import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import { applyImportPayload, previewImportPayload, processImportInbox } from './importInbox.ts';
import { LiveStore, type PromptlabData, type Category, type JobRun, type Token } from './liveStore.ts';

dotenv.config();

type CachedPromptlabData = {
  filePath: string;
  updatedAt: string;
  mtimeMs: number;
  data: PromptlabData;
  summaryTokens: Token[];
  tokensById: Map<string, Token>;
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

type CachedWebDb = {
  manifest: WebDbManifest;
  summaryTokens: Token[];
  tokenIndex: Record<string, string>;
  manifestMtimeMs: number;
  chunkCache: Map<string, Map<string, Token>>;
};

type RebuildStatus = {
  state: 'idle' | 'running' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  queued: boolean;
  currentJobId: string | null;
  recentJobs?: JobRun[];
};

type SuggestionStatus = 'pending' | 'approved' | 'rejected';

type ImportDraft = {
  id: string;
  createdAt: number;
  preview: ReturnType<typeof previewImportPayload>;
  nextData: PromptlabData;
  nextSummary: PromptlabData;
};

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
let inboxProcessingPromise: Promise<void> | null = null;
const importDrafts = new Map<string, ImportDraft>();
let rebuildStatus: RebuildStatus = {
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  error: null,
  queued: false,
  currentJobId: null,
};
let rebuildPromise: Promise<void> | null = null;
let rebuildQueued = false;

app.use(express.json({ limit: '20mb' }));

function cleanupImportDrafts() {
  const now = Date.now();
  for (const [draftId, draft] of importDrafts.entries()) {
    if (now - draft.createdAt > 1000 * 60 * 30) {
      importDrafts.delete(draftId);
    }
  }
}

function scheduleWebDbRebuild() {
  if (rebuildPromise) {
    rebuildQueued = true;
    rebuildStatus = {
      ...rebuildStatus,
      queued: true,
    };
    return rebuildPromise;
  }

  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  liveStore.createJob({
    id: jobId,
    kind: 'webdb-rebuild',
    status: 'running',
    scope: 'public-cache',
    message: 'Rebuilding read-optimized web cache',
    createdAt: startedAt,
    startedAt,
  });

  rebuildStatus = {
    state: 'running',
    startedAt,
    finishedAt: null,
    error: null,
    queued: false,
    currentJobId: jobId,
  };

  rebuildPromise = new Promise<void>((resolve) => {
    liveStore.exportToJsonFile();

    const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/generate-web-db.ts'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATA_DIR: dataDir,
      },
      stdio: 'ignore',
      windowsHide: true,
    });

    child.on('error', (error) => {
      console.error('Failed to start Web DB rebuild:', error);
      liveStore.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Web DB rebuild failed',
        finishedAt: new Date().toISOString(),
      });
      rebuildStatus = {
        state: 'error',
        startedAt: rebuildStatus.startedAt,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Web DB rebuild failed',
        queued: rebuildQueued,
        currentJobId: jobId,
      };
      rebuildPromise = null;
      if (rebuildQueued) {
        rebuildQueued = false;
        void scheduleWebDbRebuild();
      }
      resolve();
    });

    child.on('close', (code) => {
      cachedWebDb = null;
      liveStore.updateJob(jobId, {
        status: code === 0 ? 'succeeded' : 'failed',
        error: code === 0 ? undefined : `Web DB rebuild exited with code ${code}`,
        finishedAt: new Date().toISOString(),
      });
      rebuildStatus = {
        state: code === 0 ? 'idle' : 'error',
        startedAt: rebuildStatus.startedAt,
        finishedAt: new Date().toISOString(),
        error: code === 0 ? null : `Web DB rebuild exited with code ${code}`,
        queued: rebuildQueued,
        currentJobId: jobId,
      };
      rebuildPromise = null;
      if (rebuildQueued) {
        rebuildQueued = false;
        void scheduleWebDbRebuild();
      }
      resolve();
    });
  });

  return rebuildPromise;
}

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

const liveStore = new LiveStore({
  dataDir,
  resolveDataFilePath,
  readSourceData: readDataFile,
});

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

function buildSummaryData(data: PromptlabData): PromptlabData {
  return {
    categories: data.categories,
    tokens: data.tokens.map(createTokenSummary),
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
  if (Math.floor(sourceStats.mtimeMs) !== Math.floor(manifest.source.mtimeMs)) {
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

    const currentData = liveStore.getAllData();
    console.log(`Promptlab live store ready with ${currentData.tokens.length} tokens`);
  } catch (error) {
    console.error('Failed to warm Promptlab cache on startup:', error);
  }
}

function writeDataFile(data: PromptlabData) {
  liveStore.replaceAllData(normalizeData(data), {
    dataFile: path.basename(resolveDataFilePath()),
  });
  const filePath = liveStore.exportToJsonFile();
  cachedPromptlabData = null;
  cachedWebDb = null;
  return filePath;
}

async function ensureImportsProcessed() {
  if (inboxProcessingPromise) {
    await inboxProcessingPromise;
    return;
  }

  const inboxDir = path.join(dataDir, 'imports');
  if (!fs.existsSync(inboxDir)) {
    return;
  }

  const pendingFiles = fs
    .readdirSync(inboxDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .filter((name) => fs.statSync(path.join(inboxDir, name)).isFile());

  if (pendingFiles.length === 0) {
    return;
  }

  inboxProcessingPromise = (async () => {
    const jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    liveStore.createJob({
      id: jobId,
      kind: 'import-inbox',
      status: 'running',
      scope: 'filesystem-inbox',
      message: 'Processing import inbox files',
      createdAt: startedAt,
      startedAt,
    });

    try {
      const imported = await processImportInbox({
        dataDir,
        readCurrentData: () => liveStore.getAllData(),
        writeCurrentData: (data) => {
          writeDataFile(data);
        },
      });

      if (imported.length > 0) {
        const summary = imported.map((entry) => `${entry.fileName} -> ${entry.mode}`).join(', ');
        console.log(`Processed import inbox: ${summary}`);
        liveStore.updateJob(jobId, {
          status: 'succeeded',
          message: `Processed ${imported.length} import file(s): ${summary}`,
          finishedAt: new Date().toISOString(),
        });
        void scheduleWebDbRebuild();
      } else {
        liveStore.updateJob(jobId, {
          status: 'succeeded',
          message: 'No import files found',
          finishedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to process import inbox:', error);
      liveStore.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to process import inbox',
        finishedAt: new Date().toISOString(),
      });
    } finally {
      inboxProcessingPromise = null;
    }
  })();

  await inboxProcessingPromise;
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

app.get('/api/sync-status', (_req, res) => {
  res.json({
    ...rebuildStatus,
    recentJobs: liveStore.listJobs(12),
  });
});

app.get('/api/config', async (_req, res) => {
  await ensureImportsProcessed();
  const webDb = getCachedWebDb();
  const filePath = resolveDataFilePath();

  if (!fs.existsSync(filePath)) {
    const emptyData: PromptlabData = { categories: [], tokens: [] };
    fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
  }

  res.json({
    aiEnabled: Boolean(process.env.GEMINI_API_KEY),
    dataFile: liveStore.getDataFileName() || path.basename(filePath),
    rebuildStatus,
  });
});

app.get('/api/admin/jobs', requireAdmin, (_req, res) => {
  res.json({ jobs: liveStore.listJobs(50) });
});

app.get('/api/data', async (_req, res) => {
  await ensureImportsProcessed();
  const full = _req.query.full === '1';

  const webDb = getCachedWebDb();
  if (webDb && !full && rebuildStatus.state === 'idle') {
    res.json({
      categories: webDb.manifest.categories,
      tokens: webDb.summaryTokens,
      meta: {
        dataFile: liveStore.getDataFileName(),
        updatedAt: liveStore.getUpdatedAt(),
        mode: 'summary',
      },
    });
    return;
  }

  const liveData = full ? liveStore.getAllData() : liveStore.getSummaryData();
  res.json({
    categories: liveData.categories,
    tokens: liveData.tokens,
    meta: {
      dataFile: liveStore.getDataFileName(),
      updatedAt: liveStore.getUpdatedAt(),
      mode: full ? 'full' : 'summary',
    },
  });
});

app.get('/api/tokens/:id', async (req, res) => {
  await ensureImportsProcessed();
  const token = liveStore.getTokenById(req.params.id);

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

app.post('/api/admin/data', requireAdmin, async (req, res) => {
  const data = normalizeData(req.body);
  const filePath = writeDataFile(data);
  void scheduleWebDbRebuild();
  res.json({ ok: true, dataFile: path.basename(filePath), rebuildStatus });
});

app.post('/api/admin/tokens', requireAdmin, (req, res) => {
  const token = normalizeData({ categories: [], tokens: [req.body] }).tokens[0];

  if (!token?.id || !token.name) {
    res.status(400).json({ error: 'Token id and name are required' });
    return;
  }

  liveStore.upsertToken(token);
  const filePath = liveStore.exportToJsonFile();
  void scheduleWebDbRebuild();
  res.json({ ok: true, token, dataFile: path.basename(filePath), rebuildStatus });
});

app.delete('/api/admin/tokens/:id', requireAdmin, (req, res) => {
  liveStore.deleteToken(req.params.id);
  const filePath = liveStore.exportToJsonFile();
  void scheduleWebDbRebuild();
  res.json({ ok: true, dataFile: path.basename(filePath), rebuildStatus });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const category = normalizeData({ categories: [req.body], tokens: [] }).categories[0];

  if (!category?.id || !category.name) {
    res.status(400).json({ error: 'Category id and name are required' });
    return;
  }

  liveStore.upsertCategory(category);
  const filePath = liveStore.exportToJsonFile();
  void scheduleWebDbRebuild();
  res.json({ ok: true, category, dataFile: path.basename(filePath), rebuildStatus });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  liveStore.deleteCategory(req.params.id);
  const filePath = liveStore.exportToJsonFile();
  void scheduleWebDbRebuild();
  res.json({ ok: true, dataFile: path.basename(filePath), rebuildStatus });
});

app.post('/api/admin/categories/reorder', requireAdmin, (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(String) : [];

  if (orderedIds.length === 0) {
    res.status(400).json({ error: 'orderedIds are required' });
    return;
  }

  liveStore.reorderCategories(orderedIds);
  const filePath = liveStore.exportToJsonFile();
  void scheduleWebDbRebuild();
  res.json({ ok: true, dataFile: path.basename(filePath), rebuildStatus });
});

app.post('/api/admin/import/preview', requireAdmin, async (req, res) => {
  await ensureImportsProcessed();

  try {
    cleanupImportDrafts();
    const currentData = liveStore.getAllData();
    const preview = previewImportPayload(currentData, req.body);
    const nextData = applyImportPayload(currentData, req.body);
    const draftId = crypto.randomUUID();
    importDrafts.set(draftId, {
      id: draftId,
      createdAt: Date.now(),
      preview,
      nextData,
      nextSummary: buildSummaryData(nextData),
    });
    res.json({ preview, draftId });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Import preview failed' });
  }
});

app.get('/api/admin/import/drafts/:id', requireAdmin, async (req, res) => {
  await ensureImportsProcessed();
  cleanupImportDrafts();

  const draft = importDrafts.get(req.params.id);
  if (!draft) {
    res.status(404).json({ error: 'Import draft not found or expired' });
    return;
  }

  res.json({
    draftId: draft.id,
    preview: draft.preview,
    nextData: draft.nextSummary,
  });
});

app.post('/api/admin/import/apply', requireAdmin, async (req, res) => {
  await ensureImportsProcessed();

  let jobId: string | null = null;
  try {
    cleanupImportDrafts();
    let nextData: PromptlabData;
    const draftId = typeof req.body?.draftId === 'string' ? req.body.draftId : null;

    if (draftId) {
      const draft = importDrafts.get(draftId);
      if (!draft) {
        res.status(404).json({ error: 'Import draft not found or expired' });
        return;
      }
      nextData = draft.nextData;
      importDrafts.delete(draftId);
    } else {
      const currentData = liveStore.getAllData();
      nextData = applyImportPayload(currentData, req.body);
    }

    jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    liveStore.createJob({
      id: jobId,
      kind: 'import-apply',
      status: 'running',
      scope: 'admin-ui',
      message: 'Applying import payload',
      createdAt: startedAt,
      startedAt,
    });
    const filePath = writeDataFile(nextData);
    liveStore.updateJob(jobId, {
      status: 'succeeded',
      message: 'Import payload applied to live database',
      finishedAt: new Date().toISOString(),
    });
    void scheduleWebDbRebuild();
    res.json({ ok: true, dataFile: path.basename(filePath), rebuildStatus });
  } catch (error) {
    if (jobId) {
      liveStore.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Import apply failed',
        finishedAt: new Date().toISOString(),
      });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Import apply failed' });
  }
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
    app.use(
      '/webdb-assets',
      express.static(path.join(webDbDir, 'assets'), {
        maxAge: '30d',
        immutable: true,
      }),
    );
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
  ensureImportsProcessed().finally(() => warmPromptlabCache());
});
