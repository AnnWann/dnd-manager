import type { DieSides } from "../dice/Die"
import type { ClassName, ClassSourceBook } from "../sheet/Class"

export type LevelChoiceKind =
  | "fighting-style"
  | "expertise"
  | "metamagic"
  | "pact-boon"
  | "invocation"
  | "maneuver"
  | "infusion"
  | "elemental-discipline"
  | "rune"
  | "subclass-option"
  | "asi"
  | "optional-feature"
  | "custom"

export type LevelChoiceDefinition = {
  id: string
  label: string
  kind: LevelChoiceKind
  count: number
  options?: string[]
  allowCustom?: boolean
  description?: string
}

export type LevelFeatureDefinition = {
  id: string
  name: string
  level: number
  source: ClassSourceBook
  optional?: boolean
  description?: string
  choice?: LevelChoiceDefinition
}

export type SubclassDefinition = {
  id: string
  name: string
  className: ClassName
  source: ClassSourceBook
  features: LevelFeatureDefinition[]
}

export type ClassProgressionDefinition = {
  className: ClassName
  label: string
  hitDie: DieSides
  source: ClassSourceBook
  subclassLevel: number
  features: LevelFeatureDefinition[]
  subclasses: SubclassDefinition[]
  cantripsKnown?: Partial<Record<number, number>>
}

const f = (
  level: number,
  name: string,
  source: ClassSourceBook = "PHB",
  extra: Partial<LevelFeatureDefinition> = {},
): LevelFeatureDefinition => ({
  id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${level}`,
  name,
  level,
  source,
  ...extra,
})

const subclass = (
  className: ClassName,
  id: string,
  name: string,
  source: ClassSourceBook,
  features: LevelFeatureDefinition[],
): SubclassDefinition => ({ id, name, className, source, features })

const ASI_LEVELS: Partial<Record<ClassName, number[]>> = {
  artificer: [4, 8, 12, 16, 19],
  barbarian: [4, 8, 12, 16, 19],
  bard: [4, 8, 12, 16, 19],
  cleric: [4, 8, 12, 16, 19],
  druid: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  monk: [4, 8, 12, 16, 19],
  paladin: [4, 8, 12, 16, 19],
  ranger: [4, 8, 12, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  sorcerer: [4, 8, 12, 16, 19],
  warlock: [4, 8, 12, 16, 19],
  wizard: [4, 8, 12, 16, 19],
}

function withAsi(
  className: ClassName,
  features: LevelFeatureDefinition[],
): LevelFeatureDefinition[] {
  return [
    ...features,
    ...(ASI_LEVELS[className] ?? []).map((level) =>
      f(level, "Ability Score Improvement", "PHB", {
        choice: {
          id: `asi-${className}-${level}`,
          label: "Ability Score Improvement or feat",
          kind: "asi",
          count: 1,
          allowCustom: true,
        },
      }),
    ),
  ].toSorted((left, right) => left.level - right.level)
}

export const FIGHTING_STYLES: Record<
  "fighter" | "paladin" | "ranger",
  string[]
> = {
  fighter: [
    "Archery",
    "Defense",
    "Dueling",
    "Great Weapon Fighting",
    "Protection",
    "Two-Weapon Fighting",
    "Blind Fighting",
    "Interception",
    "Superior Technique",
    "Thrown Weapon Fighting",
    "Unarmed Fighting",
  ],
  paladin: [
    "Defense",
    "Dueling",
    "Great Weapon Fighting",
    "Protection",
    "Blessed Warrior",
    "Blind Fighting",
    "Interception",
  ],
  ranger: [
    "Archery",
    "Defense",
    "Dueling",
    "Two-Weapon Fighting",
    "Blind Fighting",
    "Druidic Warrior",
    "Interception",
    "Thrown Weapon Fighting",
  ],
}

export const WARLOCK_INVOCATIONS = [
  "Agonizing Blast",
  "Armor of Shadows",
  "Ascendant Step",
  "Beast Speech",
  "Beguiling Influence",
  "Bewitching Whispers",
  "Book of Ancient Secrets",
  "Chains of Carceri",
  "Devil's Sight",
  "Dreadful Word",
  "Eldritch Mind",
  "Eldritch Sight",
  "Eldritch Spear",
  "Eyes of the Rune Keeper",
  "Fiendish Vigor",
  "Gaze of Two Minds",
  "Lifedrinker",
  "Mask of Many Faces",
  "Master of Myriad Forms",
  "Minions of Chaos",
  "Mire the Mind",
  "Misty Visions",
  "One with Shadows",
  "Otherworldly Leap",
  "Repelling Blast",
  "Sculptor of Flesh",
  "Sign of Ill Omen",
  "Thief of Five Fates",
  "Thirsting Blade",
  "Visions of Distant Realms",
  "Voice of the Chain Master",
  "Whispers of the Grave",
  "Witch Sight",
  "Bond of the Talisman",
  "Far Scribe",
  "Gift of the Protectors",
  "Investment of the Chain Master",
  "Protection of the Talisman",
  "Rebuke of the Talisman",
  "Undying Servitude",
]

export const BATTLE_MASTER_MANEUVERS = [
  "Commander's Strike",
  "Disarming Attack",
  "Distracting Strike",
  "Evasive Footwork",
  "Feinting Attack",
  "Goading Attack",
  "Lunging Attack",
  "Maneuvering Attack",
  "Menacing Attack",
  "Parry",
  "Precision Attack",
  "Pushing Attack",
  "Rally",
  "Riposte",
  "Sweeping Attack",
  "Trip Attack",
  "Ambush",
  "Bait and Switch",
  "Brace",
  "Commanding Presence",
  "Grappling Strike",
  "Quick Toss",
  "Tactical Assessment",
]

export const ARTIFICER_INFUSIONS = [
  "Arcane Propulsion Armor",
  "Armor of Magical Strength",
  "Boots of the Winding Path",
  "Enhanced Arcane Focus",
  "Enhanced Defense",
  "Enhanced Weapon",
  "Helm of Awareness",
  "Homunculus Servant",
  "Mind Sharpener",
  "Radiant Weapon",
  "Repeating Shot",
  "Replicate Magic Item",
  "Repulsion Shield",
  "Resistant Armor",
  "Returning Weapon",
  "Spell-Refueling Ring",
]

export const ELEMENTAL_DISCIPLINES = [
  "Elemental Attunement",
  "Fangs of the Fire Snake",
  "Fist of Four Thunders",
  "Fist of Unbroken Air",
  "Rush of the Gale Spirits",
  "Shape the Flowing River",
  "Sweeping Cinder Strike",
  "Water Whip",
  "Clench of the North Wind",
  "Gong of the Summit",
  "Flames of the Phoenix",
  "Mist Stance",
  "Ride the Wind",
  "Breath of Winter",
  "Eternal Mountain Defense",
  "River of Hungry Flame",
  "Wave of Rolling Earth",
]

export const RUNE_KNIGHT_RUNES = [
  "Cloud Rune",
  "Fire Rune",
  "Frost Rune",
  "Stone Rune",
  "Hill Rune",
  "Storm Rune",
]

const barbarianSubclasses: SubclassDefinition[] = [
  subclass("barbarian", "berserker", "Path of the Berserker", "PHB", [
    f(3, "Frenzy"),
    f(6, "Mindless Rage"),
    f(10, "Intimidating Presence"),
    f(14, "Retaliation"),
  ]),
  subclass("barbarian", "totem-warrior", "Path of the Totem Warrior", "PHB", [
    f(3, "Spirit Seeker"),
    f(3, "Totem Spirit", "PHB", {
      choice: {
        id: "totem-spirit-3",
        label: "Totem spirit",
        kind: "subclass-option",
        count: 1,
        options: ["Bear", "Eagle", "Wolf"],
      },
    }),
    f(6, "Aspect of the Beast", "PHB", {
      choice: {
        id: "totem-aspect-6",
        label: "Bestial aspect",
        kind: "subclass-option",
        count: 1,
        options: ["Bear", "Eagle", "Wolf"],
      },
    }),
    f(10, "Spirit Walker"),
    f(14, "Totemic Attunement", "PHB", {
      choice: {
        id: "totem-attunement-14",
        label: "Totemic attunement",
        kind: "subclass-option",
        count: 1,
        options: ["Bear", "Eagle", "Wolf"],
      },
    }),
  ]),
  subclass("barbarian", "beast", "Path of the Beast", "Tasha", [
    f(3, "Form of the Beast", "Tasha"),
    f(6, "Bestial Soul", "Tasha"),
    f(10, "Infectious Fury", "Tasha"),
    f(14, "Call the Hunt", "Tasha"),
  ]),
  subclass("barbarian", "wild-magic", "Path of Wild Magic", "Tasha", [
    f(3, "Magic Awareness", "Tasha"),
    f(3, "Wild Surge", "Tasha"),
    f(6, "Bolstering Magic", "Tasha"),
    f(10, "Unstable Backlash", "Tasha"),
    f(14, "Controlled Surge", "Tasha"),
  ]),
]

const bardSubclasses: SubclassDefinition[] = [
  subclass("bard", "lore", "College of Lore", "PHB", [
    f(3, "Bonus Proficiencies"),
    f(3, "Cutting Words"),
    f(6, "Additional Magical Secrets"),
    f(14, "Peerless Skill"),
  ]),
  subclass("bard", "valor", "College of Valor", "PHB", [
    f(3, "Bonus Proficiencies"),
    f(3, "Combat Inspiration"),
    f(6, "Extra Attack"),
    f(14, "Battle Magic"),
  ]),
  subclass("bard", "creation", "College of Creation", "Tasha", [
    f(3, "Mote of Potential", "Tasha"),
    f(3, "Performance of Creation", "Tasha"),
    f(6, "Animating Performance", "Tasha"),
    f(14, "Creative Crescendo", "Tasha"),
  ]),
  subclass("bard", "eloquence", "College of Eloquence", "Tasha", [
    f(3, "Silver Tongue", "Tasha"),
    f(3, "Unsettling Words", "Tasha"),
    f(6, "Unfailing Inspiration", "Tasha"),
    f(6, "Universal Speech", "Tasha"),
    f(14, "Infectious Inspiration", "Tasha"),
  ]),
]

const clericSubclasses: SubclassDefinition[] = [
  subclass("cleric", "knowledge", "Knowledge Domain", "PHB", [
    f(1, "Blessings of Knowledge"), f(2, "Knowledge of the Ages"), f(6, "Read Thoughts"), f(8, "Potent Spellcasting"), f(17, "Visions of the Past"),
  ]),
  subclass("cleric", "life", "Life Domain", "PHB", [
    f(1, "Disciple of Life"), f(2, "Preserve Life"), f(6, "Blessed Healer"), f(8, "Divine Strike"), f(17, "Supreme Healing"),
  ]),
  subclass("cleric", "light", "Light Domain", "PHB", [
    f(1, "Bonus Cantrip"), f(1, "Warding Flare"), f(2, "Radiance of the Dawn"), f(6, "Improved Flare"), f(8, "Potent Spellcasting"), f(17, "Corona of Light"),
  ]),
  subclass("cleric", "nature", "Nature Domain", "PHB", [
    f(1, "Acolyte of Nature"), f(2, "Charm Animals and Plants"), f(6, "Dampen Elements"), f(8, "Divine Strike"), f(17, "Master of Nature"),
  ]),
  subclass("cleric", "tempest", "Tempest Domain", "PHB", [
    f(1, "Bonus Proficiencies"), f(1, "Wrath of the Storm"), f(2, "Destructive Wrath"), f(6, "Thunderbolt Strike"), f(8, "Divine Strike"), f(17, "Stormborn"),
  ]),
  subclass("cleric", "trickery", "Trickery Domain", "PHB", [
    f(1, "Blessing of the Trickster"), f(2, "Invoke Duplicity"), f(6, "Cloak of Shadows"), f(8, "Divine Strike"), f(17, "Improved Duplicity"),
  ]),
  subclass("cleric", "war", "War Domain", "PHB", [
    f(1, "Bonus Proficiencies"), f(1, "War Priest"), f(2, "Guided Strike"), f(6, "War God's Blessing"), f(8, "Divine Strike"), f(17, "Avatar of Battle"),
  ]),
  subclass("cleric", "order", "Order Domain", "Tasha", [
    f(1, "Bonus Proficiencies", "Tasha"), f(1, "Voice of Authority", "Tasha"), f(2, "Order's Demand", "Tasha"), f(6, "Embodiment of the Law", "Tasha"), f(8, "Divine Strike", "Tasha"), f(17, "Order's Wrath", "Tasha"),
  ]),
  subclass("cleric", "peace", "Peace Domain", "Tasha", [
    f(1, "Implement of Peace", "Tasha"), f(1, "Emboldening Bond", "Tasha"), f(2, "Balm of Peace", "Tasha"), f(6, "Protective Bond", "Tasha"), f(8, "Potent Spellcasting", "Tasha"), f(17, "Expansive Bond", "Tasha"),
  ]),
  subclass("cleric", "twilight", "Twilight Domain", "Tasha", [
    f(1, "Bonus Proficiencies", "Tasha"), f(1, "Eyes of Night", "Tasha"), f(1, "Vigilant Blessing", "Tasha"), f(2, "Twilight Sanctuary", "Tasha"), f(6, "Steps of Night", "Tasha"), f(8, "Divine Strike", "Tasha"), f(17, "Twilight Shroud", "Tasha"),
  ]),
]

const druidSubclasses: SubclassDefinition[] = [
  subclass("druid", "land", "Circle of the Land", "PHB", [
    f(2, "Bonus Cantrip"),
    f(2, "Natural Recovery"),
    f(2, "Circle Spells", "PHB", {
      choice: {
        id: "circle-land-type",
        label: "Land type",
        kind: "subclass-option",
        count: 1,
        options: ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"],
      },
    }),
    f(6, "Land's Stride"), f(10, "Nature's Ward"), f(14, "Nature's Sanctuary"),
  ]),
  subclass("druid", "moon", "Circle of the Moon", "PHB", [
    f(2, "Combat Wild Shape"), f(2, "Circle Forms"), f(6, "Primal Strike"), f(10, "Elemental Wild Shape"), f(14, "Thousand Forms"),
  ]),
  subclass("druid", "spores", "Circle of Spores", "Tasha", [
    f(2, "Circle Spells", "Tasha"), f(2, "Halo of Spores", "Tasha"), f(2, "Symbiotic Entity", "Tasha"), f(6, "Fungal Infestation", "Tasha"), f(10, "Spreading Spores", "Tasha"), f(14, "Fungal Body", "Tasha"),
  ]),
  subclass("druid", "stars", "Circle of Stars", "Tasha", [
    f(2, "Star Map", "Tasha"), f(2, "Starry Form", "Tasha"), f(6, "Cosmic Omen", "Tasha"), f(10, "Twinkling Constellations", "Tasha"), f(14, "Full of Stars", "Tasha"),
  ]),
  subclass("druid", "wildfire", "Circle of Wildfire", "Tasha", [
    f(2, "Circle Spells", "Tasha"), f(2, "Summon Wildfire Spirit", "Tasha"), f(6, "Enhanced Bond", "Tasha"), f(10, "Cauterizing Flames", "Tasha"), f(14, "Blazing Revival", "Tasha"),
  ]),
]

const fighterSubclasses: SubclassDefinition[] = [
  subclass("fighter", "champion", "Champion", "PHB", [
    f(3, "Improved Critical"), f(7, "Remarkable Athlete"), f(10, "Additional Fighting Style"), f(15, "Superior Critical"), f(18, "Survivor"),
  ]),
  subclass("fighter", "battle-master", "Battle Master", "PHB", [
    f(3, "Combat Superiority", "PHB", {
      choice: { id: "battle-master-maneuvers-3", label: "Maneuvers", kind: "maneuver", count: 3, options: BATTLE_MASTER_MANEUVERS },
    }),
    f(3, "Student of War"),
    f(7, "Know Your Enemy", "PHB", {
      choice: { id: "battle-master-maneuvers-7", label: "Additional maneuvers", kind: "maneuver", count: 2, options: BATTLE_MASTER_MANEUVERS },
    }),
    f(10, "Improved Combat Superiority", "PHB", {
      choice: { id: "battle-master-maneuvers-10", label: "Additional maneuvers", kind: "maneuver", count: 2, options: BATTLE_MASTER_MANEUVERS },
    }),
    f(15, "Relentless", "PHB", {
      choice: { id: "battle-master-maneuvers-15", label: "Additional maneuvers", kind: "maneuver", count: 2, options: BATTLE_MASTER_MANEUVERS },
    }),
    f(18, "Improved Combat Superiority"),
  ]),
  subclass("fighter", "eldritch-knight", "Eldritch Knight", "PHB", [
    f(3, "Spellcasting"), f(3, "Weapon Bond"), f(7, "War Magic"), f(10, "Eldritch Strike"), f(15, "Arcane Charge"), f(18, "Improved War Magic"),
  ]),
  subclass("fighter", "psi-warrior", "Psi Warrior", "Tasha", [
    f(3, "Psionic Power", "Tasha"), f(7, "Telekinetic Adept", "Tasha"), f(10, "Guarded Mind", "Tasha"), f(15, "Bulwark of Force", "Tasha"), f(18, "Telekinetic Master", "Tasha"),
  ]),
  subclass("fighter", "rune-knight", "Rune Knight", "Tasha", [
    f(3, "Bonus Proficiencies", "Tasha"),
    f(3, "Rune Carver", "Tasha", {
      choice: { id: "rune-knight-runes-3", label: "Runes", kind: "rune", count: 2, options: RUNE_KNIGHT_RUNES },
    }),
    f(3, "Giant's Might", "Tasha"),
    f(7, "Runic Shield", "Tasha", {
      choice: { id: "rune-knight-runes-7", label: "Additional rune", kind: "rune", count: 1, options: RUNE_KNIGHT_RUNES },
    }),
    f(10, "Great Stature", "Tasha", {
      choice: { id: "rune-knight-runes-10", label: "Additional rune", kind: "rune", count: 1, options: RUNE_KNIGHT_RUNES },
    }),
    f(15, "Master of Runes", "Tasha", {
      choice: { id: "rune-knight-runes-15", label: "Additional rune", kind: "rune", count: 1, options: RUNE_KNIGHT_RUNES },
    }),
    f(18, "Runic Juggernaut", "Tasha"),
  ]),
]

const monkSubclasses: SubclassDefinition[] = [
  subclass("monk", "open-hand", "Way of the Open Hand", "PHB", [f(3, "Open Hand Technique"), f(6, "Wholeness of Body"), f(11, "Tranquility"), f(17, "Quivering Palm")]),
  subclass("monk", "shadow", "Way of Shadow", "PHB", [f(3, "Shadow Arts"), f(6, "Shadow Step"), f(11, "Cloak of Shadows"), f(17, "Opportunist")]),
  subclass("monk", "four-elements", "Way of the Four Elements", "PHB", [
    f(3, "Disciple of the Elements", "PHB", { choice: { id: "elements-disciplines-3", label: "Elemental disciplines", kind: "elemental-discipline", count: 2, options: ELEMENTAL_DISCIPLINES } }),
    f(6, "Additional Elemental Discipline", "PHB", { choice: { id: "elements-disciplines-6", label: "Elemental discipline", kind: "elemental-discipline", count: 1, options: ELEMENTAL_DISCIPLINES } }),
    f(11, "Additional Elemental Discipline", "PHB", { choice: { id: "elements-disciplines-11", label: "Elemental discipline", kind: "elemental-discipline", count: 1, options: ELEMENTAL_DISCIPLINES } }),
    f(17, "Additional Elemental Discipline", "PHB", { choice: { id: "elements-disciplines-17", label: "Elemental discipline", kind: "elemental-discipline", count: 1, options: ELEMENTAL_DISCIPLINES } }),
  ]),
  subclass("monk", "astral-self", "Way of the Astral Self", "Tasha", [f(3, "Arms of the Astral Self", "Tasha"), f(6, "Visage of the Astral Self", "Tasha"), f(11, "Body of the Astral Self", "Tasha"), f(17, "Awakened Astral Self", "Tasha")]),
  subclass("monk", "mercy", "Way of Mercy", "Tasha", [f(3, "Implements of Mercy", "Tasha"), f(3, "Hand of Healing", "Tasha"), f(3, "Hand of Harm", "Tasha"), f(6, "Physician's Touch", "Tasha"), f(11, "Flurry of Healing and Harm", "Tasha"), f(17, "Hand of Ultimate Mercy", "Tasha")]),
]

const paladinSubclasses: SubclassDefinition[] = [
  subclass("paladin", "devotion", "Oath of Devotion", "PHB", [f(3, "Oath Spells"), f(3, "Sacred Weapon"), f(3, "Turn the Unholy"), f(7, "Aura of Devotion"), f(15, "Purity of Spirit"), f(20, "Holy Nimbus")]),
  subclass("paladin", "ancients", "Oath of the Ancients", "PHB", [f(3, "Oath Spells"), f(3, "Nature's Wrath"), f(3, "Turn the Faithless"), f(7, "Aura of Warding"), f(15, "Undying Sentinel"), f(20, "Elder Champion")]),
  subclass("paladin", "vengeance", "Oath of Vengeance", "PHB", [f(3, "Oath Spells"), f(3, "Abjure Enemy"), f(3, "Vow of Enmity"), f(7, "Relentless Avenger"), f(15, "Soul of Vengeance"), f(20, "Avenging Angel")]),
  subclass("paladin", "glory", "Oath of Glory", "Tasha", [f(3, "Oath Spells", "Tasha"), f(3, "Peerless Athlete", "Tasha"), f(3, "Inspiring Smite", "Tasha"), f(7, "Aura of Alacrity", "Tasha"), f(15, "Glorious Defense", "Tasha"), f(20, "Living Legend", "Tasha")]),
  subclass("paladin", "watchers", "Oath of the Watchers", "Tasha", [f(3, "Oath Spells", "Tasha"), f(3, "Watcher's Will", "Tasha"), f(3, "Abjure the Extraplanar", "Tasha"), f(7, "Aura of the Sentinel", "Tasha"), f(15, "Vigilant Rebuke", "Tasha"), f(20, "Mortal Bulwark", "Tasha")]),
]

const rangerSubclasses: SubclassDefinition[] = [
  subclass("ranger", "hunter", "Hunter", "PHB", [
    f(3, "Hunter's Prey", "PHB", { choice: { id: "hunter-prey-3", label: "Hunter's Prey", kind: "subclass-option", count: 1, options: ["Colossus Slayer", "Giant Killer", "Horde Breaker"] } }),
    f(7, "Defensive Tactics", "PHB", { choice: { id: "hunter-defense-7", label: "Defensive Tactics", kind: "subclass-option", count: 1, options: ["Escape the Horde", "Multiattack Defense", "Steel Will"] } }),
    f(11, "Multiattack", "PHB", { choice: { id: "hunter-multiattack-11", label: "Multiattack", kind: "subclass-option", count: 1, options: ["Volley", "Whirlwind Attack"] } }),
    f(15, "Superior Hunter's Defense", "PHB", { choice: { id: "hunter-defense-15", label: "Superior Hunter's Defense", kind: "subclass-option", count: 1, options: ["Evasion", "Stand Against the Tide", "Uncanny Dodge"] } }),
  ]),
  subclass("ranger", "beast-master", "Beast Master", "PHB", [f(3, "Ranger's Companion"), f(3, "Primal Companion", "Tasha", { optional: true }), f(7, "Exceptional Training"), f(11, "Bestial Fury"), f(15, "Share Spells")]),
  subclass("ranger", "fey-wanderer", "Fey Wanderer", "Tasha", [f(3, "Dreadful Strikes", "Tasha"), f(3, "Fey Wanderer Magic", "Tasha"), f(3, "Otherworldly Glamour", "Tasha"), f(7, "Beguiling Twist", "Tasha"), f(11, "Fey Reinforcements", "Tasha"), f(15, "Misty Wanderer", "Tasha")]),
  subclass("ranger", "swarmkeeper", "Swarmkeeper", "Tasha", [f(3, "Gathered Swarm", "Tasha"), f(3, "Swarmkeeper Magic", "Tasha"), f(7, "Writhing Tide", "Tasha"), f(11, "Mighty Swarm", "Tasha"), f(15, "Swarming Dispersal", "Tasha")]),
]

const rogueSubclasses: SubclassDefinition[] = [
  subclass("rogue", "thief", "Thief", "PHB", [f(3, "Fast Hands"), f(3, "Second-Story Work"), f(9, "Supreme Sneak"), f(13, "Use Magic Device"), f(17, "Thief's Reflexes")]),
  subclass("rogue", "assassin", "Assassin", "PHB", [f(3, "Bonus Proficiencies"), f(3, "Assassinate"), f(9, "Infiltration Expertise"), f(13, "Impostor"), f(17, "Death Strike")]),
  subclass("rogue", "arcane-trickster", "Arcane Trickster", "PHB", [f(3, "Spellcasting"), f(3, "Mage Hand Legerdemain"), f(9, "Magical Ambush"), f(13, "Versatile Trickster"), f(17, "Spell Thief")]),
  subclass("rogue", "phantom", "Phantom", "Tasha", [f(3, "Whispers of the Dead", "Tasha"), f(3, "Wails from the Grave", "Tasha"), f(9, "Tokens of the Departed", "Tasha"), f(13, "Ghost Walk", "Tasha"), f(17, "Death's Friend", "Tasha")]),
  subclass("rogue", "soulknife", "Soulknife", "Tasha", [f(3, "Psionic Power", "Tasha"), f(3, "Psychic Blades", "Tasha"), f(9, "Soul Blades", "Tasha"), f(13, "Psychic Veil", "Tasha"), f(17, "Rend Mind", "Tasha")]),
]

const sorcererSubclasses: SubclassDefinition[] = [
  subclass("sorcerer", "draconic", "Draconic Bloodline", "PHB", [
    f(1, "Dragon Ancestor", "PHB", { choice: { id: "draconic-ancestry", label: "Dragon ancestry", kind: "subclass-option", count: 1, options: ["Black — acid", "Blue — lightning", "Brass — fire", "Bronze — lightning", "Copper — acid", "Gold — fire", "Green — poison", "Red — fire", "Silver — cold", "White — cold"] } }),
    f(1, "Draconic Resilience"), f(6, "Elemental Affinity"), f(14, "Dragon Wings"), f(18, "Draconic Presence"),
  ]),
  subclass("sorcerer", "wild-magic", "Wild Magic", "PHB", [f(1, "Wild Magic Surge"), f(1, "Tides of Chaos"), f(6, "Bend Luck"), f(14, "Controlled Chaos"), f(18, "Spell Bombardment")]),
  subclass("sorcerer", "aberrant-mind", "Aberrant Mind", "Tasha", [f(1, "Psionic Spells", "Tasha"), f(1, "Telepathic Speech", "Tasha"), f(6, "Psionic Sorcery", "Tasha"), f(6, "Psychic Defenses", "Tasha"), f(14, "Revelation in Flesh", "Tasha"), f(18, "Warping Implosion", "Tasha")]),
  subclass("sorcerer", "clockwork-soul", "Clockwork Soul", "Tasha", [f(1, "Clockwork Magic", "Tasha"), f(1, "Restore Balance", "Tasha"), f(6, "Bastion of Law", "Tasha"), f(14, "Trance of Order", "Tasha"), f(18, "Clockwork Cavalcade", "Tasha")]),
]

const warlockSubclasses: SubclassDefinition[] = [
  subclass("warlock", "archfey", "The Archfey", "PHB", [f(1, "Fey Presence"), f(6, "Misty Escape"), f(10, "Beguiling Defenses"), f(14, "Dark Delirium")]),
  subclass("warlock", "fiend", "The Fiend", "PHB", [f(1, "Dark One's Blessing"), f(6, "Dark One's Own Luck"), f(10, "Fiendish Resilience"), f(14, "Hurl Through Hell")]),
  subclass("warlock", "great-old-one", "The Great Old One", "PHB", [f(1, "Awakened Mind"), f(6, "Entropic Ward"), f(10, "Thought Shield"), f(14, "Create Thrall")]),
  subclass("warlock", "fathomless", "The Fathomless", "Tasha", [f(1, "Expanded Spell List", "Tasha"), f(1, "Tentacle of the Deeps", "Tasha"), f(1, "Gift of the Sea", "Tasha"), f(6, "Oceanic Soul", "Tasha"), f(6, "Guardian Coil", "Tasha"), f(10, "Grasping Tentacles", "Tasha"), f(14, "Fathomless Plunge", "Tasha")]),
  subclass("warlock", "genie", "The Genie", "Tasha", [
    f(1, "Expanded Spell List", "Tasha"),
    f(1, "Genie's Vessel", "Tasha", { choice: { id: "genie-kind", label: "Genie kind", kind: "subclass-option", count: 1, options: ["Dao", "Djinni", "Efreeti", "Marid"] } }),
    f(6, "Elemental Gift", "Tasha"), f(10, "Sanctuary Vessel", "Tasha"), f(14, "Limited Wish", "Tasha"),
  ]),
]

const wizardSubclasses: SubclassDefinition[] = [
  subclass("wizard", "abjuration", "School of Abjuration", "PHB", [f(2, "Abjuration Savant"), f(2, "Arcane Ward"), f(6, "Projected Ward"), f(10, "Improved Abjuration"), f(14, "Spell Resistance")]),
  subclass("wizard", "conjuration", "School of Conjuration", "PHB", [f(2, "Conjuration Savant"), f(2, "Minor Conjuration"), f(6, "Benign Transposition"), f(10, "Focused Conjuration"), f(14, "Durable Summons")]),
  subclass("wizard", "divination", "School of Divination", "PHB", [f(2, "Divination Savant"), f(2, "Portent"), f(6, "Expert Divination"), f(10, "The Third Eye"), f(14, "Greater Portent")]),
  subclass("wizard", "enchantment", "School of Enchantment", "PHB", [f(2, "Enchantment Savant"), f(2, "Hypnotic Gaze"), f(6, "Instinctive Charm"), f(10, "Split Enchantment"), f(14, "Alter Memories")]),
  subclass("wizard", "evocation", "School of Evocation", "PHB", [f(2, "Evocation Savant"), f(2, "Sculpt Spells"), f(6, "Potent Cantrip"), f(10, "Empowered Evocation"), f(14, "Overchannel")]),
  subclass("wizard", "illusion", "School of Illusion", "PHB", [f(2, "Illusion Savant"), f(2, "Improved Minor Illusion"), f(6, "Malleable Illusions"), f(10, "Illusory Self"), f(14, "Illusory Reality")]),
  subclass("wizard", "necromancy", "School of Necromancy", "PHB", [f(2, "Necromancy Savant"), f(2, "Grim Harvest"), f(6, "Undead Thralls"), f(10, "Inured to Undeath"), f(14, "Command Undead")]),
  subclass("wizard", "transmutation", "School of Transmutation", "PHB", [f(2, "Transmutation Savant"), f(2, "Minor Alchemy"), f(6, "Transmuter's Stone"), f(10, "Shapechanger"), f(14, "Master Transmuter")]),
  subclass("wizard", "bladesinging", "Bladesinging", "Tasha", [f(2, "Training in War and Song", "Tasha"), f(2, "Bladesong", "Tasha"), f(6, "Extra Attack", "Tasha"), f(10, "Song of Defense", "Tasha"), f(14, "Song of Victory", "Tasha")]),
  subclass("wizard", "order-of-scribes", "Order of Scribes", "Tasha", [f(2, "Wizardly Quill", "Tasha"), f(2, "Awakened Spellbook", "Tasha"), f(6, "Manifest Mind", "Tasha"), f(10, "Master Scrivener", "Tasha"), f(14, "One with the Word", "Tasha")]),
]

const artificerSubclasses: SubclassDefinition[] = [
  subclass("artificer", "alchemist", "Alchemist", "Tasha", [f(3, "Tool Proficiency", "Tasha"), f(3, "Alchemist Spells", "Tasha"), f(3, "Experimental Elixir", "Tasha"), f(5, "Alchemical Savant", "Tasha"), f(9, "Restorative Reagents", "Tasha"), f(15, "Chemical Mastery", "Tasha")]),
  subclass("artificer", "armorer", "Armorer", "Tasha", [f(3, "Tools of the Trade", "Tasha"), f(3, "Armorer Spells", "Tasha"), f(3, "Arcane Armor", "Tasha"), f(3, "Armor Model", "Tasha"), f(5, "Extra Attack", "Tasha"), f(9, "Armor Modifications", "Tasha"), f(15, "Perfected Armor", "Tasha")]),
  subclass("artificer", "artillerist", "Artillerist", "Tasha", [f(3, "Tool Proficiency", "Tasha"), f(3, "Artillerist Spells", "Tasha"), f(3, "Eldritch Cannon", "Tasha"), f(5, "Arcane Firearm", "Tasha"), f(9, "Explosive Cannon", "Tasha"), f(15, "Fortified Position", "Tasha")]),
  subclass("artificer", "battle-smith", "Battle Smith", "Tasha", [f(3, "Tool Proficiency", "Tasha"), f(3, "Battle Smith Spells", "Tasha"), f(3, "Battle Ready", "Tasha"), f(3, "Steel Defender", "Tasha"), f(5, "Extra Attack", "Tasha"), f(9, "Arcane Jolt", "Tasha"), f(15, "Improved Defender", "Tasha")]),
]

export const CLASS_PROGRESSIONS: Record<ClassName, ClassProgressionDefinition> = {
  artificer: {
    className: "artificer", label: "Artificer", hitDie: "d8", source: "Tasha", subclassLevel: 3, subclasses: artificerSubclasses,
    cantripsKnown: { 1: 2, 10: 3, 14: 4 },
    features: withAsi("artificer", [
      f(1, "Magical Tinkering", "Tasha"), f(1, "Spellcasting", "Tasha"),
      f(2, "Infuse Item", "Tasha", { choice: { id: "artificer-infusions-2", label: "Infusions known", kind: "infusion", count: 4, options: ARTIFICER_INFUSIONS } }),
      f(3, "Artificer Specialist", "Tasha"), f(3, "The Right Tool for the Job", "Tasha"), f(5, "Specialist Feature", "Tasha"),
      f(6, "Tool Expertise", "Tasha", { choice: { id: "artificer-infusions-6", label: "Additional infusions", kind: "infusion", count: 2, options: ARTIFICER_INFUSIONS } }),
      f(7, "Flash of Genius", "Tasha"), f(9, "Specialist Feature", "Tasha"),
      f(10, "Magic Item Adept", "Tasha", { choice: { id: "artificer-infusions-10", label: "Additional infusions", kind: "infusion", count: 2, options: ARTIFICER_INFUSIONS } }),
      f(11, "Spell-Storing Item", "Tasha"),
      f(14, "Magic Item Savant", "Tasha", { choice: { id: "artificer-infusions-14", label: "Additional infusions", kind: "infusion", count: 2, options: ARTIFICER_INFUSIONS } }),
      f(15, "Specialist Feature", "Tasha"), f(18, "Magic Item Master", "Tasha", { choice: { id: "artificer-infusions-18", label: "Additional infusions", kind: "infusion", count: 2, options: ARTIFICER_INFUSIONS } }), f(20, "Soul of Artifice", "Tasha"),
    ]),
  },
  barbarian: {
    className: "barbarian", label: "Barbarian", hitDie: "d12", source: "PHB", subclassLevel: 3, subclasses: barbarianSubclasses,
    features: withAsi("barbarian", [f(1, "Rage"), f(1, "Unarmored Defense"), f(2, "Reckless Attack"), f(2, "Danger Sense"), f(3, "Primal Path"), f(3, "Primal Knowledge", "Tasha", { optional: true }), f(5, "Extra Attack"), f(5, "Fast Movement"), f(7, "Feral Instinct"), f(7, "Instinctive Pounce", "Tasha", { optional: true }), f(9, "Brutal Critical"), f(11, "Relentless Rage"), f(13, "Brutal Critical Improvement"), f(15, "Persistent Rage"), f(17, "Brutal Critical Improvement"), f(18, "Indomitable Might"), f(20, "Primal Champion")]),
  },
  bard: {
    className: "bard", label: "Bard", hitDie: "d8", source: "PHB", subclassLevel: 3, subclasses: bardSubclasses,
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    features: withAsi("bard", [f(1, "Spellcasting"), f(1, "Bardic Inspiration"), f(2, "Jack of All Trades"), f(2, "Song of Rest"), f(2, "Magical Inspiration", "Tasha", { optional: true }), f(3, "Bard College"), f(3, "Expertise", "PHB", { choice: { id: "bard-expertise-3", label: "Expertise skills", kind: "expertise", count: 2 } }), f(4, "Bardic Versatility", "Tasha", { optional: true }), f(5, "Font of Inspiration"), f(5, "Bardic Inspiration Improvement"), f(6, "Countercharm"), f(9, "Song of Rest Improvement"), f(10, "Expertise", "PHB", { choice: { id: "bard-expertise-10", label: "Expertise skills", kind: "expertise", count: 2 } }), f(10, "Magical Secrets"), f(10, "Bardic Inspiration Improvement"), f(13, "Song of Rest Improvement"), f(14, "Magical Secrets"), f(15, "Bardic Inspiration Improvement"), f(17, "Song of Rest Improvement"), f(18, "Magical Secrets"), f(20, "Superior Inspiration")]),
  },
  cleric: {
    className: "cleric", label: "Cleric", hitDie: "d8", source: "PHB", subclassLevel: 1, subclasses: clericSubclasses,
    cantripsKnown: { 1: 3, 4: 4, 10: 5 },
    features: withAsi("cleric", [f(1, "Spellcasting"), f(1, "Divine Domain"), f(2, "Channel Divinity"), f(2, "Turn Undead"), f(2, "Harness Divine Power", "Tasha", { optional: true }), f(4, "Cantrip Versatility", "Tasha", { optional: true }), f(5, "Destroy Undead"), f(6, "Channel Divinity Improvement"), f(8, "Destroy Undead Improvement"), f(8, "Blessed Strikes", "Tasha", { optional: true }), f(10, "Divine Intervention"), f(11, "Destroy Undead Improvement"), f(14, "Destroy Undead Improvement"), f(17, "Destroy Undead Improvement"), f(18, "Channel Divinity Improvement"), f(20, "Improved Divine Intervention")]),
  },
  druid: {
    className: "druid", label: "Druid", hitDie: "d8", source: "PHB", subclassLevel: 2, subclasses: druidSubclasses,
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    features: withAsi("druid", [f(1, "Druidic"), f(1, "Spellcasting"), f(2, "Wild Shape"), f(2, "Druid Circle"), f(2, "Wild Companion", "Tasha", { optional: true }), f(4, "Wild Shape Improvement"), f(4, "Cantrip Versatility", "Tasha", { optional: true }), f(8, "Wild Shape Improvement"), f(18, "Timeless Body"), f(18, "Beast Spells"), f(20, "Archdruid")]),
  },
  fighter: {
    className: "fighter", label: "Fighter", hitDie: "d10", source: "PHB", subclassLevel: 3, subclasses: fighterSubclasses,
    features: withAsi("fighter", [f(1, "Fighting Style", "PHB", { choice: { id: "fighter-style-1", label: "Fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES.fighter } }), f(1, "Second Wind"), f(2, "Action Surge"), f(3, "Martial Archetype"), f(4, "Martial Versatility", "Tasha", { optional: true }), f(5, "Extra Attack"), f(9, "Indomitable"), f(10, "Additional Fighting Style", "PHB", { choice: { id: "fighter-style-10", label: "Additional fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES.fighter } }), f(11, "Extra Attack Improvement"), f(13, "Indomitable Improvement"), f(17, "Action Surge Improvement"), f(17, "Indomitable Improvement"), f(20, "Extra Attack Improvement")]),
  },
  monk: {
    className: "monk", label: "Monk", hitDie: "d8", source: "PHB", subclassLevel: 3, subclasses: monkSubclasses,
    features: withAsi("monk", [f(1, "Unarmored Defense"), f(1, "Martial Arts"), f(2, "Ki"), f(2, "Unarmored Movement"), f(2, "Dedicated Weapon", "Tasha", { optional: true }), f(3, "Monastic Tradition"), f(3, "Deflect Missiles"), f(3, "Ki-Fueled Attack", "Tasha", { optional: true }), f(4, "Slow Fall"), f(4, "Quickened Healing", "Tasha", { optional: true }), f(5, "Extra Attack"), f(5, "Stunning Strike"), f(5, "Focused Aim", "Tasha", { optional: true }), f(6, "Ki-Empowered Strikes"), f(7, "Evasion"), f(7, "Stillness of Mind"), f(9, "Unarmored Movement Improvement"), f(10, "Purity of Body"), f(13, "Tongue of the Sun and Moon"), f(14, "Diamond Soul"), f(15, "Timeless Body"), f(18, "Empty Body"), f(20, "Perfect Self")]),
  },
  paladin: {
    className: "paladin", label: "Paladin", hitDie: "d10", source: "PHB", subclassLevel: 3, subclasses: paladinSubclasses,
    features: withAsi("paladin", [f(1, "Divine Sense"), f(1, "Lay on Hands"), f(2, "Fighting Style", "PHB", { choice: { id: "paladin-style-2", label: "Fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES.paladin } }), f(2, "Spellcasting"), f(2, "Divine Smite"), f(3, "Divine Health"), f(3, "Sacred Oath"), f(3, "Harness Divine Power", "Tasha", { optional: true }), f(4, "Martial Versatility", "Tasha", { optional: true }), f(5, "Extra Attack"), f(6, "Aura of Protection"), f(10, "Aura of Courage"), f(11, "Improved Divine Smite"), f(14, "Cleansing Touch"), f(18, "Aura Improvements")]),
  },
  ranger: {
    className: "ranger", label: "Ranger", hitDie: "d10", source: "PHB", subclassLevel: 3, subclasses: rangerSubclasses,
    features: withAsi("ranger", [f(1, "Favored Enemy"), f(1, "Natural Explorer"), f(1, "Deft Explorer", "Tasha", { optional: true }), f(1, "Favored Foe", "Tasha", { optional: true }), f(2, "Fighting Style", "PHB", { choice: { id: "ranger-style-2", label: "Fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES.ranger } }), f(2, "Spellcasting"), f(2, "Spellcasting Focus", "Tasha", { optional: true }), f(3, "Ranger Archetype"), f(3, "Primeval Awareness"), f(3, "Primal Awareness", "Tasha", { optional: true }), f(4, "Martial Versatility", "Tasha", { optional: true }), f(5, "Extra Attack"), f(6, "Favored Enemy Improvement"), f(6, "Natural Explorer Improvement"), f(8, "Land's Stride"), f(10, "Hide in Plain Sight"), f(10, "Nature's Veil", "Tasha", { optional: true }), f(14, "Vanish"), f(14, "Favored Enemy Improvement"), f(18, "Feral Senses"), f(20, "Foe Slayer")]),
  },
  rogue: {
    className: "rogue", label: "Rogue", hitDie: "d8", source: "PHB", subclassLevel: 3, subclasses: rogueSubclasses,
    features: withAsi("rogue", [f(1, "Expertise", "PHB", { choice: { id: "rogue-expertise-1", label: "Expertise skills", kind: "expertise", count: 2 } }), f(1, "Sneak Attack"), f(1, "Thieves' Cant"), f(2, "Cunning Action"), f(3, "Roguish Archetype"), f(3, "Steady Aim", "Tasha", { optional: true }), f(5, "Uncanny Dodge"), f(6, "Expertise", "PHB", { choice: { id: "rogue-expertise-6", label: "Expertise skills", kind: "expertise", count: 2 } }), f(7, "Evasion"), f(11, "Reliable Talent"), f(14, "Blindsense"), f(15, "Slippery Mind"), f(18, "Elusive"), f(20, "Stroke of Luck")]),
  },
  sorcerer: {
    className: "sorcerer", label: "Sorcerer", hitDie: "d6", source: "PHB", subclassLevel: 1, subclasses: sorcererSubclasses,
    cantripsKnown: { 1: 4, 4: 5, 10: 6 },
    features: withAsi("sorcerer", [f(1, "Spellcasting"), f(1, "Sorcerous Origin"), f(2, "Font of Magic"), f(3, "Metamagic", "PHB", { choice: { id: "metamagic-3", label: "Metamagic options", kind: "metamagic", count: 2 } }), f(4, "Sorcerous Versatility", "Tasha", { optional: true }), f(6, "Sorcerous Origin Feature"), f(10, "Metamagic", "PHB", { choice: { id: "metamagic-10", label: "Additional metamagic", kind: "metamagic", count: 1 } }), f(14, "Sorcerous Origin Feature"), f(17, "Metamagic", "PHB", { choice: { id: "metamagic-17", label: "Additional metamagic", kind: "metamagic", count: 1 } }), f(18, "Sorcerous Origin Feature"), f(20, "Sorcerous Restoration")]),
  },
  warlock: {
    className: "warlock", label: "Warlock", hitDie: "d8", source: "PHB", subclassLevel: 1, subclasses: warlockSubclasses,
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    features: withAsi("warlock", [f(1, "Otherworldly Patron"), f(1, "Pact Magic"), f(2, "Eldritch Invocations", "PHB", { choice: { id: "invocations-2", label: "Eldritch invocations", kind: "invocation", count: 2, options: WARLOCK_INVOCATIONS } }), f(3, "Pact Boon", "PHB", { choice: { id: "pact-boon-3", label: "Pact boon", kind: "pact-boon", count: 1, options: ["Pact of the Chain", "Pact of the Blade", "Pact of the Tome", "Pact of the Talisman"] } }), f(4, "Eldritch Versatility", "Tasha", { optional: true }), f(5, "Additional Invocation", "PHB", { choice: { id: "invocations-5", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }), f(7, "Additional Invocation", "PHB", { choice: { id: "invocations-7", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }), f(9, "Additional Invocation", "PHB", { choice: { id: "invocations-9", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }), f(11, "Mystic Arcanum (6th level)"), f(12, "Additional Invocation", "PHB", { choice: { id: "invocations-12", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }), f(13, "Mystic Arcanum (7th level)"), f(15, "Mystic Arcanum (8th level)"), f(15, "Additional Invocation", "PHB", { choice: { id: "invocations-15", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }), f(17, "Mystic Arcanum (9th level)"), f(18, "Additional Invocation", "PHB", { choice: { id: "invocations-18", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }), f(20, "Eldritch Master")]),
  },
  wizard: {
    className: "wizard", label: "Wizard", hitDie: "d6", source: "PHB", subclassLevel: 2, subclasses: wizardSubclasses,
    cantripsKnown: { 1: 3, 4: 4, 10: 5 },
    features: withAsi("wizard", [f(1, "Spellcasting"), f(1, "Arcane Recovery"), f(2, "Arcane Tradition"), f(2, "Cantrip Formulas", "Tasha", { optional: true }), f(18, "Spell Mastery"), f(20, "Signature Spells")]),
  },
}

export function getClassProgression(
  className: ClassName,
): ClassProgressionDefinition {
  return CLASS_PROGRESSIONS[className]
}

export function getFeaturesAtLevel(
  className: ClassName,
  level: number,
  subclassId?: string,
): LevelFeatureDefinition[] {
  const progression = getClassProgression(className)
  const subclassDefinition = progression.subclasses.find(
    (entry) => entry.id === subclassId,
  )

  return [
    ...progression.features.filter((feature) => feature.level === level),
    ...(subclassDefinition?.features.filter(
      (feature) => feature.level === level,
    ) ?? []),
  ]
}

export function getCantripsKnownAtLevel(
  className: ClassName,
  level: number,
): number {
  const progression = getClassProgression(className)
  const entries = Object.entries(progression.cantripsKnown ?? {})
    .map(([minimumLevel, count]) => [Number(minimumLevel), count] as const)
    .filter(([minimumLevel]) => minimumLevel <= level)
    .toSorted((left, right) => left[0] - right[0])

  return entries.at(-1)?.[1] ?? 0
}
