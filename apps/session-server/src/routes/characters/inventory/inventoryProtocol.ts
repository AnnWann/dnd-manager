import type { SessionInventoryOperation as SharedInventoryOperation } from "../../../../../../packages/session-protocol/src/inventoryOperations"
import type { InventorySettingsOperation } from "../../../../../../packages/session-protocol/src/inventorySettings"
type InventoryLocation = { type: "party" } | { type: "ground" } | { type: "character"; characterId: string };
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
