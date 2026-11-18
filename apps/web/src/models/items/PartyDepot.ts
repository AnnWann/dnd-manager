import { canonicalizeSupplyItem } from "../supplies/partySupply"
import type { Itemmable } from "./item"

export const DEFAULT_PARTY_DEPOT_ID = "default"
export type PartyDepot = {
  id: string
  name: string
  description: string
  accessible: boolean
  carryCapacity: number
  useForDailySupplies: boolean
  items: Itemmable[]
}
export type PartyDepotState = {
  partyInventory?: Itemmable[]
  partyDepots?: PartyDepot[]
  partyInventoryAccessible?: boolean
  carryCapacity?: number
  partyCarryCapacity?: number
}

/** The legacy inventory remains the default depot so imports/rests/loot keep their contents. */
export function getPartyDepots(state: PartyDepotState): PartyDepot[] {
  const saved = state.partyDepots ?? []
  const main = saved.find(depot => depot.id === DEFAULT_PARTY_DEPOT_ID)
  return [{
    id: DEFAULT_PARTY_DEPOT_ID,
    name: main?.name || "Inventário do grupo",
    description: main?.description ?? "",
    accessible: state.partyInventoryAccessible !== false,
    carryCapacity: state.carryCapacity ?? state.partyCarryCapacity ?? 0,
    useForDailySupplies: main?.useForDailySupplies !== false,
    items: state.partyInventory ?? [],
  }, ...saved.filter(depot => depot.id !== DEFAULT_PARTY_DEPOT_ID)]
}
export function setPartyDepotItems(state: PartyDepotState, depotId: string | undefined, items: Itemmable[]): boolean {
  const id = depotId || DEFAULT_PARTY_DEPOT_ID
  if (id === DEFAULT_PARTY_DEPOT_ID) { state.partyInventory = items; return true }
  if (!state.partyDepots?.some(depot => depot.id === id)) return false
  state.partyDepots = state.partyDepots.map(depot => depot.id === id ? { ...depot, items } : depot)
  return true
}
export function updatePartyDepot(state: PartyDepotState, id: string, patch: Partial<Omit<PartyDepot, "id" | "items">>): boolean {
  const depots = getPartyDepots(state)
  const current = depots.find(depot => depot.id === id)
  if (!current) return false
  const next = { ...current, ...patch, name: patch.name?.trim() ?? current.name }
  state.partyDepots = depots.map(depot => depot.id === id ? next : depot).map(depot => depot.id === DEFAULT_PARTY_DEPOT_ID ? { ...depot, items: [] } : depot)
  if (id === DEFAULT_PARTY_DEPOT_ID) {
    state.partyInventoryAccessible = next.accessible
    if ("revision" in state || "carryCapacity" in state) state.carryCapacity = next.carryCapacity
    state.partyCarryCapacity = next.carryCapacity
  }
  return true
}
export function createPartyDepot(state: PartyDepotState, id: string, name: string): boolean {
  if (getPartyDepots(state).some(depot => depot.id === id)) return false
  state.partyDepots = [...(state.partyDepots ?? []), {
    id, name: name.trim(), description: "", accessible: true, carryCapacity: 0, useForDailySupplies: true, items: [],
  }]
  return true
}
export function getDailyDepotSupplies(state: PartyDepotState): Itemmable[] {
  if (!state.partyDepots?.length) return state.partyInventoryAccessible === false ? [] : state.partyInventory ?? []
  return getPartyDepots(state).filter(depot => depot.accessible && depot.useForDailySupplies).flatMap(depot =>
    depot.items.map((item, index) => ({ ...canonicalizeSupplyItem(item), id: JSON.stringify([depot.id, index]) })),
  )
}
/** Map temporary selection identities back to their depot, even with repeated item IDs across stocks. */
export function applyDailyDepotSupplies(state: PartyDepotState, remaining: Itemmable[]): void {
  if (!state.partyDepots?.length) { state.partyInventory = remaining; return }
  const byKey = new Map(remaining.map(item => [item.id, item]))
  for (const depot of getPartyDepots(state)) {
    if (!depot.accessible || !depot.useForDailySupplies) continue
    setPartyDepotItems(state, depot.id, depot.items.flatMap((original, index) => {
      const item = byKey.get(JSON.stringify([depot.id, index]))
      return item ? [{ ...item, id: original.id }] : []
    }))
  }
}
