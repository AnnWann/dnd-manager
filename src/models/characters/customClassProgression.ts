import { getClassProgression } from "../../data/classProgression"
import type { Ability } from "../abilities/Ability"
import type { Spell } from "../magic/spells/Spell"
import { createCharacterAcquisition } from "./CharacterAcquisition"
import type { CharacterTemplate } from "./CharacterTemplate"
import {
  createCustomClassEntry,
  getCustomClassConfig,
  getCustomClassConfigFromEntry,
  getCustomClassIndex,
  isCustomClassEntry,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "./customClassConfig"
import type { HP } from "../sheet/HP"
import type { Skill } from "../sheet/Skills"
import type { Attribute } from "../sheet/Attribute"
import type { ClassLevel, ClassName } from "../sheet/Class"

const ATTRIBUTES: Attribute[] = ["str", "dex", "con", "int", "wis", "cha"]

export function applyCustomClassCreationConfiguration(
  character: CharacterTemplate,
  config: CustomClassRuntimeConfig,
  selectedSkills: Skill[] = [],
  className?: ClassName,
): CharacterTemplate {
  if (getCustomClassIndex(character, className) < 0) return character

  const normalized = normalizeCustomClassConfig(config)
  let next = updateCustomClassConfig(character, normalized, className)
  const customIndex = getCustomClassIndex(next, className)

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

  next = recalculateCreationHp(next)
  return next.syncMagicWithClasses()
}

export function applyCustomClassLevelUp(
  character: CharacterTemplate,
  className: ClassName,
  config: CustomClassRuntimeConfig,
  hpGain: number,
  abilities: Ability[] = [],
  eventId = crypto.randomUUID(),
  addedAt = new Date().toISOString(),
): CharacterTemplate {
  const normalized = normalizeCustomClassConfig(config)
  const classes = [...(character.get("sheet").classes ?? [])]
  const customIndex = getCustomClassIndex(character, className)
  const previousCustomLevel = customIndex >= 0 ? classes[customIndex].level : 0
  const targetLevel = Math.min(20, previousCustomLevel + 1)
  if (previousCustomLevel >= 20) return character

  if (customIndex >= 0) {
    classes[customIndex] = { ...classes[customIndex], level: targetLevel as ClassLevel }
  } else {
    classes.push({ ...createCustomClassEntry(normalized.name, className), level: 1 })
  }

  let next = character.withSheet("classes", classes)
  next = updateCustomClassConfig(next, normalized, className)
  next = addCustomLevelHp(next, normalized, hpGain)

  if (abilities.length) {
    const totalLevel = (next.get("sheet").classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
    const stamped = abilities.map((ability) => ({
      ...ability,
      source: "class" as const,
      acquisition: createCharacterAcquisition({
        eventId,
        addedAt,
        reason: "level-up",
        characterLevel: totalLevel,
        className,
        classLevel: targetLevel,
        sourceType: "class",
        sourceId: String(className),
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

export function applyCustomClassSpellSelection(
  character: CharacterTemplate,
  className: ClassName,
  config: CustomClassRuntimeConfig,
  targetLevel: number,
  spellIndexes: string[],
  preparedSpellIndexes: string[],
  spells: Spell[],
  eventId = crypto.randomUUID(),
  addedAt = new Date().toISOString(),
): CharacterTemplate {
  const normalized = normalizeCustomClassConfig(config)
  const ensured = character.ensureMagic()
  const magic = ensured.get("magic")
  if (!magic) return ensured

  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  const matchesClass = (entry: typeof magic.spells.knownSpells[number]) =>
    entry.source.type === "class" &&
    String(entry.source.sourceId ?? entry.source.name) === String(className)
  const existingForClass = new Map(
    magic.spells.knownSpells.filter(matchesClass).map((entry) => [entry.spells.id, entry]),
  )
  const preparedOnly = normalized.knownSpellMode === "prepared-only"
  const retained = magic.spells.knownSpells.filter((entry) => {
    if (!matchesClass(entry)) return true
    if (!preparedOnly) return false
    const spell = byIndex.get(entry.spells.id)
    return !spell || spell.slotLevel > 0
  })
  const totalLevel = (ensured.get("sheet").classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
  const acquisition = createCharacterAcquisition({
    eventId,
    addedAt,
    reason: "level-up",
    characterLevel: totalLevel,
    className,
    classLevel: targetLevel,
    sourceType: "class",
    sourceId: String(className),
    sourceName: normalized.name,
  })
  const additions = [] as typeof magic.spells.knownSpells

  for (const spellIndex of Array.from(new Set(spellIndexes))) {
    const spell = byIndex.get(spellIndex)
    if (!spell) continue
    if (preparedOnly && spell.slotLevel > 0) continue
    const existing = existingForClass.get(spellIndex)
    additions.push({
      source: {
        ...(existing?.source ?? {}),
        type: "class",
        name: normalized.name,
        sourceId: String(className),
        attribute: normalized.castingAttribute,
        extendedList: existing?.source.extendedList ?? false,
      },
      spells: {
        ...existing?.spells,
        id: spellIndex,
        prepared: preparedOnly && spell.slotLevel === 0
          ? true
          : existing?.spells.prepared ?? preparedSpellIndexes.includes(spellIndex),
      },
      acquisition: existing?.acquisition ?? acquisition,
    })
  }

  const byKey = new Map<string, typeof magic.spells.knownSpells[number]>()
  for (const entry of [...retained, ...additions]) {
    byKey.set(`${entry.source.type}:${entry.source.sourceId ?? entry.source.name}:${entry.spells.id}`, entry)
  }

  return ensured.with("magic", {
    ...magic,
    spells: { ...magic.spells, knownSpells: Array.from(byKey.values()) },
  }).syncMagicWithClasses()
}

export function getCustomLevelUpConfig(
  character: CharacterTemplate,
  className?: ClassName,
): CustomClassRuntimeConfig {
  return normalizeCustomClassConfig(getCustomClassConfig(character, className))
}

function recalculateCreationHp(
  character: CharacterTemplate,
): CharacterTemplate {
  const conModifier = character.getAttributeModifier("con")
  const hitDice: HP["hitDice"] = {}
  let max = 0
  let firstLevel = true

  for (const classEntry of character.get("sheet").classes ?? []) {
    const hitDie = isCustomClassEntry(classEntry)
      ? getCustomClassConfigFromEntry(classEntry)?.hitDie ?? "d8"
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
  const currentMax = Number(hp.currentMax)
  const nextMax = hp.max + gain
  const nextCurrentMax =
    Number.isFinite(currentMax) && currentMax < hp.max
      ? currentMax
      : nextMax

  return character.withSheet("HP", {
    ...hp,
    max: nextMax,
    currentMax: nextCurrentMax,
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
