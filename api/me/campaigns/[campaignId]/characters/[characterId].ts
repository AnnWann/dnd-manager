import {
  CampaignMemberStatus,
  CampaignRole,
  CharacterVisibility,
} from "../../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
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
    const body = await readJsonObject(request)
    const visibility = parseVisibility(body.visibility)

    const access = await requireCampaignAccess(campaignId, session.user.id)
    const character = await requireOwnedCharacter(characterId, session.user.id)

    if (!access.isMaster) {
      const requestId = crypto.randomUUID()
      const dataJson = JSON.stringify({ visibility })

      await prisma.$executeRaw`
        INSERT INTO "campaign_content_request" (
          "id",
          "campaignId",
          "type",
          "status",
          "title",
          "sourceId",
          "data",
          "submittedById",
          "submittedAt",
          "updatedAt"
        ) VALUES (
          ${requestId},
          ${campaignId},
          'CHARACTER',
          'PENDING',
          ${character.name},
          ${characterId},
          ${dataJson}::jsonb,
          ${session.user.id},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("campaignId", "type", "sourceId") DO UPDATE SET
          "status" = 'PENDING',
          "title" = EXCLUDED."title",
          "data" = EXCLUDED."data",
          "note" = NULL,
          "submittedById" = EXCLUDED."submittedById",
          "submittedAt" = CURRENT_TIMESTAMP,
          "reviewedById" = NULL,
          "reviewedAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      `

      return jsonResponse(
        {
          character: {
            id: character.id,
            name: character.name,
            visibility,
          },
          requestStatus: "PENDING",
        },
        202,
      )
    }

    const link = await prisma.campaignCharacter.upsert({
      where: {
        campaignId_characterId: {
          campaignId,
          characterId,
        },
      },
      update: {
        visibility,
      },
      create: {
        campaignId,
        characterId,
        visibility,
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
    })

    return jsonResponse(
      {
        character: {
          ...link.character,
          visibility: link.visibility,
        },
        requestStatus: "APPROVED",
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, characterId } = await context.params
    const body = await readJsonObject(request)
    const visibility = parseVisibility(body.visibility)

    await requireCampaignAccess(campaignId, session.user.id)
    await requireOwnedCharacter(characterId, session.user.id)

    const updated = await prisma.campaignCharacter.updateMany({
      where: {
        campaignId,
        characterId,
      },
      data: {
        visibility,
      },
    })

    if (!updated.count) {
      throw new ApiError(
        404,
        "CAMPAIGN_CHARACTER_NOT_FOUND",
        "O personagem não está vinculado a esta campanha.",
      )
    }

    return jsonResponse({
      character: {
        id: characterId,
        visibility,
      },
    })
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

    await prisma.$transaction([
      prisma.campaignCharacter.deleteMany({
        where: {
          campaignId,
          characterId,
        },
      }),
      prisma.$executeRaw`
        DELETE FROM "campaign_content_request"
        WHERE "campaignId" = ${campaignId}
          AND "type" = 'CHARACTER'
          AND "sourceId" = ${characterId}
          AND "submittedById" = ${session.user.id}
      `,
    ])

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}

function parseVisibility(value: unknown): CharacterVisibility {
  if (value === undefined) return CharacterVisibility.PARTY
  if (value === CharacterVisibility.PRIVATE) return CharacterVisibility.PRIVATE
  if (value === CharacterVisibility.PARTY) return CharacterVisibility.PARTY
  if (value === CharacterVisibility.MASTER) return CharacterVisibility.MASTER

  throw new ApiError(
    400,
    "INVALID_CAMPAIGN_CHARACTER_VISIBILITY",
    "A visibilidade precisa ser PRIVATE, PARTY ou MASTER.",
  )
}

async function requireCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<{ isMaster: boolean }> {
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
      ownerId: true,
      members: {
        where: {
          userId,
          status: CampaignMemberStatus.ACTIVE,
        },
        select: {
          role: true,
        },
      },
    },
  })

  if (!campaign) {
    throw new ApiError(
      403,
      "CAMPAIGN_ACCESS_DENIED",
      "Você precisa ser membro ativo desta campanha.",
    )
  }

  return {
    isMaster:
      campaign.ownerId === userId ||
      campaign.members.some((member) => member.role === CampaignRole.MASTER),
  }
}

async function requireOwnedCharacter(
  characterId: string,
  userId: string,
): Promise<{ id: string; name: string }> {
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!character) {
    throw new ApiError(
      404,
      "CHARACTER_NOT_FOUND",
      "Personagem não encontrado.",
    )
  }

  return character
}
