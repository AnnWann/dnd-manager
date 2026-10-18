export type SessionEquipmentReference =
  | { type: "weapon"; itemId: string }
  | { type: "shield" }
  | { type: "held-item"; itemId: string }
  | { type: "slot"; slot: "armor" | "helmet" | "gloves" | "boots" | "cape" }
  | { type: "ring"; itemId: string }
  | { type: "necklace"; itemId: string }
  | { type: "body-part"; itemId: string };

import type { SessionEquipmentOperation as SharedSessionEquipmentOperation, SessionEquipmentClientMessage as SharedSessionEquipmentClientMessage } from "../../../../../packages/session-protocol/src/equipmentOperations"
export type SessionEquipmentOperation = SharedSessionEquipmentOperation<SessionEquipmentReference, "inventory" | "pocket">
export type SessionEquipmentClientMessage = SharedSessionEquipmentClientMessage<SessionEquipmentReference, "inventory" | "pocket">

const OPERATION_TYPES = new Set<SessionEquipmentOperation["type"]>([
  "character.equipment.item.update",
  "character.equipment.move",
  "character.equipment.attunement.toggle",
  "character.equipment.pocket.unequip",
  "character.equipment.pocket.wield",
  "character.equipment.pocket.use",
]);

export function parseEquipmentClientMessage(raw: string): SessionEquipmentClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as { type?: unknown; operation?: unknown };
  if (message.type !== "session.equipment.operation") return null;
  if (!message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (
    typeof operation.type !== "string" ||
    !OPERATION_TYPES.has(operation.type as SessionEquipmentOperation["type"]) ||
    typeof operation.characterId !== "string" ||
    !operation.characterId.trim()
  ) return null;

  if (operation.type === "character.equipment.pocket.wield") {
    if (typeof operation.index !== "number" || !Number.isInteger(operation.index) || operation.index < 0) return null;
    if (operation.replaceWeaponId !== undefined && typeof operation.replaceWeaponId !== "string") return null;
    if (operation.hands !== undefined && operation.hands !== 1 && operation.hands !== 2) return null;
  }

  return message as SessionEquipmentClientMessage;
}
