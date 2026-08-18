import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../server/api"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"

type RouteContext = {
  params: Promise<{
    campaignId: string
  }>
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId } = await context.params

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        inviteCode: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          where: {
            status: {
              not: CampaignMemberStatus.REMOVED,
            },
          },
          select: {
            userId: true,
            role: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
      },
    })

    if (!campaign) {
      throw new ApiError(
        403,
        "MASTER_REQUIRED",
        "Somente o mestre pode acessar as configurações da sessão.",
      )
    }

    return jsonResponse({
      settings: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          inviteCode: campaign.inviteCode,
        },
        owner: {
          ...campaign.owner,
          role: CampaignRole.MASTER,
          status: CampaignMemberStatus.ACTIVE,
        },
        members: campaign.members.map((member) => ({
          ...member.user,
          role: member.role,
          status: member.status,
        })),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
