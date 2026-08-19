import type { CharacterTemplateProps } from "../../src/models/characters/CharacterTemplate";
import { CharacterTemplate } from "../../src/models/characters/CharacterTemplate";
import {
  getEquippedItem,
  moveEquippedItemToCharacterStorage,
  type EquippedItemReference,
} from "../../src/models/characters/characterEquippedItemMovement";
import { wieldPocketWeaponWithRules } from "../../src/models/characters/characterEquipmentInteractions";
import { unequipPocketStack } from "../../src/models/characters/characterInventoryStacks";
import { toggleInventoryItemAttunement } from "../../src/models/characters/characterInventory";
import { applyConsumableEffect } from "../../src/models/characters/characterConsumables";
import { consumeItemQuantity, isConsumableItemKind } from "../../src/models/items/itemConsumption";
import type { Itemmable } from "../../src/models/items/item";
import { getCharacterConditions, withCharacterConditions } from "../../src/models/characters/characterConditionStorage";
import { getCurrentMaxHp } from "../../src/models/characters/characterHp";
import { SessionActor as MagicSessionActor } from "./MagicSessionActor";
import { parseEquipmentClientMessage, type SessionEquipmentOperation } from "./equipmentProtocol";
import { MAX_HP_LOG_RECORDS } from "./hpState";
import type { SessionAbilityState } from "./abilityProtocol";
import type { SessionConditionsState, SessionConnection, SessionHpState } from "./protocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const HP_LOG_KEY = "hp-log";

type UnifiedLogRecord = {
  id: string;
  actorId: string;
  createdAt: string;
  operation: { type: string; characterId: string; [key: string]: unknown };
  reverseOperation: {
    type: "character.ability.restore";
    characterId: string;
    snapshot: {
      ability: SessionAbilityState;
      hp: SessionHpState;
      conditions: SessionConditionsState;
    };
  } | { type: string; characterId: string; [key: string]: unknown };
  undoneAt?: string;
  undoneBy?: string;
};

export class SessionActor extends MagicSessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseEquipmentClientMessage(raw);
    if (!parsed) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    await this.handleEquipmentOperation(webSocket, connection, parsed.operation);
  }

  private async handleEquipmentOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionEquipmentOperation,
  ): Promise<void> {
    const [abilityState, hpState, conditionsState, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY).then((value) => value ?? []),
    ]);

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];
    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      sendError(webSocket, "EQUIPMENT_STATE_NOT_INITIALIZED", "Equipment state for this character has not been initialized by the MASTER.");
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change equipment for this character.");
      return;
    }

    let current: CharacterTemplate;
    try {
      current = hydrateCharacter(storedAbility, hp, conditions);
    } catch {
      sendError(webSocket, "EQUIPMENT_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    let next: CharacterTemplate | null = null;
    try {
      next = applyEquipmentOperation(current, operation);
    } catch {
      next = null;
    }
    if (!next || JSON.stringify(current.toJSON()) === JSON.stringify(next.toJSON())) {
      sendError(webSocket, "EQUIPMENT_OPERATION_REJECTED", "The requested equipment operation is invalid for the current character state.");
      return;
    }

    const nextState: SessionAbilityState = {
      characterId: operation.characterId,
      character: next.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };
    const nextHp = extractHpState(next, hp);
    const nextConditions = extractConditionsState(next, conditions);
    const hpChanged = !sameHpRuntime(hp, nextHp);
    const conditionsChanged = JSON.stringify(conditions.conditions) !== JSON.stringify(nextConditions.conditions);

    abilityState[operation.characterId] = nextState;
    if (hpChanged) hpState[operation.characterId] = nextHp;
    if (conditionsChanged) conditionsState[operation.characterId] = nextConditions;

    log.push({
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation,
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: { ability: storedAbility, hp, conditions },
      },
    });
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilityState,
      ...(hpChanged ? { [HP_STATE_KEY]: hpState } : {}),
      ...(conditionsChanged ? { [CONDITIONS_STATE_KEY]: conditionsState } : {}),
      [HP_LOG_KEY]: nextLog,
    });

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
    if (hpChanged) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: nextHp });
    if (conditionsChanged) broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: nextConditions });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
  }
}

function applyEquipmentOperation(character: CharacterTemplate, operation: SessionEquipmentOperation): CharacterTemplate | null {
  switch (operation.type) {
    case "character.equipment.item.update":
      return updateEquippedItem(character, operation.reference as EquippedItemReference, operation.item as Itemmable);
    case "character.equipment.move":
      return moveEquippedItemToCharacterStorage(character, operation.reference as EquippedItemReference, operation.destination);
    case "character.equipment.attunement.toggle":
      return toggleInventoryItemAttunement(character, operation.itemId);
    case "character.equipment.pocket.unequip":
      return unequipPocketStack(character, operation.index);
    case "character.equipment.pocket.wield":
      return wieldPocketWeaponWithRules(character, operation.index);
    case "character.equipment.pocket.use":
      return usePocketItem(character, operation.index);
  }
}

function usePocketItem(character: CharacterTemplate, index: number): CharacterTemplate {
  const item = character.get("equipment").pockets[index];
  if (!item || !isConsumableItemKind(item)) return character;

  const withEffect = item.kind === "consumable" ? applyConsumableEffect(character, item) : character;
  const equipment = withEffect.get("equipment");
  const currentItem = equipment.pockets[index];
  if (!currentItem || !isConsumableItemKind(currentItem)) return character;
  const nextItem = consumeItemQuantity(currentItem);
  const pockets = nextItem
    ? equipment.pockets.map((entry, currentIndex) => currentIndex === index ? nextItem : entry)
    : equipment.pockets.filter((_, currentIndex) => currentIndex !== index);

  return withEffect.with("equipment", { ...equipment, pockets });
}

function updateEquippedItem(
  character: CharacterTemplate,
  reference: EquippedItemReference,
  item: Itemmable,
): CharacterTemplate {
  const current = getEquippedItem(character, reference);
  if (!current || current.id !== item.id) return character;
  const equipment = character.get("equipment");

  if (reference.type === "weapon") {
    return character.with("equipment", { ...equipment, weapons: equipment.weapons.map((entry) => entry.id === reference.itemId ? item as any : entry) });
  }
  if (reference.type === "shield") {
    return character.with("equipment", { ...equipment, shield: item as any });
  }
  if (reference.type === "held-item") {
    return character.with("equipment", { ...equipment, heldItems: (equipment.heldItems ?? []).map((entry) => entry.id === reference.itemId ? item : entry) });
  }
  if (reference.type === "slot") {
    return character.with("equipment", { ...equipment, [reference.slot]: item as any });
  }
  if (reference.type === "ring") {
    return character.with("equipment", { ...equipment, rings: equipment.rings.map((entry) => entry.id === reference.itemId ? item as any : entry) });
  }
  return character.with("equipment", { ...equipment, necklaces: (equipment.necklaces ?? []).map((entry) => entry.id === reference.itemId ? item as any : entry) });
}

function hydrateCharacter(state: SessionAbilityState, hp: SessionHpState, conditions: SessionConditionsState): CharacterTemplate {
  let character = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>);
  const sheet = character.get("sheet");
  character = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized ? { ...hp.savingThrows } : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
      HP: { ...sheet.HP, current: hp.current, temporary: hp.temporary, max: hp.max, currentMax: hp.currentMax },
    },
  });
  return withCharacterConditions(character, conditions.conditions as any);
}

function extractHpState(character: CharacterTemplate, previous: SessionHpState): SessionHpState {
  const hp = character.get("sheet").HP;
  const currentMax = getCurrentMaxHp(character);
  return {
    ...previous,
    current: hp.current,
    temporary: hp.temporary,
    max: hp.max,
    currentMax,
    maxHpBonus: character.getEffectiveMaxHp() - currentMax,
    revision: previous.revision + 1,
  };
}

function extractConditionsState(character: CharacterTemplate, previous: SessionConditionsState): SessionConditionsState {
  return {
    ...previous,
    conditions: getCharacterConditions(character) as any,
    revision: previous.revision + 1,
  };
}

function sameHpRuntime(left: SessionHpState, right: SessionHpState): boolean {
  return left.current === right.current && left.temporary === right.temporary && left.max === right.max && left.currentMax === right.currentMax && left.maxHpBonus === right.maxHpBonus;
}

function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection; } catch { return null; }
}
function sendError(webSocket: WebSocket, code: string, message: string): void {
  try { webSocket.send(JSON.stringify({ type: "session.error", code, message })); } catch {}
}
function broadcast(sockets: WebSocket[], message: unknown): void {
  const payload = JSON.stringify(message);
  for (const socket of sockets) { try { socket.send(payload); } catch {} }
}
function broadcastToMasters(sockets: WebSocket[], records: UnifiedLogRecord[]): void {
  const payload = JSON.stringify({ type: "session.hp.log", records });
  for (const socket of sockets) {
    const connection = readConnection(socket);
    if (connection?.role === "MASTER") { try { socket.send(payload); } catch {} }
  }
}
