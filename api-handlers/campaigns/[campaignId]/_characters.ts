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
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          where: {
            status: CampaignMemberStatus.ACTIVE,
          },
          select: {
            userId: true,
            role: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true,
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
        404,
        "CAMPAIGN_NOT_FOUND",
        "Campanha não encontrada.",
      )
    }

    const membership = campaign.members.find(
      (member) => member.userId === session.user.id,
    )
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
    const canAccessAllCharacters = isMaster || role === CampaignRole.MODERATOR

    const links = await prisma.campaignCharacter.findMany({
      where: {
        campaignId,
        ...(canAccessAllCharacters
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
            data: true,
            revision: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
            domains: {
              select: {
                domain: true,
                data: true,
                revision: true,
                updatedById: true,
                updatedAt: true,
              },
              orderBy: {
                domain: "asc",
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
        canAccessAllCharacters,
      },
      members: [
        {
          id: campaign.owner.id,
          name: campaign.owner.name,
          role: CampaignRole.MASTER,
        },
        ...campaign.members
          .filter((member) => member.userId !== campaign.ownerId)
          .map((member) => ({
            id: member.user.id,
            name: member.user.name,
            role: member.role,
          })),
      ],
      characters: links.map((link) => ({
        id: link.character.id,
        name: link.character.name,
        data: link.character.data,
        revision: link.character.revision,
        visibility: link.visibility,
        owner: link.character.owner,
        addedAt: link.addedAt,
        domains: link.character.domains.map((domain) => ({
          domain: domain.domain.toLowerCase(),
          payload: domain.data,
          version: domain.revision,
          updatedBy: domain.updatedById,
          updatedAt: domain.updatedAt,
        })),
      })),
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
