import { PHB_BACKGROUND_PRESETS } from "../../src/data/characterCreation/phbPresets";
import type { CharacterBackground } from "../../src/models/characters/CharacterBackground";
import { CharacterTemplate, type CharacterTemplateProps } from "../../src/models/characters/CharacterTemplate";
import {
  withCharacterBackground,
  withoutCharacterBackground,
} from "../../src/models/characters/characterBackgroundStorage";
import type { CharacterProfile } from "../../src/models/characters/characterProfile";
import type { Proficiency } from "../../src/models/sheet/Proficiency";
import { SessionActor as RaceSessionActor } from "./RaceSessionActor";
import { parseProfileClientMessage, type SessionProfileOperation } from "./profileProtocol";
import { MAX_HP_LOG_RECORDS } from "./hpState";
import type { SessionAbilityState } from "./abilityProtocol";
import type { SessionConnection, SessionHpState } from "./protocol";

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

    const applied = applyProfileOperation(character, hp, operation);
    if (!applied.ok) {
      sendError(webSocket, applied.code, applied.message);
      return;
    }
    if (JSON.stringify(character.toJSON()) === JSON.stringify(applied.character.toJSON())) return;

    const nextState: SessionAbilityState = {
      ...stored,
      character: applied.character.toJSON() as unknown as Record<string, unknown>,
      revision: stored.revision + 1,
    };
    abilities[operation.characterId] = nextState;
    const hpChanged = JSON.stringify(hp.skills) !== JSON.stringify(applied.hp.skills);
    if (hpChanged) hpState[operation.characterId] = applied.hp;

    const now = new Date().toISOString();
    const previous = log[log.length - 1];
    const canCoalesce = Boolean(
      operation.type === "character.profile.replace"
      && previous && !previous.undoneAt
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
      ...(hpChanged ? { [HP_STATE_KEY]: hpState } : {}),
      [HP_LOG_KEY]: nextLog,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
    if (hpChanged) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: applied.hp });
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

type ProfileApplyResult =
  | { ok: true; character: CharacterTemplate; hp: SessionHpState }
  | { ok: false; code: string; message: string };

function applyProfileOperation(
  character: CharacterTemplate,
  hp: SessionHpState,
  operation: SessionProfileOperation,
): ProfileApplyResult {
  if (operation.type === "character.profile.replace") {
    const profile = normalizeProfile(operation.profile);
    if (!profile) return invalid("PROFILE_OPERATION_INVALID", "The requested profile state is invalid.");
    const currentBackground = character.get("profile").background;
    const { background: _incomingBackground, ...profileWithoutBackground } = profile;
    const nextProfile = currentBackground
      ? { ...profileWithoutBackground, background: currentBackground }
      : profileWithoutBackground;
    return { ok: true, character: character.with("profile", nextProfile), hp };
  }

  if (operation.type === "character.profile.background.remove") {
    return { ok: true, character: withoutCharacterBackground(character), hp };
  }

  const background = normalizeBackground(operation.background);
  if (!background) return invalid("BACKGROUND_INVALID", "The requested background is invalid.");

  const preset = PHB_BACKGROUND_PRESETS.find((entry) => entry.id === background.id);
  if (operation.addEquipment && !preset) {
    return invalid("BACKGROUND_EQUIPMENT_NOT_ALLOWED", "Starting equipment can only be granted from a known background preset.");
  }

  const safeBackground: CharacterBackground = preset
    ? {
        ...background,
        startingEquipment: preset.startingEquipment.map((item) => ({ ...item })),
      }
    : { ...background, startingEquipment: [] };

  let next = withCharacterBackground(character, safeBackground);
  const sheet = next.get("sheet");
  const skills = { ...sheet.skills };
  for (const skill of safeBackground.skillProficiencies) {
    if (skills[skill] !== "expertise") skills[skill] = "proficient";
  }
  const proficiencies = mergeProficiencies(sheet.proficiencies ?? [], safeBackground.proficiencies);
  const inventory = operation.addEquipment && preset
    ? [
        ...next.get("inventory"),
        ...preset.startingEquipment.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          desc: item.desc || `Equipamento inicial do antecedente ${safeBackground.name}.`,
        })),
      ]
    : next.get("inventory");

  next = next.withPatch({
    sheet: { ...sheet, skills, proficiencies },
    inventory,
  });
  const nextHp: SessionHpState = JSON.stringify(hp.skills) === JSON.stringify(skills)
    ? hp
    : { ...hp, skills, skillsInitialized: true, revision: hp.revision + 1 };
  return { ok: true, character: next, hp: nextHp };
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

function normalizeBackground(background: CharacterBackground): CharacterBackground | null {
  if (!background || typeof background.id !== "string" || typeof background.name !== "string" || !background.name.trim()) return null;
  if (!Array.isArray(background.skillProficiencies) || !Array.isArray(background.proficiencies) || !Array.isArray(background.startingEquipment)) return null;
  return structuredClone(background);
}

function mergeProficiencies(current: Proficiency[], incoming: Proficiency[]): Proficiency[] {
  const result = [...current];
  for (const proficiency of incoming) {
    const duplicate = result.some((entry) =>
      entry.category === proficiency.category
      && entry.name.trim().toLocaleLowerCase("pt-BR") === proficiency.name.trim().toLocaleLowerCase("pt-BR"),
    );
    if (!duplicate) result.push(structuredClone(proficiency));
  }
  return result;
}

function invalid(code: string, message: string): ProfileApplyResult {
  return { ok: false, code, message };
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
