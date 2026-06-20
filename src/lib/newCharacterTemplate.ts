import { CharacterTemplate } from "../models/characters/CharacterTemplate";
import type { Player } from "../models/player/Player";

export function newCharacterTemplate(name: string, owner: Player): CharacterTemplate {
  return CharacterTemplate.fromJSON({
    id: crypto.randomUUID(),
    name,
    sheet: {
      HP: {
          max: 1,
          current: 1,
          temporary: 0,
          hitDice: {}
      },
      stats: {
        armorClass: 10,
        mobility: 9,
        initiative: 0,
        passive_perception: 10,
      },
      attributes: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      savingThrowProficiencies: {},
      skills: {},
      race: {
        race: 'human',
        naturalAbilities: [],
        subrace: '',
        attributeBonus: {
          str: 0,
          dex: 0,
          con: 0,
          int: 0,
          wis: 0,
          cha: 0
        },
        proficiencies: []
      },
      type: "pc",
      arms: 2,
      classes: [],
    },
    actionsPerTurn: {
      action: 1,
      bonusAction: 1,
      reaction: 1,
      legendaryAction: 0,
      legendaryReaction: 0,
      legendaryResistance: 0,
      interaction: 1,
      free: 999,
    },
    unique: true,
    abilities: [],
    equipment: {
      rings: [],
      weapons: [],
      pockets: [],
    },
    inventory: [],
    notes: [],
    owner: owner,
    visibility: "party",
  })
}