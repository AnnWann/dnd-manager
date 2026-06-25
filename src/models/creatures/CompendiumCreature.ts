export type CreatureSide = "ally" | "enemy" | "neutral"

export type CreatureAbilityScores = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export type CompendiumCreature = {
  id: string
  name: string
  category: string
  size: string
  challengeRating: string
  unique: boolean
  defaultSide: CreatureSide

  initiativeBonus: number
  armorClass?: number
  maxHp?: number
  speed: string
  passivePerception?: number
  abilityScores: CreatureAbilityScores

  savingThrows: string
  skills: string
  vulnerabilities: string
  resistances: string
  immunities: string
  conditionImmunities: string
  senses: string
  languages: string

  traits: string
  actions: string
  bonusActions: string
  reactions: string
  legendaryActions: string
  combatNotes: string

  /**
   * Portrait or representative image of the creature.
   *
   * The property keeps its original name so existing local compendiums remain
   * compatible. Imported/exported JSON also accepts the clearer `imageUrl`
   * alias.
   */
  sheetImageUrl?: string
  createdAt: number
  updatedAt: number
}

export type CreatureCompendiumState = {
  version: 1
  creatures: CompendiumCreature[]
  updatedAt: number
}

const DEFAULT_ABILITY_SCORES: CreatureAbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
}

export function createCompendiumCreature(
  patch: Partial<CompendiumCreature> = {},
): CompendiumCreature {
  const now = Date.now()

  return {
    id: patch.id ?? crypto.randomUUID(),
    name: patch.name ?? "Nova criatura",
    category: patch.category ?? "Monstro",
    size: patch.size ?? "Médio",
    challengeRating: patch.challengeRating ?? "",
    unique: patch.unique ?? false,
    defaultSide: patch.defaultSide ?? "enemy",
    initiativeBonus: finiteNumber(patch.initiativeBonus),
    armorClass: optionalFiniteNumber(patch.armorClass),
    maxHp: optionalFiniteNumber(patch.maxHp),
    speed: patch.speed ?? "9 m",
    passivePerception: optionalFiniteNumber(patch.passivePerception),
    abilityScores: normalizeAbilityScores(patch.abilityScores),
    savingThrows: patch.savingThrows ?? "",
    skills: patch.skills ?? "",
    vulnerabilities: patch.vulnerabilities ?? "",
    resistances: patch.resistances ?? "",
    immunities: patch.immunities ?? "",
    conditionImmunities: patch.conditionImmunities ?? "",
    senses: patch.senses ?? "",
    languages: patch.languages ?? "",
    traits: patch.traits ?? "",
    actions: patch.actions ?? "",
    bonusActions: patch.bonusActions ?? "",
    reactions: patch.reactions ?? "",
    legendaryActions: patch.legendaryActions ?? "",
    combatNotes: patch.combatNotes ?? "",
    sheetImageUrl: patch.sheetImageUrl,
    createdAt: finiteNumber(patch.createdAt, now),
    updatedAt: finiteNumber(patch.updatedAt, now),
  }
}

export function normalizeCompendiumCreature(raw: unknown): CompendiumCreature {
  const value = asRecord(raw)
  if (!value) throw new Error("A criatura precisa ser um objeto JSON.")

  const name = stringValue(value.name).trim()
  if (!name) throw new Error("A criatura precisa ter um nome.")

  const now = Date.now()
  const abilityScores = asRecord(value.abilityScores)

  return {
    id: stringValue(value.id).trim() || crypto.randomUUID(),
    name,
    category: stringValue(value.category, "Monstro"),
    size: stringValue(value.size, "Médio"),
    challengeRating: stringValue(value.challengeRating),
    unique: booleanValue(value.unique),
    defaultSide: creatureSideValue(value.defaultSide),
    initiativeBonus: finiteNumber(value.initiativeBonus),
    armorClass: optionalFiniteNumber(value.armorClass),
    maxHp: optionalFiniteNumber(value.maxHp),
    speed: stringValue(value.speed, "9 m"),
    passivePerception: optionalFiniteNumber(value.passivePerception),
    abilityScores: {
      str: finiteNumber(abilityScores?.str, DEFAULT_ABILITY_SCORES.str),
      dex: finiteNumber(abilityScores?.dex, DEFAULT_ABILITY_SCORES.dex),
      con: finiteNumber(abilityScores?.con, DEFAULT_ABILITY_SCORES.con),
      int: finiteNumber(abilityScores?.int, DEFAULT_ABILITY_SCORES.int),
      wis: finiteNumber(abilityScores?.wis, DEFAULT_ABILITY_SCORES.wis),
      cha: finiteNumber(abilityScores?.cha, DEFAULT_ABILITY_SCORES.cha),
    },
    savingThrows: stringValue(value.savingThrows),
    skills: stringValue(value.skills),
    vulnerabilities: stringValue(value.vulnerabilities),
    resistances: stringValue(value.resistances),
    immunities: stringValue(value.immunities),
    conditionImmunities: stringValue(value.conditionImmunities),
    senses: stringValue(value.senses),
    languages: stringValue(value.languages),
    traits: stringValue(value.traits),
    actions: stringValue(value.actions),
    bonusActions: stringValue(value.bonusActions),
    reactions: stringValue(value.reactions),
    legendaryActions: stringValue(value.legendaryActions),
    combatNotes: stringValue(value.combatNotes),
    sheetImageUrl:
      optionalStringValue(value.imageUrl) ??
      optionalStringValue(value.creatureImageUrl) ??
      optionalStringValue(value.sheetImageUrl),
    createdAt: finiteNumber(value.createdAt, now),
    updatedAt: finiteNumber(value.updatedAt, now),
  }
}

export function createCreatureCompendiumState(): CreatureCompendiumState {
  return {
    version: 1,
    creatures: [],
    updatedAt: Date.now(),
  }
}

export function normalizeCreatureCompendiumState(
  raw: Partial<CreatureCompendiumState> | null | undefined,
): CreatureCompendiumState {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.creatures)) {
    return createCreatureCompendiumState()
  }

  return {
    version: 1,
    creatures: raw.creatures
      .flatMap((entry) => {
        try {
          return [normalizeCompendiumCreature(entry)]
        } catch {
          return []
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
    updatedAt: finiteNumber(raw.updatedAt, Date.now()),
  }
}

export function duplicateCompendiumCreature(
  creature: CompendiumCreature,
): CompendiumCreature {
  return createCompendiumCreature({
    ...creature,
    id: crypto.randomUUID(),
    name: `${creature.name} (cópia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

function normalizeAbilityScores(
  value: Partial<CreatureAbilityScores> | undefined,
): CreatureAbilityScores {
  return {
    str: finiteNumber(value?.str, DEFAULT_ABILITY_SCORES.str),
    dex: finiteNumber(value?.dex, DEFAULT_ABILITY_SCORES.dex),
    con: finiteNumber(value?.con, DEFAULT_ABILITY_SCORES.con),
    int: finiteNumber(value?.int, DEFAULT_ABILITY_SCORES.int),
    wis: finiteNumber(value?.wis, DEFAULT_ABILITY_SCORES.wis),
    cha: finiteNumber(value?.cha, DEFAULT_ABILITY_SCORES.cha),
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return fallback
}

function optionalStringValue(value: unknown): string | undefined {
  const result = stringValue(value).trim()
  return result || undefined
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value.toLowerCase() === "true"
  return Boolean(value)
}

function creatureSideValue(value: unknown): CreatureSide {
  return value === "ally" || value === "neutral" || value === "enemy"
    ? value
    : "enemy"
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = finiteNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : undefined
}
