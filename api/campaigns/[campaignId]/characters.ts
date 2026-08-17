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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: {
          where: { userId: session.user.id },
          select: {
            role: true,
            status: true,
          },
        },
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Campanha não encontrada.",
      )
    }

    const membership = campaign.members[0]
    const isOwner = campaign.ownerId === session.user.id
    const isActiveMember = membership?.status === CampaignMemberStatus.ACTIVE

    if (!isOwner && !isActiveMember) {
      throw new ApiError(
        403,
        "CAMPAIGN_ACCESS_FORBIDDEN",
        "Você não participa ativamente desta campanha.",
      )
    }

    const role = isOwner
      ? CampaignRole.MASTER
      : membership?.role ?? CampaignRole.PLAYER
    const isMaster = role === CampaignRole.MASTER

    const links = await prisma.campaignCharacter.findMany({
      where: {
        campaignId,
        ...(isMaster
          ? {}
          : {
              character: {
                ownerId: session.user.id,
              },
            }),
      },
      select: {
        visibility: true,
        addedAt: true,
        character: {
          select: {
            id: true,
            name: true,
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
        addedAt: "asc",
      },
    })

    return jsonResponse({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        role,
        isMaster,
      },
      characters: links.map((link) => ({
        id: link.character.id,
        name: link.character.name,
        visibility: link.visibility,
        owner: link.character.owner,
        addedAt: link.addedAt,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
