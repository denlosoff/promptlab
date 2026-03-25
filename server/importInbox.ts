import fs from 'node:fs';
import path from 'node:path';

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

type TokenImportEnvelope = {
  schemaVersion?: string;
  type: 'promptlab-token';
  categories?: Category[];
  token: Token;
};

type TokenSetImportEnvelope = {
  schemaVersion?: string;
  type: 'promptlab-token-set';
  meta?: {
    id?: string;
    name?: string;
    version?: string;
    author?: string;
    description?: string;
    syncMode?: 'merge' | 'replace-master';
  };
  categories?: Category[];
  tokens?: Token[];
  deletedTokenIds?: string[];
  deletedCategoryIds?: string[];
};

type ImportResult = {
  fileName: string;
  mode: 'merge' | 'replace-master';
  tokenCount: number;
  categoryCount: number;
  deletedTokenCount: number;
  deletedCategoryCount: number;
};

type ImportLogEntry = ImportResult & {
  importedAt: string;
  archivedAs: string;
};

export type ImportPreview = {
  mode: 'merge' | 'replace-master';
  tokenCount: number;
  categoryCount: number;
  deletedTokenCount: number;
  deletedCategoryCount: number;
  newTokenCount: number;
  updatedTokenCount: number;
  unchangedTokenCount: number;
  newCategoryCount: number;
  updatedCategoryCount: number;
  unchangedCategoryCount: number;
  nextTokenCount: number;
  nextCategoryCount: number;
  newTokens: { id: string; name: string }[];
  updatedTokens: { id: string; name: string; changedFields: string[] }[];
  deletedTokens: { id: string; name: string }[];
  newCategories: { id: string; name: string; parentId?: string }[];
  updatedCategories: { id: string; name: string; parentId?: string; changedFields: string[] }[];
  deletedCategories: { id: string; name: string; parentId?: string }[];
};

type ProcessImportInboxOptions = {
  dataDir: string;
  readCurrentData: () => PromptlabData;
  writeCurrentData: (data: PromptlabData) => void;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function assertCategoryShape(category: any, context: string) {
  if (!category || typeof category !== 'object') {
    throw new Error(`${context}: category must be an object`);
  }

  if (typeof category.id !== 'string' || !category.id.trim()) {
    throw new Error(`${context}: category.id is required`);
  }

  if (typeof category.name !== 'string' || !category.name.trim()) {
    throw new Error(`${context}: category.name is required`);
  }

  if (category.parentId !== undefined && category.parentId !== null && typeof category.parentId !== 'string') {
    throw new Error(`${context}: category.parentId must be a string when present`);
  }
}

function assertTokenShape(token: any, context: string) {
  if (!token || typeof token !== 'object') {
    throw new Error(`${context}: token must be an object`);
  }

  if (typeof token.id !== 'string' || !token.id.trim()) {
    throw new Error(`${context}: token.id is required`);
  }

  if (typeof token.name !== 'string' || !token.name.trim()) {
    throw new Error(`${context}: token.name is required`);
  }

  if (typeof token.descriptionShort !== 'string') {
    throw new Error(`${context}: token.descriptionShort must be a string`);
  }

  if (!isStringArray(token.aliases ?? [])) {
    throw new Error(`${context}: token.aliases must be an array of strings`);
  }

  if (token.wordForms !== undefined && !isStringArray(token.wordForms)) {
    throw new Error(`${context}: token.wordForms must be an array of strings`);
  }

  if (!isStringArray(token.categoryIds ?? [])) {
    throw new Error(`${context}: token.categoryIds must be an array of strings`);
  }

  if (!isStringArray(token.examples ?? [])) {
    throw new Error(`${context}: token.examples must be an array of strings`);
  }
}

function validateImportPayload(payload: any) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Import payload must be a JSON object');
  }

  if (Array.isArray(payload.categories)) {
    payload.categories.forEach((category: any, index: number) => assertCategoryShape(category, `categories[${index}]`));
  }

  if (Array.isArray(payload.tokens)) {
    payload.tokens.forEach((token: any, index: number) => assertTokenShape(token, `tokens[${index}]`));
  }

  if (payload.type === 'promptlab-token') {
    if (!payload.token) {
      throw new Error('promptlab-token import requires token');
    }
    assertTokenShape(payload.token, 'token');
    return;
  }

  if (payload.type === 'promptlab-token-set') {
    if (payload.schemaVersion && !['1.0', '1.1'].includes(String(payload.schemaVersion))) {
      throw new Error(`Unsupported promptlab-token-set schemaVersion: ${payload.schemaVersion}`);
    }

    if (payload.meta?.syncMode && !['merge', 'replace-master'].includes(String(payload.meta.syncMode))) {
      throw new Error(`Unsupported syncMode: ${payload.meta.syncMode}`);
    }

    if (payload.deletedTokenIds !== undefined && !isStringArray(payload.deletedTokenIds)) {
      throw new Error('deletedTokenIds must be an array of strings');
    }

    if (payload.deletedCategoryIds !== undefined && !isStringArray(payload.deletedCategoryIds)) {
      throw new Error('deletedCategoryIds must be an array of strings');
    }
    return;
  }

  if (Array.isArray(payload.categories) && Array.isArray(payload.tokens)) {
    return;
  }

  throw new Error('Unsupported import file format');
}

function normalizeData(input: any): PromptlabData {
  const categories = Array.isArray(input?.categories) ? input.categories : [];
  const tokens = Array.isArray(input?.tokens) ? input.tokens : [];

  return {
    categories: categories.map((category: any) => ({
      id: String(category.id),
      name: String(category.name || ''),
      icon: category.icon ? String(category.icon) : undefined,
      parentId: category.parentId ? String(category.parentId) : undefined,
    })),
    tokens: tokens.map((token: any) => ({
      id: String(token.id),
      name: String(token.name || ''),
      descriptionShort: String(token.descriptionShort || ''),
      aliases: Array.isArray(token.aliases) ? token.aliases.map(String) : [],
      wordForms: Array.isArray(token.wordForms) ? token.wordForms.map(String) : [],
      categoryIds: Array.isArray(token.categoryIds) ? token.categoryIds.map(String) : [],
      examples: Array.isArray(token.examples) ? token.examples.map(String) : [],
      exampleCount: typeof token.exampleCount === 'number' ? token.exampleCount : undefined,
      coverImage: token.coverImage ? String(token.coverImage) : undefined,
    })),
  };
}

function normalizeCategory(category: any): Category {
  return {
    id: String(category.id),
    name: String(category.name || ''),
    icon: category.icon ? String(category.icon) : undefined,
    parentId: category.parentId ? String(category.parentId) : undefined,
  };
}

function normalizeToken(token: any): Token {
  return {
    id: String(token.id),
    name: String(token.name || ''),
    descriptionShort: String(token.descriptionShort || ''),
    aliases: Array.isArray(token.aliases) ? token.aliases.map(String) : [],
    wordForms: Array.isArray(token.wordForms) ? token.wordForms.map(String) : [],
    categoryIds: Array.isArray(token.categoryIds) ? token.categoryIds.map(String) : [],
    examples: Array.isArray(token.examples) ? token.examples.map(String) : [],
    exampleCount: typeof token.exampleCount === 'number' ? token.exampleCount : undefined,
    coverImage: token.coverImage ? String(token.coverImage) : undefined,
  };
}

function upsertCategories(current: Category[], incoming: Category[]) {
  const byId = new Map(current.map((category) => [category.id, category]));
  for (const category of incoming) {
    byId.set(category.id, category);
  }
  return Array.from(byId.values());
}

function upsertTokens(current: Token[], incoming: Token[]) {
  const byId = new Map(current.map((token) => [token.id, token]));
  for (const token of incoming) {
    byId.set(token.id, token);
  }
  return Array.from(byId.values());
}

function deleteCategories(data: PromptlabData, deletedCategoryIds: string[]) {
  if (deletedCategoryIds.length === 0) {
    return data;
  }

  const ids = new Set(deletedCategoryIds);
  return {
    categories: data.categories.filter((category) => !ids.has(category.id)),
    tokens: data.tokens.map((token) => ({
      ...token,
      categoryIds: token.categoryIds.filter((categoryId) => !ids.has(categoryId)),
    })),
  };
}

function deleteTokens(data: PromptlabData, deletedTokenIds: string[]) {
  if (deletedTokenIds.length === 0) {
    return data;
  }

  const ids = new Set(deletedTokenIds);
  return {
    ...data,
    tokens: data.tokens.filter((token) => !ids.has(token.id)),
  };
}

function applyTokenImport(currentData: PromptlabData, payload: TokenImportEnvelope) {
  const incomingCategories = Array.isArray(payload.categories) ? payload.categories.map(normalizeCategory) : [];
  const incomingToken = normalizeToken(payload.token);
  const nextData = {
    categories: upsertCategories(currentData.categories, incomingCategories),
    tokens: upsertTokens(currentData.tokens, [incomingToken]),
  };

  return {
    data: nextData,
    result: {
      mode: 'merge' as const,
      tokenCount: 1,
      categoryCount: incomingCategories.length,
      deletedTokenCount: 0,
      deletedCategoryCount: 0,
    },
  };
}

function applyTokenSetImport(currentData: PromptlabData, payload: TokenSetImportEnvelope) {
  const syncMode = payload.meta?.syncMode === 'replace-master' ? 'replace-master' : 'merge';
  const incomingCategories = Array.isArray(payload.categories) ? payload.categories.map(normalizeCategory) : [];
  const incomingTokens = Array.isArray(payload.tokens) ? payload.tokens.map(normalizeToken) : [];
  const deletedTokenIds = Array.isArray(payload.deletedTokenIds) ? payload.deletedTokenIds.map(String) : [];
  const deletedCategoryIds = Array.isArray(payload.deletedCategoryIds) ? payload.deletedCategoryIds.map(String) : [];

  const replacedData =
    syncMode === 'replace-master'
      ? {
          categories: incomingCategories,
          tokens: incomingTokens,
        }
      : {
          categories: upsertCategories(currentData.categories, incomingCategories),
          tokens: upsertTokens(currentData.tokens, incomingTokens),
        };

  const withoutDeletedTokens = deleteTokens(replacedData, deletedTokenIds);
  const nextData = deleteCategories(withoutDeletedTokens, deletedCategoryIds);

  return {
    data: nextData,
    result: {
      mode: syncMode as 'merge' | 'replace-master',
      tokenCount: incomingTokens.length,
      categoryCount: incomingCategories.length,
      deletedTokenCount: deletedTokenIds.length,
      deletedCategoryCount: deletedCategoryIds.length,
    },
  };
}

function applyImportFile(currentData: PromptlabData, payload: any) {
  validateImportPayload(payload);

  if (payload?.type === 'promptlab-token' && payload?.token) {
    return applyTokenImport(currentData, payload as TokenImportEnvelope);
  }

  if (payload?.type === 'promptlab-token-set') {
    return applyTokenSetImport(currentData, payload as TokenSetImportEnvelope);
  }

  if (Array.isArray(payload?.categories) && Array.isArray(payload?.tokens)) {
    return {
      data: normalizeData(payload),
      result: {
        mode: 'replace-master' as const,
        tokenCount: Array.isArray(payload.tokens) ? payload.tokens.length : 0,
        categoryCount: Array.isArray(payload.categories) ? payload.categories.length : 0,
        deletedTokenCount: 0,
        deletedCategoryCount: 0,
      },
    };
  }
}

function categoriesEqual(a: Category, b: Category) {
  return a.id === b.id && a.name === b.name && a.icon === b.icon && a.parentId === b.parentId;
}

function tokensEqual(a: Token, b: Token) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffCategoryFields(current: Category, next: Category) {
  const changedFields: string[] = [];
  if (current.name !== next.name) changedFields.push('name');
  if (current.icon !== next.icon) changedFields.push('icon');
  if (current.parentId !== next.parentId) changedFields.push('parentId');
  return changedFields;
}

function diffTokenFields(current: Token, next: Token) {
  const changedFields: string[] = [];
  if (current.name !== next.name) changedFields.push('name');
  if (current.descriptionShort !== next.descriptionShort) changedFields.push('descriptionShort');
  if (JSON.stringify(current.aliases || []) !== JSON.stringify(next.aliases || [])) changedFields.push('aliases');
  if (JSON.stringify(current.wordForms || []) !== JSON.stringify(next.wordForms || [])) changedFields.push('wordForms');
  if (JSON.stringify(current.categoryIds || []) !== JSON.stringify(next.categoryIds || [])) changedFields.push('categoryIds');
  if (JSON.stringify(current.examples || []) !== JSON.stringify(next.examples || [])) changedFields.push('examples');
  return changedFields;
}

export function previewImportPayload(currentDataInput: PromptlabData, payload: any): ImportPreview {
  const currentData = normalizeData(currentDataInput);
  const applied = applyImportFile(currentData, payload);
  const nextData = normalizeData(applied.data);

  const currentTokensById = new Map(currentData.tokens.map((token) => [token.id, token]));
  const currentCategoriesById = new Map(currentData.categories.map((category) => [category.id, category]));
  const nextTokensById = new Map(nextData.tokens.map((token) => [token.id, token]));
  const nextCategoriesById = new Map(nextData.categories.map((category) => [category.id, category]));

  let newTokenCount = 0;
  let updatedTokenCount = 0;
  let unchangedTokenCount = 0;
  const newTokens: { id: string; name: string }[] = [];
  const updatedTokens: { id: string; name: string; changedFields: string[] }[] = [];

  for (const token of nextData.tokens) {
    const existing = currentTokensById.get(token.id);
    if (!existing) {
      newTokenCount += 1;
      newTokens.push({ id: token.id, name: token.name });
      continue;
    }

    if (tokensEqual(existing, token)) {
      unchangedTokenCount += 1;
    } else {
      updatedTokenCount += 1;
      updatedTokens.push({ id: token.id, name: token.name, changedFields: diffTokenFields(existing, token) });
    }
  }

  let newCategoryCount = 0;
  let updatedCategoryCount = 0;
  let unchangedCategoryCount = 0;
  const newCategories: { id: string; name: string; parentId?: string }[] = [];
  const updatedCategories: { id: string; name: string; parentId?: string; changedFields: string[] }[] = [];

  for (const category of nextData.categories) {
    const existing = currentCategoriesById.get(category.id);
    if (!existing) {
      newCategoryCount += 1;
      newCategories.push({ id: category.id, name: category.name, parentId: category.parentId });
      continue;
    }

    if (categoriesEqual(existing, category)) {
      unchangedCategoryCount += 1;
    } else {
      updatedCategoryCount += 1;
      updatedCategories.push({
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        changedFields: diffCategoryFields(existing, category),
      });
    }
  }

  const deletedTokens = currentData.tokens
    .filter((token) => !nextTokensById.has(token.id))
    .map((token) => ({ id: token.id, name: token.name }));
  const deletedCategories = currentData.categories
    .filter((category) => !nextCategoriesById.has(category.id))
    .map((category) => ({ id: category.id, name: category.name, parentId: category.parentId }));
  const deletedTokenCount = deletedTokens.length;
  const deletedCategoryCount = deletedCategories.length;

  return {
    mode: applied.result.mode,
    tokenCount: applied.result.tokenCount,
    categoryCount: applied.result.categoryCount,
    deletedTokenCount: Math.max(applied.result.deletedTokenCount, deletedTokenCount),
    deletedCategoryCount: Math.max(applied.result.deletedCategoryCount, deletedCategoryCount),
    newTokenCount,
    updatedTokenCount,
    unchangedTokenCount,
    newCategoryCount,
    updatedCategoryCount,
    unchangedCategoryCount,
    nextTokenCount: nextData.tokens.length,
    nextCategoryCount: nextData.categories.length,
    newTokens,
    updatedTokens,
    deletedTokens,
    newCategories,
    updatedCategories,
    deletedCategories,
  };
}

export function applyImportPayload(currentDataInput: PromptlabData, payload: any) {
  return normalizeData(applyImportFile(normalizeData(currentDataInput), payload).data);
}

export async function processImportInbox({ dataDir, readCurrentData, writeCurrentData }: ProcessImportInboxOptions) {
  const inboxDir = path.join(dataDir, 'imports');
  const processedDir = path.join(inboxDir, 'processed');
  const logFilePath = path.join(processedDir, 'import-log.json');

  fs.mkdirSync(inboxDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });

  const files = fs
    .readdirSync(inboxDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => ({
      name,
      path: path.join(inboxDir, name),
      stats: fs.statSync(path.join(inboxDir, name)),
    }))
    .filter((entry) => entry.stats.isFile())
    .sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs);

  if (files.length === 0) {
    return [] as ImportLogEntry[];
  }

  let workingData = normalizeData(readCurrentData());
  const logEntries: ImportLogEntry[] = fs.existsSync(logFilePath)
    ? JSON.parse(fs.readFileSync(logFilePath, 'utf8'))
    : [];
  const newEntries: ImportLogEntry[] = [];

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(file.path, 'utf8'));
    const applied = applyImportFile(workingData, payload);
    workingData = normalizeData(applied.data);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedAs = `${path.basename(file.name, '.json')}--${timestamp}.json`;
    fs.renameSync(file.path, path.join(processedDir, archivedAs));

    newEntries.push({
      fileName: file.name,
      archivedAs,
      importedAt: new Date().toISOString(),
      ...applied.result,
    });
  }

  writeCurrentData(workingData);

  fs.writeFileSync(logFilePath, JSON.stringify([...newEntries, ...logEntries].slice(0, 100), null, 2));
  return newEntries;
}
