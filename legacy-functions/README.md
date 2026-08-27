# Legacy Vercel functions

These files are intentionally stored outside `api/` so Vercel does not deploy them as Serverless Functions.

Archived on 2026-08-27 after auditing the QA branch for the Hobby-plan function limit.

## Archived routes

- `api/v2/*`: superseded relational API. The only frontend wrapper that references these routes is `src/lib/relationalApi.ts`; its `createRelationalRepositories` factory is no longer referenced by the application. The file remains in `src/` because current code still imports its `CharacterDomainName` type.
- `api/auth/[...all].ts`: superseded by the active `api/auth.ts` handler plus the `/api/auth/(.*) -> /api/auth?__betterAuthPath=$1` rewrite in `vercel.json`.
- `api/better-auth.ts`: duplicate Better Auth handler not targeted by the current rewrite/client flow.
- `api/compendium/spells/[index].ts`: superseded by the active `/api/compendium/spells` endpoint, which supports both searches and detail lookup by index(es).

Do not move files back under `api/` without checking the Vercel Serverless Function count and current callers.
