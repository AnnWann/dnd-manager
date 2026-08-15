import type { CharacterTemplate } from "./CharacterTemplate"

export const CUSTOM_CLASS_CHOICE_KEY = "dnd-manager:custom-class-name"
const CUSTOM_CLASS_CONFIG_KEY = "dnd-manager:custom-class-config"
const CUSTOM_CLASS_SLOT_STATE_KEY = "dnd-manager:custom-class-slot-state"

export type CustomCasterType = "none" | "full" | "half" | "third"
export type CustomSlotRecovery = "short" | "long"
export type CustomSpellSlotPoolConfig = {
  id: string
  name: string
  recovery: CustomSlotRecovery
  progression: Record<string, Record<string, number>>
}
export type CustomClassRuntimeConfig = {
  name: string
  hitDie: "d4" | "d6" | "d8" | "d10" | "d12"
  casterType: CustomCasterType
  castingAttribute: "str" | "dex" | "con" | "int" | "wis" | "cha"
  knownSpellMode: "limited" | "spellbook" | "prepared-only"
  knownAtLevel1: number
  knownPerLevel: number
  additionalSlotPools: CustomSpellSlotPoolConfig[]
}
export type CustomSpellSlotPool = {
  id: string
  name: string
  recovery: CustomSlotRecovery
  slots: Record<number, { level: number; max: number; current: number }>
}

const DEFAULT_CONFIG: CustomClassRuntimeConfig = {
  name: "Classe personalizada",
  hitDie: "d8",
  casterType: "none",
  castingAttribute: "int",
  knownSpellMode: "limited",
  knownAtLevel1: 2,
  knownPerLevel: 1,
  additionalSlotPools: [],
}

export function getCustomClassIndex(character: CharacterTemplate): number {
  return (character.get("sheet").classes ?? []).findIndex((entry) =>
    Boolean(entry.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.length),
  )
}

export function hasCustomClass(character: CharacterTemplate): boolean {
  return getCustomClassIndex(character) >= 0
}

export function getCustomClassConfig(character: CharacterTemplate): CustomClassRuntimeConfig | undefined {
  const index = getCustomClassIndex(character)
  if (index < 0) return undefined
  const entry = character.get("sheet").classes[index]
  if (!entry) return undefined
  const raw = entry.levelChoices?.[CUSTOM_CLASS_CONFIG_KEY]?.[0]
  if (raw) {
    try {
      return normalizeConfig(JSON.parse(raw))
    } catch {
      // Cai para a configuração inferida.
    }
  }
  return normalizeConfig({
    ...DEFAULT_CONFIG,
    name: entry.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.[0] || DEFAULT_CONFIG.name,
    casterType: entry.spellcastingProgression ?? "none",
    castingAttribute: entry.castingAttribute ?? "int",
    knownSpellMode: entry.knownSpells?.mode ?? "limited",
    knownAtLevel1: entry.knownSpells?.baseAtLevel1 ?? 2,
    knownPerLevel: entry.knownSpells?.perLevel ?? 1,
  })
}

export function updateCustomClassConfig(character: CharacterTemplate, config: CustomClassRuntimeConfig): CharacterTemplate {
  const index = getCustomClassIndex(character)
  if (index < 0) return character
  const normalized = normalizeConfig(config)
  const classes = [...(character.get("sheet").classes ?? [])]
  const entry = classes[index]
  if (!entry) return character
  classes[index] = {
    ...entry,
    castingAttribute: normalized.casterType === "none" ? undefined : normalized.castingAttribute,
    spellcastingProgression: normalized.casterType === "none" ? undefined : normalized.casterType,
    knownSpells: normalized.casterType === "none" ? undefined : {
      mode: normalized.knownSpellMode,
      baseAtLevel1: normalized.knownSpellMode === "prepared-only" ? 0 : normalized.knownAtLevel1,
      perLevel: normalized.knownSpellMode === "prepared-only" ? 0 : normalized.knownPerLevel,
    },
    levelChoices: {
      ...(entry.levelChoices ?? {}),
      [CUSTOM_CLASS_CHOICE_KEY]: [normalized.name],
      [CUSTOM_CLASS_CONFIG_KEY]: [JSON.stringify(normalized)],
    },
  }
  return character.withSheet("classes", classes)
}

export function createCustomSlotPool(name = "Espaços da classe"): CustomSpellSlotPoolConfig {
  return {
    id: `custom-slots-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    recovery: "long",
    progression: {},
  }
}

export function getCustomSpellSlotPools(character: CharacterTemplate): CustomSpellSlotPool[] {
  const config = getCustomClassConfig(character)
  const index = getCustomClassIndex(character)
  if (!config || index < 0) return []
  const classEntry = character.get("sheet").classes[index]
  if (!classEntry) return []
  const level = String(classEntry.level)
  const state = readState(character, index)

  return config.additionalSlotPools.map((pool) => {
    const slots: CustomSpellSlotPool["slots"] = {}
    const row = pool.progression[level] ?? {}
    for (let circle = 1; circle <= 9; circle += 1) {
      const key = String(circle)
      const max = Math.max(0, Math.trunc(Number(row[key] ?? 0)))
      if (max <= 0) continue
      const current = state[pool.id]?.[key]
      slots[circle] = { level: circle, max, current: Math.min(max, Math.max(0, current ?? max)) }
    }
    return { id: pool.id, name: pool.name, recovery: pool.recovery, slots }
  }).filter((pool) => Object.keys(pool.slots).length > 0)
}

export function spendCustomSpellSlot(character: CharacterTemplate, poolId: string, level: number): CharacterTemplate {
  return changeSlot(character, poolId, level, -1)
}

export function restoreCustomSpellSlot(character: CharacterTemplate, poolId: string, level: number): CharacterTemplate {
  return changeSlot(character, poolId, level, 1)
}

function changeSlot(character: CharacterTemplate, poolId: string, level: number, delta: number): CharacterTemplate {
  const index = getCustomClassIndex(character)
  if (index < 0) return character
  const slot = getCustomSpellSlotPools(character).find((pool) => pool.id === poolId)?.slots[level]
  if (!slot) return character
  const next = Math.max(0, Math.min(slot.max, slot.current + delta))
  if (next === slot.current) return character
  const state = readState(character, index)
  state[poolId] = { ...(state[poolId] ?? {}), [String(level)]: next }
  return writeState(character, index, state)
}

function readState(character: CharacterTemplate, index: number): Record<string, Record<string, number>> {
  const entry = character.get("sheet").classes[index]
  const raw = entry?.levelChoices?.[CUSTOM_CLASS_SLOT_STATE_KEY]?.[0]
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, Record<string, number>>
  } catch {
    return {}
  }
}

function writeState(character: CharacterTemplate, index: number, state: Record<string, Record<string, number>>): CharacterTemplate {
  const classes = [...(character.get("sheet").classes ?? [])]
  const entry = classes[index]
  if (!entry) return character
  classes[index] = {
    ...entry,
    levelChoices: {
      ...(entry.levelChoices ?? {}),
      [CUSTOM_CLASS_SLOT_STATE_KEY]: [JSON.stringify(state)],
    },
  }
  return character.withSheet("classes", classes)
}

function normalizeConfig(value: Partial<CustomClassRuntimeConfig> | undefined): CustomClassRuntimeConfig {
  const config = { ...DEFAULT_CONFIG, ...(value ?? {}) }
  return {
    ...config,
    name: String(config.name || DEFAULT_CONFIG.name).trim() || DEFAULT_CONFIG.name,
    hitDie: config.hitDie ?? "d8",
    casterType: config.casterType ?? "none",
    castingAttribute: config.castingAttribute ?? "int",
    knownSpellMode: config.knownSpellMode ?? "limited",
    knownAtLevel1: Math.max(0, Math.trunc(Number(config.knownAtLevel1) || 0)),
    knownPerLevel: Math.max(0, Number(config.knownPerLevel) || 0),
    additionalSlotPools: Array.isArray(config.additionalSlotPools) ? config.additionalSlotPools : [],
  }
}
