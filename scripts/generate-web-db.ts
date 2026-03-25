import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

type PromptlabData = {
  categories: Category[];
  tokens: Token[];
};

type WebDbManifest = {
  schemaVersion: '1.0';
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

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(currentDir, '..');
const dataDir = path.isAbsolute(process.env.DATA_DIR || '')
  ? String(process.env.DATA_DIR)
  : path.resolve(projectRoot, process.env.DATA_DIR || '..');
const webDbDir = path.join(dataDir, 'webdb');
const webDbManifestPath = path.join(webDbDir, 'manifest.json');
const chunkSize = 100;
const publicAssetBasePath = '/webdb-assets';

function ensureDataDirExists() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function listCandidateDataFiles() {
  ensureDataDirExists();

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

function resolveDataFilePath() {
  if (process.env.DATA_FILE) {
    return path.isAbsolute(process.env.DATA_FILE)
      ? process.env.DATA_FILE
      : path.resolve(projectRoot, process.env.DATA_FILE);
  }

  const candidates = listCandidateDataFiles().filter((name) => name.startsWith('promptlab-data'));
  const fallbackCandidates = candidates.length > 0 ? candidates : listCandidateDataFiles();
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
    coverImage: token.examples.length > 0 ? token.examples[0] : undefined,
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

function materializeTokenExamples(token: Token, assetDir: string): Token {
  const examples = token.examples.map((example, index) => {
    const asset = getAssetInfo(example, token.id, index);
    if (!asset) {
      return example;
    }

    const assetPath = path.join(assetDir, asset.fileName);
    if (!fs.existsSync(assetPath)) {
      fs.writeFileSync(assetPath, asset.buffer);
    }

    return `${publicAssetBasePath}/${asset.fileName}`;
  });

  return {
    ...token,
    examples,
  };
}

function isUpToDate(sourceFilePath: string) {
  if (!fs.existsSync(webDbManifestPath)) {
    return false;
  }

  const sourceStats = fs.statSync(sourceFilePath);
  const manifest = JSON.parse(fs.readFileSync(webDbManifestPath, 'utf8')) as WebDbManifest;

  return (
    manifest.source.fileName === path.basename(sourceFilePath) &&
    Math.floor(manifest.source.mtimeMs) === Math.floor(sourceStats.mtimeMs) &&
    fs.existsSync(path.join(webDbDir, manifest.summaryFile)) &&
    fs.existsSync(path.join(webDbDir, manifest.tokenIndexFile))
  );
}

function writeJson(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function main() {
  ensureDataDirExists();
  const sourceFilePath = resolveDataFilePath();

  if (!fs.existsSync(sourceFilePath)) {
    const emptyData: PromptlabData = { categories: [], tokens: [] };
    fs.writeFileSync(sourceFilePath, JSON.stringify(emptyData, null, 2));
  }

  if (isUpToDate(sourceFilePath)) {
    console.log(`Web DB is up to date for ${path.basename(sourceFilePath)}`);
    return;
  }

  console.log(`Generating Web DB from ${sourceFilePath} ...`);

  const sourceStats = fs.statSync(sourceFilePath);
  const parsed = JSON.parse(fs.readFileSync(sourceFilePath, 'utf8'));
  const data = normalizeData(parsed);
  const tokenIndex: Record<string, string> = {};
  const tempDir = `${webDbDir}.tmp`;
  const chunkDirName = 'token-chunks';
  const assetDirName = 'assets';
  const chunkDir = path.join(tempDir, chunkDirName);
  const assetDir = path.join(tempDir, assetDirName);

  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(chunkDir, { recursive: true });
  fs.mkdirSync(assetDir, { recursive: true });

  const materializedTokens = data.tokens.map((token) => materializeTokenExamples(token, assetDir));
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
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    source: {
      fileName: path.basename(sourceFilePath),
      relativePath: path.relative(dataDir, sourceFilePath).replace(/\\/g, '/'),
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

  fs.rmSync(webDbDir, { recursive: true, force: true });
  fs.renameSync(tempDir, webDbDir);

  console.log(`Web DB ready: ${data.tokens.length} tokens, ${data.categories.length} categories`);
}

main();
