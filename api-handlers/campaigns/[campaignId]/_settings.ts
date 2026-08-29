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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        ownerId: true,
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
      throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
    }

    const isOwner = campaign.ownerId === session.user.id
    const membership = campaign.members.find(
      (member) =>
        member.userId === session.user.id &&
        member.status === CampaignMemberStatus.ACTIVE,
    )
    const role = isOwner ? CampaignRole.MASTER : membership?.role
    const canViewPermissions =
      role === CampaignRole.MASTER || role === CampaignRole.MODERATOR

    if (!canViewPermissions) {
      throw new ApiError(
        403,
        "PERMISSIONS_REQUIRED",
        "Somente mestres e moderadores podem acessar as permissões da sessão.",
      )
    }

    return jsonResponse({
      settings: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          inviteCode: isOwner ? campaign.inviteCode : null,
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
        canManageMembers: isOwner,
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
