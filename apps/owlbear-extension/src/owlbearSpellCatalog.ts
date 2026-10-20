import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"
import type { InitiativeEntry } from "../../web/src/models/initiative/Initiative"
import type { Spell } from "../../web/src/models/magic/spells/Spell"

/** Source IDs in initiative are namespaced; older entries may contain raw IDs. */
export function findOwlbearInitiativeCreature(
  creatures: readonly CompendiumCreature[],
  entry: Pick<InitiativeEntry, "sourceId">,
): CompendiumCreature | undefined {
  const sourceId = entry.sourceId?.startsWith("compendium:")
    ? entry.sourceId.slice("compendium:".length)
    : entry.sourceId
  return sourceId ? creatures.find(creature => creature.id === sourceId) : undefined
}

function isSpell(value: unknown): value is Spell {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const spell = value as Record<string, unknown>
  return typeof spell.index === "string" && spell.index.trim().length > 0
    && typeof spell.name === "string" && spell.name.trim().length > 0
    && typeof spell.slotLevel === "number" && Number.isInteger(spell.slotLevel)
    && spell.slotLevel >= 0 && spell.slotLevel <= 9
}

/**
 * Owlbear has no first-party authenticated spell-compendium context.
 * Supply full definitions from the authoritative session snapshot and the
 * campaign/user spell library rather than fetching /api from the extension's
 * own origin. Session definitions take precedence where indexes overlap.
 */
export function resolveOwlbearSpellDefinitions(
  snapshot: Record<string, unknown> | null,
  library: readonly Record<string, unknown>[],
): Spell[] {
  const config = snapshot?.config
  const raw = config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>).spells
    : undefined
  const authoritative = Array.isArray(raw) ? raw : []
  const spells = new Map<string, Spell>()
  for (const value of [...library, ...authoritative]) {
    if (isSpell(value)) spells.set(value.index.trim(), value)
  }
  return [...spells.values()]
}

/** Missing spell definitions must not be silently presented as valid rolls. */
export function listMissingCreatureSpells(
  creature: CompendiumCreature | undefined,
  definitions: readonly Spell[],
): string[] {
  if (!creature?.spellcasting) return []
  const defined = new Set(definitions.map(spell => spell.index))
  return [...new Set(creature.spellcasting.spells
    .map(spell => spell.spellIndex)
    .filter(index => !defined.has(index)))]
}
