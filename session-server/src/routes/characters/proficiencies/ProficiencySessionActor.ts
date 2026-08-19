import { CharacterTemplate, type CharacterTemplateProps } from "../../../../../src/models/characters/CharacterTemplate";
import { getAbilityGrantedProficiencies } from "../../../../../src/models/characters/characterProficiencies";
import type { Proficiency } from "../../../../../src/models/sheet/Proficiency";
import { SessionActor as InventorySessionActor } from "../inventory/InventorySessionActor";
import { parseProficiencyClientMessage, type SessionProficiencyOperation } from "./proficiencyProtocol";
import { MAX_HP_LOG_RECORDS } from "../sheet/hpState";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
import type { SessionConnection, SessionHpState } from "../../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../../session/sessionLog";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";

export class SessionActor extends InventorySessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
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
      readSessionLog(this.ctx.storage),
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

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,
      reverseOperation: {
        type: "session.proficiency.restore",
        characterId: operation.characterId,
        snapshot: structuredClone(stored),
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [ABILITIES_STATE_KEY]: abilities },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
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

function readConnection(ws: WebSocket): SessionConnection | null {
  try { return ws.deserializeAttachment() as SessionConnection; }
  catch { return null; }
}
function send(ws: WebSocket, value: unknown): void {
  try { ws.send(JSON.stringify(value)); } catch {}
}
function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: "session.error", code, message });
}
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const ws of sockets) try { ws.send(payload); } catch {}
}
