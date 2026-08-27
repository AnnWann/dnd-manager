import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../server/api.js"
import { prisma } from "../../../server/prisma.js"
import { requireSession } from "../../../server/session.js"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
      }>
    | {
        campaignId?: string
      }
}

export async function GET(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)

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

async function resolveCampaignId(
  request: Request,
  context?: RouteContext,
): Promise<string> {
  const params = context?.params ? await context.params : undefined
  const fromContext = params?.campaignId?.trim()
  if (fromContext) return fromContext

  const match = new URL(request.url).pathname.match(/\/api\/campaigns\/([^/]+)/)
  if (match?.[1]) return decodeURIComponent(match[1])

  throw new ApiError(
    400,
    "CAMPAIGN_ID_REQUIRED",
    "O identificador da campanha não foi informado.",
  )
}
