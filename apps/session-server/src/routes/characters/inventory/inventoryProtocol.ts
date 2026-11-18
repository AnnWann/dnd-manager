import type { SessionInventoryOperation as SharedInventoryOperation } from "../../../../../../packages/session-protocol/src/inventoryOperations"
import type { InventorySettingsOperation } from "../../../../../../packages/session-protocol/src/inventorySettings"
type InventoryLocation = { type: "party"; depotId?: string } | { type: "ground" } | { type: "character"; characterId: string };
type ServerEquipmentDestination = { type: "natural" } | { type: "pocket" } | { type: "hand"; hands?: 1 | 2; wieldedTwoHanded?: boolean };
type ServerInventoryTransfer = { itemId: string; quantity: number; from: InventoryLocation; to: InventoryLocation; destinationItemId?: string };
type ServerEquippedReference =
  | { type: "weapon"; itemId: string }
  | { type: "shield" }
  | { type: "held-item"; itemId: string }
  | { type: "slot"; slot: "armor" | "helmet" | "gloves" | "boots" | "cape" }
  | { type: "ring"; itemId: string }
  | { type: "necklace"; itemId: string };

export type SessionInventoryOperation = SharedInventoryOperation<Record<string, unknown>, ServerEquipmentDestination, ServerInventoryTransfer, ServerEquippedReference>

export type SessionInventoryClientMessage =
  | {
      type: "session.inventory.initialize";
      partyDepots?: import("../../../../../web/src/models/items/PartyDepot").PartyDepot[];
      partyInventory: Record<string, unknown>[];
      groundInventory: Record<string, unknown>[];
      carryCapacity?: number;
      additionalSupplyConsumption?: number;
      partyInventoryAccessible?: boolean;
    }
  | { type: "session.inventory.operation"; operation: SessionInventoryOperation };

export function parseInventoryClientMessage(raw: string): SessionInventoryClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type === "session.inventory.initialize") {
    if (!Array.isArray(message.partyInventory) || !Array.isArray(message.groundInventory)) return null;
    if (message.partyDepots !== undefined) {
      if (!Array.isArray(message.partyDepots) || message.partyDepots.length > 100) return null;
      const ids = new Set<string>();
      for (const raw of message.partyDepots) {
        if (!raw || typeof raw !== "object") return null;
        const depot = raw as Record<string, unknown>;
        if (typeof depot.id !== "string" || !depot.id.trim() || depot.id.length > 200 || ids.has(depot.id)) return null;
        ids.add(depot.id);
        if (typeof depot.name !== "string" || !depot.name.trim() || depot.name.length > 80 || typeof depot.description !== "string" || depot.description.length > 2000 || typeof depot.accessible !== "boolean" || typeof depot.useForDailySupplies !== "boolean" || !Array.isArray(depot.items) || !isOptionalNonNegativeNumber(depot.carryCapacity)) return null;
      }
    }
    if (!isOptionalNonNegativeNumber(message.carryCapacity)) return null;
    if (!isOptionalNonNegativeNumber(message.additionalSupplyConsumption)) return null;
    if (
      message.partyInventoryAccessible !== undefined
      && typeof message.partyInventoryAccessible !== "boolean"
    ) return null;
    return message as SessionInventoryClientMessage;
  }
  if (message.type !== "session.inventory.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (typeof operation.type !== "string" || typeof operation.characterId !== "string") return null;
  const validId = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
  if (operation.depotId !== undefined && !validId(operation.depotId)) return null;
  if (operation.type === "party.depot.create") {
    if (operation.characterId !== "session" || !validId(operation.depotId) || typeof operation.name !== "string" || !operation.name.trim() || operation.name.length > 80) return null;
  }
  if (operation.type === "party.depot.update") {
    const patch = operation.patch;
    if (operation.characterId !== "session" || !validId(operation.depotId) || !patch || typeof patch !== "object" || Array.isArray(patch)) return null;
    const p = patch as Record<string, unknown>;
    if (Object.keys(p).some(key => !["name","description","accessible","carryCapacity","useForDailySupplies"].includes(key))) return null;
    if (p.name !== undefined && (typeof p.name !== "string" || !p.name.trim() || p.name.length > 80)) return null;
    if (p.description !== undefined && (typeof p.description !== "string" || p.description.length > 2000)) return null;
    for (const key of ["accessible","useForDailySupplies"]) if (p[key] !== undefined && typeof p[key] !== "boolean") return null;
    if (!isOptionalNonNegativeNumber(p.carryCapacity)) return null;
  }
  if (operation.type === "inventory.item.transfer") {
    const request = operation.request as Record<string, unknown> | undefined;
    if (!request) return null;
    for (const side of [request.from, request.to]) {
      if (!side || typeof side !== "object") return null;
      const location = side as Record<string, unknown>;
      if (location.depotId !== undefined && (location.type !== "party" || !validId(location.depotId))) return null;
    }
  }
  if (operation.type === "party.supplies.day.consume" && (
    operation.characterId !== "session" || !Number.isInteger(operation.expectedRevision) || Number(operation.expectedRevision) < 0
  )) return null;
  if (
    operation.type === "character.ammunition.spend" &&
    (
      typeof operation.weaponId !== "string" || !operation.weaponId.trim() ||
      typeof operation.ammunitionKey !== "string" || !operation.ammunitionKey.trim() ||
      typeof operation.ammunitionName !== "string" || !operation.ammunitionName.trim() ||
      typeof operation.quantity !== "number" || !Number.isInteger(operation.quantity) ||
      operation.quantity < 1 || operation.quantity > 100
    )
  ) return null;
  if (
    (operation.type === "party.settings.carryCapacity.set" || operation.type === "party.settings.additionalSupplyConsumption.set")
    && (operation.characterId !== "session" || typeof operation.value !== "number" || !Number.isFinite(operation.value) || operation.value < 0)
  ) return null;
  if (
    operation.type === "conditional.loot.resolve"
    && (operation.characterId !== "session" || typeof operation.pendingId !== "string" || !operation.pendingId.trim() || typeof operation.drop !== "boolean")
  ) return null;
  if (
    operation.type === "party.settings.accessible.set"
    && (
      operation.characterId !== "session"
      || typeof operation.value !== "boolean"
    )
  ) return null;
  return message as SessionInventoryClientMessage;
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}
