import type { ClassSourceBook, ClassName } from "../sheet/Class"
import type {
  LevelFeatureDefinition,
  SubclassDefinition,
} from "./ClassProgression"

const XANATHAR = "Xanathar" as ClassSourceBook

function feature(
  level: number,
  name: string,
  extra: Partial<LevelFeatureDefinition> = {},
): LevelFeatureDefinition {
  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${level}`,
    name,
    level,
    source: XANATHAR,
    ...extra,
  }
}

function subclass(
  className: ClassName,
  id: string,
  name: string,
  features: LevelFeatureDefinition[],
): SubclassDefinition {
  return {
    id,
    name,
    className,
    source: XANATHAR,
    features,
  }
}

const ARCANE_SHOTS = [
  "Banishing Arrow",
  "Beguiling Arrow",
  "Bursting Arrow",
  "Enfeebling Arrow",
  "Grasping Arrow",
  "Piercing Arrow",
  "Seeking Arrow",
  "Shadow Arrow",
]

const KENSEI_WEAPONS = [
  "Battleaxe",
  "Longsword",
  "Warhammer",
  "Whip",
  "Longbow",
  "Shortbow",
  "Heavy Crossbow",
  "Hand Crossbow",
  "Light Crossbow",
]

export const XANATHAR_SUBCLASSES: Partial<
  Record<ClassName, SubclassDefinition[]>
> = {
  barbarian: [
    subclass(
      "barbarian",
      "ancestral-guardian",
      "Path of the Ancestral Guardian",
      [
        feature(3, "Ancestral Protectors"),
        feature(6, "Spirit Shield"),
        feature(10, "Consult the Spirits"),
        feature(14, "Vengeful Ancestors"),
      ],
    ),
    subclass("barbarian", "storm-herald", "Path of the Storm Herald", [
      feature(3, "Storm Aura", {
        choice: {
          id: "storm-herald-environment",
          label: "Storm environment",
          kind: "subclass-option",
          count: 1,
          options: ["Desert", "Sea", "Tundra"],
        },
      }),
      feature(6, "Storm Soul"),
      feature(10, "Shielding Storm"),
      feature(14, "Raging Storm"),
    ]),
    subclass("barbarian", "zealot", "Path of the Zealot", [
      feature(3, "Divine Fury"),
      feature(3, "Warrior of the Gods"),
      feature(6, "Fanatical Focus"),
      feature(10, "Zealous Presence"),
      feature(14, "Rage Beyond Death"),
    ]),
  ],

  bard: [
    subclass("bard", "glamour", "College of Glamour", [
      feature(3, "Mantle of Inspiration"),
      feature(3, "Enthralling Performance"),
      feature(6, "Mantle of Majesty"),
      feature(14, "Unbreakable Majesty"),
    ]),
    subclass("bard", "swords", "College of Swords", [
      feature(3, "Bonus Proficiencies"),
      feature(3, "Fighting Style", {
        choice: {
          id: "college-swords-fighting-style",
          label: "College of Swords fighting style",
          kind: "fighting-style",
          count: 1,
          options: ["Dueling", "Two-Weapon Fighting"],
        },
      }),
      feature(3, "Blade Flourish"),
      feature(6, "Extra Attack"),
      feature(14, "Master's Flourish"),
    ]),
    subclass("bard", "whispers", "College of Whispers", [
      feature(3, "Psychic Blades"),
      feature(3, "Words of Terror"),
      feature(6, "Mantle of Whispers"),
      feature(14, "Shadow Lore"),
    ]),
  ],

  cleric: [
    subclass("cleric", "forge", "Forge Domain", [
      feature(1, "Bonus Proficiencies"),
      feature(1, "Blessing of the Forge"),
      feature(2, "Artisan's Blessing"),
      feature(6, "Soul of the Forge"),
      feature(8, "Divine Strike"),
      feature(17, "Saint of Forge and Fire"),
    ]),
    subclass("cleric", "grave", "Grave Domain", [
      feature(1, "Circle of Mortality"),
      feature(1, "Eyes of the Grave"),
      feature(2, "Path to the Grave"),
      feature(6, "Sentinel at Death's Door"),
      feature(8, "Potent Spellcasting"),
      feature(17, "Keeper of Souls"),
    ]),
  ],

  druid: [
    subclass("druid", "dreams", "Circle of Dreams", [
      feature(2, "Balm of the Summer Court"),
      feature(6, "Hearth of Moonlight and Shadow"),
      feature(10, "Hidden Paths"),
      feature(14, "Walker in Dreams"),
    ]),
    subclass("druid", "shepherd", "Circle of the Shepherd", [
      feature(2, "Speech of the Woods"),
      feature(2, "Spirit Totem"),
      feature(6, "Mighty Summoner"),
      feature(10, "Guardian Spirit"),
      feature(14, "Faithful Summons"),
    ]),
  ],

  fighter: [
    subclass("fighter", "arcane-archer", "Arcane Archer", [
      feature(3, "Arcane Archer Lore"),
      feature(3, "Arcane Shot", {
        choice: {
          id: "arcane-shot-options-3",
          label: "Arcane Shot options",
          kind: "subclass-option",
          count: 2,
          options: ARCANE_SHOTS,
        },
      }),
      feature(7, "Magic Arrow"),
      feature(7, "Curving Shot"),
      feature(7, "Additional Arcane Shot Option", {
        choice: {
          id: "arcane-shot-options-7",
          label: "Additional Arcane Shot option",
          kind: "subclass-option",
          count: 1,
          options: ARCANE_SHOTS,
        },
      }),
      feature(10, "Additional Arcane Shot Option", {
        choice: {
          id: "arcane-shot-options-10",
          label: "Additional Arcane Shot option",
          kind: "subclass-option",
          count: 1,
          options: ARCANE_SHOTS,
        },
      }),
      feature(15, "Ever-Ready Shot"),
      feature(15, "Additional Arcane Shot Option", {
        choice: {
          id: "arcane-shot-options-15",
          label: "Additional Arcane Shot option",
          kind: "subclass-option",
          count: 1,
          options: ARCANE_SHOTS,
        },
      }),
      feature(18, "Additional Arcane Shot Option", {
        choice: {
          id: "arcane-shot-options-18",
          label: "Additional Arcane Shot option",
          kind: "subclass-option",
          count: 1,
          options: ARCANE_SHOTS,
        },
      }),
    ]),
    subclass("fighter", "cavalier", "Cavalier", [
      feature(3, "Bonus Proficiency"),
      feature(3, "Born to the Saddle"),
      feature(3, "Unwavering Mark"),
      feature(7, "Warding Maneuver"),
      feature(10, "Hold the Line"),
      feature(15, "Ferocious Charger"),
      feature(18, "Vigilant Defender"),
    ]),
    subclass("fighter", "samurai", "Samurai", [
      feature(3, "Bonus Proficiency"),
      feature(3, "Fighting Spirit"),
      feature(7, "Elegant Courtier"),
      feature(10, "Tireless Spirit"),
      feature(15, "Rapid Strike"),
      feature(18, "Strength Before Death"),
    ]),
  ],

  monk: [
    subclass("monk", "drunken-master", "Way of the Drunken Master", [
      feature(3, "Bonus Proficiencies"),
      feature(3, "Drunken Technique"),
      feature(6, "Tipsy Sway"),
      feature(11, "Drunkard's Luck"),
      feature(17, "Intoxicated Frenzy"),
    ]),
    subclass("monk", "kensei", "Way of the Kensei", [
      feature(3, "Path of the Kensei", {
        choice: {
          id: "kensei-weapons-3",
          label: "Initial kensei weapons",
          kind: "subclass-option",
          count: 2,
          options: KENSEI_WEAPONS,
        },
      }),
      feature(6, "One with the Blade", {
        choice: {
          id: "kensei-weapons-6",
          label: "Additional kensei weapon",
          kind: "subclass-option",
          count: 1,
          options: KENSEI_WEAPONS,
        },
      }),
      feature(11, "Sharpen the Blade", {
        choice: {
          id: "kensei-weapons-11",
          label: "Additional kensei weapon",
          kind: "subclass-option",
          count: 1,
          options: KENSEI_WEAPONS,
        },
      }),
      feature(17, "Unerring Accuracy", {
        choice: {
          id: "kensei-weapons-17",
          label: "Additional kensei weapon",
          kind: "subclass-option",
          count: 1,
          options: KENSEI_WEAPONS,
        },
      }),
    ]),
    subclass("monk", "sun-soul", "Way of the Sun Soul", [
      feature(3, "Radiant Sun Bolt"),
      feature(6, "Searing Arc Strike"),
      feature(11, "Searing Sunburst"),
      feature(17, "Sun Shield"),
    ]),
  ],

  paladin: [
    subclass("paladin", "conquest", "Oath of Conquest", [
      feature(3, "Oath Spells"),
      feature(3, "Conquering Presence"),
      feature(3, "Guided Strike"),
      feature(7, "Aura of Conquest"),
      feature(15, "Scornful Rebuke"),
      feature(20, "Invincible Conqueror"),
    ]),
    subclass("paladin", "redemption", "Oath of Redemption", [
      feature(3, "Oath Spells"),
      feature(3, "Emissary of Peace"),
      feature(3, "Rebuke the Violent"),
      feature(7, "Aura of the Guardian"),
      feature(15, "Protective Spirit"),
      feature(20, "Emissary of Redemption"),
    ]),
  ],

  ranger: [
    subclass("ranger", "gloom-stalker", "Gloom Stalker", [
      feature(3, "Gloom Stalker Magic"),
      feature(3, "Dread Ambusher"),
      feature(3, "Umbral Sight"),
      feature(7, "Iron Mind"),
      feature(11, "Stalker's Flurry"),
      feature(15, "Shadowy Dodge"),
    ]),
    subclass("ranger", "horizon-walker", "Horizon Walker", [
      feature(3, "Horizon Walker Magic"),
      feature(3, "Detect Portal"),
      feature(3, "Planar Warrior"),
      feature(7, "Ethereal Step"),
      feature(11, "Distant Strike"),
      feature(15, "Spectral Defense"),
    ]),
    subclass("ranger", "monster-slayer", "Monster Slayer", [
      feature(3, "Monster Slayer Magic"),
      feature(3, "Hunter's Sense"),
      feature(3, "Slayer's Prey"),
      feature(7, "Supernatural Defense"),
      feature(11, "Magic-User's Nemesis"),
      feature(15, "Slayer's Counter"),
    ]),
  ],

  rogue: [
    subclass("rogue", "inquisitive", "Inquisitive", [
      feature(3, "Ear for Deceit"),
      feature(3, "Eye for Detail"),
      feature(3, "Insightful Fighting"),
      feature(9, "Steady Eye"),
      feature(13, "Unerring Eye"),
      feature(17, "Eye for Weakness"),
    ]),
    subclass("rogue", "mastermind", "Mastermind", [
      feature(3, "Master of Intrigue"),
      feature(3, "Master of Tactics"),
      feature(9, "Insightful Manipulator"),
      feature(13, "Misdirection"),
      feature(17, "Soul of Deceit"),
    ]),
    subclass("rogue", "scout", "Scout", [
      feature(3, "Skirmisher"),
      feature(3, "Survivalist"),
      feature(9, "Superior Mobility"),
      feature(13, "Ambush Master"),
      feature(17, "Sudden Strike"),
    ]),
    subclass("rogue", "swashbuckler", "Swashbuckler", [
      feature(3, "Fancy Footwork"),
      feature(3, "Rakish Audacity"),
      feature(9, "Panache"),
      feature(13, "Elegant Maneuver"),
      feature(17, "Master Duelist"),
    ]),
  ],

  sorcerer: [
    subclass("sorcerer", "divine-soul", "Divine Soul", [
      feature(1, "Divine Magic", {
        choice: {
          id: "divine-soul-affinity",
          label: "Divine affinity",
          kind: "subclass-option",
          count: 1,
          options: ["Good", "Evil", "Law", "Chaos", "Neutrality"],
        },
      }),
      feature(1, "Favored by the Gods"),
      feature(6, "Empowered Healing"),
      feature(14, "Otherworldly Wings"),
      feature(18, "Unearthly Recovery"),
    ]),
    subclass("sorcerer", "shadow-magic", "Shadow Magic", [
      feature(1, "Eyes of the Dark"),
      feature(1, "Strength of the Grave"),
      feature(6, "Hound of Ill Omen"),
      feature(14, "Shadow Walk"),
      feature(18, "Umbral Form"),
    ]),
    subclass("sorcerer", "storm-sorcery", "Storm Sorcery", [
      feature(1, "Wind Speaker"),
      feature(1, "Tempestuous Magic"),
      feature(6, "Heart of the Storm"),
      feature(6, "Storm Guide"),
      feature(14, "Storm's Fury"),
      feature(18, "Wind Soul"),
    ]),
  ],

  warlock: [
    subclass("warlock", "celestial", "The Celestial", [
      feature(1, "Expanded Spell List"),
      feature(1, "Bonus Cantrips"),
      feature(1, "Healing Light"),
      feature(6, "Radiant Soul"),
      feature(10, "Celestial Resilience"),
      feature(14, "Searing Vengeance"),
    ]),
    subclass("warlock", "hexblade", "The Hexblade", [
      feature(1, "Expanded Spell List"),
      feature(1, "Hexblade's Curse"),
      feature(1, "Hex Warrior"),
      feature(6, "Accursed Specter"),
      feature(10, "Armor of Hexes"),
      feature(14, "Master of Hexes"),
    ]),
  ],

  wizard: [
    subclass("wizard", "war-magic", "War Magic", [
      feature(2, "Arcane Deflection"),
      feature(2, "Tactical Wit"),
      feature(6, "Power Surge"),
      feature(10, "Durable Magic"),
      feature(14, "Deflecting Shroud"),
    ]),
  ],
}
