import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

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

type CachedPromptlabData = {
  filePath: string;
  updatedAt: string;
  mtimeMs: number;
  data: PromptlabData;
  summaryTokens: Token[];
  tokensById: Map<string, Token>;
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

type CachedWebDb = {
  manifest: WebDbManifest;
  summaryTokens: Token[];
  tokenIndex: Record<string, string>;
  manifestMtimeMs: number;
  chunkCache: Map<string, Map<string, Token>>;
};

type SuggestionStatus = 'pending' | 'approved' | 'rejected';

type TokenSuggestion = {
  id: string;
  name: string;
  descriptionShort: string;
  aliases: string[];
  wordForms: string[];
  categoryIds: string[];
  examples: string[];
  note?: string;
  status: SuggestionStatus;
  createdAt: string;
  reviewedAt?: string;
};

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(currentDir, '..');
const dataDir = path.isAbsolute(process.env.DATA_DIR || '')
  ? String(process.env.DATA_DIR)
  : path.resolve(projectRoot, process.env.DATA_DIR || '..');
const suggestionFile = path.join(dataDir, 'promptlab-suggestions.json');
const webDbDir = path.join(dataDir, 'webdb');
const webDbManifestPath = path.join(webDbDir, 'manifest.json');
const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';
const serverPort = Number(process.env.PORT || 3001);
const app = express();
const sessions = new Map<string, number>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
let cachedPromptlabData: CachedPromptlabData | null = null;
let cachedWebDb: CachedWebDb | null = null;

app.use(express.json({ limit: '20mb' }));

function cleanupSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of sessions.entries()) {
    if (expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function ensureDataDirExists() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getAuthToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  cleanupSessions();
  const token = getAuthToken(req);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  sessions.set(token, Date.now() + SESSION_TTL_MS);
  next();
}

function listCandidateDataFiles() {
  ensureDataDirExists();

  if (!fs.existsSync(dataDir)) {
    return [];
  }

  return fs
    .readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .filter((name) => name !== path.basename(suggestionFile))
    .filter((name) => !name.startsWith('.'))
    .filter((name) => {
      const filePath = path.join(dataDir, name);
      return fs.statSync(filePath).isFile();
    })
    .sort((a, b) => {
      const aTime = fs.statSync(path.join(dataDir, a)).mtimeMs;
      const bTime = fs.statSync(path.join(dataDir, b)).mtimeMs;
      return bTime - aTime;
    });
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

  const normalizedTokens = tokens.map((token: any) => {
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
  });

  const normalizedCategories = categories.map((category: any) => ({
    id: String(category.id),
    name: String(category.name || ''),
    icon: category.icon ? String(category.icon) : undefined,
    parentId: category.parentId ? String(category.parentId) : undefined,
  }));

  return {
    categories: normalizedCategories,
    tokens: normalizedTokens,
  };
}

function readDataFile(): { filePath: string; data: PromptlabData } {
  ensureDataDirExists();
  const filePath = resolveDataFilePath();

  if (!fs.existsSync(filePath)) {
    const emptyData: PromptlabData = { categories: [], tokens: [] };
    fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
    return { filePath, data: emptyData };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return { filePath, data: normalizeData(parsed) };
}

function createTokenSummary(token: Token): Token {
  return {
    ...token,
    coverImage: Array.isArray(token.examples) && token.examples.length > 0 ? token.examples[0] : undefined,
    examples: [],
    exampleCount: Array.isArray(token.examples) ? token.examples.length : 0,
  };
}

function buildCachedPromptlabData(filePath: string, data: PromptlabData): CachedPromptlabData {
  const stats = fs.statSync(filePath);
  const summaryTokens = data.tokens.map(createTokenSummary);
  const tokensById = new Map(data.tokens.map((token) => [token.id, token]));

  return {
    filePath,
    updatedAt: stats.mtime.toISOString(),
    mtimeMs: stats.mtimeMs,
    data,
    summaryTokens,
    tokensById,
  };
}

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function getCachedPromptlabData(): CachedPromptlabData {
  ensureDataDirExists();
  const filePath = resolveDataFilePath();

  if (!fs.existsSync(filePath)) {
    const emptyData: PromptlabData = { categories: [], tokens: [] };
    fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
  }

  const stats = fs.statSync(filePath);

  if (
    cachedPromptlabData &&
    cachedPromptlabData.filePath === filePath &&
    cachedPromptlabData.mtimeMs === stats.mtimeMs
  ) {
    return cachedPromptlabData;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  cachedPromptlabData = buildCachedPromptlabData(filePath, normalizeData(parsed));
  return cachedPromptlabData;
}

function getCachedWebDb(): CachedWebDb | null {
  ensureDataDirExists();

  if (!fs.existsSync(webDbManifestPath)) {
    return null;
  }

  const manifestStats = fs.statSync(webDbManifestPath);
  const manifest = loadJsonFile<WebDbManifest>(webDbManifestPath);
  const sourceFilePath = path.join(dataDir, manifest.source.relativePath);

  if (!fs.existsSync(sourceFilePath)) {
    return null;
  }

  const sourceStats = fs.statSync(sourceFilePath);
  if (sourceStats.mtimeMs !== manifest.source.mtimeMs) {
    return null;
  }

  if (
    cachedWebDb &&
    cachedWebDb.manifestMtimeMs === manifestStats.mtimeMs &&
    cachedWebDb.manifest.source.mtimeMs === manifest.source.mtimeMs
  ) {
    return cachedWebDb;
  }

  const summaryFilePath = path.join(webDbDir, manifest.summaryFile);
  const tokenIndexFilePath = path.join(webDbDir, manifest.tokenIndexFile);

  if (!fs.existsSync(summaryFilePath) || !fs.existsSync(tokenIndexFilePath)) {
    return null;
  }

  cachedWebDb = {
    manifest,
    summaryTokens: loadJsonFile<{ tokens: Token[] }>(summaryFilePath).tokens,
    tokenIndex: loadJsonFile<Record<string, string>>(tokenIndexFilePath),
    manifestMtimeMs: manifestStats.mtimeMs,
    chunkCache: new Map(),
  };

  return cachedWebDb;
}

function getTokenFromWebDb(tokenId: string): Token | null {
  const webDb = getCachedWebDb();
  if (!webDb) {
    return null;
  }

  const relativeChunkPath = webDb.tokenIndex[tokenId];
  if (!relativeChunkPath) {
    return null;
  }

  let chunkTokens = webDb.chunkCache.get(relativeChunkPath);
  if (!chunkTokens) {
    const chunkFilePath = path.join(webDbDir, ...relativeChunkPath.split('/'));
    if (!fs.existsSync(chunkFilePath)) {
      return null;
    }

    const chunk = loadJsonFile<{ tokensById: Record<string, Token> }>(chunkFilePath);
    chunkTokens = new Map(Object.entries(chunk.tokensById));
    webDb.chunkCache.set(relativeChunkPath, chunkTokens);
  }

  return chunkTokens.get(tokenId) || null;
}

function warmPromptlabCache() {
  try {
    const webDb = getCachedWebDb();
    if (webDb) {
      console.log(`Promptlab Web DB ready for ${webDb.manifest.source.fileName} with ${webDb.manifest.tokenCount} tokens`);
      return;
    }

    const cachedData = getCachedPromptlabData();
    console.log(`Promptlab cache ready for ${path.basename(cachedData.filePath)} with ${cachedData.data.tokens.length} tokens`);
  } catch (error) {
    console.error('Failed to warm Promptlab cache on startup:', error);
  }
}

function writeDataFile(data: PromptlabData) {
  ensureDataDirExists();
  const filePath = resolveDataFilePath();
  fs.writeFileSync(filePath, JSON.stringify(normalizeData(data), null, 2));
  cachedPromptlabData = null;
  cachedWebDb = null;
  return filePath;
}

function readSuggestions(): TokenSuggestion[] {
  ensureDataDirExists();

  if (!fs.existsSync(suggestionFile)) {
    return [];
  }

  const raw = fs.readFileSync(suggestionFile, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeSuggestions(suggestions: TokenSuggestion[]) {
  ensureDataDirExists();
  fs.writeFileSync(suggestionFile, JSON.stringify(suggestions, null, 2));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  const webDb = getCachedWebDb();
  const filePath = webDb ? path.join(dataDir, webDb.manifest.source.relativePath) : resolveDataFilePath();

  if (!fs.existsSync(filePath)) {
    const emptyData: PromptlabData = { categories: [], tokens: [] };
    fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
  }

  res.json({
    aiEnabled: Boolean(process.env.GEMINI_API_KEY),
    dataFile: path.basename(filePath),
  });
});

app.get('/api/data', (_req, res) => {
  const full = _req.query.full === '1';

  const webDb = getCachedWebDb();
  if (webDb && !full) {
    res.json({
      categories: webDb.manifest.categories,
      tokens: webDb.summaryTokens,
      meta: {
        dataFile: webDb.manifest.source.fileName,
        updatedAt: new Date(webDb.manifest.source.mtimeMs).toISOString(),
        mode: 'summary',
      },
    });
    return;
  }

  const cachedData = getCachedPromptlabData();
  res.json({
    categories: cachedData.data.categories,
    tokens: full ? cachedData.data.tokens : cachedData.summaryTokens,
    meta: {
      dataFile: path.basename(cachedData.filePath),
      updatedAt: cachedData.updatedAt,
      mode: full ? 'full' : 'summary',
    },
  });
});

app.get('/api/tokens/:id', (req, res) => {
  const webDbToken = getTokenFromWebDb(req.params.id);
  if (webDbToken) {
    res.json({ token: webDbToken });
    return;
  }

  const cachedData = getCachedPromptlabData();
  const token = cachedData.tokensById.get(req.params.id);

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  res.json({ token });
});

app.get('/api/auth/session', (req, res) => {
  cleanupSessions();
  const token = getAuthToken(req);
  const isAdmin = Boolean(token && sessions.get(token) && sessions.get(token)! > Date.now());
  res.json({ isAdmin });
});

app.post('/api/auth/login', (req, res) => {
  const password = String(req.body?.password || '');

  if (!password || password !== adminPassword) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.json({ token });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getAuthToken(req);
  if (token) {
    sessions.delete(token);
  }
  res.json({ ok: true });
});

app.post('/api/admin/data', requireAdmin, (req, res) => {
  const data = normalizeData(req.body);
  const filePath = writeDataFile(data);
  res.json({ ok: true, dataFile: path.basename(filePath) });
});

app.get('/api/admin/suggestions', requireAdmin, (_req, res) => {
  res.json({ suggestions: readSuggestions() });
});

app.post('/api/suggestions', (req, res) => {
  const suggestion: TokenSuggestion = {
    id: crypto.randomUUID(),
    name: String(req.body?.name || '').trim(),
    descriptionShort: String(req.body?.descriptionShort || '').trim(),
    aliases: Array.isArray(req.body?.aliases) ? req.body.aliases.map(String) : [],
    wordForms: Array.isArray(req.body?.wordForms) ? req.body.wordForms.map(String) : [],
    categoryIds: Array.isArray(req.body?.categoryIds) ? req.body.categoryIds.map(String) : [],
    examples: Array.isArray(req.body?.examples) ? req.body.examples.map(String) : [],
    note: req.body?.note ? String(req.body.note) : '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (!suggestion.name) {
    res.status(400).json({ error: 'Suggestion name is required' });
    return;
  }

  const suggestions = readSuggestions();
  suggestions.unshift(suggestion);
  writeSuggestions(suggestions);
  res.json({ ok: true, suggestion });
});

app.post('/api/admin/suggestions/:id/status', requireAdmin, (req, res) => {
  const suggestionId = req.params.id;
  const status = req.body?.status as SuggestionStatus;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid suggestion status' });
    return;
  }

  const suggestions = readSuggestions();
  const suggestion = suggestions.find((item) => item.id === suggestionId);

  if (!suggestion) {
    res.status(404).json({ error: 'Suggestion not found' });
    return;
  }

  suggestion.status = status;
  suggestion.reviewedAt = new Date().toISOString();
  writeSuggestions(suggestions);
  res.json({ ok: true, suggestion });
});

if (fs.existsSync(path.join(projectRoot, 'dist'))) {
  if (fs.existsSync(path.join(webDbDir, 'assets'))) {
    app.use('/webdb-assets', express.static(path.join(webDbDir, 'assets')));
  }

  app.use(express.static(path.join(projectRoot, 'dist')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.join(projectRoot, 'dist', 'index.html'));
  });
}

app.listen(serverPort, () => {
  console.log(`Promptlab server listening on http://localhost:${serverPort}`);
  console.log(`Reading data files from ${dataDir}`);
  warmPromptlabCache();
});
