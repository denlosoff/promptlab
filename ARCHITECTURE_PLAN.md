# Promptlab Architecture Plan

## Goal

Move Promptlab from a file-centric app to a stable data-driven web application with:

- fast public catalog reads
- fast admin CRUD
- safe import/export flows
- background rebuild jobs
- clear separation between live data and derived web caches

## Target Architecture

### 1. Live Source Of Truth

Use `SQLite` as the only live source of truth for runtime operations.

Core tables:

- `tokens`
- `categories`
- `token_aliases`
- `token_word_forms`
- `token_examples`
- `token_categories`
- `suggestions`
- `import_jobs`
- `job_runs`

Rules:

- admin edits must write directly to SQLite
- public reads must not depend on rewriting the master JSON file
- JSON files are not the live database anymore

### 2. JSON Role

JSON remains useful, but only for:

- import
- export
- backup
- sync with the external app

Rules:

- full master JSON can replace the whole database
- token-set JSON can merge into the database
- all imports are validated before apply

### 3. API Layer

Split API into clear domains.

Public read API:

- `GET /api/data`
- `GET /api/tokens/:id`

Admin CRUD API:

- `POST /api/admin/tokens`
- `DELETE /api/admin/tokens/:id`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`

Admin import API:

- `POST /api/admin/import/preview`
- `POST /api/admin/import/apply`

Admin status API:

- `GET /api/sync-status`
- `GET /api/admin/jobs`

Rules:

- token/category CRUD must be small, direct operations
- import/apply must not reuse the UI state as the source of truth
- background tasks must be observable

### 4. Read Model

Public browsing should use a read-optimized model derived from SQLite.

Read model contains:

- categories tree
- token summary cards
- token detail lookups
- asset URLs instead of embedded images

Rules:

- public UI reads summary first
- token detail loads on demand
- derived read model must not block admin CRUD

### 5. Background Jobs

Heavy work should not run inline in user-facing requests.

Background jobs:

- rebuild webdb
- regenerate optimized assets
- import apply post-processing
- cache refresh

Rules:

- one job runner
- coalesce duplicate rebuild requests
- report job state and last error
- keep CRUD latency low even while jobs run

### 6. Asset Pipeline

Images must live as files, not large base64 payloads in API responses.

Needed outputs:

- cover images
- gallery previews
- optimized asset URLs

Rules:

- summary responses contain only URLs
- public catalog does not download original source images by default
- image rebuild can run in background

### 7. Admin UX

Admin mode should behave like a normal editorial interface.

Rules:

- edit/delete/add token must be available immediately after auth
- save/delete must feel instant
- long-running work gets a toast or fixed indicator
- no technical status strings in the main header
- logout must never wait on a full rebuild

### 8. Public UX

Public mode should stay read-only and stable.

Rules:

- fast summary load
- lazy token detail fetch
- lazy image loading
- no admin sync dependency

### 9. Validation And Contracts

External sync must be versioned and explicit.

Required:

- versioned JSON schemas
- import validation
- merge semantics
- delete semantics
- dry-run semantics

### 10. Observability

Need enough signals to debug real issues quickly.

Required:

- job logs
- import history
- CRUD operation timing
- rebuild timing
- visible error state for admin

## Implementation Roadmap

### Stage 1. Live Token CRUD

Goal:

- token add/update/delete uses SQLite directly
- no full-data sync dependency for token editing

Status:

- mostly done

### Stage 2. Live Category CRUD

Goal:

- category add/update/delete/reorder uses SQLite directly

Status:

- mostly done

### Stage 3. Background Job Manager

Goal:

- move webdb rebuild and related work into explicit job management

Status:

- started
- rebuild queue + job history added
- still missing a fuller job runner model and richer UI/history

### Stage 4. Import Pipeline On SQLite

Goal:

- import preview/apply works against SQLite
- full replace and merge both supported cleanly

Status:

- partially done
- preview/apply work from live SQLite state
- inbox import no longer rebuilds webdb inline
- still needs richer job/history UX and cleaner draft/apply lifecycle polish

### Stage 5. UI Status Cleanup

Goal:

- remove technical status noise from header
- replace with toasts / compact fixed indicators

Status:

- partially done
- compact fixed status block is in place
- still needs more polished phrasing / toast-style behavior

### Stage 6. Tests

Critical scenarios:

- edit token with existing images
- delete token
- logout after save
- import preview/apply
- replace database
- rebuild while public users browse

Status:

- not started

## Definition Of Done

The architecture is considered stable when:

- admin edits are fast and local-feeling
- public catalog remains fast while admin changes happen
- imports are predictable and reversible
- backups and exports are simple
- no user-facing action waits on a full database rebuild
