import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
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
    characterId: string
  }>
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { characterId } = await context.params

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        campaignLinks: {
          select: {
            visibility: true,
            campaign: {
              select: {
                id: true,
                name: true,
                ownerId: true,
                owner: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                members: {
                  where: {
                    userId: session.user.id,
                  },
                  select: {
                    role: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        homebrewSpells: {
          select: {
            grantedAt: true,
            sourceCampaign: {
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
                ownerId: true,
                owner: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                campaignLinks: {
                  where: {
                    status: CampaignSpellApprovalStatus.APPROVED,
                    campaign: {
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
                  },
                  select: {
                    status: true,
                    campaign: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            grantedAt: "desc",
          },
        },
      },
    })

    if (!character) {
      throw new ApiError(
        404,
        "CHARACTER_NOT_FOUND",
        "Personagem não encontrado.",
      )
    }

    return jsonResponse({
      access: {
        campaigns: character.campaignLinks.map((link) => {
          const campaign = link.campaign
          const membership = campaign.members[0]
          const isOwner = campaign.ownerId === session.user.id

          return {
            id: campaign.id,
            name: campaign.name,
            master: campaign.owner,
            visibility: link.visibility,
            role: isOwner
              ? CampaignRole.MASTER
              : membership?.role ?? CampaignRole.PLAYER,
            status: isOwner
              ? CampaignMemberStatus.ACTIVE
              : membership?.status ?? CampaignMemberStatus.REMOVED,
          }
        }),
        homebrewSpells: character.homebrewSpells.map((grant) => ({
          id: grant.spell.id,
          index: grant.spell.index,
          name: grant.spell.name,
          author: grant.spell.owner,
          ownedByCurrentUser: grant.spell.ownerId === session.user.id,
          sourceCampaign: grant.sourceCampaign,
          approvedCampaigns: grant.spell.campaignLinks.map((link) => ({
            ...link.campaign,
            status: link.status,
          })),
          grantedAt: grant.grantedAt,
        })),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
