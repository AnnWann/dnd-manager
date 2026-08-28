import {
  isValidSessionConnectionSecret,
  verifySessionConnectionToken,
} from "../../../../src/shared/session-runtime/sessionConnectionToken";
import type { SessionRole } from "./protocol";

export interface SessionConnectionClaims {
  sessionId: string;
  userId: string;
  role: SessionRole;
  clientId: string;
  expiresAt: number;
  ownedCharacterIds?: string[];
}

export interface SessionServerEnv {
  SESSION_ACTOR: DurableObjectNamespace;
  SESSION_AUTH_MODE?: "development" | "token";
  SESSION_CONNECTION_SECRET?: string;
}

export type SessionAuthResult =
  | { ok: true; claims: SessionConnectionClaims }
  | { ok: false; status: number; message: string };

const DEVELOPMENT_AUTH_MODE = "development";
const TOKEN_AUTH_MODE = "token";
const DEVELOPMENT_TOKEN_TTL_MS = 5 * 60 * 1000;

export async function authenticateSessionConnection(
  request: Request,
  sessionId: string,
  env: SessionServerEnv,
): Promise<SessionAuthResult> {
  if (env.SESSION_AUTH_MODE === DEVELOPMENT_AUTH_MODE) {
    return authenticateDevelopmentConnection(request, sessionId);
  }

  if (env.SESSION_AUTH_MODE !== TOKEN_AUTH_MODE) {
    return {
      ok: false,
      status: 500,
      message: "Session authentication mode is not configured.",
    };
  }

  const secret = env.SESSION_CONNECTION_SECRET?.trim();
  if (!isValidSessionConnectionSecret(secret)) {
    console.error(
      "[session-auth] SESSION_CONNECTION_SECRET is missing or shorter than 32 bytes.",
    );
    return {
      ok: false,
      status: 500,
      message: "Session token authentication is not configured.",
    };
  }

  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Missing session connection token.",
    };
  }

  const claims = await verifySessionConnectionToken(token, secret);
  if (!claims || claims.sessionId !== sessionId) {
    return {
      ok: false,
      status: 401,
      message: "Invalid or expired session connection token.",
    };
  }

  return {
    ok: true,
    claims: {
      sessionId: claims.sessionId,
      userId: claims.userId,
      role: claims.role,
      clientId: claims.clientId,
      expiresAt: claims.expiresAt,
      ownedCharacterIds: claims.ownedCharacterIds,
    },
  };
}

function authenticateDevelopmentConnection(
  request: Request,
  sessionId: string,
): SessionAuthResult {
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
