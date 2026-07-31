import type { Itemmable } from "../../models/items/item"
import { WEAPON_PROPERTIES } from "../../models/items/equipment/Weapon"

const base = {
  id: "",
  desc: "",
  notes: "",
  quantity: 1,
  weight: 0,
  pocketable: true,
  kind: "gear" as const,
}

export const BASIC_ITEM_COMPENDIUM: Itemmable[] = [
  {
    ...base,
    id: "compendium-longsword",
    name: "Espada longa",
    desc: "Arma marcial corpo a corpo.",
    weight: 1.35,
    kind: "equipment",
    equippable: true,
    equipSlot: "weapon",
    properties: [WEAPON_PROPERTIES.versatile],
    damage: { quantity: 1, sides: "d8" },
    versatileDamage: { quantity: 1, sides: "d10" },
    modifierAttribute: "str",
    proficient: false,
  },
  {
    ...base,
    id: "compendium-dagger",
    name: "Adaga",
    desc: "Arma simples leve, de acuidade e arremesso.",
    weight: 0.45,
    kind: "equipment",
    equippable: true,
    equipSlot: "weapon",
    properties: [
      WEAPON_PROPERTIES.finesse,
      WEAPON_PROPERTIES.light,
      WEAPON_PROPERTIES.thrown,
    ],
    damage: { quantity: 1, sides: "d4" },
    modifierAttribute: "dex",
    proficient: false,
  },
  {
    ...base,
    id: "compendium-shortbow",
    name: "Arco curto",
    desc: "Arma simples à distância que utiliza flechas.",
    weight: 0.9,
    pocketable: false,
    kind: "equipment",
    equippable: true,
    equipSlot: "weapon",
    properties: [
      WEAPON_PROPERTIES.ammunition,
      WEAPON_PROPERTIES.range,
      WEAPON_PROPERTIES["two-handed"],
    ],
    damage: { quantity: 1, sides: "d6" },
    modifierAttribute: "dex",
    proficient: false,
  },
  {
    ...base,
    id: "compendium-arrows",
    name: "Flechas",
    desc: "Munição para arcos.",
    quantity: 20,
    weight: 0.025,
    kind: "ammunition",
  },
  {
    ...base,
    id: "compendium-leather-armor",
    name: "Armadura de couro",
    desc: "Armadura leve básica.",
    weight: 4.5,
    pocketable: false,
    kind: "equipment",
    equippable: true,
    equipSlot: "armor",
  },
  {
    ...base,
    id: "compendium-shield",
    name: "Escudo",
    desc: "Escudo comum de madeira ou metal.",
    weight: 2.7,
    pocketable: false,
    kind: "shield",
    equippable: true,
    equipSlot: "shield",
  },
  {
    ...base,
    id: "compendium-healing-potion",
    name: "Poção de cura",
    desc: "Consumível mágico que restaura pontos de vida.",
    weight: 0.25,
    kind: "consumable",
    magicItem: true,
  },
  {
    ...base,
    id: "compendium-rope",
    name: "Corda de cânhamo (15 m)",
    desc: "Corda resistente com 15 metros de comprimento.",
    weight: 4.5,
    pocketable: false,
    kind: "gear",
  },
  {
    ...base,
    id: "compendium-torch",
    name: "Tocha",
    desc: "Ilumina uma área quando acesa.",
    quantity: 10,
    weight: 0.45,
    kind: "gear",
  },
  {
    ...base,
    id: "compendium-rations",
    name: "Rações de viagem",
    desc: "Uma porção diária de alimento seco.",
    quantity: 10,
    weight: 0.9,
    kind: "supply",
  },
  {
    ...base,
    id: "compendium-thieves-tools",
    name: "Ferramentas de ladrão",
    desc: "Conjunto de ferramentas para abrir fechaduras e desarmar mecanismos.",
    weight: 0.45,
    kind: "tool",
  },
  {
    ...base,
    id: "compendium-arcane-focus",
    name: "Foco arcano",
    desc: "Foco utilizado para conjurar magias arcanas.",
    weight: 0.45,
    kind: "focus",
  },
]

export function cloneCompendiumItem(item: Itemmable): Itemmable {
  return {
    ...structuredClone(item),
    id: crypto.randomUUID(),
  }
}

export function itemJsonTemplate(): Itemmable {
  return {
    id: crypto.randomUUID(),
    name: "Novo item",
    desc: "Descrição do item.",
    notes: "",
    quantity: 1,
    weight: 0,
    pocketable: true,
    kind: "gear",
  }
}

export function parseItemJson(value: string): Itemmable {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("O JSON deve representar um único item.")
  }

  const item = parsed as Partial<Itemmable>
  if (typeof item.name !== "string" || !item.name.trim()) {
    throw new Error("O item precisa possuir um nome.")
  }

  return {
    ...itemJsonTemplate(),
    ...item,
    id: typeof item.id === "string" && item.id.trim()
      ? item.id
      : crypto.randomUUID(),
    name: item.name.trim(),
    desc: typeof item.desc === "string" ? item.desc : "",
    notes: typeof item.notes === "string" ? item.notes : "",
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    weight: Math.max(0, Number(item.weight) || 0),
    pocketable: item.pocketable !== false,
    kind: item.kind ?? "gear",
  } as Itemmable
}
