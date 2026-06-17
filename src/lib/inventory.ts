import type { DeathSaveState, InventoryItem } from '../models/types'

export function normalizeInventoryItem(item: any): InventoryItem {
  return {
    id: String(item?.id ?? crypto.randomUUID()),
    name: String(item?.name ?? ''),
    quantity: Math.max(0, Math.trunc(Number(item?.quantity ?? 1)) || 0),
    notes: String(item?.notes ?? ''),
  }
}

export function normalizeInventoryItems(items: any): InventoryItem[] {
  if (!Array.isArray(items)) return []
  return items.map(normalizeInventoryItem)
}

export function normalizeDeathSaves(value: any): DeathSaveState {
  return {
    successes: Math.max(0, Math.min(3, Math.trunc(Number(value?.successes ?? 0)) || 0)),
    failures: Math.max(0, Math.min(3, Math.trunc(Number(value?.failures ?? 0)) || 0)),
  }
}

export function newInventoryItem(): InventoryItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: 1,
    notes: '',
  }
}