import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
  HomebrewSpellStatus,
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
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                status: CampaignMemberStatus.ACTIVE,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: {
          where: {
            userId: session.user.id,
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

    const isMaster =
      campaign.ownerId === session.user.id ||
      campaign.members.some((member) => member.role === CampaignRole.MASTER)

    const links = await prisma.campaignHomebrewSpell.findMany({
      where: {
        campaignId,
        spell: {
          status: HomebrewSpellStatus.ACTIVE,
        },
        ...(isMaster
          ? {}
          : {
              OR: [
                { status: CampaignSpellApprovalStatus.APPROVED },
                { submittedById: session.user.id },
              ],
            }),
      },
      select: {
        id: true,
        status: true,
        note: true,
        submittedAt: true,
        reviewedAt: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        spell: {
          select: {
            id: true,
            index: true,
            name: true,
            data: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    })

    return jsonResponse({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        isMaster,
      },
      spells: links.map((link) => ({
        linkId: link.id,
        status: link.status,
        note: link.note,
        submittedAt: link.submittedAt,
        reviewedAt: link.reviewedAt,
        submittedBy: link.submittedBy,
        reviewedBy: link.reviewedBy,
        id: link.spell.id,
        index: link.spell.index,
        name: link.spell.name,
        data: link.spell.data,
        author: link.spell.owner,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
