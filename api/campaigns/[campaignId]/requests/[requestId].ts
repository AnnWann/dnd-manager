import {
  CampaignMemberStatus,
  CampaignRole,
  CharacterVisibility,
} from "../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../server/api"
import { prisma } from "../../../../server/prisma"
import { requireSession } from "../../../../server/session"

type RouteContext = {
  params: Promise<{
    campaignId: string
    requestId: string
  }>
}

type RequestType = "CHARACTER" | "SYSTEM" | "CLASS" | "OTHER"
type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

type RawRequest = {
  id: string
  campaignId: string
  type: RequestType
  status: RequestStatus
  title: string
  sourceId: string
  data: unknown
  submittedById: string
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, requestId } = await context.params
    await requireMaster(campaignId, session.user.id)
    const body = await readJsonObject(request)
    const status = parseReviewStatus(body.status)
    const note =
      typeof body.note === "string"
        ? body.note.trim().slice(0, 2000) || null
        : null

    const rows = await prisma.$queryRaw<RawRequest[]>`
      SELECT
        "id",
        "campaignId",
        "type",
        "status",
        "title",
        "sourceId",
        "data",
        "submittedById"
      FROM "campaign_content_request"
      WHERE "id" = ${requestId}
        AND "campaignId" = ${campaignId}
      LIMIT 1
    `
    const entry = rows[0]

    if (!entry) {
      throw new ApiError(
        404,
        "CONTENT_REQUEST_NOT_FOUND",
        "Solicitação não encontrada.",
      )
    }

    if (status === "APPROVED") {
      await applyApprovedContent(entry, session.user.id)
    }

    await prisma.$executeRaw`
      UPDATE "campaign_content_request"
      SET
        "status" = ${status},
        "note" = ${note},
        "reviewedById" = ${session.user.id},
        "reviewedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${requestId}
        AND "campaignId" = ${campaignId}
    `

    return jsonResponse({
      request: {
        id: requestId,
        status,
        reviewedAt: new Date(),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

async function applyApprovedContent(
  entry: RawRequest,
  actorId: string,
): Promise<void> {
  const data = isRecord(entry.data) ? entry.data : {}

  if (entry.type === "CHARACTER") {
    const character = await prisma.character.findFirst({
      where: {
        id: entry.sourceId,
        ownerId: entry.submittedById,
      },
      select: { id: true },
    })

    if (!character) {
      throw new ApiError(
        404,
        "CHARACTER_NOT_FOUND",
        "O personagem solicitado não está mais disponível.",
      )
    }

    await prisma.campaignCharacter.upsert({
      where: {
        campaignId_characterId: {
          campaignId: entry.campaignId,
          characterId: entry.sourceId,
        },
      },
      update: {
        visibility: parseVisibility(data.visibility),
      },
      create: {
        campaignId: entry.campaignId,
        characterId: entry.sourceId,
        visibility: parseVisibility(data.visibility),
      },
    })
    return
  }

  const assetId = crypto.randomUUID()
  const dataJson = JSON.stringify(data)

  await prisma.$executeRaw`
    INSERT INTO "campaign_homebrew_asset" (
      "id",
      "campaignId",
      "type",
      "sourceId",
      "name",
      "data",
      "addedById",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${assetId},
      ${entry.campaignId},
      ${entry.type},
      ${entry.sourceId},
      ${entry.title},
      ${dataJson}::jsonb,
      ${actorId},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("campaignId", "type", "sourceId") DO UPDATE SET
      "name" = EXCLUDED."name",
      "data" = EXCLUDED."data",
      "addedById" = EXCLUDED."addedById",
      "updatedAt" = CURRENT_TIMESTAMP
  `
}

async function requireMaster(campaignId: string, userId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
              status: CampaignMemberStatus.ACTIVE,
              role: CampaignRole.MASTER,
            },
          },
        },
      ],
    },
    select: { id: true },
  })

  if (!campaign) {
    throw new ApiError(
      403,
      "CAMPAIGN_MASTER_REQUIRED",
      "Somente mestres podem revisar solicitações da sessão.",
    )
  }
}

function parseReviewStatus(value: unknown): "APPROVED" | "REJECTED" {
  if (value === "APPROVED" || value === "REJECTED") return value
  throw new ApiError(
    400,
    "INVALID_REVIEW_STATUS",
    "A revisão precisa aprovar ou rejeitar a solicitação.",
  )
}

function parseVisibility(value: unknown): CharacterVisibility {
  if (value === CharacterVisibility.PRIVATE) return CharacterVisibility.PRIVATE
  if (value === CharacterVisibility.MASTER) return CharacterVisibility.MASTER
  return CharacterVisibility.PARTY
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
