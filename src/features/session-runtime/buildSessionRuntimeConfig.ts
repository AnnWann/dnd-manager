import { getOfficialSpellsByIndexes } from "../../api/spell-compendium"
import { collectReferencedSpellIndexes } from "../../lib/spellReferences"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { Spell } from "../../models/magic/spells/Spell"
import type { CreationState } from "../../shared/creation/creation.types"
import {
  toSessionRuntimeConfig,
  type SessionRuntimeConfigSnapshot,
} from "../../shared/session-runtime/sessionRuntimeConfig"

export function collectSessionReferencedSpellIndexes(
  characters: readonly CharacterTemplate[],
): string[] {
  const indexes = new Set<string>()
  for (const character of characters) {
    for (const index of collectReferencedSpellIndexes(character.toJSON())) {
      const normalized = index.trim()
      if (normalized) indexes.add(normalized)
    }
  }
  return Array.from(indexes).sort((left, right) => left.localeCompare(right))
}

export function sessionSpellReferenceKey(indexes: readonly string[]): string {
  return Array.from(new Set(indexes.map((index) => index.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .join("\u0000")
}

export async function buildSessionRuntimeConfigSnapshot(args: {
  creationRevision: number
  creation: CreationState
  referencedSpellIndexes: readonly string[]
}): Promise<SessionRuntimeConfigSnapshot> {
  const savedByIndex = new Map(
    args.creation.spells
      .map((spell) => [spell.index.trim(), spell] as const)
      .filter(([index]) => Boolean(index)),
  )
  const missingOfficialIndexes = Array.from(
    new Set(
      args.referencedSpellIndexes
        .map((index) => index.trim())
        .filter((index) => index && !savedByIndex.has(index)),
    ),
  )

  const official = missingOfficialIndexes.length
    ? await getOfficialSpellsByIndexes(missingOfficialIndexes)
    : []

  const spellByIndex = new Map<string, Spell>()
  for (const spell of official) {
    const index = spell.index.trim()
    if (index) spellByIndex.set(index, spell)
  }
  // Campaign/Creation spell definitions intentionally win over the official
  // compendium when an index collision exists.
  for (const [index, spell] of savedByIndex) {
    spellByIndex.set(index, spell)
  }

  return {
    creationRevision: args.creationRevision,
    config: {
      ...toSessionRuntimeConfig(args.creation),
      spells: Array.from(spellByIndex.values())
        .sort((left, right) => left.index.localeCompare(right.index)),
    },
  }
}
