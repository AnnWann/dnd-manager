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

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const characterId = getCharacterId(request)

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
        revision: true,
        createdAt: true,
        updatedAt: true,
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
        domains: character.domains.map((domain) => ({
          domain: domain.domain.toLowerCase(),
          payload: domain.data,
          version: domain.revision,
          updatedBy: domain.updatedById,
          updatedAt: domain.updatedAt,
        })),
        campaigns: character.campaignLinks.map((link) => link.campaign),
        campaignLinks: undefined,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const characterId = getCharacterId(request)
    const body = await readJsonObject(request)

    const existing = await prisma.character.findFirst({
      where: {
        id: characterId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        revision: true,
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
    const hasLegacyData = body.data !== undefined

    if (!requestedName && !requestedVisibility && !hasLegacyData) {
      throw new ApiError(
        400,
        "EMPTY_CHARACTER_UPDATE",
        "Nenhuma alteração de identidade foi informada.",
      )
    }

    if (hasLegacyData && !isJsonObject(body.data)) {
      throw new ApiError(
        400,
        "INVALID_CHARACTER_DATA",
        "Os dados do personagem precisam ser um objeto JSON.",
      )
    }

    const expectedVersion = hasLegacyData
      ? undefined
      : parseExpectedRootVersion(body.expectedVersion)

    let legacyData: Prisma.InputJsonObject | undefined
    let accessibleSpellIds: string[] | undefined

    if (hasLegacyData) {
      const itemSafeData = sanitizeCharacterItemData(
        body.data as Prisma.InputJsonObject,
      )
      legacyData = sanitizeCharacterAcquisitionData(itemSafeData, {
        reason: "manual",
        sourceType: "manual",
        sourceName: "Edição legada da ficha",
      })
      accessibleSpellIds = await getAccessibleReferencedSpellIds(
        legacyData,
        session.user.id,
      )
    }

    const character = await prisma.$transaction(async (transaction) => {
      if (expectedVersion !== undefined) {
        const changed = await transaction.character.updateMany({
          where: {
            id: existing.id,
            ownerId: session.user.id,
            revision: expectedVersion,
          },
          data: {
            ...(requestedName
              ? { name: requestedName.slice(0, 120) }
              : {}),
            ...(requestedVisibility
              ? { visibility: requestedVisibility }
              : {}),
            revision: { increment: 1 },
          },
        })

        if (changed.count !== 1) {
          const current = await transaction.character.findUnique({
            where: { id: existing.id },
            select: {
              id: true,
              name: true,
              visibility: true,
              revision: true,
              updatedAt: true,
            },
          })
          return { conflict: current, character: null }
        }
      } else {
        await transaction.character.update({
          where: { id: existing.id },
          data: {
            ...(legacyData ? { data: legacyData } : {}),
            ...(requestedName
              ? { name: requestedName.slice(0, 120) }
              : {}),
            ...(requestedVisibility
              ? { visibility: requestedVisibility }
              : {}),
            revision: { increment: 1 },
          },
        })
      }

      if (legacyData && accessibleSpellIds) {
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
      }

      const updated = await transaction.character.findUniqueOrThrow({
        where: { id: existing.id },
        select: {
          id: true,
          name: true,
          data: true,
          visibility: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return { conflict: null, character: updated }
    })

    if (character.conflict) {
      return jsonResponse(
        {
          error: {
            code: "CHARACTER_ROOT_VERSION_CONFLICT",
            message: "A identidade do personagem foi alterada por outro cliente.",
          },
          current: character.conflict,
        },
        409,
      )
    }

    return jsonResponse({ character: character.character })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const characterId = getCharacterId(request)

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

function getCharacterId(request: Request): string {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/api\/me\/characters\/([^/]+)\/?$/)
  const characterId = match?.[1] ? decodeURIComponent(match[1]).trim() : ""

  if (!characterId) {
    throw new ApiError(
      400,
      "CHARACTER_ID_REQUIRED",
      "O identificador do personagem é obrigatório.",
    )
  }

  return characterId
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

function parseExpectedRootVersion(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError(
      428,
      "CHARACTER_ROOT_VERSION_REQUIRED",
      "expectedVersion é obrigatório para alterar a identidade da ficha.",
    )
  }
  return parsed
}

async function getAccessibleReferencedSpellIds(
  data: Prisma.InputJsonObject,
  userId: string,
): Promise<string[]> {
  const referencedSpellIndexes = extractReferencedSpellIndexes(data)
  if (!referencedSpellIndexes.length) return []

  const accessibleHomebrewSpells = await prisma.homebrewSpell.findMany({
    where: {
      index: {
        in: referencedSpellIndexes,
      },
      status: HomebrewSpellStatus.ACTIVE,
      OR: [
        { ownerId: userId },
        {
          campaignLinks: {
            some: {
              status: CampaignSpellApprovalStatus.APPROVED,
              campaign: {
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
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  })

  return accessibleHomebrewSpells.map((spell) => spell.id)
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
