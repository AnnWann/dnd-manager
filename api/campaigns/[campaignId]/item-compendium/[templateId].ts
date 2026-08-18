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
  params: Promise<{
    campaignId: string
    templateId: string
  }>
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, templateId } = await context.params
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
