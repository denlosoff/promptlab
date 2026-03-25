import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Category = {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
};

export type Token = {
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

export type PromptlabData = {
  categories: Category[];
  tokens: Token[];
};

type LiveStoreOptions = {
  dataDir: string;
  resolveDataFilePath: () => string;
  readSourceData: () => { filePath: string; data: PromptlabData };
};

type PersistMeta = {
  dataFile?: string;
  sourceMtimeMs?: number;
};

export type JobKind = 'webdb-rebuild' | 'import-inbox' | 'import-apply';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type JobRun = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  scope?: string;
  message?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export class LiveStore {
  private db: Database.Database;
  private dataDir: string;
  private resolveDataFilePath: () => string;
  private readSourceData: () => { filePath: string; data: PromptlabData };

  constructor({ dataDir, resolveDataFilePath, readSourceData }: LiveStoreOptions) {
    this.dataDir = dataDir;
    this.resolveDataFilePath = resolveDataFilePath;
    this.readSourceData = readSourceData;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.db = new Database(path.join(this.dataDir, 'promptlab-live.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.createSchema();
    this.bootstrap();
  }

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        parent_id TEXT,
        sort_index INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description_short TEXT NOT NULL,
        sort_index INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS token_aliases (
        token_id TEXT NOT NULL,
        value TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        PRIMARY KEY (token_id, sort_index)
      );

      CREATE TABLE IF NOT EXISTS token_word_forms (
        token_id TEXT NOT NULL,
        value TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        PRIMARY KEY (token_id, sort_index)
      );

      CREATE TABLE IF NOT EXISTS token_examples (
        token_id TEXT NOT NULL,
        value TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        PRIMARY KEY (token_id, sort_index)
      );

      CREATE TABLE IF NOT EXISTS token_categories (
        token_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        PRIMARY KEY (token_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS job_runs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        scope TEXT,
        message TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
    `);
  }

  private getMeta(key: string) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  private setMeta(key: string, value: string) {
    this.db.prepare(`
      INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  private bootstrap() {
    const tokenCountRow = this.db.prepare('SELECT COUNT(*) AS count FROM tokens').get() as { count: number };
    const sourceFilePath = this.resolveDataFilePath();
    const sourceExists = fs.existsSync(sourceFilePath);
    const sourceMtimeMs = sourceExists ? fs.statSync(sourceFilePath).mtimeMs : 0;
    const storedSourceMtimeMs = Number(this.getMeta('source_mtime_ms') || '0');

    if (tokenCountRow.count === 0 || (sourceExists && Math.floor(sourceMtimeMs) > Math.floor(storedSourceMtimeMs))) {
      const { filePath, data } = this.readSourceData();
      const fileMtimeMs = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : Date.now();
      this.replaceAllData(data, {
        dataFile: path.basename(filePath),
        sourceMtimeMs: fileMtimeMs,
      });
    }
  }

  replaceAllData(data: PromptlabData, meta: PersistMeta = {}) {
    const writeAll = this.db.transaction((input: PromptlabData) => {
      this.db.prepare('DELETE FROM token_categories').run();
      this.db.prepare('DELETE FROM token_examples').run();
      this.db.prepare('DELETE FROM token_word_forms').run();
      this.db.prepare('DELETE FROM token_aliases').run();
      this.db.prepare('DELETE FROM tokens').run();
      this.db.prepare('DELETE FROM categories').run();

      const insertCategory = this.db.prepare(`
        INSERT INTO categories (id, name, icon, parent_id, sort_index)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertToken = this.db.prepare(`
        INSERT INTO tokens (id, name, description_short, sort_index)
        VALUES (?, ?, ?, ?)
      `);
      const insertAlias = this.db.prepare(`
        INSERT INTO token_aliases (token_id, value, sort_index)
        VALUES (?, ?, ?)
      `);
      const insertWordForm = this.db.prepare(`
        INSERT INTO token_word_forms (token_id, value, sort_index)
        VALUES (?, ?, ?)
      `);
      const insertExample = this.db.prepare(`
        INSERT INTO token_examples (token_id, value, sort_index)
        VALUES (?, ?, ?)
      `);
      const insertTokenCategory = this.db.prepare(`
        INSERT INTO token_categories (token_id, category_id, sort_index)
        VALUES (?, ?, ?)
      `);

      input.categories.forEach((category, index) => {
        insertCategory.run(category.id, category.name, category.icon || null, category.parentId || null, index);
      });

      input.tokens.forEach((token, index) => {
        insertToken.run(token.id, token.name, token.descriptionShort, index);
        (token.aliases || []).forEach((alias, aliasIndex) => insertAlias.run(token.id, alias, aliasIndex));
        (token.wordForms || []).forEach((wordForm, wordFormIndex) => insertWordForm.run(token.id, wordForm, wordFormIndex));
        (token.examples || []).forEach((example, exampleIndex) => insertExample.run(token.id, example, exampleIndex));
        (token.categoryIds || []).forEach((categoryId, categoryIndex) => insertTokenCategory.run(token.id, categoryId, categoryIndex));
      });
    });

    writeAll(data);
    this.setMeta('updated_at', new Date().toISOString());
    this.setMeta('data_file', meta.dataFile || path.basename(this.resolveDataFilePath()));
    if (typeof meta.sourceMtimeMs === 'number') {
      this.setMeta('source_mtime_ms', String(meta.sourceMtimeMs));
    }
  }

  getAllData(): PromptlabData {
    const categories = this.db.prepare(`
      SELECT id, name, icon, parent_id AS parentId
      FROM categories
      ORDER BY sort_index ASC, id ASC
    `).all() as Category[];

    const tokenRows = this.db.prepare(`
      SELECT id, name, description_short AS descriptionShort
      FROM tokens
      ORDER BY sort_index ASC, id ASC
    `).all() as Array<{ id: string; name: string; descriptionShort: string }>;

    const aliasRows = this.db.prepare(`
      SELECT token_id AS tokenId, value
      FROM token_aliases
      ORDER BY token_id ASC, sort_index ASC
    `).all() as Array<{ tokenId: string; value: string }>;

    const wordFormRows = this.db.prepare(`
      SELECT token_id AS tokenId, value
      FROM token_word_forms
      ORDER BY token_id ASC, sort_index ASC
    `).all() as Array<{ tokenId: string; value: string }>;

    const exampleRows = this.db.prepare(`
      SELECT token_id AS tokenId, value
      FROM token_examples
      ORDER BY token_id ASC, sort_index ASC
    `).all() as Array<{ tokenId: string; value: string }>;

    const tokenCategoryRows = this.db.prepare(`
      SELECT token_id AS tokenId, category_id AS categoryId
      FROM token_categories
      ORDER BY token_id ASC, sort_index ASC
    `).all() as Array<{ tokenId: string; categoryId: string }>;

    const aliasesByToken = new Map<string, string[]>();
    const wordFormsByToken = new Map<string, string[]>();
    const examplesByToken = new Map<string, string[]>();
    const categoryIdsByToken = new Map<string, string[]>();

    aliasRows.forEach((row) => {
      aliasesByToken.set(row.tokenId, [...(aliasesByToken.get(row.tokenId) || []), row.value]);
    });
    wordFormRows.forEach((row) => {
      wordFormsByToken.set(row.tokenId, [...(wordFormsByToken.get(row.tokenId) || []), row.value]);
    });
    exampleRows.forEach((row) => {
      examplesByToken.set(row.tokenId, [...(examplesByToken.get(row.tokenId) || []), row.value]);
    });
    tokenCategoryRows.forEach((row) => {
      categoryIdsByToken.set(row.tokenId, [...(categoryIdsByToken.get(row.tokenId) || []), row.categoryId]);
    });

    const tokens: Token[] = tokenRows.map((row) => ({
      id: row.id,
      name: row.name,
      descriptionShort: row.descriptionShort,
      aliases: aliasesByToken.get(row.id) || [],
      wordForms: wordFormsByToken.get(row.id) || [],
      categoryIds: categoryIdsByToken.get(row.id) || [],
      examples: examplesByToken.get(row.id) || [],
    }));

    return { categories, tokens };
  }

  getSummaryData(): PromptlabData {
    const fullData = this.getAllData();
    return {
      categories: fullData.categories,
      tokens: fullData.tokens.map((token) => ({
        ...token,
        coverImage: token.examples[0],
        exampleCount: token.examples.length,
        examples: [],
      })),
    };
  }

  getTokenById(tokenId: string): Token | null {
    return this.getAllData().tokens.find((token) => token.id === tokenId) || null;
  }

  exportToJsonFile() {
    const filePath = this.resolveDataFilePath();
    const data = this.getAllData();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    this.setMeta('data_file', path.basename(filePath));
    this.setMeta('source_mtime_ms', String(fs.statSync(filePath).mtimeMs));
    this.setMeta('updated_at', new Date().toISOString());
    return filePath;
  }

  getDataFileName() {
    return this.getMeta('data_file') || path.basename(this.resolveDataFilePath());
  }

  getUpdatedAt() {
    return this.getMeta('updated_at') || new Date(0).toISOString();
  }

  createJob(job: JobRun) {
    this.db.prepare(`
      INSERT INTO job_runs (id, kind, status, scope, message, error, created_at, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.kind,
      job.status,
      job.scope || null,
      job.message || null,
      job.error || null,
      job.createdAt,
      job.startedAt || null,
      job.finishedAt || null,
    );
  }

  updateJob(jobId: string, updates: Partial<JobRun>) {
    const current = this.db.prepare(`
      SELECT
        id,
        kind,
        status,
        scope,
        message,
        error,
        created_at AS createdAt,
        started_at AS startedAt,
        finished_at AS finishedAt
      FROM job_runs
      WHERE id = ?
    `).get(jobId) as JobRun | undefined;

    if (!current) {
      return;
    }

    const nextJob: JobRun = {
      ...current,
      ...updates,
    };

    this.db.prepare(`
      UPDATE job_runs
      SET kind = ?, status = ?, scope = ?, message = ?, error = ?, created_at = ?, started_at = ?, finished_at = ?
      WHERE id = ?
    `).run(
      nextJob.kind,
      nextJob.status,
      nextJob.scope || null,
      nextJob.message || null,
      nextJob.error || null,
      nextJob.createdAt,
      nextJob.startedAt || null,
      nextJob.finishedAt || null,
      jobId,
    );
  }

  listJobs(limit = 20): JobRun[] {
    return this.db.prepare(`
      SELECT
        id,
        kind,
        status,
        scope,
        message,
        error,
        created_at AS createdAt,
        started_at AS startedAt,
        finished_at AS finishedAt
      FROM job_runs
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `).all(limit) as JobRun[];
  }

  upsertToken(token: Token) {
    const writeToken = this.db.transaction((nextToken: Token) => {
      const tokenRow = this.db.prepare('SELECT sort_index AS sortIndex FROM tokens WHERE id = ?').get(nextToken.id) as { sortIndex: number } | undefined;
      const maxSortRow = this.db.prepare('SELECT COALESCE(MAX(sort_index), -1) AS maxSortIndex FROM tokens').get() as { maxSortIndex: number };
      const sortIndex = tokenRow?.sortIndex ?? (maxSortRow.maxSortIndex + 1);

      this.db.prepare(`
        INSERT INTO tokens (id, name, description_short, sort_index)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description_short = excluded.description_short
      `).run(nextToken.id, nextToken.name, nextToken.descriptionShort, sortIndex);

      this.db.prepare('DELETE FROM token_aliases WHERE token_id = ?').run(nextToken.id);
      this.db.prepare('DELETE FROM token_word_forms WHERE token_id = ?').run(nextToken.id);
      this.db.prepare('DELETE FROM token_examples WHERE token_id = ?').run(nextToken.id);
      this.db.prepare('DELETE FROM token_categories WHERE token_id = ?').run(nextToken.id);

      const insertAlias = this.db.prepare('INSERT INTO token_aliases (token_id, value, sort_index) VALUES (?, ?, ?)');
      const insertWordForm = this.db.prepare('INSERT INTO token_word_forms (token_id, value, sort_index) VALUES (?, ?, ?)');
      const insertExample = this.db.prepare('INSERT INTO token_examples (token_id, value, sort_index) VALUES (?, ?, ?)');
      const insertCategory = this.db.prepare('INSERT INTO token_categories (token_id, category_id, sort_index) VALUES (?, ?, ?)');

      (nextToken.aliases || []).forEach((alias, index) => insertAlias.run(nextToken.id, alias, index));
      (nextToken.wordForms || []).forEach((wordForm, index) => insertWordForm.run(nextToken.id, wordForm, index));
      (nextToken.examples || []).forEach((example, index) => insertExample.run(nextToken.id, example, index));
      (nextToken.categoryIds || []).forEach((categoryId, index) => insertCategory.run(nextToken.id, categoryId, index));
    });

    writeToken(token);
    this.setMeta('updated_at', new Date().toISOString());
  }

  deleteToken(tokenId: string) {
    const removeToken = this.db.transaction((id: string) => {
      this.db.prepare('DELETE FROM token_categories WHERE token_id = ?').run(id);
      this.db.prepare('DELETE FROM token_examples WHERE token_id = ?').run(id);
      this.db.prepare('DELETE FROM token_word_forms WHERE token_id = ?').run(id);
      this.db.prepare('DELETE FROM token_aliases WHERE token_id = ?').run(id);
      this.db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
    });

    removeToken(tokenId);
    this.setMeta('updated_at', new Date().toISOString());
  }

  upsertCategory(category: Category) {
    const writeCategory = this.db.transaction((nextCategory: Category) => {
      const categoryRow = this.db.prepare('SELECT sort_index AS sortIndex FROM categories WHERE id = ?').get(nextCategory.id) as { sortIndex: number } | undefined;
      const maxSortRow = this.db.prepare('SELECT COALESCE(MAX(sort_index), -1) AS maxSortIndex FROM categories').get() as { maxSortIndex: number };
      const sortIndex = categoryRow?.sortIndex ?? (maxSortRow.maxSortIndex + 1);

      this.db.prepare(`
        INSERT INTO categories (id, name, icon, parent_id, sort_index)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          icon = excluded.icon,
          parent_id = excluded.parent_id
      `).run(nextCategory.id, nextCategory.name, nextCategory.icon || null, nextCategory.parentId || null, sortIndex);
    });

    writeCategory(category);
    this.setMeta('updated_at', new Date().toISOString());
  }

  deleteCategory(categoryId: string) {
    const getAllChildIds = (id: string): string[] => {
      const children = this.db.prepare('SELECT id FROM categories WHERE parent_id = ?').all(id) as Array<{ id: string }>;
      return children.flatMap((child) => [child.id, ...getAllChildIds(child.id)]);
    };

    const idsToDelete = [categoryId, ...getAllChildIds(categoryId)];
    const deleteIds = this.db.transaction((ids: string[]) => {
      const deleteCategoryStatement = this.db.prepare('DELETE FROM categories WHERE id = ?');
      const updateTokenCategories = this.db.prepare('DELETE FROM token_categories WHERE category_id = ?');

      ids.forEach((id) => {
        deleteCategoryStatement.run(id);
        updateTokenCategories.run(id);
      });
    });

    deleteIds(idsToDelete);
    this.setMeta('updated_at', new Date().toISOString());
  }

  reorderCategories(orderedIds: string[]) {
    const reorder = this.db.transaction((ids: string[]) => {
      const updateSort = this.db.prepare('UPDATE categories SET sort_index = ? WHERE id = ?');
      ids.forEach((id, index) => {
        updateSort.run(index, id);
      });
    });

    reorder(orderedIds);
    this.setMeta('updated_at', new Date().toISOString());
  }
}
