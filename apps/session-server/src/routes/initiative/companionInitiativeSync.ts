import type { SessionRuntimeConfigSnapshot } from "../../../../web/src/shared/session-runtime/sessionRuntimeConfig"
import { allCreatureFeatures, defaultCompanionState, type CompanionState } from "../../../../web/src/shared/session-runtime/companionRuntime"
import type { InitiativeEntry, InitiativeSession } from "../../../../web/src/models/initiative/Initiative"

/**
 * A controlled creature owns one persistent HP/resource pool regardless of
 * how many initiative turns it has. A newly added combatant receives the
 * persistent values; edits during combat update that same pool.
 */
export function synchronizeCompanionInitiative(
  before: InitiativeSession,
  after: InitiativeSession,
  config: SessionRuntimeConfigSnapshot | null,
  stored: Record<string, CompanionState>,
): { session: InitiativeSession; companions: Record<string, CompanionState>; changedIds: string[] } {
  if (!config) return { session: after, companions: stored, changedIds: [] }
  const controlled = new Map(config.config.creatureCompendium
    .filter(creature => creature.ownerUserId)
    .map(creature => [creature.id, creature]))
  const previous = new Map(before.entries
    .filter(entry => entry.sourceId?.startsWith("compendium:"))
    .map(entry => [entry.id, entry]))
  const nextStates = { ...stored }
  const changed = new Set<string>()
  const initial = new Set<string>()
  const entries = after.entries.map(entry => {
    const creatureId = entry.sourceId?.startsWith("compendium:") ? entry.sourceId.slice("compendium:".length) : undefined
    const creature = creatureId ? controlled.get(creatureId) : undefined
    if (!creature) return entry
    const existing = nextStates[creature.id] ?? defaultCompanionState(creature)
    const previousEntry = previous.get(entry.id)
    if (!previousEntry) {
      // All copies/turns of the same controlled creature share one persistent pool.
      initial.add(creature.id)
      return {
        ...entry,
        currentHp: existing.currentHp,
        maxHp: existing.maxHp,
        temporaryHp: existing.temporaryHp,
        conditions: existing.conditions ?? [],
        creatureFeatureResources: Object.fromEntries(allCreatureFeatures(creature)
          .filter(feature => feature.usage)
          .map(feature => [feature.id, { max: feature.usage!.max, used: existing.featureUses[feature.id] ?? 0 }])),
        creatureSpellResources: {
          ...entry.creatureSpellResources,
          slots: Object.fromEntries(Object.entries(creature.spellcasting?.slots ?? {})
            .map(([level, max]) => [level, {
              max: max ?? 0,
              current: existing.spellSlots[level] ?? max ?? 0,
            }])) as NonNullable<InitiativeEntry["creatureSpellResources"]>["slots"],
          perDay: Object.fromEntries((creature.spellcasting?.spells ?? [])
            .filter(spell => spell.usage.type === "perDay")
            .map(spell => [spell.spellIndex, {
              used: existing.spellPerDay?.[spell.spellIndex] ?? 0,
              max: spell.usage.type === "perDay" ? spell.usage.uses : 0,
            }])),
        },
      }
    }
    const updated = JSON.stringify(entry.conditions) !== JSON.stringify(previousEntry.conditions)
      || entry.currentHp !== previousEntry.currentHp
      || entry.maxHp !== previousEntry.maxHp
      || entry.temporaryHp !== previousEntry.temporaryHp
      || JSON.stringify(entry.creatureFeatureResources) !== JSON.stringify(previousEntry.creatureFeatureResources)
      || JSON.stringify(entry.creatureSpellResources?.slots) !== JSON.stringify(previousEntry.creatureSpellResources?.slots)
      || JSON.stringify(entry.creatureSpellResources?.perDay) !== JSON.stringify(previousEntry.creatureSpellResources?.perDay)
    if (!updated) return entry
    const featureUses = Object.fromEntries(Object.entries(entry.creatureFeatureResources ?? {})
      .map(([id, resource]) => [id, resource.used]))
    const spellPerDay = Object.fromEntries(Object.entries(entry.creatureSpellResources?.perDay ?? {})
      .map(([index, resource]) => [index, resource?.used ?? 0]))
    const spellSlots = Object.fromEntries(Object.entries(entry.creatureSpellResources?.slots ?? {})
      .map(([level, resource]) => [level, resource?.current ?? 0]))
    nextStates[creature.id] = {
      ...existing,
      currentHp: Math.max(0, Math.min(entry.currentHp ?? existing.currentHp, entry.maxHp ?? existing.maxHp)),
      maxHp: Math.max(1, entry.maxHp ?? existing.maxHp),
      temporaryHp: Math.max(0, entry.temporaryHp ?? existing.temporaryHp),
      conditions: entry.conditions,
      featureUses: { ...existing.featureUses, ...featureUses },
      spellSlots: { ...existing.spellSlots, ...spellSlots },
      spellPerDay: { ...existing.spellPerDay, ...spellPerDay },
      revision: existing.revision + 1,
    }
    changed.add(creature.id)
    return entry
  })
  return {
    session: initial.size ? { ...after, entries } : after,
    companions: nextStates,
    changedIds: [...changed],
  }
}
