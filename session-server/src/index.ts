import {
  authenticateSessionConnection,
  type SessionServerEnv,
} from "./auth";
import { SessionActor } from "./InventorySessionActor";

export { SessionActor };

const SESSION_CONNECT_ROUTE = /^\/session\/([^/]+)\/connect\/?$/;

export default {
  async fetch(request: Request, env: SessionServerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "session-server",
        serverTime: Date.now(),
      });
    }

    const routeMatch = SESSION_CONNECT_ROUTE.exec(url.pathname);
    if (!routeMatch || request.method !== "GET") {
      return new Response("Not found.", { status: 404 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade.", { status: 426 });
    }

    const sessionId = decodeURIComponent(routeMatch[1]).trim();
    if (!sessionId) {
      return new Response("Missing sessionId.", { status: 400 });
    }

    const authResult = await authenticateSessionConnection(request, sessionId, env);
    if (!authResult.ok) {
      return new Response(authResult.message, { status: authResult.status });
    }

    const { claims } = authResult;
    const durableObjectId = env.SESSION_ACTOR.idFromName(sessionId);
    const actor = env.SESSION_ACTOR.get(durableObjectId);

    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("x-session-id", claims.sessionId);
    forwardedHeaders.set("x-session-client-id", claims.clientId);
    forwardedHeaders.set("x-session-user-id", claims.userId);
    forwardedHeaders.set("x-session-role", claims.role);
    forwardedHeaders.set("x-session-expires-at", String(claims.expiresAt));

    return actor.fetch(
      new Request("https://session-actor.internal/connect", {
        method: "GET",
        headers: forwardedHeaders,
      }),
    );
  },
} satisfies ExportedHandler<SessionServerEnv>;
