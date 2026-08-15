import type { CharacterTemplate } from "./CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { ClassLevel, KnownSpellMode, SpellcastingProgression } from "../sheet/Class"
import type { DieSides } from "../dice/Die"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import type { Slot } from "../magic/spells/LeveledSlots"

export const CUSTOM_CLASS_CHOICE_KEY = "dnd-manager:custom-class-name"
const CUSTOM_CLASS_CONFIG_KEY = "dnd-manager:custom-class-config"
const CUSTOM_CLASS_SLOT_STATE_KEY = "dnd-manager:custom-class-slot-state"

export type CustomCasterType = "none" | SpellcastingProgression
export type CustomSlotRecovery = "short" | "long"

export type CustomSpellSlotPoolConfig = {
  id: string
  name: string
  recovery: CustomSlotRecovery
  progression: Partial<
    Record<ClassLevel, Partial<Record<MagicCircleLevel, number>>>
  >
}

export type CustomClassRuntimeConfig = {
  name: string
  hitDie: DieSides
  casterType: CustomCasterType
  castingAttribute: Attribute
  knownSpellMode: KnownSpellMode
  knownAtLevel1: number
  knownPerLevel: number
  additionalSlotPools: CustomSpellSlotPoolConfig[]
}

export type CustomSpellSlotPool = {
  id: string
  name: string
  recovery: CustomSlotRecovery
  slots: Partial<Record<MagicCircleLevel, Slot>>
}

type StoredSlotState = Record<string, Partial<Record<MagicCircleLevel, number>>>

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

export function isCustomClassEntry(
  classEntry: CharacterTemplate["get"] extends never ? never : any,
): boolean {
  return Boolean(classEntry?.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.length)
}

export function getCustomClassIndex(character: CharacterTemplate): number {
  return (character.get("sheet").classes ?? []).findIndex((entry) =>
    Boolean(entry.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.length),
  )
}

export function hasCustomClass(character: CharacterTemplate): boolean {
  return getCustomClassIndex(character) >= 0
}

export function getCustomClassConfig(
  character: CharacterTemplate,
): CustomClassRuntimeConfig | undefined {
  const index = getCustomClassIndex(character)
  if (index < 0) return undefined

  const entry = character.get("sheet").classes[index]
  const stored = entry.levelChoices?.[CUSTOM_CLASS_CONFIG_KEY]?.[0]
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<CustomClassRuntimeConfig>
      return normalizeConfig({
        ...DEFAULT_CONFIG,
        ...parsed,
        additionalSlotPools: Array.isArray(parsed.additionalSlotPools)
          ? parsed.additionalSlotPools
          : [],
      })
    } catch {
      // Configurações antigas são inferidas dos campos já persistidos na classe.
    }
  }

  return normalizeConfig({
    ...DEFAULT_CONFIG,
    name:
      entry.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.[0] ||
      DEFAULT_CONFIG.name,
    casterType: entry.spellcastingProgression ?? "none",
    castingAttribute: entry.castingAttribute ?? "int",
    knownSpellMode: entry.knownSpells?.mode ?? "limited",
    knownAtLevel1: entry.knownSpells?.baseAtLevel1 ?? 2,
    knownPerLevel: entry.knownSpells?.perLevel ?? 1,
  })
}

export function updateCustomClassConfig(
  character: CharacterTemplate,
  config: CustomClassRuntimeConfig,
): CharacterTemplate {
  const index = getCustomClassIndex(character)
  if (index < 0) return character

  const normalized = normalizeConfig(config)
  const classes = [...(character.get("sheet").classes ?? [])]
  const entry = classes[index]
  classes[index] = {
    ...entry,
    castingAttribute:
      normalized.casterType === "none"
        ? undefined
        : normalized.castingAttribute,
    spellcastingProgression:
      normalized.casterType === "none" ? undefined : normalized.casterType,
    knownSpells:
      normalized.casterType === "none"
        ? undefined
        : {
            mode: normalized.knownSpellMode,
            baseAtLevel1:
              normalized.knownSpellMode === "prepared-only"
                ? 0
                : normalized.knownAtLevel1,
            perLevel:
              normalized.knownSpellMode === "prepared-only"
                ? 0
                : normalized.knownPerLevel,
          },
    levelChoices: {
      ...(entry.levelChoices ?? {}),
      [CUSTOM_CLASS_CHOICE_KEY]: [normalized.name],
      [CUSTOM_CLASS_CONFIG_KEY]: [JSON.stringify(normalized)],
    },
  }

  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      classes,
    },
  })
}

export function createCustomSlotPool(
  name = "Espaços da classe",
): CustomSpellSlotPoolConfig {
  return {
    id: `custom-slots-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    recovery: "long",
    progression: {},
  }
}

export function getCustomSpellSlotPools(
  character: CharacterTemplate,
): CustomSpellSlotPool[] {
  const config = getCustomClassConfig(character)
  const classIndex = getCustomClassIndex(character)
  if (!config || classIndex < 0) return []

  const level = character.get("sheet").classes[classIndex].level as ClassLevel
  const state = getStoredSlotState(character, classIndex)

  return config.additionalSlotPools
    .map((pool) => {
      const row = pool.progression[level] ?? {}
      const slots: Partial<Record<MagicCircleLevel, Slot>> = {}

      for (let circle = 1; circle <= 9; circle += 1) {
        const slotLevel = circle as MagicCircleLevel
        const max = Math.max(0, Math.trunc(Number(row[slotLevel] ?? 0)))
        if (max <= 0) continue
        const saved = state[pool.id]?.[slotLevel]
        slots[slotLevel] = {
          level: slotLevel,
          max,
          current: Math.min(max, Math.max(0, saved ?? max)),
        }
      }

      return {
        id: pool.id,
        name: pool.name || "Espaços da classe",
        recovery: pool.recovery,
        slots,
      }
    })
    .filter((pool) => Object.keys(pool.slots).length > 0)
}

export function spendCustomSpellSlot(
  character: CharacterTemplate,
  poolId: string,
  level: MagicCircleLevel,
): CharacterTemplate {
  return changeCustomSlot(character, poolId, level, -1)
}

export function restoreCustomSpellSlot(
  character: CharacterTemplate,
  poolId: string,
  level: MagicCircleLevel,
): CharacterTemplate {
  return changeCustomSlot(character, poolId, level, 1)
}

export function recoverCustomSpellSlotPools(
  character: CharacterTemplate,
  restKind: CustomSlotRecovery,
  fraction: number,
): CharacterTemplate {
  const classIndex = getCustomClassIndex(character)
  if (classIndex < 0) return character

  const pools = getCustomSpellSlotPools(character)
  const currentState = getStoredSlotState(character, classIndex)
  const nextState: StoredSlotState = { ...currentState }
  let changed = false

  for (const pool of pools) {
    if (pool.recovery !== restKind && restKind !== "long") continue
    if (pool.recovery === "long" && restKind !== "long") continue

    nextState[pool.id] = { ...(nextState[pool.id] ?? {}) }
    for (const [levelText, slot] of Object.entries(pool.slots)) {
      if (!slot) continue
      const level = Number(levelText) as MagicCircleLevel
      const missing = Math.max(0, slot.max - slot.current)
      const restored = Math.min(
        slot.max,
        slot.current + Math.ceil(missing * Math.max(0, Math.min(1, fraction))),
      )
      nextState[pool.id][level] = restored
      changed = changed || restored !== slot.current
    }
  }

  return changed ? storeSlotState(character, classIndex, nextState) : character
}

function changeCustomSlot(
  character: CharacterTemplate,
  poolId: string,
  level: MagicCircleLevel,
  delta: -1 | 1,
): CharacterTemplate {
  const classIndex = getCustomClassIndex(character)
  if (classIndex < 0) return character

  const pool = getCustomSpellSlotPools(character).find((entry) => entry.id === poolId)
  const slot = pool?.slots[level]
  if (!slot) return character

  const next = Math.max(0, Math.min(slot.max, slot.current + delta))
  if (next === slot.current) return character

  const state = getStoredSlotState(character, classIndex)
  const nextState: StoredSlotState = {
    ...state,
    [poolId]: {
      ...(state[poolId] ?? {}),
      [level]: next,
    },
  }
  return storeSlotState(character, classIndex, nextState)
}

function getStoredSlotState(
  character: CharacterTemplate,
  classIndex: number,
): StoredSlotState {
  const entry = character.get("sheet").classes[classIndex]
  const raw = entry.levelChoices?.[CUSTOM_CLASS_SLOT_STATE_KEY]?.[0]
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function storeSlotState(
  character: CharacterTemplate,
  classIndex: number,
  state: StoredSlotState,
): CharacterTemplate {
  const classes = [...(character.get("sheet").classes ?? [])]
  const entry = classes[classIndex]
  classes[classIndex] = {
    ...entry,
    levelChoices: {
      ...(entry.levelChoices ?? {}),
      [CUSTOM_CLASS_SLOT_STATE_KEY]: [JSON.stringify(state)],
    },
  }
  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      classes,
    },
  })
}

function normalizeConfig(config: CustomClassRuntimeConfig): CustomClassRuntimeConfig {
  return {
    ...config,
    name: String(config.name || DEFAULT_CONFIG.name).trim() || DEFAULT_CONFIG.name,
    hitDie: config.hitDie || "d8",
    casterType: config.casterType ?? "none",
    castingAttribute: config.castingAttribute ?? "int",
    knownSpellMode: config.knownSpellMode ?? "limited",
    knownAtLevel1: Math.max(0, Math.trunc(Number(config.knownAtLevel1) || 0)),
    knownPerLevel: Math.max(0, Number(config.knownPerLevel) || 0),
    additionalSlotPools: (config.additionalSlotPools ?? []).map((pool) => ({
      ...pool,
      id: pool.id || createCustomSlotPool().id,
      name: String(pool.name || "Espaços da classe"),
      recovery: pool.recovery === "short" ? "short" : "long",
      progression: pool.progression ?? {},
    })),
  }
}
