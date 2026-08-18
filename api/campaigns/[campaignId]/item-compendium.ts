import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"

type RouteContext = {
  params: Promise<{
    campaignId: string
  }>
}

type ItemVisibility = "PUBLIC" | "MASTER"

type RawCompendiumRow = {
  id: string
  campaignId: string
  templateId: string
  item: unknown
  custom: boolean
  visibility: ItemVisibility
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId } = await context.params
    const access = await requireCampaignAccess(campaignId, session.user.id)

    const rows = access.isMaster
      ? await prisma.$queryRaw<RawCompendiumRow[]>`
          SELECT
            "id",
            "campaignId",
            "templateId",
            "item",
            "custom",
            "visibility",
            "createdById",
            "createdAt",
            "updatedAt"
          FROM "campaign_item_compendium"
          WHERE "campaignId" = ${campaignId}
          ORDER BY "updatedAt" DESC
        `
      : await prisma.$queryRaw<RawCompendiumRow[]>`
          SELECT
            "id",
            "campaignId",
            "templateId",
            CASE
              WHEN "custom" = FALSE THEN NULL
              ELSE "item"
            END AS "item",
            "custom",
            "visibility",
            "createdById",
            "createdAt",
            "updatedAt"
          FROM "campaign_item_compendium"
          WHERE "campaignId" = ${campaignId}
            AND (
              "custom" = FALSE
              OR "visibility" = 'PUBLIC'
            )
          ORDER BY "updatedAt" DESC
        `

    return jsonResponse({
      campaign: {
        id: campaignId,
        isMaster: access.isMaster,
      },
      entries: rows,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId } = await context.params
    const access = await requireCampaignAccess(campaignId, session.user.id)

    if (!access.isMaster) {
      throw new ApiError(
        403,
        "CAMPAIGN_MASTER_REQUIRED",
        "Somente mestres podem alterar o compêndio de itens da sessão.",
      )
    }

    const body = await readJsonObject(request)
    const item = readItem(body.item)
    const templateId = readRequiredString(item.id, "item.id", 240)
    const visibility = parseVisibility(body.visibility)
    const custom = body.custom === true
    const itemJson = JSON.stringify(item)

    if (itemJson.length > 2_000_000) {
      throw new ApiError(
        413,
        "ITEM_PAYLOAD_TOO_LARGE",
        "O item ultrapassa o limite de 2 MB.",
      )
    }

    const id = crypto.randomUUID()

    const rows = await prisma.$queryRaw<RawCompendiumRow[]>`
      INSERT INTO "campaign_item_compendium" (
        "id",
        "campaignId",
        "templateId",
        "item",
        "custom",
        "visibility",
        "createdById",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${id},
        ${campaignId},
        ${templateId},
        ${itemJson}::jsonb,
        ${custom},
        ${visibility},
        ${session.user.id},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("campaignId", "templateId") DO UPDATE SET
        "item" = EXCLUDED."item",
        "custom" = EXCLUDED."custom",
        "visibility" = EXCLUDED."visibility",
        "createdById" = EXCLUDED."createdById",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        "id",
        "campaignId",
        "templateId",
        "item",
        "custom",
        "visibility",
        "createdById",
        "createdAt",
        "updatedAt"
    `

    return jsonResponse({ entry: rows[0] }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

async function requireCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<{ isMaster: boolean }> {
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
            },
          },
        },
      ],
    },
    select: {
      ownerId: true,
      members: {
        where: {
          userId,
          status: CampaignMemberStatus.ACTIVE,
        },
        select: { role: true },
      },
    },
  })

  if (!campaign) {
    throw new ApiError(
      403,
      "CAMPAIGN_ACCESS_DENIED",
      "Você precisa ser membro ativo desta sessão.",
    )
  }

  return {
    isMaster:
      campaign.ownerId === userId ||
      campaign.members.some((member) => member.role === CampaignRole.MASTER),
  }
}

function parseVisibility(value: unknown): ItemVisibility {
  return value === "MASTER" ? "MASTER" : "PUBLIC"
}

function readItem(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_ITEM", "O item precisa ser um objeto válido.")
  }

  const item = value as Record<string, unknown>
  readRequiredString(item.id, "item.id", 240)
  readRequiredString(item.name, "item.name", 240)
  return item
}

function readRequiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized) {
    throw new ApiError(400, "ITEM_FIELD_REQUIRED", `${field} é obrigatório.`)
  }
  return normalized.slice(0, maxLength)
}
