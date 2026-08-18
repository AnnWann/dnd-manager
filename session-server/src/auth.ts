import type { SessionRole } from "./protocol";

export interface SessionConnectionClaims {
  sessionId: string;
  userId: string;
  role: SessionRole;
  clientId: string;
  expiresAt: number;
}

export interface SessionServerEnv {
  SESSION_ACTOR: DurableObjectNamespace;
  SESSION_AUTH_MODE?: string;
}

export type SessionAuthResult =
  | { ok: true; claims: SessionConnectionClaims }
  | { ok: false; status: number; message: string };

const DEVELOPMENT_AUTH_MODE = "development";
const DEVELOPMENT_TOKEN_TTL_MS = 5 * 60 * 1000;

export async function authenticateSessionConnection(
  request: Request,
  sessionId: string,
  env: SessionServerEnv,
): Promise<SessionAuthResult> {
  if (env.SESSION_AUTH_MODE !== DEVELOPMENT_AUTH_MODE) {
    return {
      ok: false,
      status: 501,
      message:
        "Session connection token validation is not configured. Use SESSION_AUTH_MODE=development only for local testing.",
    };
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const role = url.searchParams.get("role")?.trim().toUpperCase();
  const requestedClientId = url.searchParams.get("clientId")?.trim();

  if (!userId) {
    return { ok: false, status: 400, message: "Missing development userId." };
  }

  if (role !== "MASTER" && role !== "PLAYER") {
    return {
      ok: false,
      status: 400,
      message: "Development role must be MASTER or PLAYER.",
    };
  }

  return {
    ok: true,
    claims: {
      sessionId,
      userId,
      role,
      clientId: requestedClientId || crypto.randomUUID(),
      expiresAt: Date.now() + DEVELOPMENT_TOKEN_TTL_MS,
    },
  };
}
