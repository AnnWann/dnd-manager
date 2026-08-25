import { getClassProgression } from "../../data/classProgression"
import type { Ability } from "../abilities/Ability"
import { createCharacterAcquisition } from "./CharacterAcquisition"
import type { CharacterTemplate } from "./CharacterTemplate"
import {
  CUSTOM_CLASS_RUNTIME_ID,
  createCustomClassEntry,
  getCustomClassConfig,
  getCustomClassIndex,
  isCustomClassEntry,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "./customClassConfig"
import type { HP } from "../sheet/HP"
import type { Skill } from "../sheet/Skills"
import type { Attribute } from "../sheet/Attribute"
import type { ClassLevel } from "../sheet/Class"

const ATTRIBUTES: Attribute[] = ["str", "dex", "con", "int", "wis", "cha"]

export function applyCustomClassCreationConfiguration(
  character: CharacterTemplate,
  config: CustomClassRuntimeConfig,
  selectedSkills: Skill[] = [],
): CharacterTemplate {
  if (getCustomClassIndex(character) < 0) return character

  const normalized = normalizeCustomClassConfig(config)
  let next = updateCustomClassConfig(character, normalized)
  const customIndex = getCustomClassIndex(next)

  if (customIndex === 0) {
    const current = next.get("sheet").savingThrowProficiencies ?? {}
    const savingThrows = { ...current }
    for (const attribute of ATTRIBUTES) {
      savingThrows[attribute] = normalized.savingThrows.includes(attribute)
    }
    next = next.withSheet("savingThrowProficiencies", savingThrows)
  }

  if (selectedSkills.length) {
    const skills = { ...next.get("sheet").skills }
    for (const skill of selectedSkills.slice(0, normalized.skillChoices)) {
      if (skills[skill] !== "expertise") skills[skill] = "proficient"
    }
    next = next.withSheet("skills", skills)
  }

  next = recalculateCreationHp(next, normalized)
  return next.syncMagicWithClasses()
}

export function applyCustomClassLevelUp(
  character: CharacterTemplate,
  config: CustomClassRuntimeConfig,
  hpGain: number,
  abilities: Ability[] = [],
): CharacterTemplate {
  const normalized = normalizeCustomClassConfig(config)
  const classes = [...(character.get("sheet").classes ?? [])]
  const customIndex = classes.findIndex(isCustomClassEntry)
  const previousCustomLevel = customIndex >= 0 ? classes[customIndex].level : 0
  const targetLevel = Math.min(20, previousCustomLevel + 1)
  if (previousCustomLevel >= 20) return character

  if (customIndex >= 0) {
    classes[customIndex] = {
      ...classes[customIndex],
      level: targetLevel as ClassLevel,
    }
  } else {
    classes.push({
      ...createCustomClassEntry(normalized.name),
      level: 1,
    })
  }

  let next = character.withSheet("classes", classes)
  next = updateCustomClassConfig(next, normalized)
  next = addCustomLevelHp(next, normalized, hpGain)

  if (abilities.length) {
    const eventId = crypto.randomUUID()
    const addedAt = new Date().toISOString()
    const totalLevel = (next.get("sheet").classes ?? []).reduce(
      (sum, entry) => sum + entry.level,
      0,
    )
    const stamped = abilities.map((ability) => ({
      ...ability,
      source: "class" as const,
      acquisition: createCharacterAcquisition({
        eventId,
        addedAt,
        reason: "level-up",
        characterLevel: totalLevel,
        className: CUSTOM_CLASS_RUNTIME_ID,
        classLevel: targetLevel,
        sourceType: "class",
        sourceId: String(CUSTOM_CLASS_RUNTIME_ID),
        sourceName: normalized.name,
      }),
    }))
    const stampedIds = new Set(stamped.map((ability) => ability.id))
    next = next.with("abilities", [
      ...(next.get("abilities") ?? []).filter((ability) => !stampedIds.has(ability.id)),
      ...stamped,
    ])
  }

  return next.syncMagicWithClasses()
}

export function getCustomLevelUpConfig(
  character: CharacterTemplate,
): CustomClassRuntimeConfig {
  return normalizeCustomClassConfig(
    getCustomClassConfig(character) ?? {
      name: "Classe personalizada",
      hitDie: "d8",
      savingThrows: [],
      skillChoices: 2,
      casterType: "none",
      castingAttribute: "int",
      knownSpellMode: "limited",
      knownAtLevel1: 0,
      knownPerLevel: 0,
      slotProgressionMode: "formula",
      spellSlotProgression: {},
      additionalSlotPools: [],
    },
  )
}

function recalculateCreationHp(
  character: CharacterTemplate,
  customConfig: CustomClassRuntimeConfig,
): CharacterTemplate {
  const conModifier = character.getAttributeModifier("con")
  const hitDice: HP["hitDice"] = {}
  let max = 0
  let firstLevel = true

  for (const classEntry of character.get("sheet").classes ?? []) {
    const hitDie = isCustomClassEntry(classEntry)
      ? customConfig.hitDie
      : getClassProgression(classEntry.className).hitDie
    const sides = Number(hitDie.slice(1)) || 6
    const currentPool = hitDice[hitDie] ?? {
      max: { quantity: 0, sides: hitDie },
      current: { quantity: 0, sides: hitDie },
    }

    hitDice[hitDie] = {
      max: {
        quantity: currentPool.max.quantity + classEntry.level,
        sides: hitDie,
      },
      current: {
        quantity: currentPool.current.quantity + classEntry.level,
        sides: hitDie,
      },
    }

    for (let level = 1; level <= classEntry.level; level += 1) {
      max += Math.max(
        1,
        (firstLevel ? sides : Math.floor(sides / 2) + 1) + conModifier,
      )
      firstLevel = false
    }
  }

  return character.withSheet("HP", {
    max: Math.max(1, max),
    current: Math.max(1, max),
    temporary: 0,
    hitDice,
  })
}

function addCustomLevelHp(
  character: CharacterTemplate,
  config: CustomClassRuntimeConfig,
  hpGain: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP
  const hitDie = config.hitDie
  const pool = hp.hitDice[hitDie] ?? {
    max: { quantity: 0, sides: hitDie },
    current: { quantity: 0, sides: hitDie },
  }
  const gain = Math.max(1, Math.trunc(hpGain || 1))

  return character.withSheet("HP", {
    ...hp,
    max: hp.max + gain,
    current: hp.current + gain,
    hitDice: {
      ...hp.hitDice,
      [hitDie]: {
        max: { quantity: pool.max.quantity + 1, sides: hitDie },
        current: { quantity: pool.current.quantity + 1, sides: hitDie },
      },
    },
  })
}
