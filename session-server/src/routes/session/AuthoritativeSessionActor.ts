import { SessionActor as ComposedSessionActor } from "./ComposedSessionActor";
import { SessionActor as MissionSessionActor, MISSIONS_SHARED_SCOPE, MISSIONS_STATE_KEY, readMissionState } from "../missions/MissionSessionActor";
import { parseMissionClientMessage, type SessionMissionState } from "../missions/missionProtocol";
import { SessionActor as InitiativeSessionActor, INITIATIVE_SHARED_SCOPE, INITIATIVE_STATE_KEY, readInitiativeState } from "../initiative/InitiativeSessionActor";
import { parseInitiativeClientMessage, type SessionInitiativeState } from "../initiative/initiativeProtocol";
import { normalizeInitiativeSession } from "../../../../src/models/initiative/Initiative";
import { projectInitiativeSessionFromCharacterState } from "../initiative/initiativeCharacterProjection";
import { projectInitiativeSessionFromCreatureState } from "../initiative/initiativeCreatureProjection";
import { SessionActor as CustomSystemSessionActor } from "../characters/custom-systems/CustomSystemSessionActor";
import { parseCustomSystemClientMessage } from "../characters/custom-systems/customSystemProtocol";
import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../characters/sheet/characterState";
import type { SessionConditionsState, SessionConnection, SessionHpState } from "./protocol";
import { parseRuntimeConfigPublishMessage } from "./runtimeConfigProtocol";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import { reconcileConfiguredCustomSystemStates } from "../../../../src/lib/customSystems/CustomSystemConfigurationReconciliation";
import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import {
  RUNTIME_CONFIG_STATE_KEY,
  authorizeCharacterMutation,
  extractOperationCharacterId,
  readRuntimeConfig,
  visibleRuntimeConfigSnapshot,
} from "./runtimeConfigAccess";
import {
  broadcastAllVisibleCharacterSnapshots,
  broadcastVisibilityFiltered,
  refreshAllConnectionVisibility,
} from "./visibilityDelivery";
import {
  commitSessionUndo,
  createSessionLogRecord,
  readSessionLog,
  validateUndoOrdering,
} from "./sessionLog";

export { RUNTIME_CONFIG_STATE_KEY } from "./runtimeConfigAccess";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";

type SharedDomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

type MissionReverse = {
  type: "session.missions.restore";
  characterId: "session";
  affectedScopes?: string[];
  snapshot: SessionMissionState;
};

type InitiativeReverse = {
  type: "session.initiative.restore";
  characterId: "session";
  affectedScopes?: string[];
  snapshot: SessionInitiativeState;
  abilities?: Record<string, SessionAbilityState>;
  hp?: Record<string, SessionHpState>;
  conditions?: Record<string, SessionConditionsState>;
};

type SharedReverse = MissionReverse | InitiativeReverse;

/** Final shared-domain boundary layered over the composed character authority. */
export class SessionActor extends ComposedSessionActor {
  private readonly missionRoute = bindDomainActor(MissionSessionActor.prototype, this.ctx);
  private readonly initiativeRoute = bindDomainActor(InitiativeSessionActor.prototype, this.ctx);
  private readonly customSystemRoute = bindDomainActor(CustomSystemSessionActor.prototype, this.ctx);

  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;
    const socket = this.ctx.getWebSockets().find((candidate) => {
      try {
        const connection = candidate.deserializeAttachment() as { clientId?: unknown } | null;
        return connection?.clientId === clientId;
      } catch {
        return false;
      }
    });
    if (socket) {
      const connection = readConnection(socket);
      const [missions, initiative, runtimeConfig] = await Promise.all([
        readMissionState(this.ctx.storage),
        readInitiativeState(this.ctx.storage),
        readRuntimeConfig(this.ctx.storage),
      ]);
      send(socket, { type: "session.missions.snapshot", state: missions });
      send(socket, { type: "session.initiative.snapshot", state: initiative });
      send(socket, {
        type: "session.config.snapshot",
        snapshot: connection
          ? visibleRuntimeConfigSnapshot(connection, runtimeConfig)
          : null,
      });
    }
    return response;
  }

  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);

    const runtimeConfig = parseRuntimeConfigPublishMessage(raw);
    if (runtimeConfig) {
      await this.handleRuntimeConfigPublish(webSocket, runtimeConfig.snapshot);
      return;
    }

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }

    const characterId = extractOperationCharacterId(raw);
    if (characterId) {
      const authorization = authorizeCharacterMutation(
        connection,
        await readRuntimeConfig(this.ctx.storage),
        characterId,
      );
      if (!authorization.ok) {
        sendError(webSocket, authorization.code, authorization.message);
        return;
      }
    }

    if (parseCustomSystemClientMessage(raw)) {
      await this.customSystemRoute.webSocketMessage(webSocket, message);
      await this.reconcileInitiativeProjection();
      return;
    }

    const undoLogId = parseUndoLogId(raw);
    if (undoLogId) {
      const reverseType = await this.sharedUndoType(undoLogId);
      if (reverseType) {
        await this.handleSharedUndo(webSocket, undoLogId, reverseType);
        return;
      }
    }

    if (parseMissionClientMessage(raw)) {
      await this.missionRoute.webSocketMessage(webSocket, message);
      return;
    }
    if (parseInitiativeClientMessage(raw)) {
      await this.initiativeRoute.webSocketMessage(webSocket, message);
      return;
    }

    await super.webSocketMessage(webSocket, message);
    await this.reconcileInitiativeProjection();
  }

  private async reconcileInitiativeProjection(): Promise<void> {
    const [initiative, abilities, hp, conditions, runtimeConfig] = await Promise.all([
      readInitiativeState(this.ctx.storage),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      readRuntimeConfig(this.ctx.storage),
    ]);
    if (!initiative.initialized) return;
    const current = normalizeInitiativeSession(initiative.session as Partial<import("../../../../src/models/initiative/Initiative").InitiativeSession>);
    const characterProjection = projectInitiativeSessionFromCharacterState(current, { abilities, hp, conditions });
    const creatureProjection = projectInitiativeSessionFromCreatureState(characterProjection.session, runtimeConfig);
    if (!characterProjection.changed && !creatureProjection.changed) return;
    initiative.session = creatureProjection.session as unknown as Record<string, unknown>;
    initiative.revision += 1;
    await this.ctx.storage.put(INITIATIVE_STATE_KEY, initiative);
    broadcastVisibilityFiltered(this.ctx.getWebSockets(), {
      type: "session.initiative.updated",
      state: initiative,
    });
  }

  private async handleRuntimeConfigPublish(
    webSocket: WebSocket,
    snapshot: SessionRuntimeConfigSnapshot,
  ): Promise<void> {
    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can publish session configuration.");
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const current = await readRuntimeConfig(this.ctx.storage);
    if (current && snapshot.creationRevision < current.creationRevision) {
      sendError(
        webSocket,
        "CREATION_CONFIG_STALE",
        `Creation revision ${snapshot.creationRevision} is older than active revision ${current.creationRevision}.`,
      );
      send(webSocket, {
        type: "session.config.snapshot",
        snapshot: visibleRuntimeConfigSnapshot(connection, current),
      });
      return;
    }

    const sameRevisionDifferentConfig = Boolean(
      current
      && snapshot.creationRevision === current.creationRevision
      && JSON.stringify(snapshot.config) !== JSON.stringify(current.config),
    );

    if (!current || snapshot.creationRevision > current.creationRevision || sameRevisionDifferentConfig) {
      // Older builds allowed Creation-relevant database mutations without
      // incrementing creationRevision. An authenticated MASTER publishing the
      // canonical DB snapshot is therefore allowed to reconcile one of those
      // legacy collisions in-place. New writes now increment the revision, so
      // this path is recovery rather than the normal update mechanism.
      const reconciledAbilities = await reconcileAbilityCustomSystems(
        this.ctx.storage,
        snapshot,
      );
      const writes: Record<string, unknown> = {
        [RUNTIME_CONFIG_STATE_KEY]: structuredClone(snapshot),
      };
      if (reconciledAbilities) {
        writes[ABILITIES_STATE_KEY] = reconciledAbilities;
      }
      await this.ctx.storage.put(writes);

      const sockets = this.ctx.getWebSockets();
      refreshAllConnectionVisibility(sockets, snapshot);
      broadcastRuntimeConfig(sockets, snapshot);
      await broadcastAllVisibleCharacterSnapshots(this.ctx.storage, sockets);
      await this.reconcileInitiativeProjection();
      return;
    }

    // Equal revision + equal content is an idempotent republish after reconnect.
    send(webSocket, {
      type: "session.config.snapshot",
      snapshot: visibleRuntimeConfigSnapshot(connection, current),
    });
  }

  private async sharedUndoType(logId: string): Promise<SharedReverse["type"] | null> {
    const log = await readSessionLog(this.ctx.storage);
    const record = log.find((entry) => entry.id === logId);
    const type = record?.reverseOperation.type;
    return type === "session.missions.restore" || type === "session.initiative.restore" ? type : null;
  }

  private async handleSharedUndo(
    webSocket: WebSocket,
    logId: string,
    reverseType: SharedReverse["type"],
  ): Promise<void> {
    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const log = await readSessionLog(this.ctx.storage);
    const validation = validateUndoOrdering(log, logId);
    if (!validation.ok) {
      sendError(webSocket, validation.code, validation.message);
      return;
    }
    if (validation.record.reverseOperation.type !== reverseType) {
      await super.webSocketMessage(webSocket, JSON.stringify({ type: "session.log.undo", logId }));
      return;
    }

    const reverse = validation.record.reverseOperation as unknown as SharedReverse;
    if (reverse.type === "session.missions.restore") {
      await this.restoreMissionUndo(webSocket, connection, log, validation.index, validation.affectedScopes, reverse);
      return;
    }
    await this.restoreInitiativeUndo(webSocket, connection, log, validation.index, validation.affectedScopes, reverse);
  }

  private async restoreMissionUndo(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: Awaited<ReturnType<typeof readSessionLog>>,
    sourceIndex: number,
    scopes: string[],
    reverse: MissionReverse,
  ): Promise<void> {
    const current = await readMissionState(this.ctx.storage);
    const affectedScopes = scopes.length ? scopes : [MISSIONS_SHARED_SCOPE];
    const now = new Date().toISOString();
    const inverseReverse: MissionReverse = {
      type: "session.missions.restore",
      characterId: "session",
      affectedScopes,
      snapshot: structuredClone(current),
    };
    const undoRecord = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId: "session", sourceLogId: log[sourceIndex].id },
      affectedScopes,
      reverseOperation: inverseReverse,
    });

    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [MISSIONS_STATE_KEY]: reverse.snapshot },
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
      undoneAt: now,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.missions.updated", state: reverse.snapshot });
  }

  private async restoreInitiativeUndo(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: Awaited<ReturnType<typeof readSessionLog>>,
    sourceIndex: number,
    scopes: string[],
    reverse: InitiativeReverse,
  ): Promise<void> {
    const [currentInitiative, abilities, hp, conditions] = await Promise.all([
      readInitiativeState(this.ctx.storage),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
    ]);
    const affectedScopes = scopes.length ? scopes : [INITIATIVE_SHARED_SCOPE];
    const now = new Date().toISOString();
    const restoredAbilityIds = Object.keys(reverse.abilities ?? {});
    const restoredHpIds = Object.keys(reverse.hp ?? {});
    const restoredConditionIds = Object.keys(reverse.conditions ?? {});
    const inverseAbilities = Object.fromEntries(
      restoredAbilityIds.flatMap((characterId) => {
        const current = abilities[characterId];
        return current ? [[characterId, structuredClone(current)]] : [];
      }),
    ) as Record<string, SessionAbilityState>;
    const inverseHp = Object.fromEntries(restoredHpIds.flatMap((characterId) => hp[characterId] ? [[characterId, structuredClone(hp[characterId])]] : [])) as Record<string, SessionHpState>;
    const inverseConditions = Object.fromEntries(restoredConditionIds.flatMap((characterId) => conditions[characterId] ? [[characterId, structuredClone(conditions[characterId])]] : [])) as Record<string, SessionConditionsState>;
    const inverseReverse: InitiativeReverse = {
      type: "session.initiative.restore",
      characterId: "session",
      affectedScopes,
      snapshot: structuredClone(currentInitiative),
      ...(restoredAbilityIds.length ? { abilities: inverseAbilities } : {}),
      ...(restoredHpIds.length ? { hp: inverseHp } : {}),
      ...(restoredConditionIds.length ? { conditions: inverseConditions } : {}),
    };

    for (const [characterId, snapshot] of Object.entries(reverse.abilities ?? {})) abilities[characterId] = structuredClone(snapshot);
    for (const [characterId, snapshot] of Object.entries(reverse.hp ?? {})) hp[characterId] = structuredClone(snapshot);
    for (const [characterId, snapshot] of Object.entries(reverse.conditions ?? {})) conditions[characterId] = structuredClone(snapshot);

    const writes: Record<string, unknown> = {
      [INITIATIVE_STATE_KEY]: reverse.snapshot,
    };
    if (restoredAbilityIds.length) writes[ABILITIES_STATE_KEY] = abilities;
    if (restoredHpIds.length) writes[HP_STATE_KEY] = hp;
    if (restoredConditionIds.length) writes[CONDITIONS_STATE_KEY] = conditions;

    const undoRecord = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId: "session", sourceLogId: log[sourceIndex].id },
      affectedScopes,
      reverseOperation: inverseReverse,
    });

    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
      undoneAt: now,
    });

    const sockets = this.ctx.getWebSockets();
    broadcastVisibilityFiltered(sockets, { type: "session.initiative.updated", state: reverse.snapshot });
    for (const characterId of restoredAbilityIds) {
      const snapshot = abilities[characterId];
      if (!snapshot) continue;
      broadcastVisibilityFiltered(sockets, { type: "session.abilities.updated", character: snapshot });
    }
    for (const characterId of restoredHpIds) {
      const snapshot = hp[characterId];
      if (!snapshot) continue;
      broadcastVisibilityFiltered(sockets, { type: "session.hp.updated", character: snapshot });
    }
    for (const characterId of restoredConditionIds) {
      const snapshot = conditions[characterId];
      if (!snapshot) continue;
      broadcastVisibilityFiltered(sockets, { type: "session.conditions.updated", character: snapshot });
    }
  }
}

async function reconcileAbilityCustomSystems(
  storage: DurableObjectStorage,
  snapshot: SessionRuntimeConfigSnapshot,
): Promise<Record<string, SessionAbilityState> | null> {
  const abilities = (
    await storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)
  ) ?? {};
  const characterConfigById = new Map(
    snapshot.config.characters.map((character) => [character.characterId, character]),
  );
  let changed = false;

  for (const [characterId, stored] of Object.entries(abilities)) {
    if (!stored.initialized) continue;
    const configuration = characterConfigById.get(characterId);
    if (!configuration) continue;

    let character: CharacterTemplate;
    try {
      character = CharacterTemplate.fromJSON(
        stored.character as Partial<CharacterTemplateProps>,
      );
    } catch {
      continue;
    }

    const currentSystems = character.get("sheet").customSystems ?? [];
    const nextSystems = reconcileConfiguredCustomSystemStates(
      currentSystems,
      configuration.customSystems,
      snapshot.config.customSystems,
    );
    if (JSON.stringify(currentSystems) === JSON.stringify(nextSystems)) continue;

    const nextCharacter = character.withSheet("customSystems", nextSystems);
    abilities[characterId] = {
      ...stored,
      character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
      revision: stored.revision + 1,
    };
    changed = true;
  }

  return changed ? abilities : null;
}

function bindDomainActor<T extends SharedDomainActor>(prototype: T, ctx: DurableObjectState): T {
  const actor = Object.create(null) as T;
  for (const key of Reflect.ownKeys(prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (descriptor) Object.defineProperty(actor, key, descriptor);
  }
  Object.defineProperty(actor, "ctx", {
    value: ctx,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return actor;
}

function parseUndoLogId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; logId?: unknown };
    return value.type === "session.log.undo" && typeof value.logId === "string" ? value.logId : null;
  } catch {
    return null;
  }
}
function readConnection(socket: WebSocket): SessionConnection | null {
  try { return socket.deserializeAttachment() as SessionConnection | null; } catch { return null; }
}
function sendError(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: "session.error", code, message });
}
function send(socket: WebSocket, value: unknown): void {
  try { socket.send(JSON.stringify(value)); } catch {}
}
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}
function broadcastRuntimeConfig(
  sockets: WebSocket[],
  snapshot: SessionRuntimeConfigSnapshot,
): void {
  for (const socket of sockets) {
    const connection = readConnection(socket);
    if (!connection) continue;
    send(socket, {
      type: "session.config.snapshot",
      snapshot: visibleRuntimeConfigSnapshot(connection, snapshot),
    });
  }
}
