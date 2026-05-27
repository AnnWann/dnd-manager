import type { Character } from "../types";
import type { AppStateV1 } from "./remoteState";

export function normalizeCharacter(character: any): Character {
  const attributes =
    character.attributes ??
    character.abilities ??
    {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    }

  return {
    ...character,
    attributes,
    type: character.type ?? 'pc',
    visibilityRole: character.visibilityRole ?? 'player',
    ownerKey: character.ownerKey ?? '',
    skills: character.skills ?? {},
    classes: character.classes ?? [],
    spells: character.spells ?? [],
    armorClass: character.armorClass ?? 10,
    initiativeBonus: character.initiativeBonus ?? 0,
    maxHp: character.maxHp ?? 0,
    currentHp: Math.min(character.currentHp ?? 0, character.maxHp ?? 0),
    temporaryHp: character.temporaryHp ?? 0,
    hitDice: character.hitDice ?? [],
  }
}

export function normalizeAppState(state: AppStateV1): AppStateV1 {
  const initiativeOrder = (state.initiativeOrder ?? []).map((entry) => ({
    ...entry,
    effects: entry.effects ?? [],
  }))

  return {
    ...state,
    characters: state.characters.map(normalizeCharacter),
    spellCache: state.spellCache ?? {},
    effectPresets: state.effectPresets ?? {},
    homebrewLibrary: state.homebrewLibrary ?? {},
    spellTranslations: state.spellTranslations ?? {},
    initiativeOrder,
    currentTurnIndex:
      initiativeOrder.length === 0
        ? 0
        : Math.min(state.currentTurnIndex ?? 0, initiativeOrder.length - 1),
  }
}