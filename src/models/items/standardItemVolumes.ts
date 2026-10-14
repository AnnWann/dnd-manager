/**
 * Storage-space estimates in liters per physical item, not storage capacity.
 *
 * D&D 5e publishes weights and some container capacities, but NOT exterior
 * dimensions or displaced volume for the vast majority of its equipment.
 * These rounded figures are practical packed-volume estimates: folded clothes,
 * coiled ropes, bundled ammunition and stowed gear, rather than the solid
 * material's density. Large rigid objects use approximate exterior size.
 * Each value is per quantity unit as used by the existing item compendium
 * (e.g. one arrow, one ration, one torch).
 *
 * The official 2014 container capacities are encoded separately below.
 * Ref: https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment
 */
export const STANDARD_ITEM_VOLUME_LITERS: Readonly<Record<string, number>> = {
  // Weapons
  "club": 1.2,
  "dagger": 0.25,
  "greatclub": 5,
  "handaxe": 0.9,
  "javelin": 1.5,
  "light-hammer": 0.7,
  "mace": 1.8,
  "quarterstaff": 2,
  "sickle": 0.7,
  "spear": 2.2,
  "light-crossbow": 4,
  "dart": 0.08,
  "shortbow": 3,
  "sling": 0.15,
  "battleaxe": 2,
  "flail": 1.5,
  "glaive": 5.5,
  "greataxe": 4,
  "greatsword": 4.5,
  "halberd": 6,
  "lance": 6,
  "longsword": 2.2,
  "maul": 5,
  "morningstar": 1.6,
  "pike": 9,
  "rapier": 1.4,
  "scimitar": 1.6,
  "shortsword": 1.4,
  "trident": 3,
  "war-pick": 1.3,
  "warhammer": 1.6,
  "whip": 1,
  "hand-crossbow": 1.8,
  "heavy-crossbow": 11,
  "longbow": 4,

  // Armor and shield
  "padded-armor": 9,
  "leather-armor": 7,
  "studded-leather": 9,
  "hide-armor": 11,
  "chain-shirt": 6,
  "scale-mail": 18,
  "breastplate": 16,
  "half-plate": 23,
  "ring-mail": 20,
  "chain-mail": 19,
  "splint-armor": 29,
  "plate-armor": 35,
  "shield": 8,

  // Ammunition
  "arrows": 0.14,
  "crossbow-bolts": 0.1,
  "sling-bullets": 0.03,
  "blowgun-needles": 0.004,

  // Adventuring gear and consumables
  "abacus": 1.2,
  "acid-vial": 0.35,
  "alchemists-fire": 0.35,
  "antitoxin": 0.15,
  "backpack": 3.5,
  "ball-bearings": 1.3,
  "barrel": 160,
  "basket": 65,
  "bedroll": 9,
  "bell": 0.2,
  "blanket": 4,
  "block-and-tackle": 8,
  "book": 2,
  "glass-bottle": 1,
  "bucket": 15,
  "caltrops": 1.2,
  "candle": 0.08,
  "crossbow-bolt-case": 2,
  "map-case": 1.5,
  "chain": 4,
  "chalk": 0.02,
  "chest": 400,
  "climbers-kit": 10,
  "common-clothes": 5,
  "costume-clothes": 8,
  "fine-clothes": 8,
  "travelers-clothes": 7,
  "component-pouch": 1.2,
  "crowbar": 2,
  "fishing-tackle": 3,
  "flask": 0.8,
  "grappling-hook": 3,
  "hammer": 1.4,
  "sledgehammer": 4,
  "healers-kit": 0.35,
  "holy-water": 0.35,
  "hourglass": 0.6,
  "hunting-trap": 10,
  "ink": 0.08,
  "ink-pen": 0.03,
  "jug": 5,
  "ladder": 60,
  "lamp": 1.5,
  "bullseye-lantern": 3,
  "hooded-lantern": 3,
  "lock": 0.5,
  "magnifying-glass": 0.3,
  "manacles": 1.5,
  "mess-kit": 2,
  "steel-mirror": 0.2,
  "oil-flask": 0.65,
  "paper": 0.01,
  "parchment": 0.02,
  "perfume": 0.12,
  "miners-pick": 5,
  "piton": 0.15,
  "basic-poison": 0.12,
  "pole": 4,
  "iron-pot": 7,
  "healing-potion": 0.35,
  "pouch": 0.4,
  "quiver": 3.5,
  "portable-ram": 18,
  "rations": 1.3,
  "robes": 7,
  "hemp-rope": 9,
  "silk-rope": 5,
  "sack": 1,
  "merchants-scale": 3,
  "sealing-wax": 0.1,
  "shovel": 5,
  "signal-whistle": 0.05,
  "signet-ring": 0.02,
  "soap": 0.15,
  "spellbook": 3,
  "iron-spikes": 0.25,
  "spyglass": 1,
  "tent": 22,
  "tinderbox": 1,
  "torch": 0.6,
  "vial": 0.2,
  "waterskin": 2.3,
  "whetstone": 0.6,

  // Tools and gaming sets
  "alchemists-supplies": 12,
  "brewers-supplies": 18,
  "calligraphers-supplies": 4,
  "carpenters-tools": 9,
  "cartographers-tools": 6,
  "cobblers-tools": 7,
  "cooks-utensils": 15,
  "glassblowers-tools": 10,
  "jewelers-tools": 3,
  "leatherworkers-tools": 7,
  "masons-tools": 12,
  "painters-supplies": 5,
  "potters-tools": 7,
  "smiths-tools": 14,
  "tinkers-tools": 11,
  "weavers-tools": 10,
  "woodcarvers-tools": 5,
  "thieves-tools": 2,
  "disguise-kit": 6,
  "forgery-kit": 4,
  "herbalism-kit": 4,
  "navigators-tools": 4,
  "poisoners-kit": 3,
  "dice-set": 0.1,
  "dragonchess-set": 4,
  "playing-card-set": 0.15,
  "three-dragon-ante-set": 0.15,

  // Musical instruments
  "bagpipes": 9,
  "drum": 12,
  "dulcimer": 24,
  "flute": 1,
  "lute": 20,
  "lyre": 12,
  "horn": 6,
  "pan-flute": 1.5,
  "shawm": 1.5,
  "viol": 16,

  // Foci and holy symbols
  "arcane-crystal": 0.4,
  "arcane-orb": 1.2,
  "arcane-rod": 1.2,
  "arcane-staff": 2.5,
  "arcane-wand": 0.3,
  "druidic-sprig": 0.2,
  "druidic-totem": 0.3,
  "druidic-staff": 2.5,
  "druidic-yew-wand": 0.3,
  "holy-amulet": 0.1,
  "holy-emblem": 0.1,
  "holy-reliquary": 1.5,

  // Equipment packs
  "burglars-pack": 45,
  "diplomats-pack": 55,
  "dungeoneers-pack": 55,
  "entertainers-pack": 50,
  "explorers-pack": 60,
  "priests-pack": 32,
  "scholars-pack": 28,

  // Mounting gear
  "animal-feed": 6,
  "bit-and-bridle": 3,
  "saddlebags": 8,
  "pack-saddle": 35,
  "riding-saddle": 45,
  // Extradimensional bag's *outside* packed size, not its interior volume.
  "bag-of-holding": 10,
}

/** 2014 D&D 5e container capacities, rounded to 0.1 L for play. */
export type StandardContainerSize = {
  capacityLiters: number
  maxWeightKg: number | null
}

export const STANDARD_CONTAINER_SIZES: Readonly<Record<string, StandardContainerSize>> = {
  // Capacity is for ordinary goods, not the container's exterior dimensions.
  "backpack": { capacityLiters: 28.3, maxWeightKg: 13.6 },
  "barrel": { capacityLiters: 113.3, maxWeightKg: null }, // solids: 4 cu ft; liquid: 40 US gal
  "basket": { capacityLiters: 56.6, maxWeightKg: 18.1 },
  "bucket": { capacityLiters: 11.4, maxWeightKg: null }, // liquid: 3 US gal
  "chest": { capacityLiters: 339.8, maxWeightKg: 136.1 },
  "glass-bottle": { capacityLiters: 0.7, maxWeightKg: null },
  "flask": { capacityLiters: 0.5, maxWeightKg: null },
  "jug": { capacityLiters: 3.8, maxWeightKg: null },
  "iron-pot": { capacityLiters: 3.8, maxWeightKg: null },
  "pouch": { capacityLiters: 5.7, maxWeightKg: 2.7 },
  "sack": { capacityLiters: 28.3, maxWeightKg: 13.6 },
  "vial": { capacityLiters: 0.12, maxWeightKg: null },
  "waterskin": { capacityLiters: 1.9, maxWeightKg: null },
  // Flexible estimate only: the rules do not specify inner capacity here.
  "component-pouch": { capacityLiters: 1, maxWeightKg: null },
  "crossbow-bolt-case": { capacityLiters: 3, maxWeightKg: null },
  "map-case": { capacityLiters: 2, maxWeightKg: null },
  "quiver": { capacityLiters: 4, maxWeightKg: null },
  "saddlebags": { capacityLiters: 55, maxWeightKg: null },
}

/** Supports both templates and already-owned instances with compendiumItemId. */
export function getStandardItemVolumeLiters(
  item: { id: string; compendiumItemId?: string; category?: string },
): number | undefined {
  if (item.category === "bagOfHolding") return STANDARD_ITEM_VOLUME_LITERS["bag-of-holding"]
  const key = item.compendiumItemId ?? item.id
  if (!key.startsWith("compendium-")) return undefined
  return STANDARD_ITEM_VOLUME_LITERS[key.slice("compendium-".length)]
}
