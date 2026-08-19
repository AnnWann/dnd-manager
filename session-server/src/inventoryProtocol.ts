export type SessionInventoryOperation =
  | { type: "character.inventory.item.add"; characterId: string; item: Record<string, unknown> }
  | { type: "character.inventory.item.update"; characterId: string; itemId: string; item: Record<string, unknown> }
  | { type: "character.inventory.item.remove"; characterId: string; itemId: string }
  | { type: "character.inventory.item.consume"; characterId: string; itemId: string }
  | { type: "character.inventory.item.equip"; characterId: string; itemId: string; destination: { type: "natural" } | { type: "pocket" } | { type: "hand"; hands?: 1 | 2; wieldedTwoHanded?: boolean } }
  | { type: "character.inventory.bag.toggle"; characterId: string; itemId: string }
  | { type: "character.inventory.currenciesBag.set"; characterId: string; insideBagOfHolding: boolean }
  | { type: "character.inventory.attunement.toggle"; characterId: string; itemId: string }
  | { type: "inventory.item.transfer"; characterId: string; request: { itemId: string; quantity: number; from: InventoryLocation; to: InventoryLocation; destinationItemId?: string } }
  | { type: "party.item.add"; characterId: string; item: Record<string, unknown> }
  | { type: "party.item.update"; characterId: string; itemId: string; item: Record<string, unknown> }
  | { type: "party.item.remove"; characterId: string; itemId: string }
  | { type: "ground.item.add"; characterId: string; item: Record<string, unknown> }
  | { type: "ground.item.update"; characterId: string; itemId: string; item: Record<string, unknown> }
  | { type: "ground.item.remove"; characterId: string; itemId: string }
  | { type: "character.equipment.move.ground"; characterId: string; reference: EquippedReference };

type InventoryLocation = { type: "party" } | { type: "ground" } | { type: "character"; characterId: string };
type EquippedReference =
  | { type: "weapon"; itemId: string }
  | { type: "shield" }
  | { type: "held-item"; itemId: string }
  | { type: "slot"; slot: "armor" | "helmet" | "gloves" | "boots" | "cape" }
  | { type: "ring"; itemId: string }
  | { type: "necklace"; itemId: string };

export type SessionInventoryClientMessage =
  | { type: "session.inventory.initialize"; partyInventory: Record<string, unknown>[]; groundInventory: Record<string, unknown>[] }
  | { type: "session.inventory.operation"; operation: SessionInventoryOperation };

export function parseInventoryClientMessage(raw: string): SessionInventoryClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type === "session.inventory.initialize") {
    if (!Array.isArray(message.partyInventory) || !Array.isArray(message.groundInventory)) return null;
    return message as SessionInventoryClientMessage;
  }
  if (message.type !== "session.inventory.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (typeof operation.type !== "string" || typeof operation.characterId !== "string") return null;
  return message as SessionInventoryClientMessage;
}
