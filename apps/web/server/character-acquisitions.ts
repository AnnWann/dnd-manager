import type { Prisma } from "../generated/prisma/client"

const CLASS_NAMES = new Set([
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
])

type AcquisitionReason =
  | "character-creation"
  | "level-up"
  | "manual"
  | "import"
  | "campaign-grant"

type AcquisitionDefaults = {
  reason: AcquisitionReason
  sourceType: string
  sourceName: string
}

export function sanitizeCharacterAcquisitionData(
  data: Prisma.InputJsonObject,
  defaults: AcquisitionDefaults,
): Prisma.InputJsonObject {
  const root = structuredClone(data) as Record<string, unknown>
  const eventId = crypto.randomUUID()
  const addedAt = new Date().toISOString()
  const sheet = asRecord(root.sheet)
  const classes = Array.isArray(sheet?.classes) ? sheet.classes : []
  const classLevels = new Map<string, number>()

  for (const entry of classes) {
    const classEntry = asRecord(entry)
    const className = stringValue(classEntry?.className)
    if (!className) continue
    classLevels.set(className, numberValue(classEntry?.level))
  }

  const totalLevel = Array.from(classLevels.values()).reduce(
    (sum, level) => sum + Math.max(0, level),
    0,
  )

  function metadata(input: {
    sourceType?: string
    sourceId?: string
    sourceName?: string
    className?: string
    classLevel?: number
  }): Record<string, unknown> {
    const className =
      input.className && CLASS_NAMES.has(input.className)
        ? input.className
        : undefined

    return compactObject({
      eventId,
      addedAt,
      characterLevel: totalLevel,
      className,
      classLevel:
        input.classLevel ??
        (className ? classLevels.get(className) : undefined),
      sourceType: input.sourceType ?? defaults.sourceType,
      sourceId: input.sourceId,
      sourceName: input.sourceName ?? defaults.sourceName,
      reason: defaults.reason,
    })
  }

  function normalizeGrant(
    value: unknown,
    source: {
      sourceType: string
      sourceId?: string
      sourceName?: string
      className?: string
      classLevel?: number
    },
  ): unknown {
    const grant = asRecord(value)
    if (!grant || typeof grant.index !== "string") return value
    return {
      ...grant,
      acquisition: isRecord(grant.acquisition)
        ? grant.acquisition
        : metadata(source),
    }
  }

  function normalizeAbility(
    value: unknown,
    source: {
      sourceType: string
      sourceId?: string
      sourceName?: string
      className?: string
      classLevel?: number
    },
  ): unknown {
    const ability = asRecord(value)
    if (!ability || typeof ability.id !== "string") return value

    return {
      ...ability,
      acquisition: isRecord(ability.acquisition)
        ? ability.acquisition
        : metadata(source),
      grantedSpells: Array.isArray(ability.grantedSpells)
        ? ability.grantedSpells.map((grant) =>
            normalizeGrant(grant, {
              sourceType: "ability",
              sourceId: ability.id as string,
              sourceName: stringValue(ability.name),
              className: source.className,
              classLevel: source.classLevel,
            }),
          )
        : ability.grantedSpells,
    }
  }

  if (Array.isArray(root.abilities)) {
    root.abilities = root.abilities.map((ability) => {
      const entry = asRecord(ability)
      const source = stringValue(entry?.source)
      const sourceType =
        source === "race"
          ? "race"
          : source === "equipment"
            ? "equipment"
            : entry?.category === "feat"
              ? "feat"
              : defaults.sourceType
      return normalizeAbility(ability, {
        sourceType,
        sourceId: stringValue(entry?.sourceItemId),
        sourceName: stringValue(entry?.sourceItemName) || defaults.sourceName,
      })
    })
  }

  const race = asRecord(sheet?.race)
  if (race && Array.isArray(race.naturalAbilities)) {
    const raceName =
      stringValue(race.customName) ||
      stringValue(race.subrace) ||
      stringValue(race.race) ||
      "Raça"
    race.naturalAbilities = race.naturalAbilities.map((ability) =>
      normalizeAbility(ability, {
        sourceType: "race",
        sourceId: stringValue(race.race),
        sourceName: raceName,
      }),
    )
  }

  const magic = asRecord(root.magic)
  const spells = asRecord(magic?.spells)
  if (spells && Array.isArray(spells.knownSpells)) {
    spells.knownSpells = spells.knownSpells.map((value) => {
      const entry = asRecord(value)
      const source = asRecord(entry?.source)
      const sourceType = stringValue(source?.type) || defaults.sourceType
      const sourceId = stringValue(source?.sourceId)
      const className =
        sourceType === "class" && CLASS_NAMES.has(sourceId)
          ? sourceId
          : undefined

      return entry
        ? {
            ...entry,
            acquisition: isRecord(entry.acquisition)
              ? entry.acquisition
              : metadata({
                  sourceType,
                  sourceId,
                  sourceName: stringValue(source?.name) || defaults.sourceName,
                  className,
                }),
          }
        : value
    })
  }

  root.inventory = normalizeEquipmentTree(
    root.inventory,
    normalizeAbility,
    normalizeGrant,
  )
  root.equipment = normalizeEquipmentTree(
    root.equipment,
    normalizeAbility,
    normalizeGrant,
  )

  return root as Prisma.InputJsonObject
}

function normalizeEquipmentTree(
  value: unknown,
  normalizeAbility: (
    value: unknown,
    source: {
      sourceType: string
      sourceId?: string
      sourceName?: string
      className?: string
      classLevel?: number
    },
  ) => unknown,
  normalizeGrant: (
    value: unknown,
    source: {
      sourceType: string
      sourceId?: string
      sourceName?: string
      className?: string
      classLevel?: number
    },
  ) => unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      normalizeEquipmentTree(entry, normalizeAbility, normalizeGrant),
    )
  }
  const object = asRecord(value)
  if (!object) return value

  const sourceId = stringValue(object.id)
  const sourceName = stringValue(object.name)
  const result: Record<string, unknown> = { ...object }

  if (Array.isArray(object.abilities)) {
    result.abilities = object.abilities.map((ability) =>
      normalizeAbility(ability, {
        sourceType: "equipment",
        sourceId,
        sourceName,
      }),
    )
  }

  if (Array.isArray(object.spells)) {
    result.spells = object.spells.map((spell) =>
      normalizeGrant(spell, {
        sourceType: "equipment",
        sourceId,
        sourceName,
      }),
    )
  }

  for (const [key, child] of Object.entries(result)) {
    if (key === "abilities" || key === "spells") continue
    result[key] = normalizeEquipmentTree(
      child,
      normalizeAbility,
      normalizeGrant,
    )
  }

  return result
}

function compactObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function numberValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0
}
