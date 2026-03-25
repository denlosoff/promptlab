import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type Category = {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
};

type Token = {
  id: string;
  name: string;
  descriptionShort: string;
  aliases: string[];
  wordForms?: string[];
  categoryIds: string[];
  examples: string[];
  exampleCount?: number;
  coverImage?: string;
};

type MaterializedToken = Token & {
  coverImage?: string;
};

type PromptlabData = {
  categories: Category[];
  tokens: Token[];
};

type WebDbManifest = {
  schemaVersion: '1.1';
  generatedAt: string;
  source: {
    fileName: string;
    relativePath: string;
    mtimeMs: number;
    sizeBytes: number;
  };
  categoryCount: number;
  tokenCount: number;
  categories: Category[];
  summaryFile: string;
  tokenIndexFile: string;
  chunkDir: string;
  assetDir: string;
  chunkSize: number;
};

const chunkSize = 100;
const publicAssetBasePath = '/webdb-assets';
const webDbSchemaVersion = '1.1';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(currentDir, '..');

type GenerateWebDbContext = {
  dataDir: string;
  webDbDir: string;
  webDbManifestPath: string;
};

function resolveDataDir() {
  return path.isAbsolute(process.env.DATA_DIR || '')
    ? String(process.env.DATA_DIR)
    : path.resolve(projectRoot, process.env.DATA_DIR || '..');
}

function createContext(dataDir = resolveDataDir()): GenerateWebDbContext {
  const webDbDir = path.join(dataDir, 'webdb');
  return {
    dataDir,
    webDbDir,
    webDbManifestPath: path.join(webDbDir, 'manifest.json'),
  };
}

function ensureDataDirExists(dataDir: string) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function listCandidateDataFiles(dataDir: string) {
  ensureDataDirExists(dataDir);

  return fs
    .readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .filter((name) => name !== 'promptlab-suggestions.json')
    .filter((name) => name !== 'manifest.json')
    .filter((name) => !name.startsWith('.'))
    .filter((name) => {
      const filePath = path.join(dataDir, name);
      return fs.statSync(filePath).isFile();
    })
    .sort((a, b) => fs.statSync(path.join(dataDir, b)).mtimeMs - fs.statSync(path.join(dataDir, a)).mtimeMs);
}

function resolveDataFilePath(dataDir: string) {
  if (process.env.DATA_FILE) {
    return path.isAbsolute(process.env.DATA_FILE)
      ? process.env.DATA_FILE
      : path.resolve(projectRoot, process.env.DATA_FILE);
  }

  const candidates = listCandidateDataFiles(dataDir).filter((name) => name.startsWith('promptlab-data'));
  const fallbackCandidates = candidates.length > 0 ? candidates : listCandidateDataFiles(dataDir);
  const fileName = fallbackCandidates[0] || 'promptlab-data.json';
  return path.join(dataDir, fileName);
}

function normalizeData(input: any): PromptlabData {
  let categories = Array.isArray(input?.categories) ? input.categories : [];
  let tokens = Array.isArray(input?.tokens) ? input.tokens : [];

  if (Array.isArray(input?.facets)) {
    categories = [
      ...categories,
      ...input.facets.map((facet: any) => ({
        id: String(facet.id),
        name: String(facet.name),
        parentId: facet.categoryId ? String(facet.categoryId) : undefined,
      })),
    ];
  }

  if (Array.isArray(input?.facetValues)) {
    categories = [
      ...categories,
      ...input.facetValues.map((value: any) => ({
        id: String(value.id),
        name: String(value.name),
        parentId: value.facetId ? String(value.facetId) : undefined,
      })),
    ];
  }

  return {
    categories: categories.map((category: any) => ({
      id: String(category.id),
      name: String(category.name || ''),
      icon: category.icon ? String(category.icon) : undefined,
      parentId: category.parentId ? String(category.parentId) : undefined,
    })),
    tokens: tokens.map((token: any) => {
      const categoryIds = new Set<string>((token.categoryIds || []).map(String));

      if (Array.isArray(token.facetValueIds)) {
        for (const facetValueId of token.facetValueIds) {
          categoryIds.add(String(facetValueId));
        }
      }

      return {
        id: String(token.id),
        name: String(token.name || ''),
        descriptionShort: String(token.descriptionShort || ''),
        aliases: Array.isArray(token.aliases) ? token.aliases.map(String) : [],
        wordForms: Array.isArray(token.wordForms) ? token.wordForms.map(String) : [],
        categoryIds: [...categoryIds],
        examples: Array.isArray(token.examples) ? token.examples.map(String) : [],
      };
    }),
  };
}

function createTokenSummary(token: Token): Token {
  return {
    id: token.id,
    name: token.name,
    descriptionShort: token.descriptionShort,
    aliases: token.aliases,
    categoryIds: token.categoryIds,
    coverImage: token.coverImage || (token.examples.length > 0 ? token.examples[0] : undefined),
    examples: [],
    exampleCount: token.examples.length,
  };
}

function getAssetInfo(example: string, tokenId: string, index: number) {
  const match = example.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const base64Payload = match[2];
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const hash = crypto.createHash('sha1').update(base64Payload).digest('hex').slice(0, 16);

  return {
    fileName: `${tokenId}-${String(index + 1).padStart(2, '0')}-${hash}.${extension}`,
    mimeType,
    buffer: Buffer.from(base64Payload, 'base64'),
  };
}

function isRasterMimeType(mimeType: string) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff'].includes(mimeType);
}

async function writeOptimizedAsset(assetPath: string, inputBuffer: Buffer) {
  if (fs.existsSync(assetPath)) {
    return true;
  }

  try {
    const optimized = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();

    fs.writeFileSync(assetPath, optimized);
    return true;
  } catch {
    return false;
  }
}

async function writeCoverAsset(assetPath: string, inputBuffer: Buffer) {
  if (fs.existsSync(assetPath)) {
    return true;
  }

  try {
    const optimized = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 640, height: 640, fit: 'cover', position: 'attention' })
      .webp({ quality: 68, effort: 4 })
      .toBuffer();

    fs.writeFileSync(assetPath, optimized);
    return true;
  } catch {
    return false;
  }
}

async function materializeTokenExamples(token: Token, assetDir: string): Promise<MaterializedToken> {
  let coverImage: string | undefined;
  const examples = await Promise.all(
    token.examples.map(async (example, index) => {
      const asset = getAssetInfo(example, token.id, index);
      if (!asset) {
        if (index === 0) {
          coverImage = example;
        }
        return example;
      }

      if (!isRasterMimeType(asset.mimeType)) {
        const passthroughPath = path.join(assetDir, asset.fileName);
        if (!fs.existsSync(passthroughPath)) {
          fs.writeFileSync(passthroughPath, asset.buffer);
        }

        const publicPath = `${publicAssetBasePath}/${asset.fileName}`;
        if (index === 0) {
          coverImage = publicPath;
        }
        return publicPath;
      }

      const optimizedFileName = asset.fileName.replace(/\.[^.]+$/, '.webp');
      const optimizedOk = await writeOptimizedAsset(path.join(assetDir, optimizedFileName), asset.buffer);
      const optimizedPublicPath = optimizedOk ? `${publicAssetBasePath}/${optimizedFileName}` : `${publicAssetBasePath}/${asset.fileName}`;

      if (!optimizedOk) {
        const passthroughPath = path.join(assetDir, asset.fileName);
        if (!fs.existsSync(passthroughPath)) {
          fs.writeFileSync(passthroughPath, asset.buffer);
        }
      }

      if (index === 0) {
        const coverFileName = optimizedFileName.replace(/\.webp$/, '-cover.webp');
        const coverOk = await writeCoverAsset(path.join(assetDir, coverFileName), asset.buffer);
        coverImage = coverOk ? `${publicAssetBasePath}/${coverFileName}` : optimizedPublicPath;
      }

      return optimizedPublicPath;
    }),
  );

  return {
    ...token,
    examples,
    coverImage,
  };
}

function isUpToDate(context: GenerateWebDbContext, sourceFilePath: string) {
  if (!fs.existsSync(context.webDbManifestPath)) {
    return false;
  }

  const sourceStats = fs.statSync(sourceFilePath);
  const manifest = JSON.parse(fs.readFileSync(context.webDbManifestPath, 'utf8')) as WebDbManifest;

  return (
    manifest.schemaVersion === webDbSchemaVersion &&
    manifest.source.fileName === path.basename(sourceFilePath) &&
    Math.floor(manifest.source.mtimeMs) === Math.floor(sourceStats.mtimeMs) &&
    fs.existsSync(path.join(context.webDbDir, manifest.summaryFile)) &&
    fs.existsSync(path.join(context.webDbDir, manifest.tokenIndexFile))
  );
}

function writeJson(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

export async function generateWebDb(dataDir = resolveDataDir()) {
  const context = createContext(dataDir);
  ensureDataDirExists(context.dataDir);
  const sourceFilePath = resolveDataFilePath(context.dataDir);

  if (!fs.existsSync(sourceFilePath)) {
    const emptyData: PromptlabData = { categories: [], tokens: [] };
    fs.writeFileSync(sourceFilePath, JSON.stringify(emptyData, null, 2));
  }

  if (isUpToDate(context, sourceFilePath)) {
    console.log(`Web DB is up to date for ${path.basename(sourceFilePath)}`);
    return;
  }

  console.log(`Generating Web DB from ${sourceFilePath} ...`);

  const sourceStats = fs.statSync(sourceFilePath);
  const parsed = JSON.parse(fs.readFileSync(sourceFilePath, 'utf8'));
  const data = normalizeData(parsed);
  const tokenIndex: Record<string, string> = {};
  const tempDir = `${context.webDbDir}.tmp`;
  const chunkDirName = 'token-chunks';
  const assetDirName = 'assets';
  const chunkDir = path.join(tempDir, chunkDirName);
  const assetDir = path.join(tempDir, assetDirName);

  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(chunkDir, { recursive: true });
  fs.mkdirSync(assetDir, { recursive: true });

  const materializedTokens = await Promise.all(data.tokens.map((token) => materializeTokenExamples(token, assetDir)));
  const summaryTokens = materializedTokens.map(createTokenSummary);

  writeJson(path.join(tempDir, 'summary.json'), { tokens: summaryTokens });

  for (let index = 0; index < materializedTokens.length; index += chunkSize) {
    const chunkTokens = materializedTokens.slice(index, index + chunkSize);
    const chunkFileName = `chunk-${String(index / chunkSize + 1).padStart(4, '0')}.json`;
    const tokensById = Object.fromEntries(chunkTokens.map((token) => [token.id, token]));

    for (const token of chunkTokens) {
      tokenIndex[token.id] = path.posix.join(chunkDirName, chunkFileName);
    }

    writeJson(path.join(chunkDir, chunkFileName), { tokensById });
  }

  writeJson(path.join(tempDir, 'token-index.json'), tokenIndex);

  const manifest: WebDbManifest = {
    schemaVersion: webDbSchemaVersion,
    generatedAt: new Date().toISOString(),
    source: {
      fileName: path.basename(sourceFilePath),
      relativePath: path.relative(context.dataDir, sourceFilePath).replace(/\\/g, '/'),
      mtimeMs: Math.floor(sourceStats.mtimeMs),
      sizeBytes: sourceStats.size,
    },
    categoryCount: data.categories.length,
    tokenCount: data.tokens.length,
    categories: data.categories,
    summaryFile: 'summary.json',
    tokenIndexFile: 'token-index.json',
    chunkDir: chunkDirName,
    assetDir: assetDirName,
    chunkSize,
  };

  writeJson(path.join(tempDir, 'manifest.json'), manifest);

  fs.rmSync(context.webDbDir, { recursive: true, force: true });
  fs.renameSync(tempDir, context.webDbDir);

  console.log(`Web DB ready: ${data.tokens.length} tokens, ${data.categories.length} categories`);
}

async function main() {
  await generateWebDb();
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === currentFilePath;

if (isDirectRun) {
  main().catch((error) => {
    console.error('Failed to generate Web DB:', error);
    process.exitCode = 1;
  });
}
