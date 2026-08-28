import { applyBonuses, getCharacterBonuses, getScopedCharacterBonuses } from "../characters/characterStats"
import { CharacterTemplate } from "../characters/CharacterTemplate"
import type { CharacterCondition } from "../characters/CharacterCondition"
import { withCharacterConditions } from "../characters/characterConditionStorage"
import type { InitiativeCondition, InitiativeEntry } from "../initiative/Initiative"
import type { Attribute } from "../sheet/Attribute"
import type { CompendiumCreature, CreatureFeature } from "./CompendiumCreature"

export function createCreatureCombatCharacter(
  creature: CompendiumCreature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): CharacterTemplate {
  const baseArmorClass = entry?.armorClassOverride ?? creature.armorClass ?? 10
  let character = CharacterTemplate.fromJSON({
    id: `compendium:${creature.id}`,
    name: creature.name,
    unique: creature.unique,
    sheet: {
      HP: {
        max: Math.max(1, creature.maxHp ?? 1),
        current: Math.max(0, entry?.currentHp ?? creature.maxHp ?? 1),
        temporary: Math.max(0, entry?.temporaryHp ?? 0),
        hitDice: {},
      },
      stats: {
        armorClass: baseArmorClass,
        mobility: parseSpeed(creature.speed),
        initiative: creature.initiativeBonus,
        passive_perception: creature.passivePerception ?? 10,
      },
      attributes: { ...creature.abilityScores },
      skills: {},
      savingThrowProficiencies: {},
      proficiencies: [],
      race: {
        race: "custom",
        subrace: "",
        naturalAbilities: [],
        attributeBonus: {},
        proficiencies: [],
        size: "medium",
      },
      type: "monstruosidade",
      arms: 2,
      damageAffinities: creature.damageAffinities,
    },
    actionsPerTurn: {
      action: 1,
      bonusAction: 1,
      reaction: 1,
      legendaryAction: 0,
      legendaryReaction: 0,
      legendaryResistance: 0,
      interaction: 1,
      free: 999,
    },
    equipment: { rings: [], necklaces: [], weapons: [], heldItems: [], pockets: [] },
    inventory: [],
    notes: [],
    owner: { id: "", name: "", role: "master" },
    visibility: "master",
  })

  if (conditions.length) {
    character = withCharacterConditions(
      character,
      conditions.map((condition) => initiativeConditionToCharacterCondition(condition, entry?.id)),
    )
  }
  return character
}

export function getCreatureEffectiveArmorClass(
  creature: CompendiumCreature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): number {
  return createCreatureCombatCharacter(creature, conditions, entry).getEffectiveArmorClass()
}

export function getCreatureFeatureEffectiveAttackBonus(
  creature: CompendiumCreature,
  feature: CreatureFeature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): number | undefined {
  const mechanics = feature.mechanics
  if (!mechanics || mechanics.kind !== "attack") return undefined
  const character = createCreatureCombatCharacter(creature, conditions, entry)
  const attribute = mechanics.attribute ?? defaultAttackAttribute(mechanics.attackType, mechanics.rangeType)
  const scopedKey = mechanics.attackType === "spell" ? "spellAttackBonus" : mechanics.attackType === "weapon" ? "weaponAttackBonus" : undefined
  return applyBonuses(mechanics.attackBonus, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...(scopedKey ? getScopedCharacterBonuses(character, scopedKey, attribute) : []),
  ])
}

export function getCreatureFeatureEffectiveDamageBonus(
  creature: CompendiumCreature,
  feature: CreatureFeature,
  conditions: InitiativeCondition[] = [],
  entry?: InitiativeEntry,
): number {
  const mechanics = feature.mechanics
  if (!mechanics || mechanics.kind !== "attack") return 0
  const character = createCreatureCombatCharacter(creature, conditions, entry)
  const attribute = mechanics.attribute ?? defaultAttackAttribute(mechanics.attackType, mechanics.rangeType)
  const scopedKey = mechanics.attackType === "spell" ? "spellDamageBonus" : mechanics.attackType === "weapon" ? "weaponDamageBonus" : undefined
  return applyBonuses(0, [
    ...getCharacterBonuses(character, "damageBonus"),
    ...(scopedKey ? getScopedCharacterBonuses(character, scopedKey, attribute) : []),
  ])
}

export function initiativeConditionToCharacterCondition(
  condition: InitiativeCondition,
  linkedCombatantId?: string,
): CharacterCondition {
  return {
    id: condition.id,
    name: condition.name,
    description: condition.description ?? "",
    behavior: condition.behavior ?? "",
    source: condition.source ?? "Iniciativa",
    notes: condition.notes ?? "",
    tags: condition.tags ?? ["initiative"],
    bonuses: condition.bonuses,
    grantedSpells: condition.grantedSpells,
    grantedProficiencies: condition.grantedProficiencies,
    grantedAbilities: condition.grantedAbilities,
    duration: initiativeDurationToCharacter(condition.duration),
    createdAt: new Date().toISOString(),
    linkedCombatantId,
  }
}

function initiativeDurationToCharacter(duration: InitiativeCondition["duration"]): CharacterCondition["duration"] {
  if (duration.type === "rounds" || duration.type === "turns") {
    return {
      type: duration.type,
      total: duration.remaining,
      remaining: duration.remaining,
      tickOn: "end-of-turn",
      tickOwner: "affected",
      autoRemoveAtZero: true,
    }
  }
  if (duration.type === "untilTurnStart") {
    return { type: "until-start-of-turn", tickOn: "start-of-turn", tickOwner: "source", autoRemoveAtZero: true }
  }
  if (duration.type === "untilTurnEnd") {
    return { type: "until-end-of-turn", tickOn: "end-of-turn", tickOwner: "source", autoRemoveAtZero: true }
  }
  return { type: "custom", customLabel: "Remoção manual", tickOn: "manual", autoRemoveAtZero: false }
}

function defaultAttackAttribute(
  attackType: "weapon" | "spell" | "other",
  rangeType: "melee" | "ranged",
): Attribute {
  if (attackType === "spell") return "int"
  return rangeType === "ranged" ? "dex" : "str"
}

function parseSpeed(value: string): number {
  const parsed = Number(value.match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 9
}
