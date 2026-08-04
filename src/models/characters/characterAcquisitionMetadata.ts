import type { Ability } from "../abilities/Ability"
import type { SpellGrant } from "../magic/spells/SpellGrant"
import type { ClassName } from "../sheet/Class"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionMetadata,
  type CharacterAcquisitionReason,
  type CharacterAcquisitionSourceType,
} from "./CharacterAcquisition"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "./CharacterTemplate"

const CLASS_NAMES = new Set<ClassName>([
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

export type AcquisitionNormalizationDefaults = {
  eventId?: string
  addedAt?: string
  reason?: CharacterAcquisitionReason
  characterLevel?: number
  className?: ClassName
  classLevel?: number
  sourceType?: CharacterAcquisitionSourceType
  sourceId?: string
  sourceName?: string
}

export function getCharacterTotalLevel(character: CharacterTemplate): number {
  return (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.level) || 0),
    0,
  )
}

export function ensureCharacterAcquisitionMetadata(
  character: CharacterTemplate,
  defaults: AcquisitionNormalizationDefaults = {},
): CharacterTemplate {
  const eventId = defaults.eventId ?? crypto.randomUUID()
  const addedAt = defaults.addedAt ?? new Date().toISOString()
  const characterLevel =
    defaults.characterLevel ?? getCharacterTotalLevel(character)
  const reason = defaults.reason ?? "manual"
  const classLevels = new Map<ClassName, number>(
    (character.get("sheet").classes ?? []).map((entry) => [
      entry.className,
      Number(entry.level) || 0,
    ]),
  )

  function acquisition(
    sourceType: CharacterAcquisitionSourceType,
    sourceId?: string,
    sourceName?: string,
    className?: ClassName,
    classLevel?: number,
  ): CharacterAcquisitionMetadata {
    const resolvedClass = className ?? defaults.className
    return createCharacterAcquisition({
      eventId,
      addedAt,
      reason,
      characterLevel,
      className: resolvedClass,
      classLevel:
        classLevel ??
        defaults.classLevel ??
        (resolvedClass ? classLevels.get(resolvedClass) : undefined),
      sourceType,
      sourceId: sourceId ?? defaults.sourceId,
      sourceName: sourceName ?? defaults.sourceName,
    })
  }

  function normalizeGrant(
    grant: SpellGrant,
    sourceType: CharacterAcquisitionSourceType,
    sourceId?: string,
    sourceName?: string,
    className?: ClassName,
    classLevel?: number,
  ): SpellGrant {
    return {
      ...grant,
      acquisition:
        grant.acquisition ??
        acquisition(
          sourceType,
          sourceId,
          sourceName,
          className,
          classLevel,
        ),
    }
  }

  function normalizeAbility(
    ability: Ability,
    sourceType: CharacterAcquisitionSourceType,
    sourceId?: string,
    sourceName?: string,
    className?: ClassName,
    classLevel?: number,
  ): Ability {
    const metadata =
      ability.acquisition ??
      acquisition(
        sourceType,
        sourceId,
        sourceName,
        className,
        classLevel,
      )

    return {
      ...ability,
      acquisition: metadata,
      grantedSpells: ability.grantedSpells?.map((grant) =>
        normalizeGrant(
          grant,
          "ability",
          ability.id,
          ability.name,
          metadata.className,
          metadata.classLevel,
        ),
      ),
    }
  }

  const race = character.get("sheet").race
  const raceName = race.customName?.trim() || race.subrace?.trim() || race.race
  const abilities = (character.get("abilities") ?? []).map((ability) =>
    normalizeAbility(
      ability,
      inferAbilitySource(ability, defaults.sourceType),
      ability.sourceItemId ?? defaults.sourceId,
      ability.sourceItemName ?? defaults.sourceName,
    ),
  )
  const naturalAbilities = (race.naturalAbilities ?? []).map((ability) =>
    normalizeAbility(ability, "race", String(race.race), raceName),
  )

  const magic = character.get("magic")
  const knownSpells = magic?.spells.knownSpells.map((entry) => {
    const className =
      entry.source.type === "class" && isClassName(entry.source.sourceId)
        ? entry.source.sourceId
        : undefined

    return {
      ...entry,
      acquisition:
        entry.acquisition ??
        acquisition(
          mapSpellSource(entry.source.type),
          entry.source.sourceId,
          entry.source.name,
          className,
          className ? classLevels.get(className) : undefined,
        ),
    }
  })

  const inventory = normalizeEquipmentValue(
    character.get("inventory"),
    normalizeAbility,
    normalizeGrant,
  ) as CharacterTemplateProps["inventory"]
  const equipment = normalizeEquipmentValue(
    character.get("equipment"),
    normalizeAbility,
    normalizeGrant,
  ) as CharacterTemplateProps["equipment"]

  return character.withPatch({
    abilities,
    sheet: {
      ...character.get("sheet"),
      race: {
        ...race,
        naturalAbilities,
      },
    },
    magic: magic
      ? {
          ...magic,
          spells: {
            ...magic.spells,
            knownSpells: knownSpells ?? [],
          },
        }
      : magic,
    inventory,
    equipment,
  })
}

function normalizeEquipmentValue(
  value: unknown,
  normalizeAbility: (
    ability: Ability,
    sourceType: CharacterAcquisitionSourceType,
    sourceId?: string,
    sourceName?: string,
    className?: ClassName,
    classLevel?: number,
  ) => Ability,
  normalizeGrant: (
    grant: SpellGrant,
    sourceType: CharacterAcquisitionSourceType,
    sourceId?: string,
    sourceName?: string,
    className?: ClassName,
    classLevel?: number,
  ) => SpellGrant,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      normalizeEquipmentValue(entry, normalizeAbility, normalizeGrant),
    )
  }
  if (!isRecord(value)) return value

  const sourceId = typeof value.id === "string" ? value.id : undefined
  const sourceName = typeof value.name === "string" ? value.name : undefined
  const result: Record<string, unknown> = { ...value }

  if (Array.isArray(value.abilities)) {
    result.abilities = value.abilities.map((entry) =>
      isRecord(entry)
        ? normalizeAbility(
            entry as unknown as Ability,
            "equipment",
            sourceId,
            sourceName,
          )
        : entry,
    )
  }

  if (Array.isArray(value.spells)) {
    result.spells = value.spells.map((entry) =>
      isRecord(entry) && typeof entry.index === "string"
        ? {
            ...entry,
            ...normalizeGrant(
              entry as unknown as SpellGrant,
              "equipment",
              sourceId,
              sourceName,
            ),
          }
        : normalizeEquipmentValue(entry, normalizeAbility, normalizeGrant),
    )
  }

  for (const [key, child] of Object.entries(result)) {
    if (key === "abilities" || key === "spells") continue
    result[key] = normalizeEquipmentValue(
      child,
      normalizeAbility,
      normalizeGrant,
    )
  }

  return result
}

function inferAbilitySource(
  ability: Ability,
  fallback?: CharacterAcquisitionSourceType,
): CharacterAcquisitionSourceType {
  if (ability.source === "race") return "race"
  if (ability.source === "equipment") return "equipment"
  if (ability.category === "feat") return "feat"
  return fallback ?? "manual"
}

function mapSpellSource(value: string): CharacterAcquisitionSourceType {
  if (value === "class") return "class"
  if (value === "race") return "race"
  if (value === "feat") return "feat"
  if (value === "ability") return "ability"
  if (value === "equipment") return "equipment"
  return "manual"
}

function isClassName(value: string): value is ClassName {
  return CLASS_NAMES.has(value as ClassName)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
