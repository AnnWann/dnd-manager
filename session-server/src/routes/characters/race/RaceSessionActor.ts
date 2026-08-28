import { CharacterTemplate, type CharacterTemplateProps } from "../../../../../src/models/characters/CharacterTemplate";
import type { CharacterRace } from "../../../../../src/models/races/CharacterRace";
import { SessionActor as ProficiencySessionActor } from "../proficiencies/ProficiencySessionActor";
import { parseRaceClientMessage, type SessionRaceOperation } from "./raceProtocol";
import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../sheet/characterState";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
import type {
  SessionConnection,
  SessionHpState,
  SessionSavingThrowsState,
  SessionSkillsState,
} from "../../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../../session/sessionLog";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";

export class SessionActor extends ProficiencySessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseRaceClientMessage(raw);
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
    await this.handleRaceOperation(webSocket, connection, parsed.operation);
  }

  private async handleRaceOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionRaceOperation,
  ): Promise<void> {
    const [abilities, hpState, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      readSessionLog(this.ctx.storage),
    ]);

    const stored = abilities[operation.characterId];
    const hp = hpState[operation.characterId];
    if (!stored?.initialized || !hp) {
      sendError(webSocket, "RACE_STATE_NOT_INITIALIZED", "Race state for this character has not been initialized.");
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change this character's race.");
      return;
    }

    let character: CharacterTemplate;
    try {
      character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>);
    } catch {
      sendError(webSocket, "RACE_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    let next: CharacterTemplate;
    let nextHp = hp;
    let hpChanged = false;

    if (operation.type === "character.race.spells.replace") {
      const magic = character.getOrCreateMagic();
      const nonRacial = magic.spells.knownSpells.filter((entry) => entry.source.type !== "race");
      const racialSpells = operation.racialSpells as unknown as typeof magic.spells.knownSpells;
      if (racialSpells.some((entry) => entry.source.type !== "race" || !entry.spells?.id)) {
        sendError(webSocket, "RACE_SPELLS_INVALID", "All racial spell entries must belong to the race source.");
        return;
      }
      const ids = racialSpells.map((entry) => entry.spells.id);
      if (new Set(ids).size !== ids.length) {
        sendError(webSocket, "RACE_SPELLS_DUPLICATED", "Racial spell entries cannot contain duplicate spell ids.");
        return;
      }
      next = character.with("magic", {
        ...magic,
        spells: { ...magic.spells, knownSpells: [...nonRacial, ...racialSpells] },
      });
    } else {
      const race = normalizeRace(operation.race);
      const skills = normalizeSkills(operation.skills, hp.skills);
      const savingThrows = normalizeSavingThrows(operation.savingThrowProficiencies, hp.savingThrows);
      if (!race || !skills || !savingThrows) {
        sendError(webSocket, "RACE_OPERATION_INVALID", "The requested race state is invalid.");
        return;
      }

      next = character
        .withSheet("race", race)
        .withSheet("skills", skills)
        .withSheet("savingThrowProficiencies", savingThrows);
      nextHp = {
        ...hp,
        skills,
        skillsInitialized: true,
        savingThrows,
        savingThrowsInitialized: true,
        revision: hp.revision + 1,
      };
      hpChanged = true;
    }

    if (JSON.stringify(character.toJSON()) === JSON.stringify(next.toJSON())) {
      sendError(webSocket, "RACE_OPERATION_REJECTED", "The requested race operation did not change the character.");
      return;
    }

    const nextAbility: SessionAbilityState = {
      ...stored,
      character: next.toJSON() as unknown as Record<string, unknown>,
      revision: stored.revision + 1,
    };
    abilities[operation.characterId] = nextAbility;
    if (hpChanged) hpState[operation.characterId] = nextHp;

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,
      reverseOperation: {
        type: "session.race.restore",
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
    });

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextAbility });
    if (hpChanged) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: nextHp });
  }
}

function normalizeRace(value: CharacterRace): CharacterRace | null {
  if (!value || typeof value !== "object" || typeof value.race !== "string" || typeof value.subrace !== "string") return null;
  if (!Array.isArray(value.naturalAbilities) || !Array.isArray(value.proficiencies) || !value.attributeBonus || typeof value.attributeBonus !== "object") return null;
  const abilityIds = value.naturalAbilities.map((ability) => ability.id).filter(Boolean);
  if (new Set(abilityIds).size !== abilityIds.length) return null;
  const proficiencyIds = value.proficiencies.map((entry) => entry.id).filter(Boolean);
  if (new Set(proficiencyIds).size !== proficiencyIds.length) return null;
  if (value.mobility !== undefined && (!Number.isFinite(value.mobility) || value.mobility < 0)) return null;
  return structuredClone(value);
}

function normalizeSkills(
  value: Partial<Record<string, string>>,
  fallback: SessionSkillsState,
): SessionSkillsState | null {
  const allowed = new Set(["none", "proficient", "expertise"]);
  const next = { ...fallback } as Record<string, string>;
  for (const [key, candidate] of Object.entries(value)) {
    if (!(key in fallback) || typeof candidate !== "string" || !allowed.has(candidate)) return null;
    next[key] = candidate;
  }
  return next as SessionSkillsState;
}

function normalizeSavingThrows(
  value: Partial<Record<string, boolean>>,
  fallback: SessionSavingThrowsState,
): SessionSavingThrowsState | null {
  const next = { ...fallback };
  for (const [key, candidate] of Object.entries(value)) {
    if (!(key in fallback) || typeof candidate !== "boolean") return null;
    next[key as keyof SessionSavingThrowsState] = candidate;
  }
  return next;
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
