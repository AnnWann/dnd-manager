import {
  CampaignMemberStatus,
  CampaignSpellApprovalStatus,
  CharacterVisibility,
  HomebrewSpellStatus,
  Prisma,
} from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api"
import { sanitizeCharacterItemData } from "../../../server/character-items"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"

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
        name: true,
        data: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        campaignLinks: {
          select: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
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
      character: {
        ...character,
        campaigns: character.campaignLinks.map((link) => link.campaign),
        campaignLinks: undefined,
      },
    })
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
    const { characterId } = await context.params
    const body = await readJsonObject(request)

    if (!isJsonObject(body.data)) {
      throw new ApiError(
        400,
        "INVALID_CHARACTER_DATA",
        "Os dados do personagem precisam ser um objeto JSON.",
      )
    }

    const existing = await prisma.character.findFirst({
      where: {
        id: characterId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      throw new ApiError(
        404,
        "CHARACTER_NOT_FOUND",
        "Personagem não encontrado.",
      )
    }

    const requestedName =
      typeof body.name === "string" ? body.name.trim() : ""
    const requestedVisibility = parseVisibility(body.visibility)
    const data = sanitizeCharacterItemData(
      body.data as Prisma.InputJsonObject,
    )
    const knownSpellIndexes = extractKnownSpellIndexes(data)
    const accessibleHomebrewSpells = knownSpellIndexes.length
      ? await prisma.homebrewSpell.findMany({
          where: {
            index: {
              in: knownSpellIndexes,
            },
            status: HomebrewSpellStatus.ACTIVE,
            OR: [
              { ownerId: session.user.id },
              {
                campaignLinks: {
                  some: {
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
                },
              },
            ],
          },
          select: {
            id: true,
          },
        })
      : []

    const accessibleSpellIds = accessibleHomebrewSpells.map(
      (spell) => spell.id,
    )

    const character = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.character.update({
        where: {
          id: existing.id,
        },
        data: {
          data,
          ...(requestedName ? { name: requestedName.slice(0, 120) } : {}),
          ...(requestedVisibility ? { visibility: requestedVisibility } : {}),
        },
        select: {
          id: true,
          name: true,
          data: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      await transaction.characterHomebrewSpell.deleteMany({
        where: {
          characterId: existing.id,
          ...(accessibleSpellIds.length
            ? {
                spellId: {
                  notIn: accessibleSpellIds,
                },
              }
            : {}),
        },
      })

      if (accessibleSpellIds.length) {
        await transaction.characterHomebrewSpell.createMany({
          data: accessibleSpellIds.map((spellId) => ({
            characterId: existing.id,
            spellId,
            grantedById: session.user.id,
          })),
          skipDuplicates: true,
        })
      }

      return updated
    })

    return jsonResponse({ character })
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
    const { characterId } = await context.params

    const existing = await prisma.character.findFirst({
      where: {
        id: characterId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      throw new ApiError(
        404,
        "CHARACTER_NOT_FOUND",
        "Personagem não encontrado.",
      )
    }

    await prisma.character.delete({
      where: {
        id: existing.id,
      },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}

function parseVisibility(value: unknown): CharacterVisibility | undefined {
  if (typeof value !== "string") return undefined

  const normalized = value.trim().toUpperCase()
  if (normalized === CharacterVisibility.PRIVATE) {
    return CharacterVisibility.PRIVATE
  }
  if (normalized === CharacterVisibility.PARTY) {
    return CharacterVisibility.PARTY
  }
  if (normalized === CharacterVisibility.MASTER) {
    return CharacterVisibility.MASTER
  }

  throw new ApiError(
    400,
    "INVALID_CHARACTER_VISIBILITY",
    "A visibilidade informada é inválida.",
  )
}

function extractKnownSpellIndexes(
  data: Prisma.InputJsonObject,
): string[] {
  const magic = asObject(data.magic)
  const spells = asObject(magic?.spells)
  const knownSpells = Array.isArray(spells?.knownSpells)
    ? spells.knownSpells
    : []
  const indexes = new Set<string>()

  for (const entry of knownSpells) {
    const knownSpell = asObject(entry)
    const spellReference = asObject(knownSpell?.spells)
    const index =
      typeof spellReference?.id === "string"
        ? spellReference.id.trim()
        : ""

    if (index) indexes.add(index)
  }

  return Array.from(indexes)
}

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  return isJsonObject(value) ? value : null
}

function isJsonObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
