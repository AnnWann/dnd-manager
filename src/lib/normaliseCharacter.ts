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
  return {
    ...state,
    characters: state.characters.map(normalizeCharacter),
    spellCache: state.spellCache ?? {},
    effectPresets: state.effectPresets ?? {},
    homebrewLibrary: state.homebrewLibrary ?? {},
    spellTranslations: state.spellTranslations ?? {},
  }
}