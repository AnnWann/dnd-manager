import type { Item, Itemmable } from "./item"

export const CURRENCY_TYPES = [
  "copper",
  "silver",
  "electrum",
  "gold",
  "platinum",
] as const

export type CurrencyType = (typeof CURRENCY_TYPES)[number]

export type CurrencyItem = Item & {
  kind: "currency"
  currencyType: CurrencyType
}

type CurrencyDefinition = {
  label: string
  shortLabel: string
  name: string
  weight: number
}

const STANDARD_COIN_WEIGHT_KG = 0.009

export const CURRENCY_DEFINITIONS: Record<
  CurrencyType,
  CurrencyDefinition
> = {
  copper: {
    label: "Cobre",
    shortLabel: "PC",
    name: "Peças de cobre",
    weight: STANDARD_COIN_WEIGHT_KG,
  },
  silver: {
    label: "Prata",
    shortLabel: "PP",
    name: "Peças de prata",
    weight: STANDARD_COIN_WEIGHT_KG,
  },
  electrum: {
    label: "Electrum",
    shortLabel: "PE",
    name: "Peças de electrum",
    weight: STANDARD_COIN_WEIGHT_KG,
  },
  gold: {
    label: "Ouro",
    shortLabel: "PO",
    name: "Peças de ouro",
    weight: STANDARD_COIN_WEIGHT_KG,
  },
  platinum: {
    label: "Platina",
    shortLabel: "PL",
    name: "Peças de platina",
    weight: STANDARD_COIN_WEIGHT_KG,
  },
}

export function isCurrencyType(value: unknown): value is CurrencyType {
  return CURRENCY_TYPES.includes(value as CurrencyType)
}

export function isCurrencyItem(item: Itemmable): item is CurrencyItem {
  return item.kind === "currency"
}

export function createCurrencyItem(
  currencyType: CurrencyType,
  quantity = 0,
  id: string = crypto.randomUUID(),
  insideBagOfHolding = false,
): CurrencyItem {
  const definition = CURRENCY_DEFINITIONS[currencyType]

  return {
    id,
    name: definition.name,
    desc: "",
    notes: "",
    quantity: normalizeCurrencyQuantity(quantity),
    weight: definition.weight,
    pocketable: false,
    kind: "currency",
    currencyType,
    equippable: false,
    magicItem: false,
    requiresAttunement: false,
    attuned: false,
    insideBagOfHolding,
    heldHands: undefined,
  }
}

export function createCurrencyCompendiumItems(): CurrencyItem[] {
  return CURRENCY_TYPES.map((currencyType) =>
    createCurrencyItem(
      currencyType,
      1,
      `compendium-currency-${currencyType}`,
    ),
  )
}

export function normalizeCurrencyItem(item: Itemmable): CurrencyItem {
  const requestedType = (item as Partial<CurrencyItem>).currencyType
  const currencyType = isCurrencyType(requestedType)
    ? requestedType
    : inferCurrencyType(item.name)
  const definition = CURRENCY_DEFINITIONS[currencyType]
  const metadata = item as Itemmable & {
    version?: number
    updatedAt?: string
    updatedBy?: string
  }

  return {
    id: item.id,
    name: definition.name,
    desc: typeof item.desc === "string" ? item.desc : "",
    notes: typeof item.notes === "string" ? item.notes : "",
    quantity: normalizeCurrencyQuantity(item.quantity),
    weight: definition.weight,
    pocketable: false,
    kind: "currency",
    currencyType,
    equippable: false,
    magicItem: false,
    requiresAttunement: false,
    attuned: false,
    insideBagOfHolding: item.insideBagOfHolding === true,
    heldHands: undefined,
    ...(metadata.version === undefined ? {} : { version: metadata.version }),
    ...(metadata.updatedAt === undefined
      ? {}
      : { updatedAt: metadata.updatedAt }),
    ...(metadata.updatedBy === undefined
      ? {}
      : { updatedBy: metadata.updatedBy }),
  } as CurrencyItem
}

export function mergeCurrencyStacks(items: Itemmable[]): Itemmable[] {
  const result: Itemmable[] = []
  const indexByStack = new Map<string, number>()

  for (const item of items) {
    if (!isCurrencyItem(item)) {
      result.push(item)
      continue
    }

    const normalized = normalizeCurrencyItem(item)
    const stackKey = getCurrencyStackKey(normalized)
    const existingIndex = indexByStack.get(stackKey)

    if (existingIndex === undefined) {
      indexByStack.set(stackKey, result.length)
      result.push(normalized)
      continue
    }

    const existing = normalizeCurrencyItem(result[existingIndex])
    result[existingIndex] = {
      ...existing,
      quantity: existing.quantity + normalized.quantity,
    }
  }

  return result
}

export function areAllCurrenciesInBagOfHolding(
  items: Itemmable[],
): boolean {
  const currencies = items.filter(
    (item): item is CurrencyItem =>
      isCurrencyItem(item) && normalizeCurrencyQuantity(item.quantity) > 0,
  )

  return (
    currencies.length > 0 &&
    currencies.every((item) => item.insideBagOfHolding === true)
  )
}

export function setCurrenciesInsideBagOfHolding(
  items: Itemmable[],
  insideBagOfHolding: boolean,
): Itemmable[] {
  return mergeCurrencyStacks(
    items.map((item) =>
      isCurrencyItem(item)
        ? normalizeCurrencyItem({
            ...item,
            insideBagOfHolding,
          })
        : item,
    ),
  )
}

export function getCurrencyTotalWeight(item: CurrencyItem): number {
  return item.quantity * item.weight
}

function getCurrencyStackKey(item: CurrencyItem): string {
  return `${item.currencyType}:${item.insideBagOfHolding ? "bag" : "carried"}`
}

function normalizeCurrencyQuantity(value: unknown): number {
  return Math.max(0, Math.trunc(Number(value) || 0))
}

function inferCurrencyType(name: string): CurrencyType {
  const normalized = name
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (normalized.includes("platina") || normalized.includes("platinum")) {
    return "platinum"
  }
  if (normalized.includes("electrum") || normalized.includes("electro")) {
    return "electrum"
  }
  if (normalized.includes("prata") || normalized.includes("silver")) {
    return "silver"
  }
  if (normalized.includes("cobre") || normalized.includes("copper")) {
    return "copper"
  }
  if (normalized.includes("ouro") || normalized.includes("gold")) {
    return "gold"
  }

  // As moedas legadas eram criadas apenas como "Moedas" e a criação de
  // personagem já tratava esse valor como ouro.
  return "gold"
}
