import {
  CampaignMemberStatus,
} from "../../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../../../server/api"
import { prisma } from "../../../../../server/prisma"
import { requireSession } from "../../../../../server/session"

type RouteContext = {
  params: Promise<{
    campaignId: string
    characterId: string
  }>
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, characterId } = await context.params

    await requireCampaignAccess(campaignId, session.user.id)
    await requireOwnedCharacter(characterId, session.user.id)

    const link = await prisma.campaignCharacter.upsert({
      where: {
        campaignId_characterId: {
          campaignId,
          characterId,
        },
      },
      update: {},
      create: {
        campaignId,
        characterId,
      },
      select: {
        character: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return jsonResponse({ character: link.character }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, characterId } = await context.params

    await requireCampaignAccess(campaignId, session.user.id)
    await requireOwnedCharacter(characterId, session.user.id)

    await prisma.campaignCharacter.deleteMany({
      where: {
        campaignId,
        characterId,
      },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}

async function requireCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<void> {
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
      id: true,
    },
  })

  if (!campaign) {
    throw new ApiError(
      403,
      "CAMPAIGN_ACCESS_DENIED",
      "Você precisa ser membro ativo desta campanha.",
    )
  }
}

async function requireOwnedCharacter(
  characterId: string,
  userId: string,
): Promise<void> {
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      ownerId: userId,
    },
    select: {
      id: true,
    },
  })

  if (!character) {
    throw new ApiError(
      404,
      "CHARACTER_NOT_FOUND",
      "Personagem não encontrado.",
    )
  }
}
