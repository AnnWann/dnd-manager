import type { Ability } from "../abilities/Ability"
import type { BonusCollection } from "../bonuses/Bonus"
import type { SpellGrant } from "../magic/spells/SpellGrant"
import type { Proficiency } from "../sheet/Proficiency"
import type { CharacterTemplate } from "./CharacterTemplate"
import type {
  CharacterCondition,
  CharacterConditionDuration,
  ConditionDurationType,
  ConditionTickOwner,
  ConditionTickTiming,
} from "./CharacterCondition"

const CONDITION_NOTE_PREFIX = "__dnd_manager_conditions__:"

export function getCharacterConditions(
  character: CharacterTemplate,
): CharacterCondition[] {
  const sheetConditions = character.get("sheet").conditions
  if (Array.isArray(sheetConditions)) {
    return sheetConditions.map(normalizeCondition)
  }

  const metadata = character
    .get("notes")
    .find((note) => note.startsWith(CONDITION_NOTE_PREFIX))

  if (!metadata) return []

  try {
    const parsed = JSON.parse(
      metadata.slice(CONDITION_NOTE_PREFIX.length),
    ) as unknown

    return Array.isArray(parsed) ? parsed.map(normalizeCondition) : []
  } catch {
    return []
  }
}

export function withCharacterConditions(
  character: CharacterTemplate,
  conditions: CharacterCondition[],
): CharacterTemplate {
  const normalized = conditions.map(normalizeCondition)
  const visibleNotes = character
    .get("notes")
    .filter((note) => !note.startsWith(CONDITION_NOTE_PREFIX))
  const notes = normalized.length
    ? [
        ...visibleNotes,
        `${CONDITION_NOTE_PREFIX}${JSON.stringify(normalized)}`,
      ]
    : visibleNotes

  return character
    .withSheet("conditions", normalized)
    .with("notes", notes)
}

export function addCharacterCondition(
  character: CharacterTemplate,
  condition: CharacterCondition,
): CharacterTemplate {
  return withCharacterConditions(character, [
    ...getCharacterConditions(character),
    normalizeCondition(condition),
  ])
}

export function updateCharacterCondition(
  character: CharacterTemplate,
  condition: CharacterCondition,
): CharacterTemplate {
  return withCharacterConditions(
    character,
    getCharacterConditions(character).map((current) =>
      current.id === condition.id ? normalizeCondition(condition) : current,
    ),
  )
}

export function removeCharacterCondition(
  character: CharacterTemplate,
  conditionId: string,
): CharacterTemplate {
  const conditions = getCharacterConditions(character)
  const removed = conditions.find((condition) => condition.id === conditionId)
  let next = withCharacterConditions(
    character,
    conditions.filter((condition) => condition.id !== conditionId),
  )

  if (removed?.sourceAbilityId && removed.sourceAbilityLocation) {
    next = deactivateLinkedAbility(next, removed)
  }

  return next
}

export function adjustConditionRemaining(
  character: CharacterTemplate,
  conditionId: string,
  delta: number,
): CharacterTemplate {
  const conditions = getCharacterConditions(character)
  let removed: CharacterCondition | undefined
  const nextConditions = conditions.flatMap((condition) => {
    if (condition.id !== conditionId) return [condition]

    const remaining = condition.duration.remaining
    if (typeof remaining !== "number") return [condition]

    const nextRemaining = Math.max(0, remaining + delta)
    if (
      nextRemaining <= 0 &&
      condition.duration.autoRemoveAtZero
    ) {
      removed = condition
      return []
    }

    return [
      {
        ...condition,
        duration: {
          ...condition.duration,
          remaining: nextRemaining,
        },
      },
    ]
  })

  let next = withCharacterConditions(character, nextConditions)
  if (removed?.sourceAbilityId && removed.sourceAbilityLocation) {
    next = deactivateLinkedAbility(next, removed)
  }

  return next
}

function normalizeCondition(value: unknown): CharacterCondition {
  const raw = isRecord(value) ? value : {}

  return {
    id: readString(raw.id) || crypto.randomUUID(),
    name: readString(raw.name) || "Condição",
    description: readString(raw.description),
    behavior: readString(raw.behavior),
    source: readString(raw.source),
    notes: readString(raw.notes),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(readString).filter(Boolean)
      : [],
    bonuses: normalizeBonuses(raw.bonuses),
    grantedSpells: normalizeGrantedSpells(raw.grantedSpells),
    grantedProficiencies: normalizeGrantedProficiencies(raw.grantedProficiencies),
    grantedAbilities: normalizeGrantedAbilities(raw.grantedAbilities),
    duration: normalizeDuration(raw.duration),
    createdAt: readString(raw.createdAt) || new Date().toISOString(),
    sourceAbilityId: optionalString(raw.sourceAbilityId),
    sourceAbilityLocation: normalizeAbilityLocation(raw.sourceAbilityLocation),
    sourceItemId: optionalString(raw.sourceItemId),
    sourceAbilityOptionId: optionalString(raw.sourceAbilityOptionId),
    sourceCharacterId: optionalString(raw.sourceCharacterId),
    linkedCombatantId: optionalString(raw.linkedCombatantId),
    initiativeEffectId: optionalString(raw.initiativeEffectId),
  }
}

function normalizeDuration(value: unknown): CharacterConditionDuration {
  const raw = isRecord(value) ? value : {}
  const type = normalizeDurationType(raw.type)
  const total = readOptionalNumber(raw.total)
  const remaining = readOptionalNumber(raw.remaining)

  return {
    type,
    total,
    remaining:
      remaining ??
      (usesNumericDuration(type) ? total : undefined),
    tickOn: normalizeTickTiming(raw.tickOn),
    tickOwner: normalizeTickOwner(raw.tickOwner),
    autoRemoveAtZero: raw.autoRemoveAtZero !== false,
    customLabel: optionalString(raw.customLabel),
    expiresAt: optionalString(raw.expiresAt),
  }
}

function normalizeDurationType(value: unknown): ConditionDurationType {
  const allowed: ConditionDurationType[] = [
    "rounds",
    "turns",
    "minutes",
    "hours",
    "days",
    "until-start-of-turn",
    "until-end-of-turn",
    "until-save",
    "concentration",
    "permanent",
    "custom",
  ]

  return allowed.includes(value as ConditionDurationType)
    ? (value as ConditionDurationType)
    : "rounds"
}

function normalizeTickTiming(value: unknown): ConditionTickTiming {
  return value === "start-of-turn" ||
    value === "end-of-turn" ||
    value === "manual"
    ? value
    : "end-of-turn"
}

function normalizeTickOwner(value: unknown): ConditionTickOwner {
  return value === "source" ? "source" : "affected"
}

function usesNumericDuration(type: ConditionDurationType): boolean {
  return (
    type === "rounds" ||
    type === "turns" ||
    type === "minutes" ||
    type === "hours" ||
    type === "days"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function optionalString(value: unknown): string | undefined {
  const parsed = readString(value)
  return parsed || undefined
}

function normalizeBonuses(value: unknown): BonusCollection | undefined {
  return isRecord(value) ? (value as BonusCollection) : undefined
}

function normalizeGrantedSpells(value: unknown): SpellGrant[] | undefined {
  return Array.isArray(value) ? (value as SpellGrant[]) : undefined
}

function normalizeGrantedProficiencies(value: unknown): Proficiency[] | undefined {
  return Array.isArray(value) ? (value as Proficiency[]) : undefined
}

function normalizeGrantedAbilities(value: unknown): Ability[] | undefined {
  return Array.isArray(value) ? (value as Ability[]) : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined
}

function normalizeAbilityLocation(
  value: unknown,
): CharacterCondition["sourceAbilityLocation"] {
  return value === "character" ||
    value === "race" ||
    value === "equipment" ||
    value === "condition"
    ? value
    : undefined
}

function deactivateLinkedAbility(
  character: CharacterTemplate,
  condition: CharacterCondition,
): CharacterTemplate {
  const abilityId = condition.sourceAbilityId
  if (!abilityId) return character

  let next = character
  if (condition.sourceAbilityLocation === "character") {
    const ability = (next.get("abilities") ?? []).find(
      (current) => current.id === abilityId,
    )
    if (ability?.source === "consumable") {
      next = next.removeAbility(abilityId)
    } else if (ability) {
      next = next.updateAbility({
        ...ability,
        benefitsActive: false,
        modifiersActive: undefined,
      })
    }
  }

  if (condition.sourceAbilityLocation === "race") {
    const race = next.get("sheet").race
    next = next.withSheet("race", {
      ...race,
      naturalAbilities: (race.naturalAbilities ?? []).map((ability) =>
        ability.id === abilityId
          ? { ...ability, benefitsActive: false, modifiersActive: undefined }
          : ability,
      ),
    })
  }

  if (condition.sourceAbilityLocation === "condition") {
    next = withCharacterConditions(
      next,
      getCharacterConditions(next).map((sourceCondition) =>
        sourceCondition.id === condition.source
          ? {
              ...sourceCondition,
              grantedAbilities: (sourceCondition.grantedAbilities ?? []).map((ability) =>
                ability.id === abilityId
                  ? { ...ability, benefitsActive: false, modifiersActive: undefined }
                  : ability,
              ),
            }
          : sourceCondition,
      ),
    )
  }

  const linkedItemId = condition.sourceItemId
  if (condition.sourceAbilityLocation === "equipment" && linkedItemId) {
    const projected = next.getEquipmentAbilities().find(
      (ability) =>
        ability.sourceItemId === linkedItemId &&
        ability.originalAbilityId === abilityId,
    )
    if (projected) {
      const { source, sourceItemId, sourceItemName, originalAbilityId, ...ability } = projected
      next = next.updateEquipmentAbility(linkedItemId, {
        ...ability,
        id: originalAbilityId ?? abilityId,
        benefitsActive: false,
        modifiersActive: undefined,
      })
    }
  }

  const effectiveMaxHp = next.getEffectiveMaxHp()
  return next.get("sheet").HP.current > effectiveMaxHp
    ? next.setCurrentHp(effectiveMaxHp)
    : next
}
