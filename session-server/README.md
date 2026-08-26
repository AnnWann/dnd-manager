# Session Server

Cloudflare Worker + Durable Object runtime for realtime VTT sessions.

The browser connects directly to the Cloudflare Worker for realtime session traffic. In deployed environments, Vercel authenticates the Better Auth session, authorizes the user against the campaign, and issues a short-lived signed connection token before the browser opens the WebSocket.

## Local setup

```bash
npm install --prefix session-server
npm run dev:session-server
```

`npm run dev:session-server` explicitly starts Wrangler with `SESSION_AUTH_MODE=development`. This local-only mode accepts `userId`, `role` and `clientId` from the WebSocket query string.

## Deployed authentication flow

1. The browser sends `POST /api/session-connection` to the Vercel app with `sessionId` and its stable `clientId`.
2. Vercel resolves the Better Auth session and checks the campaign in the QA/production database.
3. Campaign owners receive `MASTER`; active campaign members receive their stored campaign role. Invited/removed/non-members are rejected.
4. Vercel signs a token containing `sessionId`, `userId`, `role`, `clientId`, issue time and expiry. Tokens live for 60 seconds.
5. The browser opens `GET /session/:sessionId/connect?token=<signed-token>` directly against Cloudflare.
6. The Worker verifies the HMAC signature, expiry and path `sessionId` before forwarding trusted connection metadata to the Durable Object.
7. Every reconnect requests a fresh token from Vercel.

The HMAC secret must be the same in Vercel and Cloudflare and must contain at least 32 random bytes. Never expose it through a `VITE_*` variable.

For QA, configure the Vercel environment variable:

```text
SESSION_CONNECTION_SECRET=<shared-random-secret>
VITE_SESSION_SERVER_URL=https://<qa-worker>.workers.dev
```

Then configure the exact same secret in Cloudflare:

```bash
cd session-server
npx wrangler secret put SESSION_CONNECTION_SECRET --env qa
npx wrangler deploy --env qa
```

`wrangler.jsonc` uses `SESSION_AUTH_MODE=token` for deployed/default and QA environments. The local `npm run dev:session-server` command overrides only the local Wrangler process back to `development`.

## Endpoints

### Health

```text
GET /health
```

### WebSocket: deployed token auth

```text
GET /session/:sessionId/connect?token=<short-lived-signed-token>
Upgrade: websocket
```

### WebSocket: local development auth

```text
GET /session/:sessionId/connect?userId=<user>&role=PLAYER&clientId=<optional-stable-client-id>
Upgrade: websocket
```

`role` accepts `MASTER` or `PLAYER` only in local development auth mode.

On connection the server sends `session.ready`, followed by the authoritative snapshots and presence broadcasts owned by the composed session actor. Clients send `session.heartbeat` roughly every 30 seconds. Any valid session message refreshes activity; after 90 seconds without valid activity the Durable Object closes the socket and removes it from presence.

Socket metadata lives in WebSocket attachments and expiration is driven by a Durable Object alarm so the actor can hibernate between events.

## Commands

```bash
npm run dev:session-server
npm run typecheck:session-server
npm run deploy:session-server
```

For QA deploys use `npx wrangler deploy --env qa` from `session-server` so the QA Durable Object namespace and QA secret remain isolated from production.
