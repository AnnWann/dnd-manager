import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../../server/api"
import { prisma } from "../../../../server/prisma"
import { requireSession } from "../../../../server/session"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
        templateId?: string
      }>
    | {
        campaignId?: string
        templateId?: string
      }
}

export async function DELETE(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, templateId } = await resolveRouteParams(request, context)
    const access = await requireCampaignAccess(campaignId, session.user.id)

    if (!access.isMaster) {
      throw new ApiError(
        403,
        "CAMPAIGN_MASTER_REQUIRED",
        "Somente mestres podem alterar o compêndio de itens da sessão.",
      )
    }

    await prisma.$executeRaw`
      DELETE FROM "campaign_item_compendium"
      WHERE "campaignId" = ${campaignId}
        AND "templateId" = ${templateId}
    `

    return jsonResponse({ ok: true })
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

async function resolveRouteParams(
  request: Request,
  context?: RouteContext,
): Promise<{ campaignId: string; templateId: string }> {
  const params = context?.params ? await context.params : undefined
  const fromContextCampaignId = params?.campaignId?.trim()
  const fromContextTemplateId = params?.templateId?.trim()
  if (fromContextCampaignId && fromContextTemplateId) {
    return {
      campaignId: fromContextCampaignId,
      templateId: fromContextTemplateId,
    }
  }

  const match = new URL(request.url).pathname.match(
    /\/api\/campaigns\/([^/]+)\/item-compendium\/([^/]+)/,
  )
  if (match?.[1] && match?.[2]) {
    return {
      campaignId: decodeURIComponent(match[1]),
      templateId: decodeURIComponent(match[2]),
    }
  }

  throw new ApiError(
    400,
    "ITEM_ROUTE_PARAMS_REQUIRED",
    "Os identificadores da campanha e do item não foram informados.",
  )
}
