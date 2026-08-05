import type { Armor } from "../../models/items/equipment/Armor"
import { withShieldDefaults } from "../../models/items/equipment/Shield"
import {
  WEAPON_PROPERTIES,
  type Weapon,
} from "../../models/items/equipment/Weapon"
import type { Itemmable, ItemKind } from "../../models/items/item"
import {
  findStandardItemDefinition,
  findStandardItemDefinitionByName,
  instantiateStandardItem,
  normalizeStandardItem,
} from "../../features/items/standardItemCompendium"
import type { StartingItemSpec } from "../../features/characters/creation/phbClassEquipment"

const CATEGORY_LABELS: Record<StartingItemSpec["category"], string> = {
  weapon: "Arma",
  armor: "Armadura",
  shield: "Escudo",
  ammunition: "Munição",
  tool: "Ferramenta",
  focus: "Foco",
  instrument: "Instrumento",
  pack: "Pacote",
  gear: "Equipamento geral",
  currency: "Moeda",
}

const KIND_BY_CATEGORY: Record<
  Exclude<StartingItemSpec["category"], "weapon" | "armor" | "shield">,
  ItemKind
> = {
  ammunition: "ammunition",
  tool: "tool",
  focus: "focus",
  instrument: "instrument",
  pack: "pack",
  gear: "gear",
  currency: "currency",
}

export function createStartingInventoryItem(
  spec: StartingItemSpec,
  flavoredName?: string,
): Itemmable {
  const requestedName = flavoredName?.trim() || spec.name
  const quantity = Math.max(1, spec.quantity ?? 1)
  const definition =
    findStandardItemDefinition(`compendium-${spec.id}`) ??
    findStandardItemDefinitionByName(spec.name)

  if (definition) {
    const canonical = instantiateStandardItem(definition.item.id, quantity)
    const name = definition.locked ? canonical.name : requestedName
    const notes =
      name === definition.item.name
        ? "Equipamento inicial da classe, criado a partir do compêndio."
        : `Equipamento inicial da classe com aparência/nome personalizado. Item-base do compêndio: ${definition.item.name}.`

    return normalizeStandardItem({
      ...canonical,
      name,
      notes,
      quantity,
      insideBagOfHolding: false,
      ...(canonical.kind === "equipment" && canonical.equipSlot === "weapon"
        ? { proficient: true }
        : {}),
      ...(spec.category === "armor" && spec.armorType
        ? { armorType: spec.armorType }
        : {}),
    } as Itemmable)
  }

  return createFallbackStartingItem(spec, requestedName)
}

export function createStartingGoldItem(amount: number): Itemmable {
  const item = instantiateStandardItem(
    "compendium-currency-gold",
    Math.max(0, Math.trunc(amount || 0)),
  )

  return normalizeStandardItem({
    ...item,
    desc: "Ouro inicial escolhido para substituir o pacote de equipamentos da classe.",
    notes: "Moeda inicial da criação do personagem.",
  })
}

function createFallbackStartingItem(
  spec: StartingItemSpec,
  name: string,
): Itemmable {
  const base = {
    id: crypto.randomUUID(),
    name,
    desc: `${CATEGORY_LABELS[spec.category]} inicial de classe. Base mecânica: ${spec.name}.`,
    notes:
      name === spec.name
        ? "Equipamento inicial da classe sem correspondência no compêndio."
        : `Equipamento inicial da classe com aparência/nome personalizado. Item-base: ${spec.name}.`,
    quantity: Math.max(1, spec.quantity ?? 1),
    weight: Math.max(0, spec.weight ?? 0),
    pocketable:
      spec.category === "weapon" ||
      spec.category === "ammunition" ||
      spec.category === "currency" ||
      spec.category === "tool" ||
      spec.category === "focus",
    insideBagOfHolding: false,
    itemOrigin: "custom" as const,
  }

  if (spec.category === "weapon") {
    return {
      ...base,
      kind: "equipment",
      equippable: true,
      equipSlot: "weapon",
      properties: (spec.properties ?? []).map(
        (propertyId) => WEAPON_PROPERTIES[propertyId],
      ),
      twoHanded: spec.twoHanded ?? false,
      damage: spec.damage ?? { quantity: 1, sides: "d6" },
      modifierAttribute: spec.modifierAttribute ?? "str",
      proficient: true,
    } satisfies Weapon
  }

  if (spec.category === "armor") {
    return {
      ...base,
      kind: "equipment",
      equippable: true,
      equipSlot: "armor",
      pocketable: false,
      armorType: spec.armorType ?? "light",
    } satisfies Armor
  }

  if (spec.category === "shield") {
    return withShieldDefaults({
      ...base,
      kind: "shield",
    })
  }

  return {
    ...base,
    kind: KIND_BY_CATEGORY[spec.category],
    equippable: false,
  }
}
