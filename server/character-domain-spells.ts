import {
  CampaignMemberStatus,
  CampaignSpellApprovalStatus,
  HomebrewSpellStatus,
  Prisma,
} from "../generated/prisma/client"

const COMPLETE_DOMAIN_COUNT = 9

export async function syncCharacterHomebrewSpellLinks(
  transaction: Prisma.TransactionClient,
  characterId: string,
  userId: string,
): Promise<void> {
  const [character, domains] = await Promise.all([
    transaction.character.findUnique({
      where: { id: characterId },
      select: { data: true },
    }),
    transaction.characterDomainState.findMany({
      where: { characterId },
      select: { data: true },
    }),
  ])

  if (!character) return

  const values: unknown[] = domains.map((entry) => entry.data)
  if (domains.length < COMPLETE_DOMAIN_COUNT) {
    values.unshift(character.data)
  }

  const referencedSpellIndexes = extractReferencedSpellIndexes(values)
  const accessibleHomebrewSpells = referencedSpellIndexes.length
    ? await transaction.homebrewSpell.findMany({
        where: {
          index: { in: referencedSpellIndexes },
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
        select: { id: true },
      })
    : []

  const accessibleSpellIds = accessibleHomebrewSpells.map((spell) => spell.id)

  await transaction.characterHomebrewSpell.deleteMany({
    where: {
      characterId,
      ...(accessibleSpellIds.length
        ? { spellId: { notIn: accessibleSpellIds } }
        : {}),
    },
  })

  if (accessibleSpellIds.length) {
    await transaction.characterHomebrewSpell.createMany({
      data: accessibleSpellIds.map((spellId) => ({
        characterId,
        spellId,
        grantedById: userId,
      })),
      skipDuplicates: true,
    })
  }
}

function extractReferencedSpellIndexes(values: unknown[]): string[] {
  const indexes = new Set<string>()

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isRecord(value)) return

    if (
      typeof value.index === "string" &&
      value.index.trim() &&
      ("castingMode" in value || "usage" in value)
    ) {
      indexes.add(value.index.trim())
    }

    if (
      isRecord(value.spells) &&
      typeof value.spells.id === "string" &&
      value.spells.id.trim()
    ) {
      indexes.add(value.spells.id.trim())
    }

    Object.values(value).forEach(visit)
  }

  values.forEach(visit)
  return Array.from(indexes)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
