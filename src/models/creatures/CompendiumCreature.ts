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
      .filter((entry): entry is CompendiumCreature =>
        Boolean(entry && typeof entry === "object" && entry.id),
      )
      .map((entry) => createCompendiumCreature(entry))
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

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined
}
