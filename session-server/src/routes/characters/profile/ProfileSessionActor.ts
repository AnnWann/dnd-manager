import { CharacterTemplate, type CharacterTemplateProps } from "../../src/models/characters/CharacterTemplate";
import type { CharacterProfile } from "../../src/models/characters/characterProfile";
import type { Itemmable } from "../../src/models/items/item";
import type { Proficiency } from "../../src/models/sheet/Proficiency";
import { SessionActor as RaceSessionActor } from "./RaceSessionActor";
import { parseProfileClientMessage, type SessionProfileOperation } from "./profileProtocol";
import { MAX_HP_LOG_RECORDS } from "./hpState";
import type { SessionAbilityState } from "./abilityProtocol";
import type { SessionConnection, SessionHpState, SessionSkillsState } from "./protocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const HP_LOG_KEY = "hp-log";
const PROFILE_LOG_COALESCE_MS = 1500;

type ProfileReverseOperation = {
  type: "session.profile.restore";
  characterId: string;
  snapshot: { ability: SessionAbilityState; hp: SessionHpState };
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

export class SessionActor extends RaceSessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const undoId = parseUndoLogId(raw);
    if (undoId && await this.tryProfileUndo(webSocket, undoId)) return;

    const parsed = parseProfileClientMessage(raw);
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

  private async handleOperation(webSocket: WebSocket, connection: SessionConnection, operation: SessionProfileOperation): Promise<void> {
    const [abilities, hpState, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY).then((value) => value ?? []),
    ]);
    const stored = abilities[operation.characterId];
    const hp = hpState[operation.characterId];
    if (!stored?.initialized || !hp) {
      sendError(webSocket, "PROFILE_STATE_NOT_INITIALIZED", "Profile state for this character has not been initialized.");
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change this character's profile.");
      return;
    }

    let character: CharacterTemplate;
    try { character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>); }
    catch {
      sendError(webSocket, "PROFILE_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    const profile = normalizeProfile(operation.profile);
    const inventory = normalizeInventory(operation.inventory);
    const skills = normalizeSkills(operation.skills, hp.skills);
    const proficiencies = normalizeProficiencies(operation.proficiencies);
    if (!profile || !inventory || !skills || !proficiencies) {
      sendError(webSocket, "PROFILE_OPERATION_INVALID", "The requested profile/background state is invalid.");
      return;
    }

    const next = character
      .with("profile", profile)
      .with("inventory", inventory)
      .withSheet("skills", skills)
      .withSheet("proficiencies", proficiencies);
    if (JSON.stringify(character.toJSON()) === JSON.stringify(next.toJSON())) return;

    const skillsChanged = JSON.stringify(hp.skills) !== JSON.stringify(skills);
    const nextHp: SessionHpState = skillsChanged
      ? { ...hp, skills, skillsInitialized: true, revision: hp.revision + 1 }
      : hp;
    const nextState: SessionAbilityState = {
      ...stored,
      character: next.toJSON() as unknown as Record<string, unknown>,
      revision: stored.revision + 1,
    };
    abilities[operation.characterId] = nextState;
    if (skillsChanged) hpState[operation.characterId] = nextHp;

    const now = new Date().toISOString();
    const previous = log[log.length - 1];
    const canCoalesce = Boolean(
      previous && !previous.undoneAt
      && previous.actorId === connection.userId
      && previous.operation.type === "character.profile.replace"
      && previous.operation.characterId === operation.characterId
      && Date.now() - new Date(previous.createdAt).getTime() <= PROFILE_LOG_COALESCE_MS
      && previous.reverseOperation.type === "session.profile.restore",
    );

    if (canCoalesce) {
      log[log.length - 1] = {
        ...previous,
        createdAt: now,
        operation: operation as unknown as UnifiedLogRecord["operation"],
      };
    } else {
      log.push({
        id: crypto.randomUUID(), actorId: connection.userId, createdAt: now,
        operation: operation as unknown as UnifiedLogRecord["operation"],
        reverseOperation: {
          type: "session.profile.restore",
          characterId: operation.characterId,
          snapshot: { ability: structuredClone(stored), hp: structuredClone(hp) },
        } as unknown as UnifiedLogRecord["reverseOperation"],
      });
    }
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilities,
      ...(skillsChanged ? { [HP_STATE_KEY]: hpState } : {}),
      [HP_LOG_KEY]: nextLog,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
    if (skillsChanged) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: nextHp });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
  }

  private async tryProfileUndo(webSocket: WebSocket, logId: string): Promise<boolean> {
    const log = (await this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY)) ?? [];
    const index = log.findIndex((entry) => entry.id === logId);
    if (index < 0) return false;
    const reverse = log[index].reverseOperation as unknown as ProfileReverseOperation;
    if (reverse.type !== "session.profile.restore" || !reverse.snapshot) return false;

    const connection = readConnection(webSocket);
    if (!connection) return true;
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return true;
    }
    if (log[index].undoneAt || log[index].operation.type === "character.hp.undo") {
      sendError(webSocket, "UNDO_NOT_AVAILABLE", "This profile change cannot be undone.");
      return true;
    }
    const newer = log.slice(index + 1).some((entry) =>
      !entry.undoneAt && entry.operation.type !== "character.hp.undo" && entry.reverseOperation.characterId === reverse.characterId,
    );
    if (newer) {
      sendError(webSocket, "UNDO_NOT_LATEST", "Undo newer changes for this character first.");
      return true;
    }

    const [abilities, hpState] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
    ]);
    const currentAbility = abilities[reverse.characterId];
    const currentHp = hpState[reverse.characterId];
    if (!currentAbility || !currentHp) {
      sendError(webSocket, "PROFILE_STATE_NOT_INITIALIZED", "The current profile state required for undo is missing.");
      return true;
    }

    const now = new Date().toISOString();
    log[index] = { ...log[index], undoneAt: now, undoneBy: connection.userId };
    log.push({
      id: crypto.randomUUID(), actorId: connection.userId, createdAt: now,
      operation: { type: "character.hp.undo", characterId: reverse.characterId, sourceLogId: log[index].id },
      reverseOperation: {
        type: "session.profile.restore", characterId: reverse.characterId,
        snapshot: { ability: structuredClone(currentAbility), hp: structuredClone(currentHp) },
      } as unknown as UnifiedLogRecord["reverseOperation"],
    });
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);
    abilities[reverse.characterId] = reverse.snapshot.ability;
    hpState[reverse.characterId] = reverse.snapshot.hp;
    await this.ctx.storage.put({ [ABILITIES_STATE_KEY]: abilities, [HP_STATE_KEY]: hpState, [HP_LOG_KEY]: nextLog });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot.ability });
    broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: reverse.snapshot.hp });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
    return true;
  }
}

function normalizeProfile(profile: CharacterProfile): CharacterProfile | null {
  if (!profile || typeof profile !== "object") return null;
  if (typeof profile.traits !== "string" || typeof profile.history !== "string" || typeof profile.physicalAppearance !== "string") return null;
  if (!Array.isArray(profile.relationships)) return null;
  const ids = new Set<string>();
  for (const relationship of profile.relationships) {
    if (!relationship || typeof relationship.id !== "string" || !relationship.id.trim() || ids.has(relationship.id)) return null;
    if (typeof relationship.name !== "string" || typeof relationship.relation !== "string") return null;
    if (relationship.description !== undefined && typeof relationship.description !== "string") return null;
    ids.add(relationship.id);
  }
  if (profile.imageUrl !== undefined && (typeof profile.imageUrl !== "string" || profile.imageUrl.length > 4096)) return null;
  return structuredClone(profile);
}

function normalizeInventory(items: Itemmable[]): Itemmable[] | null {
  if (!Array.isArray(items)) return null;
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) return null;
    if (typeof item.name !== "string" || !item.name.trim()) return null;
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    ids.add(item.id);
  }
  return structuredClone(items);
}

function normalizeSkills(value: Record<string, string>, fallback: SessionSkillsState): SessionSkillsState | null {
  const allowed = new Set(["none", "proficient", "expertise"]);
  const next = { ...fallback } as Record<string, string>;
  for (const key of Object.keys(fallback)) {
    const candidate = value[key];
    if (typeof candidate !== "string" || !allowed.has(candidate)) return null;
    next[key] = candidate;
  }
  return next as SessionSkillsState;
}

function normalizeProficiencies(values: Proficiency[]): Proficiency[] | null {
  if (!Array.isArray(values)) return null;
  const ids = new Set<string>();
  for (const value of values) {
    if (!value || typeof value.id !== "string" || !value.id.trim() || ids.has(value.id)) return null;
    if (typeof value.name !== "string" || !value.name.trim() || typeof value.category !== "string") return null;
    ids.add(value.id);
  }
  return structuredClone(values);
}

function parseUndoLogId(raw: string): string | null {
  try { const value = JSON.parse(raw) as { type?: unknown; logId?: unknown }; return value.type === "session.log.undo" && typeof value.logId === "string" ? value.logId : null; }
  catch { return null; }
}
function readConnection(ws: WebSocket): SessionConnection | null { try { return ws.deserializeAttachment() as SessionConnection; } catch { return null; } }
function send(ws: WebSocket, value: unknown): void { try { ws.send(JSON.stringify(value)); } catch {} }
function sendError(ws: WebSocket, code: string, message: string): void { send(ws, { type: "session.error", code, message }); }
function broadcast(sockets: WebSocket[], value: unknown): void { const payload = JSON.stringify(value); for (const ws of sockets) try { ws.send(payload); } catch {} }
function broadcastToMasters(sockets: WebSocket[], records: UnifiedLogRecord[]): void {
  const payload = JSON.stringify({ type: "session.hp.log", records });
  for (const ws of sockets) if (readConnection(ws)?.role === "MASTER") try { ws.send(payload); } catch {}
}
