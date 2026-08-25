import type { CharacterTemplate } from "./CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { CharacterClassInterface, ClassName } from "../sheet/Class"

export const CUSTOM_CLASS_RUNTIME_ID = "__custom__" as ClassName
const CUSTOM_CLASS_RUNTIME_PREFIX = `${String(CUSTOM_CLASS_RUNTIME_ID)}-`

export function isCustomClassName(
  className: ClassName | string | undefined,
): boolean {
  const value = String(className ?? "")
  return (
    value === String(CUSTOM_CLASS_RUNTIME_ID) ||
    value.startsWith(CUSTOM_CLASS_RUNTIME_PREFIX)
  )
}

export function createCustomClassRuntimeId(): ClassName {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${CUSTOM_CLASS_RUNTIME_PREFIX}${suffix}` as ClassName
}
export const CUSTOM_CLASS_CHOICE_KEY = "dnd-manager:custom-class-name"
export const CUSTOM_CLASS_CONFIG_KEY = "dnd-manager:custom-class-config"
const CUSTOM_CLASS_SLOT_STATE_KEY = "dnd-manager:custom-class-slot-state"

export type CustomCasterType = "none" | "full" | "half" | "third"
export type CustomSlotRecovery = "short" | "long"
export type CustomSpellProgressionMode = "formula" | "table"
export type CustomSpellSlotPoolConfig = {
  id: string
  name: string
  recovery: CustomSlotRecovery
  progression: Record<string, Record<string, number>>
}
export type CustomClassRuntimeConfig = {
  name: string
  hitDie: "d4" | "d6" | "d8" | "d10" | "d12"
  savingThrows: Attribute[]
  skillChoices: number
  casterType: CustomCasterType
  castingAttribute: Attribute
  knownSpellMode: "limited" | "spellbook" | "prepared-only"
  knownAtLevel1: number
  knownPerLevel: number
  slotProgressionMode: CustomSpellProgressionMode
  spellSlotProgression: Record<string, Record<string, number>>
  additionalSlotPools: CustomSpellSlotPoolConfig[]
}
export type CustomSpellSlotPool = {
  id: string
  name: string
  recovery: CustomSlotRecovery
  slots: Record<number, { level: number; max: number; current: number }>
}

const ATTRIBUTE_KEYS: Attribute[] = ["str", "dex", "con", "int", "wis", "cha"]

export const DEFAULT_CUSTOM_CLASS_CONFIG: CustomClassRuntimeConfig = {
  name: "Classe personalizada",
  hitDie: "d8",
  savingThrows: [],
  skillChoices: 2,
  casterType: "none",
  castingAttribute: "int",
  knownSpellMode: "limited",
  knownAtLevel1: 2,
  knownPerLevel: 1,
  slotProgressionMode: "formula",
  spellSlotProgression: {},
  additionalSlotPools: [],
}

export function isCustomClassEntry(entry: CharacterClassInterface | undefined): boolean {
  return Boolean(
    entry &&
      (isCustomClassName(entry.className) ||
        entry.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.length),
  )
}

export function createCustomClassEntry(
  name = "Classe personalizada",
  className: ClassName = createCustomClassRuntimeId(),
): CharacterClassInterface {
  const config = normalizeCustomClassConfig({ ...DEFAULT_CUSTOM_CLASS_CONFIG, name })
  return {
    className,
    level: 1,
    levelChoices: {
      [CUSTOM_CLASS_CHOICE_KEY]: [config.name],
      [CUSTOM_CLASS_CONFIG_KEY]: [JSON.stringify(config)],
    },
  }
}

export function getCustomClassIndex(
  character: CharacterTemplate,
  className?: ClassName,
): number {
  const classes = character.get("sheet").classes ?? []
  if (className) {
    return classes.findIndex(
      (entry) => entry.className === className && isCustomClassEntry(entry),
    )
  }
  return classes.findIndex(isCustomClassEntry)
}

export function hasCustomClass(character: CharacterTemplate): boolean {
  return getCustomClassIndex(character) >= 0
}

export function getCustomClassConfigFromEntry(
  entry: CharacterClassInterface | undefined,
): CustomClassRuntimeConfig | undefined {
  if (!isCustomClassEntry(entry) || !entry) return undefined
  const raw = entry.levelChoices?.[CUSTOM_CLASS_CONFIG_KEY]?.[0]
  if (raw) {
    try {
      return normalizeCustomClassConfig(JSON.parse(raw))
    } catch {
      // Cai para a configuração inferida.
    }
  }
  return normalizeCustomClassConfig({
    ...DEFAULT_CUSTOM_CLASS_CONFIG,
    name: entry.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.[0] || DEFAULT_CUSTOM_CLASS_CONFIG.name,
    casterType: entry.spellcastingProgression ?? "none",
    castingAttribute: entry.castingAttribute ?? "int",
    knownSpellMode: entry.knownSpells?.mode ?? "limited",
    knownAtLevel1: entry.knownSpells?.baseAtLevel1 ?? 2,
    knownPerLevel: entry.knownSpells?.perLevel ?? 1,
  })
}

export function getCustomClassConfig(
  character: CharacterTemplate,
  className?: ClassName,
): CustomClassRuntimeConfig | undefined {
  const index = getCustomClassIndex(character, className)
  if (index < 0) return undefined
  return getCustomClassConfigFromEntry(character.get("sheet").classes?.[index])
}

export function updateCustomClassConfig(
  character: CharacterTemplate,
  config: CustomClassRuntimeConfig,
  className?: ClassName,
): CharacterTemplate {
  const index = getCustomClassIndex(character, className)
  if (index < 0) return character
  const normalized = normalizeCustomClassConfig(config)
  const classes = [...(character.get("sheet").classes ?? [])]
  const entry = classes[index]
  if (!entry) return character
  classes[index] = {
    ...entry,
    className: entry.className,
    castingAttribute: normalized.casterType === "none" ? undefined : normalized.castingAttribute,
    spellcastingProgression:
      normalized.casterType === "none" || normalized.slotProgressionMode === "table"
        ? undefined
        : normalized.casterType,
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
  const result: CustomSpellSlotPool[] = []
  const classes = character.get("sheet").classes ?? []

  classes.forEach((classEntry, index) => {
    const config = getCustomClassConfigFromEntry(classEntry)
    if (!config) return
    const level = String(classEntry.level)
    const state = readState(character, index)

    for (const pool of config.additionalSlotPools) {
      const slots: CustomSpellSlotPool["slots"] = {}
      const row = pool.progression[level] ?? {}
      for (let circle = 1; circle <= 9; circle += 1) {
        const key = String(circle)
        const max = Math.max(0, Math.trunc(Number(row[key] ?? 0)))
        if (max <= 0) continue
        const current = state[pool.id]?.[key]
        slots[circle] = {
          level: circle,
          max,
          current: Math.min(max, Math.max(0, current ?? max)),
        }
      }
      if (Object.keys(slots).length > 0) {
        result.push({
          id: pool.id,
          name: pool.name,
          recovery: pool.recovery,
          slots,
        })
      }
    }
  })

  return result
}

export function spendCustomSpellSlot(character: CharacterTemplate, poolId: string, level: number): CharacterTemplate {
  return changeSlot(character, poolId, level, -1)
}

export function restoreCustomSpellSlot(character: CharacterTemplate, poolId: string, level: number): CharacterTemplate {
  return changeSlot(character, poolId, level, 1)
}

function changeSlot(character: CharacterTemplate, poolId: string, level: number, delta: number): CharacterTemplate {
  const classes = character.get("sheet").classes ?? []

  for (let index = 0; index < classes.length; index += 1) {
    const classEntry = classes[index]
    const config = getCustomClassConfigFromEntry(classEntry)
    if (!config) continue
    const pool = config.additionalSlotPools.find((candidate) => candidate.id === poolId)
    if (!pool) continue

    const key = String(level)
    const row = pool.progression[String(classEntry.level)] ?? {}
    const max = Math.max(0, Math.trunc(Number(row[key] ?? 0)))
    if (max <= 0) return character

    const state = readState(character, index)
    const current = Math.min(max, Math.max(0, state[poolId]?.[key] ?? max))
    const next = Math.max(0, Math.min(max, current + delta))
    if (next === current) return character

    state[poolId] = { ...(state[poolId] ?? {}), [key]: next }
    return writeState(character, index, state)
  }

  return character
}

function readState(character: CharacterTemplate, index: number): Record<string, Record<string, number>> {
  const entry = character.get("sheet").classes?.[index]
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

export function normalizeCustomClassConfig(
  value: Partial<CustomClassRuntimeConfig> | undefined,
): CustomClassRuntimeConfig {
  const config = { ...DEFAULT_CUSTOM_CLASS_CONFIG, ...(value ?? {}) }
  const savingThrows = Array.isArray(config.savingThrows)
    ? Array.from(new Set(config.savingThrows.filter((entry): entry is Attribute => ATTRIBUTE_KEYS.includes(entry))))
    : []

  return {
    ...config,
    name: String(config.name || DEFAULT_CUSTOM_CLASS_CONFIG.name).trim() || DEFAULT_CUSTOM_CLASS_CONFIG.name,
    hitDie: config.hitDie ?? "d8",
    savingThrows,
    skillChoices: Math.max(0, Math.min(18, Math.trunc(Number(config.skillChoices) || 0))),
    casterType: config.casterType ?? "none",
    castingAttribute: config.castingAttribute ?? "int",
    knownSpellMode: config.knownSpellMode ?? "limited",
    knownAtLevel1: Math.max(0, Math.trunc(Number(config.knownAtLevel1) || 0)),
    knownPerLevel: Math.max(0, Number(config.knownPerLevel) || 0),
    slotProgressionMode: config.slotProgressionMode === "table" ? "table" : "formula",
    spellSlotProgression:
      config.spellSlotProgression && typeof config.spellSlotProgression === "object"
        ? config.spellSlotProgression
        : {},
    additionalSlotPools: Array.isArray(config.additionalSlotPools) ? config.additionalSlotPools : [],
  }
}
