import type { InitiativeCondition } from "../../models/initiative/Initiative"
import type { DamageType } from "../../models/combat/Damage"
import type { CompendiumCreature, CreatureFeature } from "../../models/creatures/CompendiumCreature"

export type CompanionState = {
  creatureId: string
  currentHp: number
  maxHp: number
  temporaryHp: number
  /** Feature uses survive exiting initiative and reconnecting to the session. */
  conditions?: InitiativeCondition[]
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
    conditions: [],
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

/** Public NPC portraits never confer sheet or state access to a player. */
export function canControlCompanion(creature: Pick<CompendiumCreature, "ownerUserId" | "showInCompanions">, role: string, userId: string): boolean {
  return role === "MASTER" || (creature.showInCompanions !== true && Boolean(creature.ownerUserId) && creature.ownerUserId === userId)
}

export function hasPersistentCompanionState(creature: Pick<CompendiumCreature, "ownerUserId" | "showInCompanions">): boolean {
  return Boolean(creature.ownerUserId) || creature.showInCompanions === true
}
