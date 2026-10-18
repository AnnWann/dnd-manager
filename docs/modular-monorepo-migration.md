# Modular monorepo migration

## Objective

Prepare the D&D Manager for a second frontend (Owlbear Rodeo) without duplicating game rules, session operations, or presentation components. Changes must preserve existing runtime behavior.

## Current runtime ownership

- Website: Vite + React, hosted with the current Vercel setup.
- Session authority: Cloudflare Worker + Durable Object, reached through short-lived signed connection tokens issued by Vercel.
- Persistence: existing database and Prisma integrations; do not move authentication or database ownership during protocol extraction.

## Dependency direction

- Application interfaces may depend on reusable UI, session client, game core, and protocol modules.
- Session server may depend on protocol and pure game core, but never React, UI, or browser-only modules.
- Shared protocol contracts must be environment-neutral and free of runtime side effects.
- Neither website nor Owlbear should become the authority for session state.

## Migration phases

1. Extract the smallest duplicate cross-runtime contracts. First migrated: `InitiativeHpApplicationResult` in `packages/session-protocol/src/initiativeHp.ts`.
2. Add targeted contract validation and migrate remaining initiative, mission, and inventory message types with no wire format changes.
3. Extract pure game rules/calculations from UI modules into a standalone game-core package.
4. Separate WebSocket transport/authentication from React session providers into a session-client package.
5. Decouple shared character sheet, inventory, mission and initiative components from website navigation/providers.
6. Only after those extractions, migrate application roots under `apps/` and register workspace/build configuration. Preserve Vercel and Wrangler outputs throughout.
7. Add Owlbear extension as a new app consuming the shared modules.

## Guardrails

- Avoid renaming operation types or changing serialized payloads in the extraction commits.
- Do not relocate the website, Prisma configuration, or Worker as part of the first phase.
- Keep the existing npm installation and deployment workflows unchanged until an isolated workspace migration can regenerate and verify lockfiles.
- Validate both `npm run build` and `npm run typecheck:session-server` in CI before merge, plus an authenticated multi-client session smoke test.


## Remaining work and exit criteria (reviewed 2026-10-18)

1. **Protocol contracts:** identify and consolidate the remaining session message types (including abilities, character lifecycle, configuration, magic and equipment). Test parser compatibility for existing wire payloads and enforce import boundaries.
2. **Game core:** continue isolating pure calculations, selectors and item rules. Keep server-authoritative mutations in the Durable Object. Add tests for game rules and session invariants.
3. **Session client:** establish reusable typed session APIs above the raw WebSocket transport, with injectable token acquisition and browser-free tests for reconnect, ready, heartbeat, stale sockets and kicked sessions. Do not move authority or identity to consumers.
4. **Shared UI:** finish decoupling HP dialogs and character panels; create provider-free mission, inventory and initiative views with prop-driven adapters. Avoid migrating whole pages with imports pointing back to website internals.
5. **Workspace migration:** introduce npm workspace boundaries and package-scoped TypeScript builds, reconcile package-lock files, then move web and Worker roots to apps/ while preserving Vercel, Prisma, Cloudflare Wrangler, runtime paths and secrets.
6. **Owlbear integration:** implement extension manifest, session identity and authorization handshake, embed UI panels, subscribe to session snapshots and dispatch authorized actions through the existing Cloudflare session authority.
7. **Release verification:** validate production deployment outputs, permission isolation, two authenticated clients with different roles, reconnect/resync, race handling, inventory transfers and damage operations; keep the PR draft until tests and deployment checks are green.

### Delivered foundation
- Shared initiative, mission, and inventory operation types (remaining protocol families not yet extracted).
- Framework-independent damage, HP, death saves, XP and mission-board selectors.
- Shared WebSocket lifecycle transport (higher-level typed sync client remains outstanding).
- Shared XP and HP presentation primitives (full feature panels remain outstanding).
- Build and type-check CI (stale lockfile currently bypassed rather than repaired).

### Migration rule
Every extracted component must have a clear owner for state and authorization. UI can request operations but cannot become the source of truth for Cloudflare-managed session state.


## Objective 5 intermediate checkpoint (2026-10-18)

Registered seven npm workspaces, including the four shared packages, the existing Worker, and compatibility workspace entrypoints in `apps/web` and `apps/session-server`. Added per-package TypeScript checks, migrated initial mission consumers to public `@dnd-manager/*` export paths, and validated app-level scripts in CI. The active source/deployment roots remain at the repository root and `session-server/` to prevent breakage during staging.

See [workspace-migration.md](./workspace-migration.md) for the remaining lockfile regeneration, physical moves, import rewrite and deployment preservation requirements. This is a staged milestone, not completion of objective 5.
