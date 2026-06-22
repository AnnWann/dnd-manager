import type { DieSides } from "../../../models/dice/Die"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import type { WeaponPropertyId } from "../../../models/items/equipment/Weapon"
import type { Armor } from "../../../models/items/equipment/Armor"

export type StartingItemCategory =
  | "weapon"
  | "armor"
  | "shield"
  | "ammunition"
  | "tool"
  | "focus"
  | "instrument"
  | "pack"
  | "gear"
  | "currency"

export type StartingItemSpec = {
  id: string
  name: string
  quantity?: number
  category: StartingItemCategory
  weight?: number
  damage?: {
    quantity: number
    sides: DieSides
  }
  modifierAttribute?: Attribute
  properties?: WeaponPropertyId[]
  twoHanded?: boolean
  armorType?: Armor["armorType"]
}

export type ClassEquipmentOption = {
  id: string
  label: string
  items: StartingItemSpec[]
}

export type ClassEquipmentChoiceGroup = {
  id: string
  label: string
  options: ClassEquipmentOption[]
}

export type StartingGoldFormula = {
  dice: number
  sides: number
  multiplier: number
}

export type ClassEquipmentPreset = {
  className: ClassName
  fixedItems: StartingItemSpec[]
  choiceGroups: ClassEquipmentChoiceGroup[]
  startingGold: StartingGoldFormula
}

const weapon = (
  id: string,
  name: string,
  sides: DieSides,
  options: Partial<StartingItemSpec> = {},
): StartingItemSpec => ({
  id,
  name,
  category: "weapon",
  quantity: 1,
  weight: 1.5,
  damage: { quantity: 1, sides },
  modifierAttribute: "str",
  properties: [],
  ...options,
})

const item = (
  id: string,
  name: string,
  category: StartingItemCategory,
  quantity = 1,
  weight = 0,
): StartingItemSpec => ({ id, name, category, quantity, weight })

const armor = (
  id: string,
  name: string,
  armorType: Armor["armorType"],
  weight: number,
): StartingItemSpec => ({
  id,
  name,
  category: "armor",
  quantity: 1,
  armorType,
  weight,
})

const option = (
  id: string,
  label: string,
  items: StartingItemSpec[],
): ClassEquipmentOption => ({ id, label, items })

const group = (
  id: string,
  label: string,
  options: ClassEquipmentOption[],
): ClassEquipmentChoiceGroup => ({ id, label, options })

const WEAPONS = {
  greataxe: () =>
    weapon("greataxe", "Machado grande", "d12", {
      weight: 3.2,
      properties: ["heavy", "two-handed"],
      twoHanded: true,
    }),
  greatsword: () =>
    weapon("greatsword", "Espada grande", "d6", {
      weight: 2.7,
      damage: { quantity: 2, sides: "d6" },
      properties: ["heavy", "two-handed"],
      twoHanded: true,
    }),
  maul: () =>
    weapon("maul", "Malho", "d6", {
      weight: 4.5,
      damage: { quantity: 2, sides: "d6" },
      properties: ["heavy", "two-handed"],
      twoHanded: true,
    }),
  longsword: () =>
    weapon("longsword", "Espada longa", "d8", {
      weight: 1.4,
      properties: ["versatile"],
    }),
  battleaxe: () =>
    weapon("battleaxe", "Machado de batalha", "d8", {
      weight: 1.8,
      properties: ["versatile"],
    }),
  warhammer: () =>
    weapon("warhammer", "Martelo de guerra", "d8", {
      weight: 0.9,
      properties: ["versatile"],
    }),
  rapier: () =>
    weapon("rapier", "Rapieira", "d8", {
      weight: 0.9,
      modifierAttribute: "dex",
      properties: ["finesse"],
    }),
  shortsword: (id = "shortsword", quantity = 1) =>
    weapon(id, "Espada curta", "d6", {
      quantity,
      weight: 0.9,
      modifierAttribute: "dex",
      properties: ["finesse", "light"],
    }),
  scimitar: () =>
    weapon("scimitar", "Cimitarra", "d6", {
      weight: 1.4,
      modifierAttribute: "dex",
      properties: ["finesse", "light"],
    }),
  dagger: (id = "dagger", quantity = 1) =>
    weapon(id, "Adaga", "d4", {
      quantity,
      weight: 0.45,
      modifierAttribute: "dex",
      properties: ["finesse", "light", "thrown"],
    }),
  handaxe: (id = "handaxe", quantity = 1) =>
    weapon(id, "Machadinha", "d6", {
      quantity,
      weight: 0.9,
      properties: ["light", "thrown"],
    }),
  javelin: (id = "javelin", quantity = 1) =>
    weapon(id, "Azagaia", "d6", {
      quantity,
      weight: 0.9,
      properties: ["thrown"],
    }),
  spear: () =>
    weapon("spear", "Lança", "d6", {
      weight: 1.4,
      properties: ["thrown", "versatile"],
    }),
  quarterstaff: () =>
    weapon("quarterstaff", "Bordão", "d6", {
      weight: 1.8,
      properties: ["versatile"],
    }),
  mace: () => weapon("mace", "Maça", "d6", { weight: 1.8 }),
  lightCrossbow: () =>
    weapon("light-crossbow", "Besta leve", "d8", {
      weight: 2.3,
      modifierAttribute: "dex",
      properties: ["ammunition", "loading", "range", "two-handed"],
      twoHanded: true,
    }),
  longbow: () =>
    weapon("longbow", "Arco longo", "d8", {
      weight: 0.9,
      modifierAttribute: "dex",
      properties: ["ammunition", "heavy", "range", "two-handed"],
      twoHanded: true,
    }),
  shortbow: () =>
    weapon("shortbow", "Arco curto", "d6", {
      weight: 0.9,
      modifierAttribute: "dex",
      properties: ["ammunition", "range", "two-handed"],
      twoHanded: true,
    }),
  dart: (quantity = 10) =>
    weapon("dart", "Dardo", "d4", {
      quantity,
      weight: 0.1,
      modifierAttribute: "dex",
      properties: ["finesse", "thrown"],
    }),
  simple: (id = "simple-weapon") =>
    weapon(id, "Arma simples à escolha", "d6", { weight: 1.5 }),
  martial: (id = "martial-weapon") =>
    weapon(id, "Arma marcial à escolha", "d8", { weight: 1.8 }),
}

const ammunition = (id: string, name: string, quantity: number) =>
  item(id, name, "ammunition", quantity, 0.03)

const shield = () => item("shield", "Escudo", "shield", 1, 2.7)
const componentPouch = () =>
  item("component-pouch", "Bolsa de componentes", "focus", 1, 0.9)
const arcaneFocus = () =>
  item("arcane-focus", "Foco arcano", "focus", 1, 0.5)
const holySymbol = () =>
  item("holy-symbol", "Símbolo sagrado", "focus", 1, 0.5)
const druidicFocus = () =>
  item("druidic-focus", "Foco druídico", "focus", 1, 0.5)
const thievesTools = () =>
  item("thieves-tools", "Ferramentas de ladrão", "tool", 1, 0.5)

const PACKS = {
  explorer: () => item("explorer-pack", "Pacote de explorador", "pack", 1, 26),
  dungeoneer: () => item("dungeoneer-pack", "Pacote de aventureiro", "pack", 1, 27),
  diplomat: () => item("diplomat-pack", "Pacote de diplomata", "pack", 1, 18),
  entertainer: () => item("entertainer-pack", "Pacote de artista", "pack", 1, 19),
  priest: () => item("priest-pack", "Pacote de sacerdote", "pack", 1, 11),
  burglar: () => item("burglar-pack", "Pacote de assaltante", "pack", 1, 21),
  scholar: () => item("scholar-pack", "Pacote de estudioso", "pack", 1, 5),
}

const PRESETS: Partial<Record<ClassName, ClassEquipmentPreset>> = {
  barbarian: {
    className: "barbarian",
    fixedItems: [PACKS.explorer(), WEAPONS.javelin("barbarian-javelin", 4)],
    choiceGroups: [
      group("primary-weapon", "Arma principal", [
        option("greataxe", "Machado grande", [WEAPONS.greataxe()]),
        option("greatsword", "Espada grande", [WEAPONS.greatsword()]),
        option("maul", "Malho", [WEAPONS.maul()]),
        option("custom-martial", "Outra arma marcial", [WEAPONS.martial()]),
      ]),
      group("secondary-weapons", "Armas secundárias", [
        option("two-handaxes", "Duas machadinhas", [WEAPONS.handaxe("barbarian-handaxe", 2)]),
        option("spear", "Uma lança", [WEAPONS.spear()]),
        option("simple", "Outra arma simples", [WEAPONS.simple()]),
      ]),
    ],
    startingGold: { dice: 2, sides: 4, multiplier: 10 },
  },
  bard: {
    className: "bard",
    fixedItems: [armor("bard-leather", "Armadura de couro", "light", 4.5), WEAPONS.dagger("bard-dagger")],
    choiceGroups: [
      group("weapon", "Arma", [option("rapier", "Rapieira", [WEAPONS.rapier()]), option("longsword", "Espada longa", [WEAPONS.longsword()]), option("simple", "Arma simples", [WEAPONS.simple("bard-simple")])]),
      group("pack", "Pacote", [option("diplomat", "Pacote de diplomata", [PACKS.diplomat()]), option("entertainer", "Pacote de artista", [PACKS.entertainer()])]),
      group("instrument", "Instrumento", [option("lute", "Alaúde", [item("lute", "Alaúde", "instrument", 1, 0.9)]), option("flute", "Flauta", [item("flute", "Flauta", "instrument", 1, 0.5)]), option("custom-instrument", "Outro instrumento", [item("custom-instrument", "Instrumento musical à escolha", "instrument", 1, 0.8)])]),
    ],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
  },
  cleric: {
    className: "cleric",
    fixedItems: [shield(), holySymbol()],
    choiceGroups: [
      group("weapon", "Arma principal", [option("mace", "Maça", [WEAPONS.mace()]), option("warhammer", "Martelo de guerra", [WEAPONS.warhammer()])]),
      group("armor", "Armadura", [option("scale", "Cota de escamas", [armor("scale-mail", "Cota de escamas", "medium", 20.4)]), option("leather", "Armadura de couro", [armor("cleric-leather", "Armadura de couro", "light", 4.5)]), option("chain", "Cota de malha", [armor("cleric-chain", "Cota de malha", "heavy", 25)])]),
      group("secondary", "Arma secundária", [option("crossbow", "Besta leve e 20 virotes", [WEAPONS.lightCrossbow(), ammunition("cleric-bolts", "Virote", 20)]), option("simple", "Arma simples", [WEAPONS.simple("cleric-simple")])]),
      group("pack", "Pacote", [option("priest", "Pacote de sacerdote", [PACKS.priest()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])]),
    ],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
  },
  druid: {
    className: "druid",
    fixedItems: [armor("druid-leather", "Armadura de couro", "light", 4.5), PACKS.explorer(), druidicFocus()],
    choiceGroups: [
      group("first", "Primeiro item", [option("wooden-shield", "Escudo de madeira", [item("wooden-shield", "Escudo de madeira", "shield", 1, 2.7)]), option("simple", "Arma simples", [WEAPONS.simple("druid-simple-a")])]),
      group("second", "Segundo item", [option("scimitar", "Cimitarra", [WEAPONS.scimitar()]), option("simple-melee", "Arma simples corpo a corpo", [WEAPONS.simple("druid-simple-b")])]),
    ],
    startingGold: { dice: 2, sides: 4, multiplier: 10 },
  },
  fighter: {
    className: "fighter",
    fixedItems: [],
    choiceGroups: [
      group("armor", "Armadura", [option("chain", "Cota de malha", [armor("fighter-chain", "Cota de malha", "heavy", 25)]), option("leather-bow", "Couro, arco longo e 20 flechas", [armor("fighter-leather", "Armadura de couro", "light", 4.5), WEAPONS.longbow(), ammunition("fighter-arrows", "Flecha", 20)])]),
      group("primary", "Conjunto principal", [option("weapon-shield", "Arma marcial e escudo", [WEAPONS.martial("fighter-martial-a"), shield()]), option("two-weapons", "Duas armas marciais", [WEAPONS.martial("fighter-martial-b"), WEAPONS.martial("fighter-martial-c")])]),
      group("secondary", "Armas secundárias", [option("crossbow", "Besta leve e 20 virotes", [WEAPONS.lightCrossbow(), ammunition("fighter-bolts", "Virote", 20)]), option("handaxes", "Duas machadinhas", [WEAPONS.handaxe("fighter-handaxes", 2)])]),
      group("pack", "Pacote", [option("dungeoneer", "Pacote de aventureiro", [PACKS.dungeoneer()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])]),
    ],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
  },
  monk: {
    className: "monk",
    fixedItems: [WEAPONS.dart(10)],
    choiceGroups: [group("weapon", "Arma", [option("shortsword", "Espada curta", [WEAPONS.shortsword("monk-shortsword")]), option("simple", "Arma simples", [WEAPONS.simple("monk-simple")])]), group("pack", "Pacote", [option("dungeoneer", "Pacote de aventureiro", [PACKS.dungeoneer()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])])],
    startingGold: { dice: 5, sides: 4, multiplier: 1 },
  },
  paladin: {
    className: "paladin",
    fixedItems: [armor("paladin-chain", "Cota de malha", "heavy", 25), holySymbol()],
    choiceGroups: [group("primary", "Conjunto principal", [option("weapon-shield", "Arma marcial e escudo", [WEAPONS.martial("paladin-martial-a"), shield()]), option("two-weapons", "Duas armas marciais", [WEAPONS.martial("paladin-martial-b"), WEAPONS.martial("paladin-martial-c")])]), group("secondary", "Armas secundárias", [option("javelins", "Cinco azagaias", [WEAPONS.javelin("paladin-javelins", 5)]), option("simple", "Arma simples corpo a corpo", [WEAPONS.simple("paladin-simple")])]), group("pack", "Pacote", [option("priest", "Pacote de sacerdote", [PACKS.priest()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])])],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
  },
  ranger: {
    className: "ranger",
    fixedItems: [WEAPONS.longbow(), ammunition("ranger-arrows", "Flecha", 20)],
    choiceGroups: [group("armor", "Armadura", [option("scale", "Cota de escamas", [armor("ranger-scale", "Cota de escamas", "medium", 20.4)]), option("leather", "Armadura de couro", [armor("ranger-leather", "Armadura de couro", "light", 4.5)])]), group("weapons", "Armas corpo a corpo", [option("shortswords", "Duas espadas curtas", [WEAPONS.shortsword("ranger-shortswords", 2)]), option("simple-melee", "Duas armas simples", [WEAPONS.simple("ranger-simple-a"), WEAPONS.simple("ranger-simple-b")])]), group("pack", "Pacote", [option("dungeoneer", "Pacote de aventureiro", [PACKS.dungeoneer()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])])],
    startingGold: { dice: 5, sides: 4, multiplier: 10 },
  },
  rogue: {
    className: "rogue",
    fixedItems: [armor("rogue-leather", "Armadura de couro", "light", 4.5), WEAPONS.dagger("rogue-daggers", 2), thievesTools()],
    choiceGroups: [group("primary", "Arma principal", [option("rapier", "Rapieira", [WEAPONS.rapier()]), option("shortsword", "Espada curta", [WEAPONS.shortsword("rogue-shortsword-a")])]), group("secondary", "Arma secundária", [option("shortbow", "Arco curto e 20 flechas", [WEAPONS.shortbow(), ammunition("rogue-arrows", "Flecha", 20)]), option("shortsword", "Outra espada curta", [WEAPONS.shortsword("rogue-shortsword-b")])]), group("pack", "Pacote", [option("burglar", "Pacote de assaltante", [PACKS.burglar()]), option("dungeoneer", "Pacote de aventureiro", [PACKS.dungeoneer()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])])],
    startingGold: { dice: 4, sides: 4, multiplier: 10 },
  },
  sorcerer: {
    className: "sorcerer",
    fixedItems: [WEAPONS.dagger("sorcerer-daggers", 2)],
    choiceGroups: [group("weapon", "Arma", [option("crossbow", "Besta leve e 20 virotes", [WEAPONS.lightCrossbow(), ammunition("sorcerer-bolts", "Virote", 20)]), option("simple", "Arma simples", [WEAPONS.simple("sorcerer-simple")])]), group("focus", "Foco", [option("pouch", "Bolsa de componentes", [componentPouch()]), option("focus", "Foco arcano", [arcaneFocus()])]), group("pack", "Pacote", [option("dungeoneer", "Pacote de aventureiro", [PACKS.dungeoneer()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])])],
    startingGold: { dice: 3, sides: 4, multiplier: 10 },
  },
  warlock: {
    className: "warlock",
    fixedItems: [armor("warlock-leather", "Armadura de couro", "light", 4.5), WEAPONS.simple("warlock-simple-fixed"), WEAPONS.dagger("warlock-daggers", 2)],
    choiceGroups: [group("weapon", "Arma à distância", [option("crossbow", "Besta leve e 20 virotes", [WEAPONS.lightCrossbow(), ammunition("warlock-bolts", "Virote", 20)]), option("simple", "Arma simples", [WEAPONS.simple("warlock-simple-choice")])]), group("focus", "Foco", [option("pouch", "Bolsa de componentes", [componentPouch()]), option("focus", "Foco arcano", [arcaneFocus()])]), group("pack", "Pacote", [option("scholar", "Pacote de estudioso", [PACKS.scholar()]), option("dungeoneer", "Pacote de aventureiro", [PACKS.dungeoneer()])])],
    startingGold: { dice: 4, sides: 4, multiplier: 10 },
  },
  wizard: {
    className: "wizard",
    fixedItems: [item("spellbook", "Grimório", "gear", 1, 1.4)],
    choiceGroups: [group("weapon", "Arma", [option("quarterstaff", "Bordão", [WEAPONS.quarterstaff()]), option("dagger", "Adaga", [WEAPONS.dagger("wizard-dagger")])]), group("focus", "Foco", [option("pouch", "Bolsa de componentes", [componentPouch()]), option("focus", "Foco arcano", [arcaneFocus()])]), group("pack", "Pacote", [option("scholar", "Pacote de estudioso", [PACKS.scholar()]), option("explorer", "Pacote de explorador", [PACKS.explorer()])])],
    startingGold: { dice: 4, sides: 4, multiplier: 10 },
  },
}

export function getPhbClassEquipmentPreset(className: ClassName): ClassEquipmentPreset | undefined { return PRESETS[className] }

export function getDefaultClassEquipmentSelections(className: ClassName): Record<string, string> {
  const preset = getPhbClassEquipmentPreset(className)
  if (!preset) return {}
  return Object.fromEntries(preset.choiceGroups.map((choiceGroup) => [choiceGroup.id, choiceGroup.options[0]?.id ?? ""]))
}

export function getSelectedClassEquipment(className: ClassName, selections: Record<string, string>): StartingItemSpec[] {
  const preset = getPhbClassEquipmentPreset(className)
  if (!preset) return []
  return [...preset.fixedItems, ...preset.choiceGroups.flatMap((choiceGroup) => {
    const selectedOptionId = selections[choiceGroup.id]
    return (choiceGroup.options.find((entry) => entry.id === selectedOptionId) ?? choiceGroup.options[0])?.items ?? []
  })]
}

export function formatStartingGoldFormula(formula: StartingGoldFormula): string {
  const multiplier = formula.multiplier === 1 ? "" : ` × ${formula.multiplier}`
  return `${formula.dice}d${formula.sides}${multiplier} po`
}

export function averageStartingGold(formula: StartingGoldFormula): number {
  return Math.floor(formula.dice * ((formula.sides + 1) / 2) * formula.multiplier)
}

export function rollStartingGold(formula: StartingGoldFormula): number {
  let total = 0
  for (let index = 0; index < formula.dice; index += 1) total += Math.floor(Math.random() * formula.sides) + 1
  return total * formula.multiplier
}

export function getPhbClassStartingEquipmentText(className: ClassName): string {
  return getSelectedClassEquipment(className, getDefaultClassEquipmentSelections(className)).map((entry) => (entry.quantity ?? 1) > 1 ? `${entry.name} ×${entry.quantity}` : entry.name).join("\n")
}
