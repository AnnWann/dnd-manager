import type { DamageType } from "../../models/combat/Damage"
import type { CompendiumCreature, CreatureFeature } from "../../models/creatures/CompendiumCreature"

export type CompanionState = {
  creatureId: string
  currentHp: number
  maxHp: number
  temporaryHp: number
  /** Feature uses survive exiting initiative and reconnecting to the session. */
  featureUses: Record<string, number>
  /** Remaining spell slots survive exiting initiative. */
  spellSlots: Record<string, number>
  spellPerDay: Record<string, number>
  revision: number
}

export type CompanionOperation =
  | { type: "hp"; creatureId: string; mode: "damage" | "heal" | "temporary" | "set"; amount: number; damageType?: DamageType }
  | { type: "feature"; creatureId: string; featureId: string; delta: -1 | 1 }
  | { type: "spellSlot"; creatureId: string; level: number; delta: -1 | 1 }

export type CompanionClientMessage = { type: "session.companions.operation"; operation: CompanionOperation }
export type CompanionServerMessage =
  | { type: "session.companions.snapshot"; companions: CompanionState[] }
  | { type: "session.companions.updated"; companion: CompanionState }

export function defaultCompanionState(creature: CompendiumCreature): CompanionState {
  const maxHp = Math.max(1, Math.trunc(creature.maxHp ?? 1))
  return {
    creatureId: creature.id,
    currentHp: maxHp,
    maxHp,
    temporaryHp: 0,
    featureUses: {},
    spellPerDay: {},
    spellSlots: Object.fromEntries(Object.entries(creature.spellcasting?.slots ?? {})
      .map(([level, amount]) => [level, Math.max(0, Math.trunc(amount ?? 0))])),
    revision: 0,
  }
}

export function allCreatureFeatures(creature: CompendiumCreature): CreatureFeature[] {
  return [
    ...creature.traits, ...creature.actions, ...creature.bonusActions,
    ...creature.reactions, ...creature.legendaryActions,
  ]
}
