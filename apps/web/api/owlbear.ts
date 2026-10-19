import { createHmac, timingSafeEqual } from "node:crypto"
import { auth } from "../server/auth.js"
import { prisma } from "../server/prisma.js"

const EXTENSION_ORIGIN = "https://dnd-manager-owlbear-annwanns-projects.vercel.app"
const TOKEN_TTL_SECONDS = 15 * 60
const SECRET = process.env.BETTER_AUTH_SECRET
type Grant = { userId: string; sessionId: string; expires: number; scope: "owlbear:characters" }
const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } })
const cors = (origin: string | null): Record<string, string> =>
  origin === EXTENSION_ORIGIN
    ? { "Access-Control-Allow-Origin": EXTENSION_ORIGIN, "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", Vary: "Origin" }
    : { Vary: "Origin" }
const sign = (payload: string): string => {
  if (!SECRET) throw new Error("BETTER_AUTH_SECRET ausente")
  return createHmac("sha256", SECRET).update("owlbear-characters-v1." + payload).digest("base64url")
}
const createGrant = (grant: Grant) => {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url")
  return payload + "." + sign(payload)
}
async function validateGrant(request: Request): Promise<Grant | null> {
  const value = request.headers.get("Authorization")?.match(/^Bearer ([\w-]+\.[\w-]+)$/)?.[1]
  if (!value) return null
  const [payload, mac] = value.split(".")
  if (!payload || !mac || !SECRET) return null
  const expected = sign(payload)
  const first = Buffer.from(expected), second = Buffer.from(mac)
  if (first.length !== second.length || !timingSafeEqual(first, second)) return null
  try {
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString()) as Grant
    if (grant.scope !== "owlbear:characters" || !grant.userId || !grant.sessionId ||
        !Number.isFinite(grant.expires) || grant.expires <= Date.now()) return null
    const session = await prisma.session.findUnique({ where: { id: grant.sessionId }, select: { userId: true, expiresAt: true } })
    if (session?.userId !== grant.userId || session.expiresAt.getTime() <= Date.now()) return null
    return grant
  } catch { return null }
}
export function OPTIONS(request: Request): Response {
  const origin = request.headers.get("Origin")
  return new Response(null, { status: origin === EXTENSION_ORIGIN ? 204 : 403, headers: cors(origin) })
}
export async function POST(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get("op") !== "authorize") return json({ error: "Not found" }, 404)
  // This is a same-origin, first-party operation; never grant from the embedded extension.
  const origin = request.headers.get("Origin")
  const target = new URL(request.url).origin
  if (origin !== target || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Invalid origin" }, 403)
  const body = await request.json().catch(() => null) as { extensionOrigin?: string } | null
  if (body?.extensionOrigin !== EXTENSION_ORIGIN) return json({ error: "Extension not allowed" }, 403)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return json({ error: "Login required" }, 401)
  return json({ token: createGrant({ userId: session.user.id, sessionId: session.session.id, expires: Date.now() + TOKEN_TTL_SECONDS * 1000, scope: "owlbear:characters" }), expiresIn: TOKEN_TTL_SECONDS })
}
export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin"), headers = cors(origin)
  if (origin !== EXTENSION_ORIGIN) return json({ error: "Origin not allowed" }, 403, headers)
  const grant = await validateGrant(request)
  if (!grant) return json({ error: "Authorization required or expired" }, 401, headers)
  const url = new URL(request.url), op = url.searchParams.get("op")
  if (op === "characters") {
    const characters = await prisma.character.findMany({ where: { ownerId: grant.userId }, select: { id: true, name: true, revision: true }, orderBy: { updatedAt: "desc" } })
    return json({ characters }, 200, headers)
  }
  if (op === "character") {
    const id = url.searchParams.get("id") ?? ""
    const character = await prisma.character.findFirst({ where: { id, ownerId: grant.userId }, select: { id: true, name: true, revision: true, data: true } })
    return character ? json({ character }, 200, headers) : json({ error: "Not found" }, 404, headers)
  }
  return json({ error: "Not found" }, 404, headers)
}
export async function PATCH(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin"), headers = cors(origin)
  if (origin !== EXTENSION_ORIGIN) return json({ error: "Origin not allowed" }, 403, headers)
  const grant = await validateGrant(request)
  if (!grant) return json({ error: "Authorization required or expired" }, 401, headers)
  const url = new URL(request.url)
  if (url.searchParams.get("op") !== "character") return json({ error: "Not found" }, 404, headers)
  const body = await request.json().catch(() => null) as { name?: unknown; expectedVersion?: unknown } | null
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const revision = body?.expectedVersion
  const id = url.searchParams.get("id") ?? ""
  if (!id || !name || name.length > 120 || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
    return json({ error: "Invalid update" }, 400, headers)
  const changed = await prisma.character.updateMany({ where: { id, ownerId: grant.userId, revision }, data: { name, revision: { increment: 1 } } })
  if (!changed.count) return json({ error: "Character not found or concurrent edit" }, 409, headers)
  const character = await prisma.character.findFirst({ where: { id, ownerId: grant.userId }, select: { id: true, name: true, revision: true, data: true } })
  return json({ character }, 200, headers)
}
