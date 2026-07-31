import type { Itemmable } from "./item"
import {
  CURRENCY_TYPES,
  isCurrencyItem,
  normalizeCurrencyItem,
} from "./Currency"

/**
 * Verifica o principal invariante monetário de um inventário: no máximo uma
 * pilha para cada denominação e valores canônicos para peso, nome e quantidade.
 */
export function hasValidCurrencyStacks(items: Itemmable[]): boolean {
  const seen = new Set<string>()

  for (const item of items) {
    if (!isCurrencyItem(item)) continue

    const normalized = normalizeCurrencyItem(item)
    if (!CURRENCY_TYPES.includes(normalized.currencyType)) return false
    if (seen.has(normalized.currencyType)) return false
    if (!Number.isInteger(normalized.quantity) || normalized.quantity < 0) {
      return false
    }
    if (!Number.isFinite(normalized.weight) || normalized.weight < 0) {
      return false
    }

    seen.add(normalized.currencyType)
  }

  return true
}
