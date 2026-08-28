import { getBackgroundPresetStartingEquipment } from "./backgroundPresetEquipment";
import type { CharacterBackground } from "../../../../../src/models/characters/CharacterBackground";
import { CharacterTemplate, type CharacterTemplateProps } from "../../../../../src/models/characters/CharacterTemplate";
import {
  withCharacterBackground,
  withoutCharacterBackground,
} from "../../../../../src/models/characters/characterBackgroundStorage";
import type { CharacterProfile } from "../../../../../src/models/characters/characterProfile";
import type { Proficiency } from "../../../../../src/models/sheet/Proficiency";
import { SessionActor as RaceSessionActor } from "../race/RaceSessionActor";
import { parseProfileClientMessage, type SessionProfileOperation } from "./profileProtocol";
import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../sheet/characterState";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
import type { SessionConnection, SessionHpState, SessionSkillsState } from "../../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
  type SessionLogRecord,
} from "../../session/sessionLog";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const PROFILE_LOG_COALESCE_MS = 1500;

export class SessionActor extends RaceSessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
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
    await this.handleProfileOperation(webSocket, connection, parsed.operation);
  }

  private async handleProfileOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionProfileOperation,
  ): Promise<void> {
    const [abilities, hpState, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      readSessionLog(this.ctx.storage),
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
    try {
      character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>);
    } catch {
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
    const record = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation,
      reverseOperation: {
        type: "session.profile.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: structuredClone(stored),
          hp: structuredClone(hp),
        },
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: {
        [ABILITIES_STATE_KEY]: abilities,
        ...(hpChanged ? { [HP_STATE_KEY]: hpState } : {}),
      },
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
      coalesceLatest: (previous, incoming) => canCoalesceProfileLog(previous, incoming, now),
    });

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
    if (hpChanged) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: applied.hp });
  }
}

function canCoalesceProfileLog(
  previous: SessionLogRecord,
  incoming: SessionLogRecord,
  now: string,
): boolean {
  if (incoming.operation.type !== "character.profile.replace") return false;
  if (previous.undoneAt) return false;
  if (previous.actorId !== incoming.actorId) return false;
  if (previous.operation.type !== "character.profile.replace") return false;
  if (previous.operation.characterId !== incoming.operation.characterId) return false;
  if (previous.reverseOperation.type !== "session.profile.restore") return false;
  const previousTime = new Date(previous.createdAt).getTime();
  const nextTime = new Date(now).getTime();
  return Number.isFinite(previousTime)
    && Number.isFinite(nextTime)
    && nextTime - previousTime <= PROFILE_LOG_COALESCE_MS;
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

  const presetEquipment = getBackgroundPresetStartingEquipment(background.id);
  if (operation.addEquipment && !presetEquipment) {
    return invalid("BACKGROUND_EQUIPMENT_NOT_ALLOWED", "Starting equipment can only be granted from a known background preset.");
  }

  const safeBackground: CharacterBackground = presetEquipment
    ? {
        ...background,
        startingEquipment: presetEquipment.map((item) => ({ ...item })),
      }
    : { ...background, startingEquipment: [] };

  let next = withCharacterBackground(character, safeBackground);
  const sheet = next.get("sheet");
  const skills: SessionSkillsState = { ...hp.skills };
  for (const skill of safeBackground.skillProficiencies) {
    if (skills[skill] !== "expertise") skills[skill] = "proficient";
  }
  const proficiencies = mergeProficiencies(sheet.proficiencies ?? [], safeBackground.proficiencies);
  const inventory = operation.addEquipment && presetEquipment
    ? [
        ...next.get("inventory"),
        ...presetEquipment.map((item) => ({
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
