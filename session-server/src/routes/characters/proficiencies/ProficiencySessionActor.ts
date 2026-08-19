import { CharacterTemplate, type CharacterTemplateProps } from "../../../../../src/models/characters/CharacterTemplate";
import { getAbilityGrantedProficiencies } from "../../../../../src/models/characters/characterProficiencies";
import type { Proficiency } from "../../../../../src/models/sheet/Proficiency";
import { SessionActor as InventorySessionActor } from "../inventory/InventorySessionActor";
import { parseProficiencyClientMessage, type SessionProficiencyOperation } from "./proficiencyProtocol";
import { MAX_HP_LOG_RECORDS } from "../sheet/hpState";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
import type { SessionConnection, SessionHpState } from "../../session/protocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const HP_LOG_KEY = "hp-log";

type ProficiencyReverseOperation = {
  type: "session.proficiency.restore";
  characterId: string;
  snapshot: SessionAbilityState;
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

export class SessionActor extends InventorySessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const undoId = parseUndoLogId(raw);
    if (undoId && await this.tryProficiencyUndo(webSocket, undoId)) return;

    const parsed = parseProficiencyClientMessage(raw);
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

    await this.handleOperation(webSocket, connection, parsed.operation);
  }

  private async handleOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionProficiencyOperation,
  ): Promise<void> {
    const [abilities, hp, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY).then((value) => value ?? []),
    ]);

    const stored = abilities[operation.characterId];
    const characterHp = hp[operation.characterId];
    if (!stored?.initialized || !characterHp) {
      sendError(webSocket, "PROFICIENCY_STATE_NOT_INITIALIZED", "Proficiency state for this character has not been initialized.");
      return;
    }
    if (connection.role !== "MASTER" && characterHp.ownerUserId !== connection.userId) {
      sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change proficiencies for this character.");
      return;
    }

    let character: CharacterTemplate;
    try {
      character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>);
    } catch {
      sendError(webSocket, "PROFICIENCY_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    const next = applyProficiencyOperation(character, operation);
    if (!next || JSON.stringify(character.toJSON()) === JSON.stringify(next.toJSON())) {
      sendError(webSocket, "PROFICIENCY_OPERATION_REJECTED", "The requested proficiency operation is invalid for the current state.");
      return;
    }

    const nextState: SessionAbilityState = {
      ...stored,
      character: next.toJSON() as unknown as Record<string, unknown>,
      revision: stored.revision + 1,
    };
    abilities[operation.characterId] = nextState;

    const record: UnifiedLogRecord = {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation: operation as unknown as UnifiedLogRecord["operation"],
      reverseOperation: {
        type: "session.proficiency.restore",
        characterId: operation.characterId,
        snapshot: structuredClone(stored),
      } as unknown as UnifiedLogRecord["reverseOperation"],
    };
    log.push(record);
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilities,
      [HP_LOG_KEY]: nextLog,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
  }

  private async tryProficiencyUndo(webSocket: WebSocket, logId: string): Promise<boolean> {
    const log = (await this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY)) ?? [];
    const index = log.findIndex((entry) => entry.id === logId);
    if (index < 0) return false;
    const reverse = log[index].reverseOperation as unknown as ProficiencyReverseOperation;
    if (reverse.type !== "session.proficiency.restore" || !reverse.snapshot) return false;

    const connection = readConnection(webSocket);
    if (!connection) return true;
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return true;
    }

    const newer = log.slice(index + 1).some((entry) =>
      !entry.undoneAt
      && entry.operation.type !== "character.hp.undo"
      && entry.reverseOperation.characterId === reverse.characterId,
    );
    if (newer) {
      sendError(webSocket, "UNDO_NOT_LATEST", "Undo newer changes for this character first.");
      return true;
    }

    const abilities = (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
    const current = abilities[reverse.characterId];
    if (!current) {
      sendError(webSocket, "PROFICIENCY_STATE_NOT_INITIALIZED", "The current proficiency state required for undo is missing.");
      return true;
    }

    const now = new Date().toISOString();
    log[index] = { ...log[index], undoneAt: now, undoneBy: connection.userId };
    log.push({
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId: reverse.characterId, sourceLogId: log[index].id },
      reverseOperation: {
        type: "session.proficiency.restore",
        characterId: reverse.characterId,
        snapshot: structuredClone(current),
      } as unknown as UnifiedLogRecord["reverseOperation"],
    });
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);
    abilities[reverse.characterId] = reverse.snapshot;

    await this.ctx.storage.put({ [ABILITIES_STATE_KEY]: abilities, [HP_LOG_KEY]: nextLog });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
    return true;
  }
}

function applyProficiencyOperation(
  character: CharacterTemplate,
  operation: SessionProficiencyOperation,
): CharacterTemplate | null {
  const current = character.get("sheet").proficiencies ?? [];
  if (operation.type === "character.proficiency.add") {
    const proficiency = normalizeProficiency(operation.proficiency);
    if (!proficiency || current.some((entry) => entry.id === proficiency.id)) return null;

    const racial = character.get("sheet").race.proficiencies ?? [];
    const abilityGranted = getAbilityGrantedProficiencies(character).map((entry) => entry.proficiency);
    const duplicate = [...current, ...racial, ...abilityGranted].some(
      (entry) => entry.category === proficiency.category
        && entry.name.trim().toLocaleLowerCase("pt-BR") === proficiency.name.toLocaleLowerCase("pt-BR"),
    );
    if (duplicate) return null;

    return character.withSheet("proficiencies", [...current, proficiency]);
  }

  if (!current.some((entry) => entry.id === operation.proficiencyId)) return null;
  return character.withSheet(
    "proficiencies",
    current.filter((entry) => entry.id !== operation.proficiencyId),
  );
}

function normalizeProficiency(proficiency: Proficiency): Proficiency | null {
  const id = proficiency.id.trim();
  const name = proficiency.name.trim();
  if (!id || !name) return null;
  const notes = proficiency.notes?.trim();
  return {
    id,
    name,
    category: proficiency.category,
    ...(notes ? { notes } : {}),
    ...(proficiency.expertise === true ? { expertise: true } : {}),
  };
}

function parseUndoLogId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; logId?: unknown };
    return value.type === "session.log.undo" && typeof value.logId === "string" ? value.logId : null;
  } catch { return null; }
}
function readConnection(ws: WebSocket): SessionConnection | null {
  try { return ws.deserializeAttachment() as SessionConnection; } catch { return null; }
}
function send(ws: WebSocket, value: unknown): void { try { ws.send(JSON.stringify(value)); } catch {} }
function sendError(ws: WebSocket, code: string, message: string): void { send(ws, { type: "session.error", code, message }); }
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const ws of sockets) try { ws.send(payload); } catch {}
}
function broadcastToMasters(sockets: WebSocket[], records: UnifiedLogRecord[]): void {
  const payload = JSON.stringify({ type: "session.hp.log", records });
  for (const ws of sockets) if (readConnection(ws)?.role === "MASTER") try { ws.send(payload); } catch {}
}
