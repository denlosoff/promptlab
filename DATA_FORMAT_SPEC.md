# Promptlab Data Format Spec

This file defines:

- the current source-of-truth format for the full database
- the generated web format used for faster site delivery
- the recommended import format for one token
- the recommended import format for a token set

## 1. Full Database Format

This is the master format currently used by Promptlab.

```json
{
  "categories": [
    {
      "id": "lighting",
      "name": "Lighting",
      "icon": "Sun",
      "parentId": null
    }
  ],
  "tokens": [
    {
      "id": "soft-key-light",
      "name": "Soft key light",
      "descriptionShort": "Soft directional main light for portraits.",
      "aliases": ["soft key", "soft portrait light"],
      "wordForms": ["soft key lighting"],
      "categoryIds": ["lighting"],
      "examples": ["https://.../image-1.jpg", "https://.../image-2.jpg"]
    }
  ]
}
```

### Category fields

- `id`: string, required, stable unique ID
- `name`: string, required
- `icon`: string, optional
- `parentId`: string, optional

### Token fields

- `id`: string, required, stable unique ID
- `name`: string, required
- `descriptionShort`: string, required
- `aliases`: string array, required, may be empty
- `wordForms`: string array, optional
- `categoryIds`: string array, required, may be empty
- `examples`: string array, required, may be empty

## 2. Generated Web Format

The web format is generated automatically from the full database by:

```bash
npm run build:webdb
```

Files are written into:

- `DATA_DIR/webdb/manifest.json`
- `DATA_DIR/webdb/summary.json`
- `DATA_DIR/webdb/token-index.json`
- `DATA_DIR/webdb/token-chunks/chunk-0001.json`

This format is read-only and should not be edited by hand.

### Purpose

- faster category/catalog load
- no need to parse the full giant JSON on every request
- token details loaded by ID from chunk files

## 3. Single Token Import Format

Use this format if you want to prepare one token outside the app and later import/merge it safely.

```json
{
  "schemaVersion": "1.0",
  "type": "promptlab-token",
  "categories": [
    {
      "id": "lighting",
      "name": "Lighting",
      "icon": "Sun"
    }
  ],
  "token": {
    "id": "soft-key-light",
    "name": "Soft key light",
    "descriptionShort": "Soft directional main light for portraits.",
    "aliases": ["soft key", "soft portrait light"],
    "wordForms": ["soft key lighting"],
    "categoryIds": ["lighting"],
    "examples": ["https://.../image-1.jpg", "https://.../image-2.jpg"]
  }
}
```

### Rules

- `type` must be `promptlab-token`
- `token` must follow the full token schema
- `categories` should include all categories referenced by `token.categoryIds`
- category IDs must be stable

## 4. Token Set Import Format

Use this when importing a themed pack, library, or external contribution.

```json
{
  "schemaVersion": "1.1",
  "type": "promptlab-token-set",
  "meta": {
    "id": "cinematic-lighting-pack",
    "name": "Cinematic Lighting Pack",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "Portrait and scene lighting tokens.",
    "syncMode": "merge"
  },
  "categories": [
    {
      "id": "lighting",
      "name": "Lighting",
      "icon": "Sun"
    },
    {
      "id": "rim-light",
      "name": "Rim Light",
      "parentId": "lighting",
      "icon": "Sparkles"
    }
  ],
  "tokens": [
    {
      "id": "soft-key-light",
      "name": "Soft key light",
      "descriptionShort": "Soft directional main light for portraits.",
      "aliases": ["soft key", "soft portrait light"],
      "wordForms": ["soft key lighting"],
      "categoryIds": ["lighting"],
      "examples": ["https://.../image-1.jpg"]
    },
    {
      "id": "hard-rim-light",
      "name": "Hard rim light",
      "descriptionShort": "Bright edge light with strong separation.",
      "aliases": ["rim light"],
      "wordForms": [],
      "categoryIds": ["rim-light"],
      "examples": ["https://.../image-2.jpg"]
    }
  ],
  "deletedTokenIds": [],
  "deletedCategoryIds": []
}
```

### Rules

- `type` must be `promptlab-token-set`
- `meta.id` should be stable across updates of the same pack
- `meta.syncMode` may be:
  - `merge`: upsert categories/tokens by `id`, keep everything else
  - `replace-master`: replace the whole current master database with this file's `categories` and `tokens`
- every token must follow the full token schema
- every category referenced by tokens must exist in `categories`
- IDs should be globally unique and slug-like
- `deletedTokenIds` is optional and removes tokens by `id`
- `deletedCategoryIds` is optional and removes categories by `id`

## 5. Import Inbox Workflow

Promptlab now supports a drop-folder workflow.

Drop incoming files into:

- `DATA_DIR/imports/`

On the next request or server startup, Promptlab will:

1. read every `.json` file in `imports/`
2. apply them in file modification order
3. update the live master database
4. regenerate `webdb`
5. move processed files into `DATA_DIR/imports/processed/`

### Supported inbox formats

#### A. Full master snapshot

Use this when an external app exports the entire database and you want this project to mirror it exactly.

```json
{
  "categories": [...],
  "tokens": [...]
}
```

This is treated as:

- full replacement of the current master database

#### B. Single token package

```json
{
  "schemaVersion": "1.0",
  "type": "promptlab-token",
  "categories": [...],
  "token": { ... }
}
```

This is treated as:

- merge by `id`

#### C. Token set package

```json
{
  "schemaVersion": "1.1",
  "type": "promptlab-token-set",
  "meta": {
    "syncMode": "merge"
  },
  "categories": [...],
  "tokens": [...],
  "deletedTokenIds": [],
  "deletedCategoryIds": []
}
```

### Recommended workflow by source

- If the external app exports the whole current database:
  export plain master JSON `{ "categories": [...], "tokens": [...] }`

- If the external app exports only additions/changes:
  export `promptlab-token-set` with `meta.syncMode = "merge"`

- If the external app needs deletions to propagate:
  either export a full master snapshot, or include `deletedTokenIds` / `deletedCategoryIds`

## 6. Recommended ID Rules

Use lowercase slug IDs:

- `soft-key-light`
- `cinematic-lighting-pack`
- `portrait-lighting`

Avoid:

- spaces
- random timestamps
- uppercase IDs
- IDs that depend on category position

## 7. Safe Update Workflow

1. Keep the large master JSON as the source of truth.
2. Generate the web format with `npm run build:webdb`.
3. Publish the site using the generated web format.
4. When a new master JSON arrives, replace it and regenerate the web format.
5. Keep the previous master JSON as backup before replacement.
