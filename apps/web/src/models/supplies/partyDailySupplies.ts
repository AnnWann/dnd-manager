import type { Itemmable } from "../items/item"
import { normalizeLongRestSupplySettings, type LongRestSupplySettings } from "../../shared/rest/longRestSupplySettings"
import { createAutomaticLongRestSelection, consumeSelectedSupplies, hasEnoughLongRestSupplies } from "./partySupply"

export type PartyDailyConsumers = { count: number; food: number; drink: number }

/** Shared-inventory debit only: no resting, healing or resource recovery. */
export function planPartyDailySupplies(
  items: Itemmable[], consumers: PartyDailyConsumers, additional: number, configured?: LongRestSupplySettings,
) {
  const settings = normalizeLongRestSupplySettings(configured)
  const extra = Math.max(0, additional)
  const requirements = {
    foodPortions: settings.enabled && settings.food.enabled
      ? ((settings.useRaceMultipliers ? consumers.food : consumers.count) + extra) * settings.food.portionsPerStandardRest : 0,
    drinkPortions: settings.enabled && settings.drink.enabled
      ? ((settings.useRaceMultipliers ? consumers.drink : consumers.count) + extra) * settings.drink.portionsPerStandardRest : 0,
  }
  const selection = createAutomaticLongRestSelection(items, requirements)
  const consumption = consumeSelectedSupplies(items, selection)
  const enough = hasEnoughLongRestSupplies(consumption, requirements)
  const error = !settings.enabled || requirements.foodPortions + requirements.drinkPortions <= 0
    ? "Não há consumo diário habilitado para este grupo."
    : !enough && settings.shortageMode === "block"
      ? "Suprimentos insuficientes para o dia de todo o grupo."
      : consumption.selectedPortions <= 0 ? "Não há suprimentos disponíveis no inventário do grupo." : null
  return { requirements, consumption, enough, error }
}
