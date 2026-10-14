import type { Itemmable } from "./item"
import { isBagOfHoldingItem } from "./item"
import { getItemStackWeightKg } from "./itemWeight"
import { getStandardItemVolumeLiters, STANDARD_CONTAINER_SIZES } from "./standardItemVolumes"

export type CompartmentSizeUnit = "slots" | "liters"
export type ItemCompartment = {
  unit: CompartmentSizeUnit
  capacity: number
  /** null means unlimited weight; zero is a real limit. */
  maxWeightKg: number | null
  /** Extradimensional storage doesn't add contents to carried weight. */
  extradimensional?: boolean
}

export const BAG_OF_HOLDING_COMPARTMENT: ItemCompartment = {
  unit: "liters",
  capacity: 1812,
  maxWeightKg: 226,
  extradimensional: true,
}
const EPSILON = 0.000001

export function getItemCompartment(item: Itemmable): ItemCompartment | undefined {
  if (isBagOfHoldingItem(item)) return BAG_OF_HOLDING_COMPARTMENT
  if (item.compartment) return item.compartment
  // Pre-existing standard bags, sacks and containers lack saved compartment
  // data. Recognize them without migrating or rewriting the inventory.
  const source = item.compendiumItemId ?? item.id
  if (!source.startsWith("compendium-")) return undefined
  const standard = STANDARD_CONTAINER_SIZES[source.slice("compendium-".length)]
  if (!standard) return undefined
  return { unit: "liters", capacity: standard.capacityLiters, maxWeightKg: standard.maxWeightKg }
}

export function isCompartment(item: Itemmable): boolean {
  return Boolean(getItemCompartment(item))
}

/** Legacy inventories put all bag contents in the first bag. */
export function getItemContainerId(item: Itemmable, items: Itemmable[]): string | undefined {
  if (item.containerId) return item.containerId
  if (!item.insideBagOfHolding || isBagOfHoldingItem(item)) return undefined
  return items.find(entry => isBagOfHoldingItem(entry) && entry.id !== item.id)?.id
}

export function isInsideCompartment(item: Itemmable, containerId: string, items: Itemmable[]): boolean {
  const map = new Map(items.map(entry => [entry.id, entry]))
  const visited = new Set<string>([item.id])
  let id = getItemContainerId(item, items)
  while (id) {
    if (id === containerId) return true
    if (visited.has(id)) return false
    visited.add(id)
    const parent = map.get(id)
    if (!parent) return false
    id = getItemContainerId(parent, items)
  }
  return false
}

export function getCompartmentContents(items: Itemmable[], containerId: string): Itemmable[] {
  return items.filter(item => getItemContainerId(item, items) === containerId && item.id !== containerId)
}

/** A stack takes one slot by default; liters are per item, not per stack. */
export function getItemOccupiedSize(item: Itemmable, unit: CompartmentSizeUnit): number {
  if (unit === "slots") return Math.max(0, item.slotsUsed ?? 1)
  return Math.max(0, item.volumeLiters ?? getStandardItemVolumeLiters(item) ?? 1)
    * Math.max(0, item.quantity ?? 1)
}

export function getCompartmentUsage(items: Itemmable[], container: Itemmable): {
  size: number
  weightKg: number
  items: number
} {
  const config = getItemCompartment(container)
  if (!config) return { size: 0, weightKg: 0, items: 0 }
  const children = getCompartmentContents(items, container.id)
  return {
    size: children.reduce((sum, item) => sum + getItemOccupiedSize(item, config.unit), 0),
    weightKg: children.reduce((sum, item) => sum + getPhysicalItemWeight(item, items, new Set([container.id])), 0),
    items: children.length,
  }
}

function getPhysicalItemWeight(item: Itemmable, items: Itemmable[], visited: Set<string>): number {
  if (visited.has(item.id)) return 0
  const updatedVisited = new Set(visited)
  updatedVisited.add(item.id)
  const contents = getItemCompartment(item)?.extradimensional
    ? 0
    : getCompartmentContents(items, item.id)
      .reduce((sum, child) => sum + getPhysicalItemWeight(child, items, updatedVisited), 0)
  return getItemStackWeightKg(item) + contents
}

export function getInventoryCarriedWeightKg(items: Itemmable[]): number {
  return items
    .filter(item => !getItemContainerId(item, items))
    .reduce((sum, item) => sum + getPhysicalItemWeight(item, items, new Set()), 0)
}

export function canStoreItem(items: Itemmable[], itemId: string, containerId?: string):
  { ok: true; items: Itemmable[] } | { ok: false; reason: string } {
  const item = items.find(entry => entry.id === itemId)
  if (!item) return { ok: false, reason: "Item não encontrado." }
  const container = containerId ? items.find(entry => entry.id === containerId) : undefined
  if (containerId && (!container || !isCompartment(container))) {
    return { ok: false, reason: "Esse destino não é um compartimento." }
  }
  if (container && (container.id === itemId || isInsideCompartment(container, itemId, items))) {
    return { ok: false, reason: "Não é possível colocar um recipiente dentro dele mesmo ou de seu conteúdo." }
  }
  const next = items.map(entry => entry.id === itemId
    ? { ...entry, containerId, insideBagOfHolding: Boolean(container && isBagOfHoldingItem(container)) }
    : entry)
  const error = validateInventoryCompartments(next)
  return error ? { ok: false, reason: error } : { ok: true, items: next }
}

/** Reject malformed references, cycles and capacity overflow for authoritative writes. */
export function validateInventoryCompartments(items: Itemmable[]): string | undefined {
  const ids = new Set<string>()
  for (const item of items) {
    if (!item.id || ids.has(item.id)) return "O inventário contém identificadores duplicados."
    ids.add(item.id)
    const unitSize = item.volumeLiters
    const slots = item.slotsUsed
    if (unitSize !== undefined && (!Number.isFinite(unitSize) || unitSize < 0)) return "Volume inválido."
    if (slots !== undefined && (!Number.isFinite(slots) || slots < 0)) return "Número de slots inválido."
    if (item.compartment) {
      const config = item.compartment
      if (!["slots", "liters"].includes(config.unit) || !Number.isFinite(config.capacity) || config.capacity < 0 ||
        (config.maxWeightKg !== null && (!Number.isFinite(config.maxWeightKg) || config.maxWeightKg < 0))) {
        return `Capacidade inválida em ${item.name || "compartimento"}.`
      }
    }
  }
  for (const item of items) {
    const containerId = getItemContainerId(item, items)
    if (!containerId) continue
    const container = items.find(entry => entry.id === containerId)
    if (!container || !isCompartment(container)) return `O destino de ${item.name || "item"} não existe.`
    if (item.id === container.id || isInsideCompartment(container, item.id, items)) return "Compartimentos não podem formar ciclos."
  }
  for (const container of items.filter(isCompartment)) {
    const config = getItemCompartment(container)!
    const usage = getCompartmentUsage(items, container)
    if (usage.size > config.capacity + EPSILON) {
      return `${container.name || "Compartimento"} excede a capacidade (${usage.size.toLocaleString("pt-BR")} / ${config.capacity.toLocaleString("pt-BR")} ${config.unit === "slots" ? "slots" : "L"}).`
    }
    if (config.maxWeightKg !== null && usage.weightKg > config.maxWeightKg + EPSILON) {
      return `${container.name || "Compartimento"} excede o peso permitido (${usage.weightKg.toFixed(2)} / ${config.maxWeightKg} kg).`
    }
  }
  return undefined
}

/** Removing a container takes its direct contents out, retaining nested organization. */
export function releaseCompartmentContents(items: Itemmable[], removedId: string): Itemmable[] {
  const removed = items.find(item => item.id === removedId)
  if (!removed) return items
  const parentId = getItemContainerId(removed, items)
  return items.filter(item => item.id !== removedId).map(item => (
    getItemContainerId(item, items) === removedId
      ? { ...item, containerId: parentId, insideBagOfHolding: Boolean(parentId && items.find(entry => entry.id === parentId && isBagOfHoldingItem(entry))) }
      : item
  ))
}
