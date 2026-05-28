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
```

Run the app in development (builds local spell JSON first):

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
- State persistence (optional) uses a Postgres database via `POSTGRES_URL` (Neon, Vercel Postgres, etc.).
- To run the API locally use the Vercel CLI: install `vercel` and run `npm run dev:vercel`.

## Translation

- The app includes an `/api/translate` endpoint that can proxy to LibreTranslate or Google Cloud Translation.
- Configure translation provider via `TRANSLATE_PROVIDER`, `GOOGLE_TRANSLATE_API_KEY`, `TRANSLATE_API_URL`, and `TRANSLATE_API_KEY` environment variables.

## Contributing

- Fork the repo, make changes and open a PR.
- Code style follows the existing ESLint and TypeScript setup. Run `npm run lint` before opening a PR.

## License

MIT

---

If you'd like, I can also add a short development guide or update the `package.json` scripts section with examples. 
