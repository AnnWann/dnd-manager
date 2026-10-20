import type { CompendiumCreature } from "../creatures/CompendiumCreature"
import { getCreatureEffectiveInitiative } from "../creatures/CreatureCombatRuntime"
import {
  rollInitiative,
  type InitiativeCreatureSpellResources,
  type InitiativeEntry,
  type NewInitiativeEntry,
} from "./Initiative"

type EntrySource = Pick<InitiativeEntry, "sourceId">

export type CreatureInitiativeOptions = {
  quantity?: number
  sharedInitiative?: boolean
  digitalDiceEnabled?: boolean
  /** Optional roller for deterministic tests. Each unique turn calls it independently. */
  roll?: (bonus: number) => number
}

/**
 * One combatant can take several turns. Unique creatures have separate initiative
 * rolls/entry IDs for each turn, but share a combatantId (HP, conditions and resources).
 * Ordinary non-unique copies are independent creatures; only they may share a roll.
 */
export function createCreatureInitiativeEntries(
  creature: CompendiumCreature,
  existing: readonly EntrySource[],
  options: CreatureInitiativeOptions = {},
): NewInitiativeEntry[] {
  const sourceId = "compendium:" + creature.id
  const existingCopies = existing.filter(entry => entry.sourceId === sourceId).length
  if (creature.unique && existingCopies > 0) return []

  const requested = creature.unique ? creature.initiativeTurns : (options.quantity ?? 1)
  const quantity = Number.isFinite(requested)
    ? Math.max(1, Math.min(50, Math.trunc(requested)))
    : 1
  const bonus = getCreatureEffectiveInitiative(creature)
  const roller = options.roll ?? rollInitiative
  const enabled = options.digitalDiceEnabled !== false
  const sharedRoll = !creature.unique && options.sharedInitiative && enabled
    ? roller(bonus)
    : undefined
  const combatantId = creature.unique ? crypto.randomUUID() : undefined

  return Array.from({ length: quantity }, (_, index): NewInitiativeEntry => {
    const suffix = existingCopies + index + 1
    const name = creature.unique ? creature.name : `${creature.name} ${suffix}`
    const basicName = creature.unique ? creature.basicName : `${creature.basicName} ${suffix}`
    return {
      id: crypto.randomUUID(),
      sourceId,
      sourceType: creatureSourceType(creature),
      combatantId,
      name,
      realName: name,
      basicName,
      revealRealName: false,
      imageUrl: creature.sheetImageUrl,
      initiative: sharedRoll ?? (enabled ? roller(bonus) : 0),
      initiativeBonus: bonus,
      dexterity: creature.abilityScores.dex,
      side: creature.defaultSide,
      armorClass: creature.armorClass,
      currentHp: creature.maxHp,
      maxHp: creature.maxHp,
      temporaryHp: 0,
      creatureSpellResources: createCreatureSpellResources(creature),
    }
  })
}

function createCreatureSpellResources(
  creature: CompendiumCreature,
): InitiativeCreatureSpellResources | undefined {
  const spellcasting = creature.spellcasting
  if (!spellcasting) return undefined

  const slots: InitiativeCreatureSpellResources["slots"] = {}
  for (let level = 1; level <= 9; level += 1) {
    const max = Math.max(0, Math.trunc(
      spellcasting.slots[level as keyof typeof spellcasting.slots] ?? 0,
    ))
    if (max > 0) {
      slots[level as keyof InitiativeCreatureSpellResources["slots"]] = { current: max, max }
    }
  }
  const perDay = Object.fromEntries(spellcasting.spells.flatMap(spell =>
    spell.usage.type === "perDay"
      ? [[spell.spellIndex, { used: 0, max: Math.max(1, Math.trunc(spell.usage.uses)) }]]
      : [],
  ))

  return { slots, perDay }
}

function creatureSourceType(creature: CompendiumCreature): "npc" | "monster" | "custom" {
  const category = creature.category.toLocaleLowerCase()
  if (category.includes("npc") || category.includes("personagem")) return "npc"
  if (category.includes("outro")) return "custom"
  return "monster"
}
