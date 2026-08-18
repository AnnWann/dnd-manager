# dnd-manager

A lightweight web app to manage Dungeons & Dragons characters, spells, inventory and combat state (initiative, death saves, etc.). Built with React, TypeScript and Vite.

## Features

- Manage characters, attributes and classes
- Add and track spells and metamagics
- Spell slots, free casts and metamagic resources
- Initiative board and HP tracking
- Save and share party state via a serverless Postgres backend

## Quick start

Prerequisites: Node 18+ and a package manager (`npm`, `yarn`, or `pnpm`).

Install dependencies:

```bash
npm install
npm install --prefix session-server
```

Run only the frontend:

```bash
npm run dev
```

Run only Vite (frontend without `api/`):

```bash
npm run dev:vite
```

Run the Vercel local dev server (includes `/api` serverless functions):

```bash
npm run dev:vercel
```

## Full local stack

The full local mode runs the production-shaped topology locally:

```text
Browser
  -> Vercel local app + Functions (:3000)
       -> Postgres configured in Vercel Development env
  -> Cloudflare Worker + Durable Objects (:8787)
```

First link the checkout to the Vercel project once:

```bash
npm run dev:link
```

Then start everything with one command:

```bash
npm run dev:full
```

`dev:full`:

- runs `vercel dev` on port 3000;
- runs the Cloudflare session server on port 8787;
- disables `VITE_LOCAL_AUTH_BYPASS`, so Better Auth and Vercel Functions are exercised;
- injects `VITE_SESSION_SERVER_URL=http://localhost:8787`;
- uses the Environment Variables configured for the linked Vercel **Development** environment, including the Postgres connection strings.

For realistic testing, configure the Vercel Development environment to point at a dedicated Neon/development database branch instead of production data.

### Using Production Vercel env values locally

There is an explicit opt-in command for reproducing the local stack with Vercel Production environment variables:

```bash
ALLOW_PRODUCTION_DATA=1 npm run dev:full:prod-env
```

This can connect local code to the real production database and external services. It is intentionally blocked unless `ALLOW_PRODUCTION_DATA=1` is supplied.

You can override the local ports/Worker URL when necessary:

```bash
LOCAL_VERCEL_PORT=3001 VITE_SESSION_SERVER_URL=http://localhost:8788 npm run dev:full
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Force-refresh the spells JSON (uses `scripts/build-spells-json.mjs`):

```bash
npm run spells:fetch
```

## Data

- The app ships prebuilt spell and metamagic data in `public/spells.v1.json` and `public/metamagics.v1.json`.
- An internal script (`scripts/build-spells-json.mjs`) regenerates these files from source data.

## Server / Persistence

- The `/api` folder contains serverless endpoints used for sharing and translating data.
- State persistence uses Postgres via `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `DATABASE_URL` depending on the configured environment.
- `npm run dev:full` is the preferred way to test Vercel Functions, the database-backed application, and the Cloudflare session runtime together.

## Translation

- The app includes an `/api/translate` endpoint that can proxy to LibreTranslate or Google Cloud Translation.
- Configure translation provider via `TRANSLATE_PROVIDER`, `GOOGLE_TRANSLATE_API_KEY`, `TRANSLATE_API_URL`, and `TRANSLATE_API_KEY` environment variables.

## Contributing

- Fork the repo, make changes and open a PR.
- Code style follows the existing ESLint and TypeScript setup. Run `npm run lint` before opening a PR.

## License

MIT
