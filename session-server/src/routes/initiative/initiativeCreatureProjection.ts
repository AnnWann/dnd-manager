import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import { getCreatureEffectiveArmorClass } from "../../../../src/models/creatures/CreatureCombatRuntime";
import type { InitiativeSession } from "../../../../src/models/initiative/Initiative";

export const COMPENDIUM_SOURCE_PREFIX = "compendium:";

export function projectInitiativeSessionFromCreatureState(
  session: InitiativeSession,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): { session: InitiativeSession; changed: boolean } {
  if (!runtimeConfig?.config.creatureCompendium.length) return { session, changed: false };
  const creatures = new Map(runtimeConfig.config.creatureCompendium.map((creature) => [creature.id, creature]));
  let changed = false;
  const entries = session.entries.map((entry) => {
    const creature = creatureForEntry(entry.sourceId, creatures);
    if (!creature) return entry;
    const armorClass = getCreatureEffectiveArmorClass(creature, entry.conditions, entry);
    if (entry.armorClass === armorClass) return entry;
    changed = true;
    return { ...entry, armorClass };
  });
  return {
    changed,
    session: changed ? { ...session, entries, updatedAt: Date.now() } : session,
  };
}

export function creatureIdFromSourceId(sourceId: string | undefined): string | undefined {
  return sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX)
    ? sourceId.slice(COMPENDIUM_SOURCE_PREFIX.length)
    : undefined;
}

function creatureForEntry<T extends { id: string }>(sourceId: string | undefined, creatures: Map<string, T>): T | undefined {
  const id = creatureIdFromSourceId(sourceId);
  return id ? creatures.get(id) : undefined;
}
