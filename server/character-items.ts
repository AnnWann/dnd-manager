import type { Prisma } from "../generated/prisma/client"

const BAG_OF_HOLDING_ID = "compendium-bag-of-holding"
const COINS: Record<
  string,
  {
    name: string
    currencyType: "copper" | "silver" | "electrum" | "gold" | "platinum"
  }
> = {
  "compendium-currency-copper": {
    name: "Peças de cobre",
    currencyType: "copper",
  },
  "compendium-currency-silver": {
    name: "Peças de prata",
    currencyType: "silver",
  },
  "compendium-currency-electrum": {
    name: "Peças de electrum",
    currencyType: "electrum",
  },
  "compendium-currency-gold": {
    name: "Peças de ouro",
    currencyType: "gold",
  },
  "compendium-currency-platinum": {
    name: "Peças de platina",
    currencyType: "platinum",
  },
}

const COIN_WEIGHT_KG = 0.009

export function sanitizeCharacterItemData(
  data: Prisma.InputJsonObject,
): Prisma.InputJsonObject {
  return sanitizeValue(data) as Prisma.InputJsonObject
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (!isRecord(value)) return value

  const normalized = Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, sanitizeValue(child)]),
  )
  const sourceId =
    typeof normalized.compendiumItemId === "string"
      ? normalized.compendiumItemId
      : ""

  if (sourceId === BAG_OF_HOLDING_ID) {
    return {
      ...normalized,
      id: stringOr(normalized.id, crypto.randomUUID()),
      name: "Bolsa Mágica",
      desc: "Esta bolsa possui um espaço extradimensional e comporta até 226 kg de conteúdo.",
      notes: stringOr(normalized.notes, ""),
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
      compendiumItemId: BAG_OF_HOLDING_ID,
      itemOrigin: "standard",
    }
  }

  const coin = COINS[sourceId]
  if (coin) {
    const {
      heldHands: _heldHands,
      equipSlot: _equipSlot,
      category: _category,
      ...safeMetadata
    } = normalized

    return {
      ...safeMetadata,
      id: stringOr(normalized.id, crypto.randomUUID()),
      name: coin.name,
      desc: "",
      notes: stringOr(normalized.notes, ""),
      quantity: Math.max(0, Math.trunc(numberOr(normalized.quantity, 0))),
      weight: COIN_WEIGHT_KG,
      pocketable: false,
      kind: "currency",
      currencyType: coin.currencyType,
      equippable: false,
      magicItem: false,
      requiresAttunement: false,
      attuned: false,
      insideBagOfHolding: normalized.insideBagOfHolding === true,
      compendiumItemId: sourceId,
      itemOrigin: "standard",
    }
  }

  return normalized
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
