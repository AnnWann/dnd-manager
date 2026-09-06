import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../server/api.js"
import { prisma } from "../../../../server/prisma.js"
import { requireSession } from "../../../../server/session.js"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
      }>
    | {
        campaignId?: string
      }
}

export async function PATCH(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    const body = await readJsonObject(request)
    const name = parseCampaignName(body.name)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        ownerId: true,
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Campanha não encontrada.",
      )
    }

    if (campaign.ownerId !== session.user.id) {
      throw new ApiError(
        403,
        "CAMPAIGN_RENAME_FORBIDDEN",
        "Somente o mestre principal da campanha pode alterar o nome da sessão.",
      )
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { name },
      select: {
        id: true,
        name: true,
      },
    })

    return jsonResponse({ campaign: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        ownerId: true,
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Campanha não encontrada.",
      )
    }

    if (campaign.ownerId !== session.user.id) {
      throw new ApiError(
        403,
        "CAMPAIGN_DELETE_FORBIDDEN",
        "Somente o proprietário da campanha pode excluí-la.",
      )
    }

    await prisma.$transaction(async (tx) => {
      // These legacy/content tables intentionally do not have Prisma relations
      // to Campaign, so remove their rows explicitly before deleting it.
      await tx.$executeRaw`
        DELETE FROM "campaign_content_request"
        WHERE "campaignId" = ${campaignId}
      `
      await tx.$executeRaw`
        DELETE FROM "campaign_homebrew_asset"
        WHERE "campaignId" = ${campaignId}
      `
      await tx.$executeRaw`
        DELETE FROM "campaign_item_compendium"
        WHERE "campaignId" = ${campaignId}
      `

      // Members, character links and approved homebrew links are relational
      // children and are removed through their configured cascade rules.
      await tx.campaign.delete({
        where: { id: campaignId },
      })
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}

function parseCampaignName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError(
      400,
      "CAMPAIGN_NAME_REQUIRED",
      "O nome da sessão é obrigatório.",
    )
  }

  const name = value.trim()
  if (!name) {
    throw new ApiError(
      400,
      "CAMPAIGN_NAME_REQUIRED",
      "O nome da sessão é obrigatório.",
    )
  }
  if (name.length > 120) {
    throw new ApiError(
      400,
      "CAMPAIGN_NAME_TOO_LONG",
      "O nome da sessão deve ter no máximo 120 caracteres.",
    )
  }
  return name
}

async function resolveCampaignId(
  request: Request,
  context?: RouteContext,
): Promise<string> {
  const params = context?.params ? await context.params : undefined
  const campaignId = params?.campaignId?.trim()
  if (campaignId) return campaignId

  const match = new URL(request.url).pathname.match(
    /\/api\/me\/campaigns\/([^/]+)\/?$/,
  )
  if (match?.[1]) return decodeURIComponent(match[1])

  throw new ApiError(
    400,
    "CAMPAIGN_ID_REQUIRED",
    "O identificador da campanha não foi informado.",
  )
}
