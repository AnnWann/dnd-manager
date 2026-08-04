import {
  CampaignMemberStatus,
} from "../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
} from "../../../../server/api"
import { prisma } from "../../../../server/prisma"
import { requireSession } from "../../../../server/session"

type RouteContext = {
  params: Promise<{
    campaignId: string
  }>
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId } = await context.params

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: campaignId,
      },
      select: {
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

    if (campaign.ownerId === session.user.id) {
      throw new ApiError(
        409,
        "OWNER_CANNOT_LEAVE",
        "O mestre não pode sair da própria campanha.",
      )
    }

    await prisma.$transaction([
      prisma.campaignCharacter.deleteMany({
        where: {
          campaignId,
          character: {
            ownerId: session.user.id,
          },
        },
      }),
      prisma.campaignMember.updateMany({
        where: {
          campaignId,
          userId: session.user.id,
        },
        data: {
          status: CampaignMemberStatus.REMOVED,
        },
      }),
    ])

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
