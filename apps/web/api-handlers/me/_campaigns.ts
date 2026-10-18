import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
} from "../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../server/api.js"
import { prisma } from "../../server/prisma.js"
import { requireSession } from "../../server/session.js"

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)

    const campaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                status: {
                  not: CampaignMemberStatus.REMOVED,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        inviteCode: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          where: {
            OR: [
              { userId: session.user.id },
              { status: CampaignMemberStatus.INVITED },
            ],
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
        },
        characters: {
          where: {
            character: {
              ownerId: session.user.id,
            },
          },
          select: {
            visibility: true,
            character: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        homebrewSpells: {
          where: {
            OR: [
              { status: CampaignSpellApprovalStatus.APPROVED },
              { submittedById: session.user.id },
              {
                campaign: {
                  ownerId: session.user.id,
                },
              },
            ],
          },
          select: {
            id: true,
            status: true,
            note: true,
            submittedAt: true,
            reviewedAt: true,
            submittedById: true,
            spell: {
              select: {
                id: true,
                index: true,
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
            updatedAt: "desc",
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return jsonResponse({
      campaigns: campaigns.map((campaign) => {
        const membership = campaign.members.find(
          (member) => member.userId === session.user.id,
        )
        const isOwner = campaign.ownerId === session.user.id

        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          inviteCode: isOwner ? campaign.inviteCode : undefined,
          owner: campaign.owner,
          isOwner,
          role: isOwner
            ? CampaignRole.MASTER
            : membership?.role ?? CampaignRole.PLAYER,
          status: isOwner
            ? CampaignMemberStatus.ACTIVE
            : membership?.status ?? CampaignMemberStatus.REMOVED,
          characters: campaign.characters.map((link) => ({
            ...link.character,
            visibility: link.visibility,
          })),
          pendingMembers: isOwner
            ? campaign.members
                .filter(
                  (member) =>
                    member.status === CampaignMemberStatus.INVITED &&
                    member.userId !== session.user.id,
                )
                .map((member) => member.user)
            : [],
          homebrew: {
            approved: campaign.homebrewSpells.filter(
              (link) =>
                link.status === CampaignSpellApprovalStatus.APPROVED,
            ).length,
            pending: campaign.homebrewSpells.filter(
              (link) =>
                link.status === CampaignSpellApprovalStatus.PENDING,
            ).length,
            rejected: campaign.homebrewSpells.filter(
              (link) =>
                link.status === CampaignSpellApprovalStatus.REJECTED,
            ).length,
            revoked: campaign.homebrewSpells.filter(
              (link) =>
                link.status === CampaignSpellApprovalStatus.REVOKED,
            ).length,
          },
          homebrewSpells: campaign.homebrewSpells.map((link) => ({
            linkId: link.id,
            id: link.spell.id,
            index: link.spell.index,
            name: link.spell.name,
            author: link.spell.owner,
            status: link.status,
            note: link.note,
            submittedAt: link.submittedAt,
            reviewedAt: link.reviewedAt,
            submittedByCurrentUser:
              link.submittedById === session.user.id,
          })),
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        }
      }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const body = await readJsonObject(request)
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 2000)
        : ""

    if (!name) {
      throw new ApiError(
        400,
        "CAMPAIGN_NAME_REQUIRED",
        "A campanha precisa ter um nome.",
      )
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: name.slice(0, 120),
        description: description || null,
        inviteCode: createInviteCode(),
        ownerId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        inviteCode: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return jsonResponse(
      {
        campaign: {
          ...campaign,
          owner: {
            id: session.user.id,
            name: session.user.name,
          },
          isOwner: true,
          role: CampaignRole.MASTER,
          status: CampaignMemberStatus.ACTIVE,
          characters: [],
          pendingMembers: [],
          homebrew: {
            approved: 0,
            pending: 0,
            rejected: 0,
            revoked: 0,
          },
          homebrewSpells: [],
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}

function createInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
}
