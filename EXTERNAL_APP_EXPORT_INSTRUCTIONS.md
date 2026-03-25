# External App Export Instructions

Use this contract when exporting data from the other Promptlab app into this project.

## Best option

Export the whole current database as plain master JSON:

```json
{
  "categories": [...],
  "tokens": [...]
}
```

Requirements:

- file encoding must be `UTF-8`
- every token must include:
  - `id`
  - `name`
  - `descriptionShort`
  - `aliases`
  - `wordForms`
  - `categoryIds`
  - `examples`
- every category referenced in `token.categoryIds` must exist in `categories`

Why this is best:

- additions work
- edits work
- deletions work
- category tree changes work
- this project can fully mirror the other app

## If exporting only changes

Use:

```json
{
  "schemaVersion": "1.1",
  "type": "promptlab-token-set",
  "meta": {
    "id": "stable-pack-id",
    "name": "Pack name",
    "version": "1.0.0",
    "syncMode": "merge"
  },
  "categories": [...],
  "tokens": [...],
  "deletedTokenIds": [],
  "deletedCategoryIds": []
}
```

Rules:

- `merge` means upsert by `id`
- removed tokens/categories must be listed explicitly in `deletedTokenIds` / `deletedCategoryIds`

## Where to put the file

Drop the exported `.json` into:

- `C:\Users\ADMIN\Toggle\imports\`

The site will process it automatically, archive it, and rebuild the fast web database.
