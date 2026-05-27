import type { Character } from "../types";

export function normalizeCharacter(c: any): Character {
  return {
    ...c,

    type: c.type ?? 'pc',

    attributes: c.attributes ?? c.abilities ?? {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },

    skills: c.skills ?? {},

    armorClass: c.armorClass ?? 10,
    initiativeBonus: c.initiativeBonus ?? 0,

    maxHp: c.maxHp ?? 0,
    currentHp: Math.min(c.currentHp ?? 0, c.maxHp ?? 0),
    temporaryHp: c.temporaryHp ?? 0,

    hitDice: c.hitDice ?? [],

    classes: c.classes ?? [],
    spells: c.spells ?? [],
  }
}