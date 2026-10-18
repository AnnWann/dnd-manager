# Objective 5 — npm workspace migration

## Current physical layout

| Workspace | Path | Status |
| --- | --- | --- |
| `@dnd-manager/game-core` | `packages/game-core` | Native workspace |
| `@dnd-manager/game-ui` | `packages/game-ui` | Native workspace |
| `@dnd-manager/session-client` | `packages/session-client` | Native workspace |
| `@dnd-manager/session-protocol` | `packages/session-protocol` | Native workspace |
| `dnd-manager-session-server` | `session-server` | Native workspace, active Wrangler root |
| `@dnd-manager/web` | `apps/web` | Staged app workspace; commands delegate to existing root |
| `@dnd-manager/session-server-app` | `apps/session-server` | Staged app workspace; commands delegate to existing `session-server/` |

Root `package.json` declares `packages/*`, `apps/*`, and `session-server` workspaces. App wrappers are genuine npm workspaces, but **the Vite/React and Worker source directories have not yet moved**. Their current physical roots remain the active deployment source of truth.

The first migrated consumer uses `@dnd-manager/game-ui/*` and `@dnd-manager/game-core/*` package exports. More website and Worker imports still use relative source paths. The dependency graph must continue transitioning before treating the workspace separation as complete.

## CI and package boundaries

- `npm run check:workspace-boundaries`: verifies seven workspace manifests and package export source targets.
- `npm run typecheck --workspace @dnd-manager/game-core` (likewise session-protocol, session-client, game-ui): package-scoped TypeScript checks.
- Existing game-core/protocol/client Node tests, website build, and Worker typecheck remain active.
- npm installation runs at the root and resolves workspace symlinks. The redundant separate server install was removed from the modular CI workflow.
- Tailwind scans shared UI source.

## Deployment preservation

Do not change `vercel.json`, `prisma/`, `api/`, root `vite.config.ts`, or `session-server/wrangler.jsonc` until a physical move can preserve their paths, migrations, secrets and deployment output. The `apps/` package scripts deliberately invoke the existing roots.

## Remaining work before objective 5 is complete

1. **Lockfile reconciliation.** Regenerate `package-lock.json` using npm 11 / Node 24 after registering workspaces, review `packages["..."]` and workspace links, commit it, and switch CI from `npm install --package-lock=false` to `npm ci`. Current CI still bypasses lockfile generation and must not be mistaken for reproducible installs.
2. **Physical app migration.** Move Vite/React source and Worker files into `apps/web` and `apps/session-server`, respectively, updating every relative import, Vercel function, Prisma path, public/static asset path, Wrangler entrypoint, migration binding and tooling script. Remove compatibility wrappers after validation.
3. **Package-name imports.** Replace remaining direct `packages/.../src` imports with exported workspace subpaths, declare direct dependencies, and add checks prohibiting cross-package source imports.
4. **Build output verification.** Confirm Vercel and Wrangler bundle/runtime roots from the new physical app paths and repeat the CI checks.
5. **Deployment tests.** Live integration and deployed-environment checks remain intentionally deferred.

No deployment or database ownership changes are included in this stage.
