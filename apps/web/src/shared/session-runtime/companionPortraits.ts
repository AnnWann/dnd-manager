import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"

export type CompanionPortrait = { id: string; name: string; imageUrl?: string }

/** Explicit allowlist: never send the creature sheet through the public gallery. */
export function projectCompanionPortraits(creatures: CompendiumCreature[]): CompanionPortrait[] {
  return creatures.filter(creature => creature.showInCompanions === true).map(creature => ({
    id: creature.id, name: creature.name,
    ...(creature.sheetImageUrl ? { imageUrl: creature.sheetImageUrl } : {}),
  }))
}

