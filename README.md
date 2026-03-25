# Toggle Promptlab

This project is now split into:

- `frontend`: Vite + React UI
- `backend`: Express API in [`server/index.ts`](./server/index.ts)

## What it does now

- Loads the active token database from a JSON file in the parent `Toggle` folder
- Lets regular users browse tokens and build prompts
- Lets regular users suggest new tokens for admin review
- Lets admins sign in with a password and edit the live database

## Data loading

By default the backend reads the newest `promptlab-data*.json` file from the parent folder:

- `C:\Users\ADMIN\Toggle\promptlab-data (10).json`

You can override this with environment variables:

- `DATA_DIR`
- `DATA_FILE`

User suggestions are stored separately in:

- `promptlab-suggestions.json`

Incoming import files can be dropped into:

- `imports/`

Supported formats:

- full master snapshot: `{ "categories": [...], "tokens": [...] }`
- `promptlab-token`
- `promptlab-token-set`

Processed files are archived into:

- `imports/processed/`

## Environment

Create `.env.local` or `.env` based on `.env.example` and set at least:

```env
ADMIN_PASSWORD="change-me"
PORT="3001"
```

`GEMINI_API_KEY` is optional for now.

## Development

Run the backend:

```bash
npm run dev:server
```

Run the frontend:

```bash
npm run dev
```

The frontend proxies `/api` requests to `http://localhost:3001`.

## Production

Build the frontend:

```bash
npm run build
```

Start the server:

```bash
npm run start
```

The Express server will serve both the API and the built frontend from `dist/`.

## Deploy to Render

This repo is ready to deploy as a single Render web service.

What is included:

- `render.yaml` blueprint
- persistent disk mount for JSON data
- health check endpoint at `/api/health`
- built frontend served by the Express server

### Render setup

1. Push this project to GitHub.
2. In Render, create a new Blueprint and select the repository.
3. Render will read `render.yaml` and create one web service plus a persistent disk.
4. In the service settings, set:
   - `ADMIN_PASSWORD`
   - `GEMINI_API_KEY` only if you want AI features enabled
5. Deploy.

### Data file on Render

The service is configured to use:

- `DATA_DIR=/opt/render/project/src/data`

After the first deploy, open the Render shell or disk file browser and place your live JSON file there, for example:

- `/opt/render/project/src/data/promptlab-data.json`

If no file exists yet, the server will create an empty one automatically.

### Important note

Do not deploy this project to a host with an ephemeral filesystem unless you move the data layer to a real database or object storage. The app saves:

- the live token database
- `promptlab-suggestions.json`

Both need persistent storage.
