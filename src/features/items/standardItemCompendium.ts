import {
  createCurrencyCompendiumItems,
  createCurrencyItem,
  type CurrencyType,
} from "../../models/items/Currency"
import type { Itemmable } from "../../models/items/item"
import {
  BASIC_ITEM_COMPENDIUM,
  cloneCompendiumItem,
} from "./itemCompendium"

export type StandardItemDefinition = {
  item: Itemmable
  locked: boolean
  group: "currency" | "magic" | "equipment"
}

export const BAG_OF_HOLDING_COMPENDIUM_ITEM: Itemmable = {
  id: "compendium-bag-of-holding",
  name: "Bolsa Mágica",
  desc: "Esta bolsa possui um espaço extradimensional e comporta até 226 kg de conteúdo.",
  notes: "",
  quantity: 1,
  weight: 6.8,
  pocketable: false,
  kind: "gear",
  category: "bagOfHolding",
  equippable: false,
  magicItem: true,
  requiresAttunement: false,
  attuned: false,
  insideBagOfHolding: false,
}

export const STANDARD_ITEM_DEFINITIONS: StandardItemDefinition[] = [
  ...createCurrencyCompendiumItems().map((item) => ({
    item,
    locked: true,
    group: "currency" as const,
  })),
  {
    item: BAG_OF_HOLDING_COMPENDIUM_ITEM,
    locked: true,
    group: "magic",
  },
  ...BASIC_ITEM_COMPENDIUM.map((item) => ({
    item,
    locked: false,
    group: "equipment" as const,
  })),
]

export const STANDARD_ITEM_COMPENDIUM = STANDARD_ITEM_DEFINITIONS.map(
  (definition) => definition.item,
)

export function findStandardItemDefinition(
  templateId: string,
): StandardItemDefinition | undefined {
  return STANDARD_ITEM_DEFINITIONS.find(
    (definition) => definition.item.id === templateId,
  )
}

export function instantiateStandardItem(
  templateId: string,
  quantity = 1,
): Itemmable {
  const definition = findStandardItemDefinition(templateId)
  if (!definition) {
    throw new Error("Item padrão não encontrado no compêndio.")
  }

  if (definition.item.kind === "currency") {
    const currencyType = definition.item.currencyType as CurrencyType
    return createCurrencyItem(currencyType, quantity)
  }

  return {
    ...cloneCompendiumItem(definition.item),
    quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
  }
}
