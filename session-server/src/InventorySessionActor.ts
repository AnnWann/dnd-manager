import { CharacterTemplate, type CharacterTemplateProps } from "../../src/models/characters/CharacterTemplate";
import { consumeCharacterInventoryItem } from "../../src/models/characters/characterConsumables";
import { equipInventoryItemWithRules, type EquipmentDestination } from "../../src/models/characters/characterEquipmentInteractions";
import { equipInventoryStackWithRules } from "../../src/models/characters/characterInventoryStacks";
import { toggleInventoryItemAttunement } from "../../src/models/characters/characterInventory";
import { removeEquippedItem, type EquippedItemReference } from "../../src/models/characters/characterEquippedItemMovement";
import { getCharacterConditions, withCharacterConditions } from "../../src/models/characters/characterConditionStorage";
import { getCurrentMaxHp } from "../../src/models/characters/characterHp";
import { setCurrenciesInsideBagOfHolding } from "../../src/models/items/Currency";
import type { Itemmable } from "../../src/models/items/item";
import { applyGameOperation } from "../../src/models/game/applyGameOperation";
import type { AppStateV1 } from "../../src/lib/remoteState";
import { SessionActor as EquipmentSessionActor } from "./EquipmentSessionActor";
import { parseInventoryClientMessage, type SessionInventoryOperation } from "./inventoryProtocol";
import { MAX_HP_LOG_RECORDS } from "./hpState";
import type { SessionAbilityState } from "./abilityProtocol";
import type { SessionConditionsState, SessionConnection, SessionHpState } from "./protocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const INVENTORY_STATE_KEY = "inventory-state";
const HP_LOG_KEY = "hp-log";

type SharedInventoryState = {
  initialized: boolean;
  revision: number;
  partyInventory: Itemmable[];
  groundInventory: Itemmable[];
};

type InventoryReverseOperation = {
  type: "session.inventory.restore";
  characterId: string;
  snapshot: {
    abilities: Record<string, SessionAbilityState>;
    hp: Record<string, SessionHpState>;
    conditions: Record<string, SessionConditionsState>;
    inventory: SharedInventoryState;
  };
};

type UnifiedLogRecord = {
  id: string;
  actorId: string;
  createdAt: string;
  operation: { type: string; characterId: string; [key: string]: unknown };
  reverseOperation: { type: string; characterId: string; [key: string]: unknown };
  undoneAt?: string;
  undoneBy?: string;
};

export class SessionActor extends EquipmentSessionActor {
  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;
    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;
    const socket = this.ctx.getWebSockets().find((candidate) => readConnection(candidate)?.clientId === clientId);
    if (socket) await this.sendInventorySnapshot(socket);
    return response;
  }

  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const undoId = parseUndoLogId(raw);
    if (undoId && await this.tryInventoryUndo(webSocket, undoId)) return;

    const parsed = parseInventoryClientMessage(raw);
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

    if (parsed.type === "session.inventory.initialize") {
      if (connection.role !== "MASTER") return sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize inventory state.");
      const current = await this.readInventoryState();
      if (!current.initialized) {
        const state: SharedInventoryState = {
          initialized: true,
          revision: 0,
          partyInventory: parsed.partyInventory as Itemmable[],
          groundInventory: parsed.groundInventory as Itemmable[],
        };
        await this.ctx.storage.put(INVENTORY_STATE_KEY, state);
        broadcast(this.ctx.getWebSockets(), { type: "session.inventory.snapshot", state });
      } else {
        send(webSocket, { type: "session.inventory.snapshot", state: current });
      }
      return;
    }

    await this.handleInventoryOperation(webSocket, connection, parsed.operation);
  }

  private async handleInventoryOperation(webSocket: WebSocket, connection: SessionConnection, operation: SessionInventoryOperation): Promise<void> {
    const [abilities, hp, conditions, inventory, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((v) => v ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((v) => v ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((v) => v ?? {}),
      this.readInventoryState(),
      this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY).then((v) => v ?? []),
    ]);
    if (!inventory.initialized) return sendError(webSocket, "INVENTORY_STATE_NOT_INITIALIZED", "Inventory state has not been initialized by the MASTER.");

    const touchedIds = touchedCharacterIds(operation);
    for (const id of touchedIds) {
      const characterHp = hp[id];
      if (!abilities[id]?.initialized || !characterHp || !conditions[id]?.initialized) {
        return sendError(webSocket, "INVENTORY_CHARACTER_NOT_INITIALIZED", "A character required by this inventory operation is not initialized.");
      }
    }
    if (!canPerform(connection, operation, hp)) return sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot perform this inventory operation.");

    const beforeAbilities = pick(abilities, touchedIds);
    const beforeHp = pick(hp, touchedIds);
    const beforeConditions = pick(conditions, touchedIds);
    const beforeInventory = structuredClone(inventory);

    let result: ApplyResult | null = null;
    try { result = applyInventoryOperation(operation, abilities, hp, conditions, inventory); } catch { result = null; }
    if (!result || !result.changed) return sendError(webSocket, "INVENTORY_OPERATION_REJECTED", "The requested inventory operation is invalid for the current state.");

    const record: UnifiedLogRecord = {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation: operation as unknown as UnifiedLogRecord["operation"],
      reverseOperation: {
        type: "session.inventory.restore",
        characterId: operation.characterId,
        snapshot: { abilities: beforeAbilities, hp: beforeHp, conditions: beforeConditions, inventory: beforeInventory },
      } as unknown as UnifiedLogRecord["reverseOperation"],
    };
    log.push(record);
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilities,
      [HP_STATE_KEY]: hp,
      [CONDITIONS_STATE_KEY]: conditions,
      [INVENTORY_STATE_KEY]: inventory,
      [HP_LOG_KEY]: nextLog,
    });

    for (const id of result.changedCharacters) {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: abilities[id] });
      if (result.hpChanged.has(id)) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: hp[id] });
      if (result.conditionsChanged.has(id)) broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: conditions[id] });
    }
    if (result.sharedChanged) broadcast(this.ctx.getWebSockets(), { type: "session.inventory.updated", state: inventory });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
  }

  private async tryInventoryUndo(webSocket: WebSocket, logId: string): Promise<boolean> {
    const log = (await this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY)) ?? [];
    const index = log.findIndex((entry) => entry.id === logId);
    if (index < 0) return false;
    const reverse = log[index].reverseOperation as unknown as InventoryReverseOperation;
    if (reverse.type !== "session.inventory.restore" || !reverse.snapshot) return false;
    const connection = readConnection(webSocket);
    if (!connection) return true;
    if (connection.role !== "MASTER") { sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes."); return true; }
    const newer = log.slice(index + 1).some((entry) => !entry.undoneAt && entry.operation.type !== "character.hp.undo" && entry.reverseOperation.characterId === reverse.characterId);
    if (newer) { sendError(webSocket, "UNDO_NOT_LATEST", "Undo newer changes for this character first."); return true; }

    const [abilities, hp, conditions, inventory] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((v) => v ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((v) => v ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((v) => v ?? {}),
      this.readInventoryState(),
    ]);
    const currentIds = Object.keys(reverse.snapshot.abilities);
    const currentSnapshot = {
      abilities: pick(abilities, currentIds), hp: pick(hp, currentIds), conditions: pick(conditions, currentIds), inventory: structuredClone(inventory),
    };
    Object.assign(abilities, reverse.snapshot.abilities);
    Object.assign(hp, reverse.snapshot.hp);
    Object.assign(conditions, reverse.snapshot.conditions);
    const restoredInventory = reverse.snapshot.inventory;

    const now = new Date().toISOString();
    log[index] = { ...log[index], undoneAt: now, undoneBy: connection.userId };
    log.push({
      id: crypto.randomUUID(), actorId: connection.userId, createdAt: now,
      operation: { type: "character.hp.undo", characterId: reverse.characterId, sourceLogId: log[index].id },
      reverseOperation: { type: "session.inventory.restore", characterId: reverse.characterId, snapshot: currentSnapshot } as unknown as UnifiedLogRecord["reverseOperation"],
    });
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);
    await this.ctx.storage.put({ [ABILITIES_STATE_KEY]: abilities, [HP_STATE_KEY]: hp, [CONDITIONS_STATE_KEY]: conditions, [INVENTORY_STATE_KEY]: restoredInventory, [HP_LOG_KEY]: nextLog });
    for (const id of currentIds) {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: abilities[id] });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: hp[id] });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: conditions[id] });
    }
    broadcast(this.ctx.getWebSockets(), { type: "session.inventory.updated", state: restoredInventory });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
    return true;
  }

  private async readInventoryState(): Promise<SharedInventoryState> {
    return (await this.ctx.storage.get<SharedInventoryState>(INVENTORY_STATE_KEY)) ?? { initialized: false, revision: 0, partyInventory: [], groundInventory: [] };
  }
  private async sendInventorySnapshot(socket: WebSocket): Promise<void> { send(socket, { type: "session.inventory.snapshot", state: await this.readInventoryState() }); }
}

type ApplyResult = { changed: boolean; changedCharacters: Set<string>; hpChanged: Set<string>; conditionsChanged: Set<string>; sharedChanged: boolean };

function applyInventoryOperation(operation: SessionInventoryOperation, abilities: Record<string, SessionAbilityState>, hp: Record<string, SessionHpState>, conditions: Record<string, SessionConditionsState>, inventory: SharedInventoryState): ApplyResult {
  const changedCharacters = new Set<string>(); const hpChanged = new Set<string>(); const conditionsChanged = new Set<string>(); let sharedChanged = false;
  const updateCharacter = (id: string, updater: (c: CharacterTemplate) => CharacterTemplate | null) => {
    const beforeState = abilities[id]; const beforeHp = hp[id]; const beforeConditions = conditions[id];
    if (!beforeState || !beforeHp || !beforeConditions) return false;
    const before = hydrate(beforeState, beforeHp, beforeConditions); const after = updater(before); if (!after || JSON.stringify(before.toJSON()) === JSON.stringify(after.toJSON())) return false;
    abilities[id] = { characterId: id, character: after.toJSON() as unknown as Record<string, unknown>, initialized: true, revision: beforeState.revision + 1 };
    const nextHp = extractHp(after, beforeHp); const nextConditions = extractConditions(after, beforeConditions);
    if (!sameHp(beforeHp, nextHp)) { hp[id] = nextHp; hpChanged.add(id); }
    if (JSON.stringify(beforeConditions.conditions) !== JSON.stringify(nextConditions.conditions)) { conditions[id] = nextConditions; conditionsChanged.add(id); }
    changedCharacters.add(id); return true;
  };

  switch (operation.type) {
    case "character.inventory.item.add": return result(updateCharacter(operation.characterId, (c) => c.addInventoryItem(operation.item as Itemmable)));
    case "character.inventory.item.update": return result(updateCharacter(operation.characterId, (c) => c.updateInventoryItem(operation.itemId, () => operation.item as Itemmable)));
    case "character.inventory.item.remove": return result(updateCharacter(operation.characterId, (c) => c.removeInventoryItem(operation.itemId)));
    case "character.inventory.item.consume": return result(updateCharacter(operation.characterId, (c) => consumeCharacterInventoryItem(c, operation.itemId)));
    case "character.inventory.item.equip": return result(updateCharacter(operation.characterId, (c) => equipInventoryStackWithRules(c, operation.itemId, operation.destination as EquipmentDestination) ?? equipInventoryItemWithRules(c, operation.itemId, operation.destination as EquipmentDestination)));
    case "character.inventory.bag.toggle": return result(updateCharacter(operation.characterId, (c) => c.toggleInventoryItemBagOfHolding(operation.itemId)));
    case "character.inventory.currenciesBag.set": return result(updateCharacter(operation.characterId, (c) => c.with("inventory", setCurrenciesInsideBagOfHolding(c.get("inventory"), operation.insideBagOfHolding))));
    case "character.inventory.attunement.toggle": return result(updateCharacter(operation.characterId, (c) => toggleInventoryItemAttunement(c, operation.itemId)));
    case "character.equipment.move.ground": {
      const did = updateCharacter(operation.characterId, (c) => {
        const removed = removeEquippedItem(c, operation.reference as EquippedItemReference); if (!removed.item) return c;
        inventory.groundInventory.push({ ...removed.item, heldHands: undefined, insideBagOfHolding: false }); sharedChanged = true; inventory.revision += 1; return removed.character;
      }); return result(did);
    }
    case "party.item.add": inventory.partyInventory.push(operation.item as Itemmable); sharedChanged = true; inventory.revision += 1; return result(true);
    case "party.item.update": { const i = inventory.partyInventory.findIndex((x) => x.id === operation.itemId); if (i < 0) return result(false); inventory.partyInventory[i] = operation.item as Itemmable; sharedChanged = true; inventory.revision += 1; return result(true); }
    case "party.item.remove": { const n = inventory.partyInventory.filter((x) => x.id !== operation.itemId); if (n.length === inventory.partyInventory.length) return result(false); inventory.partyInventory = n; sharedChanged = true; inventory.revision += 1; return result(true); }
    case "ground.item.add": inventory.groundInventory.push(operation.item as Itemmable); sharedChanged = true; inventory.revision += 1; return result(true);
    case "ground.item.update": { const i = inventory.groundInventory.findIndex((x) => x.id === operation.itemId); if (i < 0) return result(false); inventory.groundInventory[i] = operation.item as Itemmable; sharedChanged = true; inventory.revision += 1; return result(true); }
    case "ground.item.remove": { const n = inventory.groundInventory.filter((x) => x.id !== operation.itemId); if (n.length === inventory.groundInventory.length) return result(false); inventory.groundInventory = n; sharedChanged = true; inventory.revision += 1; return result(true); }
    case "inventory.item.transfer": {
      const appState: AppStateV1 = { version: 1, activeCharacterId: "", characters: Object.values(abilities).filter((x) => x.initialized).map((x) => x.character as unknown as CharacterTemplateProps), partyInventory: inventory.partyInventory, groundInventory: inventory.groundInventory };
      const next = applyGameOperation(appState, { type: "inventory.item.transfer", request: operation.request });
      if (JSON.stringify(appState) === JSON.stringify(next)) return result(false);
      for (const raw of next.characters) {
        const old = abilities[raw.id]; if (!old || JSON.stringify(old.character) === JSON.stringify(raw)) continue;
        abilities[raw.id] = { ...old, character: raw as unknown as Record<string, unknown>, revision: old.revision + 1 }; changedCharacters.add(raw.id);
      }
      inventory.partyInventory = next.partyInventory ?? []; inventory.groundInventory = next.groundInventory ?? []; inventory.revision += 1; sharedChanged = true; return result(true);
    }
  }

  function result(changed: boolean): ApplyResult { return { changed, changedCharacters, hpChanged, conditionsChanged, sharedChanged }; }
}

function hydrate(state: SessionAbilityState, hp: SessionHpState, conditions: SessionConditionsState): CharacterTemplate {
  let c = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>); const sheet = c.get("sheet");
  c = c.withPatch({ sheet: { ...sheet, attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes, savingThrowProficiencies: hp.savingThrowsInitialized ? { ...hp.savingThrows } : sheet.savingThrowProficiencies, skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills, HP: { ...sheet.HP, current: hp.current, temporary: hp.temporary, max: hp.max, currentMax: hp.currentMax } } });
  return withCharacterConditions(c, conditions.conditions as any);
}
function extractHp(c: CharacterTemplate, previous: SessionHpState): SessionHpState { const v = c.get("sheet").HP; const currentMax = getCurrentMaxHp(c); return { ...previous, current: v.current, temporary: v.temporary, max: v.max, currentMax, maxHpBonus: c.getEffectiveMaxHp() - currentMax, revision: previous.revision + 1 }; }
function extractConditions(c: CharacterTemplate, previous: SessionConditionsState): SessionConditionsState { return { ...previous, conditions: getCharacterConditions(c) as any, revision: previous.revision + 1 }; }
function sameHp(a: SessionHpState, b: SessionHpState): boolean { return a.current === b.current && a.temporary === b.temporary && a.max === b.max && a.currentMax === b.currentMax && a.maxHpBonus === b.maxHpBonus; }
function touchedCharacterIds(op: SessionInventoryOperation): string[] { if (op.type !== "inventory.item.transfer") return op.characterId && op.characterId !== "session" ? [op.characterId] : []; const ids = new Set<string>(); if (op.request.from.type === "character") ids.add(op.request.from.characterId); if (op.request.to.type === "character") ids.add(op.request.to.characterId); return [...ids]; }
function canPerform(connection: SessionConnection, op: SessionInventoryOperation, hp: Record<string, SessionHpState>): boolean {
  if (connection.role === "MASTER") return true;
  if (op.type.startsWith("party.") || op.type.startsWith("ground.")) return false;
  if (op.type === "inventory.item.transfer") return op.request.from.type !== "character" || hp[op.request.from.characterId]?.ownerUserId === connection.userId;
  return hp[op.characterId]?.ownerUserId === connection.userId;
}
function pick<T>(source: Record<string, T>, ids: string[]): Record<string, T> { return Object.fromEntries(ids.flatMap((id) => source[id] ? [[id, structuredClone(source[id])]] : [])); }
function parseUndoLogId(raw: string): string | null { try { const v = JSON.parse(raw); return v?.type === "session.log.undo" && typeof v.logId === "string" ? v.logId : null; } catch { return null; } }
function readConnection(ws: WebSocket): SessionConnection | null { try { return ws.deserializeAttachment() as SessionConnection; } catch { return null; } }
function send(ws: WebSocket, value: unknown): void { try { ws.send(JSON.stringify(value)); } catch {} }
function sendError(ws: WebSocket, code: string, message: string): void { send(ws, { type: "session.error", code, message }); }
function broadcast(sockets: WebSocket[], value: unknown): void { const payload = JSON.stringify(value); for (const ws of sockets) try { ws.send(payload); } catch {} }
function broadcastToMasters(sockets: WebSocket[], records: UnifiedLogRecord[]): void { const payload = JSON.stringify({ type: "session.hp.log", records }); for (const ws of sockets) if (readConnection(ws)?.role === "MASTER") try { ws.send(payload); } catch {} }
