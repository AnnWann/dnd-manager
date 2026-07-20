import type { BonusCollection } from "../bonuses/Bonus"
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
  return withCharacterConditions(
    character,
    getCharacterConditions(character).filter(
      (condition) => condition.id !== conditionId,
    ),
  )
}

export function adjustConditionRemaining(
  character: CharacterTemplate,
  conditionId: string,
  delta: number,
): CharacterTemplate {
  const conditions = getCharacterConditions(character)
  const next = conditions.flatMap((condition) => {
    if (condition.id !== conditionId) return [condition]

    const remaining = condition.duration.remaining
    if (typeof remaining !== "number") return [condition]

    const nextRemaining = Math.max(0, remaining + delta)
    if (
      nextRemaining <= 0 &&
      condition.duration.autoRemoveAtZero
    ) {
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

  return withCharacterConditions(character, next)
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
    duration: normalizeDuration(raw.duration),
    createdAt: readString(raw.createdAt) || new Date().toISOString(),
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

function readOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined
}
