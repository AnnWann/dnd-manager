import { createHmac, timingSafeEqual } from "node:crypto"
import { auth } from "../server/auth.js"
import { prisma } from "../server/prisma.js"
import { CampaignMemberStatus, CampaignRole } from "../generated/prisma/client.js"
import { canReadAnyCharacter, canWriteAnyCharacter, normalizeCampaignCapabilityOverrides } from "../src/shared/campaign/campaignRoles.js"
import { isValidSessionConnectionSecret, signSessionConnectionToken } from "../src/shared/session-runtime/sessionConnectionToken.js"

const ALLOWED_EXTENSION_ORIGINS = new Set(["https://dnd-manager-owlbear-annwanns-projects.vercel.app", "https://dnd-manager-seven.vercel.app"])
const TOKEN_TTL_SECONDS = 15 * 60
const SECRET = process.env.BETTER_AUTH_SECRET
type Grant = { userId: string; sessionId: string; expires: number; scope: "owlbear:characters" }
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } })
const cors = (origin: string | null): Record<string, string> =>
  Boolean(origin && ALLOWED_EXTENSION_ORIGINS.has(origin))
    ? { "Access-Control-Allow-Origin": origin!, "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", Vary: "Origin" }
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
  return new Response(null, { status: Boolean(origin && ALLOWED_EXTENSION_ORIGINS.has(origin)) ? 204 : 403, headers: cors(origin) })
}
export async function POST(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get("op") !== "authorize") return json({ error: "Not found" }, 404)
  // This is a same-origin, first-party operation; never grant from the embedded extension.
  const origin = request.headers.get("Origin")
  const target = new URL(request.url).origin
  if (origin !== target || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Invalid origin" }, 403)
  const body = await request.json().catch(() => null) as { extensionOrigin?: string } | null
  if (!body?.extensionOrigin || !ALLOWED_EXTENSION_ORIGINS.has(body.extensionOrigin)) return json({ error: "Extension not allowed" }, 403)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return json({ error: "Login required" }, 401)
  return json({ token: createGrant({ userId: session.user.id, sessionId: session.session.id, expires: Date.now() + TOKEN_TTL_SECONDS * 1000, scope: "owlbear:characters" }), expiresIn: TOKEN_TTL_SECONDS })
}
export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin"), headers = cors(origin)
  if (!origin || !ALLOWED_EXTENSION_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, headers)
  const grant = await validateGrant(request)
  if (!grant) return json({ error: "Authorization required or expired" }, 401, headers)
  const url = new URL(request.url), op = url.searchParams.get("op")
  if (op === "sessions") {
    const campaigns = await prisma.campaign.findMany({
      where: { OR: [{ ownerId: grant.userId }, { members: { some: { userId: grant.userId, status: CampaignMemberStatus.ACTIVE } } }] },
      select: { id: true, name: true, ownerId: true, members: { where: { userId: grant.userId, status: CampaignMemberStatus.ACTIVE }, select: { role: true, permissions: true }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    })
    return json({ sessions: campaigns.map(c => ({ id: c.id, name: c.name, role: c.ownerId === grant.userId || c.members[0]?.role === CampaignRole.MASTER ? "MASTER" : "PLAYER" })) }, 200, headers)
  }
  if (op === "connect") {
    const sessionId = url.searchParams.get("sessionId") ?? ""
    if (!sessionId || sessionId.length > 256) return json({ error: "Invalid session" }, 400, headers)
    const campaign = await prisma.campaign.findUnique({
      where: { id: sessionId },
      select: { ownerId: true, members: { where: { userId: grant.userId, status: CampaignMemberStatus.ACTIVE }, select: { role: true, permissions: true }, take: 1 } },
    })
    if (!campaign || (campaign.ownerId !== grant.userId && !campaign.members.length)) return json({ error: "Session access denied" }, 403, headers)
    const isOwner = campaign.ownerId === grant.userId
    const role = isOwner ? CampaignRole.MASTER : campaign.members[0]!.role
    const permissions = isOwner ? {} : normalizeCampaignCapabilityOverrides(campaign.members[0]!.permissions)
    const secret = process.env.SESSION_CONNECTION_SECRET?.trim()
    if (!isValidSessionConnectionSecret(secret)) return json({ error: "Session authentication not configured" }, 503, headers)
    const baseUrl = process.env.VITE_SESSION_SERVER_URL?.trim()
    if (!baseUrl || !baseUrl.startsWith("https://")) return json({ error: "Session server URL not configured" }, 503, headers)
    const issuedAt = Date.now(), expiresAt = issuedAt + 60_000
    const token = await signSessionConnectionToken({
      v: 1, sessionId, userId: grant.userId, role: role === CampaignRole.MASTER ? "MASTER" : "PLAYER",
      clientId: crypto.randomUUID(), issuedAt, expiresAt,
      canReadAnyCharacter: canReadAnyCharacter(role, permissions),
      canWriteAnyCharacter: canWriteAnyCharacter(role, permissions),
    }, secret)
    return json({ token, baseUrl, expiresAt, role: role === CampaignRole.MASTER ? "MASTER" : "PLAYER" }, 200, headers)
  }
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
  if (!origin || !ALLOWED_EXTENSION_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, headers)
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
