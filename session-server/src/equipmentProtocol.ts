export type SessionEquipmentOperation =
  | {
      type: "character.equipment.item.update";
      characterId: string;
      reference:
        | { type: "weapon"; itemId: string }
        | { type: "shield" }
        | { type: "held-item"; itemId: string }
        | { type: "slot"; slot: "armor" | "helmet" | "gloves" | "boots" | "cape" }
        | { type: "ring"; itemId: string }
        | { type: "necklace"; itemId: string };
      item: Record<string, unknown>;
    }
  | {
      type: "character.equipment.move";
      characterId: string;
      reference:
        | { type: "weapon"; itemId: string }
        | { type: "shield" }
        | { type: "held-item"; itemId: string }
        | { type: "slot"; slot: "armor" | "helmet" | "gloves" | "boots" | "cape" }
        | { type: "ring"; itemId: string }
        | { type: "necklace"; itemId: string };
      destination: "inventory" | "pocket";
    }
  | {
      type: "character.equipment.pocket.unequip";
      characterId: string;
      index: number;
    }
  | {
      type: "character.equipment.pocket.wield";
      characterId: string;
      index: number;
    }
  | {
      type: "character.equipment.pocket.use";
      characterId: string;
      index: number;
    };

export type SessionEquipmentClientMessage = {
  type: "session.equipment.operation";
  operation: SessionEquipmentOperation;
};

export function parseEquipmentClientMessage(raw: string): SessionEquipmentClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as { type?: unknown; operation?: unknown };
  if (message.type !== "session.equipment.operation") return null;
  if (!message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (typeof operation.type !== "string" || typeof operation.characterId !== "string") return null;
  return message as SessionEquipmentClientMessage;
}
