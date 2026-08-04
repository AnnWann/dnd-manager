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
import { sanitizeCharacterAcquisitionData } from "../../../server/character-acquisitions"
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
    const itemSafeData = sanitizeCharacterItemData(
      body.data as Prisma.InputJsonObject,
    )
    const data = sanitizeCharacterAcquisitionData(itemSafeData, {
      reason: "manual",
      sourceType: "manual",
      sourceName: "Edição da ficha",
    })
    const referencedSpellIndexes = extractReferencedSpellIndexes(data)
    const accessibleHomebrewSpells = referencedSpellIndexes.length
      ? await prisma.homebrewSpell.findMany({
          where: {
            index: {
              in: referencedSpellIndexes,
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

function extractReferencedSpellIndexes(
  data: Prisma.InputJsonObject,
): string[] {
  const indexes = new Set<string>()

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (!isJsonObject(value)) return

    if (
      typeof value.index === "string" &&
      value.index.trim() &&
      ("castingMode" in value || "usage" in value)
    ) {
      indexes.add(value.index.trim())
    }

    if (
      isJsonObject(value.spells) &&
      typeof value.spells.id === "string" &&
      value.spells.id.trim()
    ) {
      indexes.add(value.spells.id.trim())
    }

    Object.values(value).forEach(visit)
  }

  visit(data)
  return Array.from(indexes)
}

function isJsonObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
