# Session Server

Cloudflare Worker + Durable Object runtime for realtime VTT sessions.

This package currently owns only connection lifecycle, presence and heartbeat. Game state remains in the existing application mechanisms.

## Local setup

```bash
npm install --prefix session-server
npm run dev:session-server
```

The local Wrangler configuration sets `SESSION_AUTH_MODE=development`. This mode is intentionally unsafe for production and exists only until the Vercel backend issues short-lived signed connection tokens.

## Endpoints

### Health

```text
GET /health
```

### WebSocket

```text
GET /session/:sessionId/connect?userId=<user>&role=PLAYER&clientId=<optional-stable-client-id>
Upgrade: websocket
```

`role` accepts `MASTER` or `PLAYER` only in development auth mode.

On connection the server sends `session.ready`, followed by `session.presence` broadcasts. Clients should send `session.heartbeat` roughly every 30 seconds. Any valid session message refreshes activity; after 90 seconds without valid activity the Durable Object closes the socket and removes it from presence.

No permanent timer is used. Socket metadata lives in WebSocket attachments and expiration is driven by a Durable Object alarm so the actor can hibernate between events.

## Commands

```bash
npm run dev:session-server
npm run typecheck:session-server
npm run deploy:session-server
```

Do not deploy with `SESSION_AUTH_MODE=development`. The production authentication path must validate a short-lived signed token containing `sessionId`, `userId`, `role` and expiry before forwarding a connection to the Durable Object.
