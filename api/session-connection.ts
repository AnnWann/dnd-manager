import {
  CampaignMemberStatus,
  type CampaignRole,
} from "../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../server/api"
import { prisma } from "../server/prisma"
import { requireSession } from "../server/session"
import {
  isValidSessionConnectionSecret,
  signSessionConnectionToken,
  type SessionConnectionRole,
} from "../src/shared/session-runtime/sessionConnectionToken"

const CONNECTION_TOKEN_TTL_MS = 60_000
const MAX_IDENTIFIER_LENGTH = 256

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const body = await readJsonObject(request)
    const sessionId = readIdentifier(body.sessionId, "sessionId")
    const clientId = readIdentifier(body.clientId, "clientId")

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        ownerId: true,
        members: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
            status: true,
          },
          take: 1,
        },
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "SESSION_NOT_FOUND",
        "A sessão solicitada não existe.",
      )
    }

    const role = resolveRole(
      campaign.ownerId,
      session.user.id,
      campaign.members[0],
    )
    if (!role) {
      throw new ApiError(
        403,
        "SESSION_ACCESS_DENIED",
        "Você não possui acesso ativo a esta sessão.",
      )
    }

    const secret = process.env.SESSION_CONNECTION_SECRET?.trim()
    if (!isValidSessionConnectionSecret(secret)) {
      console.error(
        "[session-connection] SESSION_CONNECTION_SECRET is missing or shorter than 32 bytes.",
      )
      throw new ApiError(
        500,
        "SESSION_AUTH_NOT_CONFIGURED",
        "A autenticação do servidor de sessão não está configurada.",
      )
    }

    const issuedAt = Date.now()
    const expiresAt = issuedAt + CONNECTION_TOKEN_TTL_MS
    const token = await signSessionConnectionToken(
      {
        v: 1,
        sessionId,
        userId: session.user.id,
        role,
        clientId,
        issuedAt,
        expiresAt,
      },
      secret,
    )

    return jsonResponse({
      token,
      expiresAt,
      role,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function resolveRole(
  ownerId: string,
  userId: string,
  membership:
    | {
        role: CampaignRole
        status: CampaignMemberStatus
      }
    | undefined,
): SessionConnectionRole | null {
  if (ownerId === userId) return "MASTER"
  if (!membership || membership.status !== CampaignMemberStatus.ACTIVE) {
    return null
  }
  return membership.role === "MASTER" ? "MASTER" : "PLAYER"
}

function readIdentifier(value: unknown, field: string): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new ApiError(
      400,
      "INVALID_SESSION_CONNECTION_REQUEST",
      `${field} inválido.`,
    )
  }
  return normalized
}
