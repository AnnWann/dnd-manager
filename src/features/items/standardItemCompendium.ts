import {
  createCurrencyCompendiumItems,
  createCurrencyItem,
  isCurrencyItem,
  normalizeCurrencyItem,
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

export function findStandardItemDefinitionByName(
  name: string,
): StandardItemDefinition | undefined {
  const normalized = normalizeItemLookupName(name)
  if (!normalized) return undefined

  return STANDARD_ITEM_DEFINITIONS.find(
    (definition) =>
      normalizeItemLookupName(definition.item.name) === normalized,
  )
}

export function resolveStandardItemDefinition(
  item: Pick<Itemmable, "id" | "name" | "kind" | "category" | "compendiumItemId">,
): StandardItemDefinition | undefined {
  const sourceId = item.compendiumItemId?.trim()
  if (sourceId) {
    const bySource = findStandardItemDefinition(sourceId)
    if (bySource) return bySource
  }

  const directId = item.id.startsWith("compendium-")
    ? findStandardItemDefinition(item.id)
    : undefined
  if (directId) return directId

  if (item.category === "bagOfHolding") {
    return findStandardItemDefinition(BAG_OF_HOLDING_COMPENDIUM_ITEM.id)
  }

  if (item.kind === "currency") {
    const currencyType = normalizeCurrencyItem(item as Itemmable).currencyType
    return findStandardItemDefinition(
      `compendium-currency-${currencyType}`,
    )
  }

  return findStandardItemDefinitionByName(item.name)
}

export function findStandardDefinitionForItem(
  item: Itemmable,
): StandardItemDefinition | undefined {
  // Moedas e Bolsa Mágica são categorias intrinsecamente canônicas. A forma
  // do item prevalece sobre metadados removidos ou adulterados no JSON.
  if (item.category === "bagOfHolding") {
    return findStandardItemDefinition(BAG_OF_HOLDING_COMPENDIUM_ITEM.id)
  }

  if (item.kind === "currency") {
    const currencyType = normalizeCurrencyItem(item).currencyType
    return findStandardItemDefinition(
      `compendium-currency-${currencyType}`,
    )
  }

  const sourceId = item.compendiumItemId?.trim()
  if (sourceId) return findStandardItemDefinition(sourceId)

  if (item.id.startsWith("compendium-")) {
    return findStandardItemDefinition(item.id)
  }

  return undefined
}

export function instantiateStandardItem(
  templateId: string,
  quantity = 1,
): Itemmable {
  const definition = findStandardItemDefinition(templateId)
  if (!definition) {
    throw new Error("Item padrão não encontrado no compêndio.")
  }

  if (isCurrencyItem(definition.item)) {
    return {
      ...createCurrencyItem(definition.item.currencyType, quantity),
      compendiumItemId: definition.item.id,
      itemOrigin: "standard",
    }
  }

  return {
    ...cloneCompendiumItem(definition.item),
    quantity:
      definition.item.category === "bagOfHolding"
        ? 1
        : Math.max(1, Math.trunc(Number(quantity) || 1)),
    compendiumItemId: definition.item.id,
    itemOrigin: "standard",
  }
}

export function instantiateMatchingStandardItem(
  item: Itemmable,
): Itemmable | undefined {
  const definition = resolveStandardItemDefinition(item)
  if (!definition) return undefined

  const instantiated = instantiateStandardItem(
    definition.item.id,
    item.quantity,
  )

  return normalizeStandardItem({
    ...instantiated,
    id: item.id,
    name: definition.locked ? instantiated.name : item.name || instantiated.name,
    notes: item.notes,
    insideBagOfHolding: item.insideBagOfHolding === true,
    attuned: item.attuned === true,
  })
}

export function normalizeStandardItem(item: Itemmable): Itemmable {
  const definition = findStandardDefinitionForItem(item)
  if (!definition) {
    return {
      ...item,
      itemOrigin: item.itemOrigin ?? "custom",
    }
  }

  const sourceId = definition.item.id

  if (!definition.locked) {
    return {
      ...item,
      compendiumItemId: sourceId,
      itemOrigin: "standard",
    }
  }

  if (isCurrencyItem(definition.item)) {
    const canonical = createCurrencyItem(
      definition.item.currencyType,
      item.quantity,
      item.id,
      item.insideBagOfHolding === true,
    )

    return {
      ...canonical,
      notes: typeof item.notes === "string" ? item.notes : "",
      compendiumItemId: sourceId,
      itemOrigin: "standard",
    }
  }

  if (definition.item.category === "bagOfHolding") {
    return {
      ...structuredClone(definition.item),
      id: item.id,
      notes: typeof item.notes === "string" ? item.notes : "",
      quantity: 1,
      insideBagOfHolding: false,
      compendiumItemId: sourceId,
      itemOrigin: "standard",
    }
  }

  return {
    ...structuredClone(definition.item),
    id: item.id,
    quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
    notes: typeof item.notes === "string" ? item.notes : "",
    insideBagOfHolding: item.insideBagOfHolding === true,
    attuned:
      definition.item.requiresAttunement === true && item.attuned === true,
    compendiumItemId: sourceId,
    itemOrigin: "standard",
  }
}

export function normalizeStandardItemsInValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeStandardItemsInValue)
  }

  if (!isRecord(value)) return value

  const normalizedChildren = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      normalizeStandardItemsInValue(child),
    ]),
  )

  if (!looksLikeItem(normalizedChildren)) {
    return normalizedChildren
  }

  return normalizeStandardItem(normalizedChildren as Itemmable)
}

export function normalizeItemLookupName(value: string): string {
  return value
    .replace(/\s*[×x]\s*\d+\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function looksLikeItem(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.kind === "string" &&
    typeof value.quantity === "number" &&
    typeof value.weight === "number"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}