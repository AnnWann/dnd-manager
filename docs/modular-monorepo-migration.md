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
