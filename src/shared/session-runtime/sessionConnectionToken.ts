export type SessionConnectionRole = "MASTER" | "PLAYER"

export type SessionConnectionTokenClaims = {
  v: 1
  sessionId: string
  userId: string
  role: SessionConnectionRole
  clientId: string
  issuedAt: number
  expiresAt: number
}

const TOKEN_VERSION = 1
const MAX_TOKEN_LENGTH = 4096
const MAX_IDENTIFIER_LENGTH = 256
const MAX_TOKEN_TTL_MS = 90_000
const CLOCK_SKEW_MS = 5_000
const MIN_SECRET_BYTES = 32
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function isValidSessionConnectionSecret(
  value: string | null | undefined,
): value is string {
  return Boolean(value && encoder.encode(value).byteLength >= MIN_SECRET_BYTES)
}

export async function signSessionConnectionToken(
  claims: SessionConnectionTokenClaims,
  secret: string,
): Promise<string> {
  if (!isValidSessionConnectionSecret(secret)) {
    throw new Error(
      `SESSION_CONNECTION_SECRET must contain at least ${MIN_SECRET_BYTES} bytes.`,
    )
  }

  if (!isValidClaims(claims, claims.issuedAt)) {
    throw new Error("Invalid session connection token claims.")
  }

  const payload = encodeBase64Url(encoder.encode(JSON.stringify(claims)))
  const signature = await signPayload(payload, secret)
  return `${payload}.${encodeBase64Url(signature)}`
}

export async function verifySessionConnectionToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<SessionConnectionTokenClaims | null> {
  if (
    !token ||
    token.length > MAX_TOKEN_LENGTH ||
    !isValidSessionConnectionSecret(secret)
  ) {
    return null
  }

  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  try {
    const expectedSignature = decodeBase64Url(parts[1])
    const key = await importHmacKey(secret, ["verify"])
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      expectedSignature,
      encoder.encode(parts[0]),
    )
    if (!validSignature) return null

    const decoded = decoder.decode(decodeBase64Url(parts[0]))
    const claims = JSON.parse(decoded) as unknown
    return isValidClaims(claims, now) ? claims : null
  } catch {
    return null
  }
}

async function signPayload(
  payload: string,
  secret: string,
): Promise<Uint8Array> {
  const key = await importHmacKey(secret, ["sign"])
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  )
  return new Uint8Array(signature)
}

function importHmacKey(
  secret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    usages,
  )
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    )
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url value.")
  }

  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function isValidClaims(
  value: unknown,
  now: number,
): value is SessionConnectionTokenClaims {
  if (!isRecord(value) || value.v !== TOKEN_VERSION) return false
  if (!isIdentifier(value.sessionId) || !isIdentifier(value.userId)) return false
  if (!isIdentifier(value.clientId)) return false
  if (value.role !== "MASTER" && value.role !== "PLAYER") return false
  if (!Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)) {
    return false
  }
  if (value.issuedAt > now + CLOCK_SKEW_MS) return false
  if (value.expiresAt <= now) return false
  if (value.expiresAt <= value.issuedAt) return false
  if (value.expiresAt - value.issuedAt > MAX_TOKEN_TTL_MS) return false
  return true
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
