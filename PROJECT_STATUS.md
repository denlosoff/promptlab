# Promptlab Project Status

## Project Goal

Turn `promptlab-v1.8.1` into a production-ready web version of Promptlab with:

- frontend + backend architecture
- automatic loading of the active JSON database from the `Toggle` folder
- user mode and admin mode
- safe suggestion flow for non-admin users
- preserved prompt builder and token browsing workflow
- visual parity with the older Promptlab interface where it matters

## Current Architecture

- Frontend: Vite + React in `src/`
- Backend: Express in `server/index.ts`
- Data source: latest `promptlab-data*.json` from parent `Toggle` folder unless overridden by env vars
- Suggestions storage: `promptlab-suggestions.json`
- Admin auth: simple password login backed by server session token

## Done

- Replaced static/manual data flow with backend API loading
- Added backend routes for config, data, auth, admin save, suggestions, and token detail loading
- Added production deployment support for Render with persistent disk via `render.yaml`
- Made frontend work against `/api`
- Added admin login/logout flow
- Added user suggestion flow instead of direct public editing
- Fixed startup white screen caused by Gemini client initialization without API key
- Made AI features fail safe when `GEMINI_API_KEY` is missing
- Restored token cover images in summary mode via `coverImage`
- Restored horizontal category carousels
- Removed duplicated token rendering under categories when token already belongs to a deeper subcategory section
- Restored card behavior closer to old version:
  - title anchored at the bottom
  - description and aliases reveal on hover
- Removed `Filter` buttons from section headers
- Moved carousel arrows back toward the left/right edges
- Removed the `Directly in this category` label
- Restored category breadcrumb behavior in the `TokenGrid` header
- Brought `RightSidebar` closer to the old version:
  - animated entry
  - preview image count
  - gallery dots
  - fullscreen gallery arrows and dots
- Cleaned the visible `TokenGrid` status line in the header area
- Cleaned visible broken Russian strings in `Sidebar` actions, collapse button, and delete confirmation
- Added `/api/health` and safer server-side data directory handling for hosted environments
- Added server-side JSON caching keyed by file mtime to avoid reparsing the same database on every request
- Added cached token summary list and token lookup map for faster `/api/data` and `/api/tokens/:id`
- Added startup cache warmup and increased local Node heap for Cloudflare-tunneled PC hosting
- Added generated Web DB assets pipeline that extracts embedded base64 images into static files
- Reduced generated catalog payload from huge embedded-image JSON to lightweight summary + token chunks + asset URLs
- Added import inbox pipeline:
  - drop incoming `.json` files into `Toggle/imports`
  - auto-apply merge or full replacement
  - archive processed files
  - rebuild `webdb` automatically
- Added external export contract docs for the other Promptlab app

## In Progress

- Bringing `TokenGrid` visual behavior closer to the old version in `C:\Users\ADMIN\Toggle\old\promptlab-v1.8.1`
- Restoring old navigation/header patterns without reverting the new backend/auth model
- Reducing visual regressions introduced during the backend migration

## Known Gaps

- Current UI still differs from the old Promptlab in multiple places
- Russian text encoding is inconsistent in several older UI strings
- Admin UX is still more generic than the old in-app workflow
- Some sections of the old toolset are not yet visually restored

## Next Tasks

- Finish restoring the remaining `TokenGrid` top bar differences
- Clean remaining `TokenGrid` visual differences against the old project
- Compare and restore remaining `Sidebar` differences against the old project
- Clean up broken Russian encoding across visible UI
- Rework admin entry UX so it matches the intended product style
- Re-check user flow for "suggest token" vs admin flow for "add token"
- Review prompt builder visual regressions after main catalog UI is stabilized
- Complete external deployment and domain setup
- Add admin-side visibility for processed import inbox history if needed

## Run Notes

- Frontend dev server: `npm run dev`
- Backend dev server: `npm run dev:server`
- Production build: `npm run build`
- Type check: `npm run lint`

## Important Files

- `server/index.ts`
- `src/components/TokenGrid.tsx`
- `src/context/AppContext.tsx`
- `src/components/Sidebar.tsx`
- `src/components/RightSidebar.tsx`
- `PROJECT_STATUS.md`
