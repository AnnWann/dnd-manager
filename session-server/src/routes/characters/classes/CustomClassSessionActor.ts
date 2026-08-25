import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../../src/models/characters/CharacterTemplate";
import {
  getCustomClassConfig,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../../../src/models/characters/customClassConfig";
import { SessionActor as ProfileSessionActor } from "../profile/ProfileSessionActor";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
import { MAX_HP_LOG_RECORDS } from "../sheet/hpState";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpState,
} from "../../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../../session/sessionLog";
import {
  parseCustomClassClientMessage,
  type SessionCustomClassOperation,
} from "./customClassProtocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const MAX_CONFIG_BYTES = 200_000;

export class SessionActor extends ProfileSessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseCustomClassClientMessage(raw);
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
    await this.handleCustomClassOperation(webSocket, connection, parsed.operation);
  }

  private async handleCustomClassOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionCustomClassOperation,
  ): Promise<void> {
    const [abilities, hpState, conditionsState, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      readSessionLog(this.ctx.storage),
    ]);

    const stored = abilities[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];
    if (!stored?.initialized || !hp || !conditions) {
      sendError(
        webSocket,
        "CUSTOM_CLASS_STATE_NOT_INITIALIZED",
        "Custom class state for this character has not been initialized.",
      );
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      sendError(
        webSocket,
        "CHARACTER_ACCESS_DENIED",
        "You cannot configure this character's custom class.",
      );
      return;
    }

    if (!isValidConfigPayload(operation.config)) {
      sendError(webSocket, "CUSTOM_CLASS_CONFIG_INVALID", "The custom class configuration is invalid.");
      return;
    }

    let character: CharacterTemplate;
    try {
      character = CharacterTemplate.fromJSON(
        stored.character as Partial<CharacterTemplateProps>,
      );
    } catch {
      sendError(
        webSocket,
        "CUSTOM_CLASS_STATE_INVALID",
        "The authoritative character snapshot is invalid.",
      );
      return;
    }

    if (!getCustomClassConfig(character)) {
      sendError(
        webSocket,
        "CUSTOM_CLASS_NOT_FOUND",
        "This character does not have a custom class to configure.",
      );
      return;
    }

    const normalized = normalizeCustomClassConfig(operation.config);
    const next = updateCustomClassConfig(character, normalized);
    if (JSON.stringify(character.toJSON()) === JSON.stringify(next.toJSON())) {
      sendError(
        webSocket,
        "CUSTOM_CLASS_OPERATION_REJECTED",
        "The requested custom class configuration did not change the character.",
      );
      return;
    }

    const nextAbility: SessionAbilityState = {
      ...stored,
      character: next.toJSON() as unknown as Record<string, unknown>,
      revision: stored.revision + 1,
    };
    abilities[operation.characterId] = nextAbility;

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: {
        ...operation,
        config: normalized,
      },
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: structuredClone(stored),
          hp: structuredClone(hp),
          conditions: structuredClone(conditions),
        },
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [ABILITIES_STATE_KEY]: abilities },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });

    broadcast(this.ctx.getWebSockets(), {
      type: "session.abilities.updated",
      character: nextAbility,
    });
  }
}

function isValidConfigPayload(config: CustomClassRuntimeConfig): boolean {
  let serialized = "";
  try {
    serialized = JSON.stringify(config);
  } catch {
    return false;
  }
  if (!serialized || serialized.length > MAX_CONFIG_BYTES) return false;
  if (typeof config.name !== "string" || !config.name.trim() || config.name.trim().length > 120) return false;
  if (!["d4", "d6", "d8", "d10", "d12"].includes(config.hitDie)) return false;
  if (!Array.isArray(config.savingThrows) || config.savingThrows.length > 6) return false;
  if (!Number.isFinite(config.skillChoices) || config.skillChoices < 0 || config.skillChoices > 18) return false;
  if (!["none", "full", "half", "third"].includes(config.casterType)) return false;
  if (!["str", "dex", "con", "int", "wis", "cha"].includes(config.castingAttribute)) return false;
  if (!["limited", "spellbook", "prepared-only"].includes(config.knownSpellMode)) return false;
  if (!Number.isFinite(config.knownAtLevel1) || config.knownAtLevel1 < 0) return false;
  if (!Number.isFinite(config.knownPerLevel) || config.knownPerLevel < 0) return false;
  if (!["formula", "table"].includes(config.slotProgressionMode)) return false;
  if (!config.spellSlotProgression || typeof config.spellSlotProgression !== "object") return false;
  if (!Array.isArray(config.additionalSlotPools) || config.additionalSlotPools.length > 20) return false;
  return config.additionalSlotPools.every((pool) =>
    Boolean(pool)
    && typeof pool.id === "string"
    && pool.id.length > 0
    && pool.id.length <= 120
    && typeof pool.name === "string"
    && pool.name.length <= 120
    && (pool.recovery === "short" || pool.recovery === "long")
    && Boolean(pool.progression)
    && typeof pool.progression === "object"
  );
}

function readConnection(ws: WebSocket): SessionConnection | null {
  try {
    return ws.deserializeAttachment() as SessionConnection;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, value: unknown): void {
  try {
    ws.send(JSON.stringify(value));
  } catch {}
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: "session.error", code, message });
}

function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {}
  }
}
