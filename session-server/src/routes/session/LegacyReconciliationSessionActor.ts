import { SessionActor as BaseSessionActor } from "./CustomClassAuthoritativeSessionActor";
import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpState,
} from "./protocol";
import type { SessionCharacterLifecycleState } from "./characterLifecycleProtocol";
import type { SessionInitiativeState } from "../initiative/initiativeProtocol";
import { INITIATIVE_STATE_KEY } from "../initiative/InitiativeSessionActor";
import { MISSIONS_STATE_KEY } from "../missions/MissionSessionActor";
import {
  normalizeInitiativeSession,
  type InitiativeSession,
} from "../../../../src/models/initiative/Initiative";
import { projectInitiativeSessionFromCharacterState } from "../initiative/initiativeCharacterProjection";
import { projectInitiativeSessionFromCreatureState } from "../initiative/initiativeCreatureProjection";
import {
  haveSameLegacyCharacterIdentity,
} from "../../../../src/shared/legacy/legacyCharacterIdentity";
import { readRuntimeConfig } from "./runtimeConfigAccess";
import {
  broadcastAllVisibleCharacterSnapshots,
  broadcastVisibilityFiltered,
  refreshConnectionVisibility,
} from "./visibilityDelivery";
import {
  SESSION_LOG_KEY,
  broadcastSessionLogToMasters,
  logRecordScopes,
  normalizeSessionLogRecordsInPlace,
  readSessionLog,
  type SessionLogRecord,
} from "./sessionLog";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const INVENTORY_STATE_KEY = "inventory-state";
const CHARACTER_LIFECYCLE_STATE_KEY = "characters-state";
const LEGACY_RECONCILIATIONS_STATE_KEY = "legacy-character-reconciliations";

type LegacyCharacterReconciliationOperation = {
  type: "character.session.reconcile";
  characterId: string;
  sourceCharacterId: string;
};

type LegacyCharacterReconciliationRecord = {
  targetCharacterId: string;
  reconciledAt: string;
};

type RevisionedCharacterState = {
  characterId: string;
  revision: number;
};

/**
 * Maintenance layer for Durable Objects created while legacy campaign import
 * used two different character id generations. Normal session-only characters
 * are never inferred here: the client only proposes pairs for a campaign that
 * carries the legacy import marker, and this actor independently validates
 * that the target is canonical while the source is absent from Creation.
 */
export class SessionActor extends BaseSessionActor {
  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const operations = parseLegacyCharacterReconciliation(raw);
    if (!operations) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(
        webSocket,
        "MASTER_REQUIRED",
        "Only the MASTER can reconcile legacy session characters.",
      );
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);
    for (const operation of operations) {
      await this.reconcileLegacyCharacter(webSocket, connection, operation);
    }
  }

  private async reconcileLegacyCharacter(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: LegacyCharacterReconciliationOperation,
  ): Promise<void> {
    const targetCharacterId = operation.characterId.trim();
    const sourceCharacterId = operation.sourceCharacterId.trim();
    if (sourceCharacterId === targetCharacterId) {
      sendError(
        webSocket,
        "LEGACY_RECONCILIATION_INVALID",
        "The legacy source and canonical target must be different characters.",
      );
      return;
    }

    const runtimeConfig = await readRuntimeConfig(this.ctx.storage);
    if (!runtimeConfig) {
      sendError(
        webSocket,
        "SESSION_CONFIG_NOT_INITIALIZED",
        "Session configuration is not initialized yet.",
      );
      return;
    }

    const targetConfig = runtimeConfig.config.characters.find(
      (entry) => entry.characterId === targetCharacterId,
    );
    if (!targetConfig) {
      sendError(
        webSocket,
        "LEGACY_RECONCILIATION_TARGET_NOT_CANONICAL",
        "The reconciliation target is not a canonical Creation character.",
      );
      return;
    }
    if (
      runtimeConfig.config.characters.some(
        (entry) => entry.characterId === sourceCharacterId,
      )
    ) {
      sendError(
        webSocket,
        "LEGACY_RECONCILIATION_SOURCE_IS_CANONICAL",
        "Canonical Creation characters cannot be removed by legacy reconciliation.",
      );
      return;
    }

    const [
      abilities,
      hp,
      conditions,
      lifecycle,
      inventory,
      missions,
      initiative,
      log,
      reconciliations,
    ] = await Promise.all([
      this.ctx.storage
        .get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)
        .then((value) => value ?? {}),
      this.ctx.storage
        .get<Record<string, SessionHpState>>(HP_STATE_KEY)
        .then((value) => value ?? {}),
      this.ctx.storage
        .get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)
        .then((value) => value ?? {}),
      this.ctx.storage
        .get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)
        .then((value) => value ?? {}),
      this.ctx.storage.get<unknown>(INVENTORY_STATE_KEY),
      this.ctx.storage.get<unknown>(MISSIONS_STATE_KEY),
      this.ctx.storage.get<SessionInitiativeState>(INITIATIVE_STATE_KEY),
      readSessionLog(this.ctx.storage),
      this.ctx.storage
        .get<Record<string, LegacyCharacterReconciliationRecord>>(
          LEGACY_RECONCILIATIONS_STATE_KEY,
        )
        .then((value) => value ?? {}),
    ]);

    const previousReconciliation = reconciliations[sourceCharacterId];
    const sourceAbility = abilities[sourceCharacterId];
    if (
      previousReconciliation?.targetCharacterId === targetCharacterId &&
      !sourceAbility
    ) {
      await broadcastAllVisibleCharacterSnapshots(
        this.ctx.storage,
        this.ctx.getWebSockets(),
      );
      return;
    }

    const targetAbility = abilities[targetCharacterId];
    const sourceLifecycle = lifecycle[sourceCharacterId];
    const targetLifecycle = lifecycle[targetCharacterId];
    if (
      !sourceAbility?.initialized ||
      !targetAbility?.initialized ||
      sourceLifecycle?.active === false ||
      targetLifecycle?.active === false
    ) {
      sendError(
        webSocket,
        "LEGACY_RECONCILIATION_STATE_MISSING",
        "Both legacy and canonical characters must be active and initialized before reconciliation.",
      );
      return;
    }

    if (
      !haveSameLegacyCharacterIdentity(
        sourceAbility.character,
        targetAbility.character,
      )
    ) {
      sendError(
        webSocket,
        "LEGACY_RECONCILIATION_IDENTITY_MISMATCH",
        "The legacy session character does not match the canonical character identity.",
      );
      return;
    }

    const sourceActivity = latestMeaningfulCharacterActivity(log, sourceCharacterId);
    const targetActivity = latestMeaningfulCharacterActivity(log, targetCharacterId);
    if (sourceActivity >= 0 && targetActivity >= 0) {
      sendError(
        webSocket,
        "LEGACY_RECONCILIATION_DIVERGED",
        "Both legacy and canonical copies have gameplay history; automatic reconciliation was skipped to avoid losing divergent state.",
      );
      return;
    }
    const preferSource = shouldPreferSourceCopy({
      sourceActivity,
      targetActivity,
      sourceAbility,
      targetAbility,
      sourceHp: hp[sourceCharacterId],
      targetHp: hp[targetCharacterId],
      sourceConditions: conditions[sourceCharacterId],
      targetConditions: conditions[targetCharacterId],
    });

    const nextAbilities = structuredClone(abilities);
    const nextHp = structuredClone(hp);
    const nextConditions = structuredClone(conditions);
    const nextLifecycle = structuredClone(lifecycle);

    const mergedAbility = preferSource
      ? structuredClone(sourceAbility)
      : structuredClone(targetAbility);
    const canonicalCharacter = targetAbility.character;
    const remappedCharacter = remapCharacterReferences(
      mergedAbility.character,
      sourceCharacterId,
      targetCharacterId,
    );
    const mergedCharacter = isRecord(remappedCharacter)
      ? {
          ...remappedCharacter,
          id: targetCharacterId,
          ...(canonicalCharacter.name !== undefined
            ? { name: canonicalCharacter.name }
            : {}),
          ...(canonicalCharacter.owner !== undefined
            ? { owner: structuredClone(canonicalCharacter.owner) }
            : {}),
          visibility: targetConfig.visibility,
        }
      : structuredClone(canonicalCharacter);

    nextAbilities[targetCharacterId] = {
      ...mergedAbility,
      characterId: targetCharacterId,
      character: mergedCharacter,
      initialized: true,
      revision: Math.max(
        sourceAbility.revision,
        targetAbility.revision,
      ) + 1,
    };
    delete nextAbilities[sourceCharacterId];

    const sourceHp = hp[sourceCharacterId];
    const targetHp = hp[targetCharacterId];
    const selectedHp = pickPreferredState(preferSource, sourceHp, targetHp);
    if (selectedHp) {
      nextHp[targetCharacterId] = {
        ...remapCharacterReferences(
          selectedHp,
          sourceCharacterId,
          targetCharacterId,
        ) as SessionHpState,
        characterId: targetCharacterId,
        ownerUserId:
          targetLifecycle?.ownerUserId ??
          targetHp?.ownerUserId ??
          targetConfig.ownerId,
        revision: Math.max(
          sourceHp?.revision ?? -1,
          targetHp?.revision ?? -1,
        ) + 1,
      };
    }
    delete nextHp[sourceCharacterId];

    const sourceConditions = conditions[sourceCharacterId];
    const targetConditions = conditions[targetCharacterId];
    const selectedConditions = pickPreferredState(
      preferSource,
      sourceConditions,
      targetConditions,
    );
    if (selectedConditions) {
      nextConditions[targetCharacterId] = {
        ...remapCharacterReferences(
          selectedConditions,
          sourceCharacterId,
          targetCharacterId,
        ) as SessionConditionsState,
        characterId: targetCharacterId,
        revision: Math.max(
          sourceConditions?.revision ?? -1,
          targetConditions?.revision ?? -1,
        ) + 1,
      };
    }
    delete nextConditions[sourceCharacterId];

    nextLifecycle[targetCharacterId] = {
      characterId: targetCharacterId,
      character: nextAbilities[targetCharacterId].character,
      ownerUserId:
        nextHp[targetCharacterId]?.ownerUserId ??
        targetLifecycle?.ownerUserId ??
        targetConfig.ownerId,
      active: true,
      revision: Math.max(
        sourceLifecycle?.revision ?? -1,
        targetLifecycle?.revision ?? -1,
      ) + 1,
    };
    delete nextLifecycle[sourceCharacterId];

    const remappedInventory = inventory === undefined
      ? undefined
      : remapCharacterReferences(
          inventory,
          sourceCharacterId,
          targetCharacterId,
        );
    const inventoryChanged =
      inventory !== undefined && !sameJson(inventory, remappedInventory);

    const remappedMissions = missions === undefined
      ? undefined
      : remapCharacterReferences(
          missions,
          sourceCharacterId,
          targetCharacterId,
        );
    const missionsChanged =
      missions !== undefined && !sameJson(missions, remappedMissions);

    let remappedInitiative = initiative === undefined
      ? undefined
      : remapCharacterReferences(
          initiative,
          sourceCharacterId,
          targetCharacterId,
        ) as SessionInitiativeState;
    let initiativeChanged =
      initiative !== undefined && !sameJson(initiative, remappedInitiative);

    if (remappedInitiative?.initialized) {
      const normalized = normalizeInitiativeSession(
        remappedInitiative.session as Partial<InitiativeSession>,
      );
      const characterProjection = projectInitiativeSessionFromCharacterState(
        normalized,
        {
          abilities: nextAbilities,
          hp: nextHp,
          conditions: nextConditions,
        },
      );
      const creatureProjection = projectInitiativeSessionFromCreatureState(
        characterProjection.session,
        runtimeConfig,
      );
      if (
        characterProjection.changed ||
        creatureProjection.changed ||
        !sameJson(remappedInitiative.session, creatureProjection.session)
      ) {
        remappedInitiative = {
          ...remappedInitiative,
          session: creatureProjection.session as unknown as Record<string, unknown>,
        };
        initiativeChanged = true;
      }
      if (initiativeChanged) {
        remappedInitiative.revision = Math.max(
          initiative?.revision ?? 0,
          remappedInitiative.revision ?? 0,
        ) + 1;
      }
    }

    const remappedLog = remapCharacterReferences(
      log,
      sourceCharacterId,
      targetCharacterId,
    ) as SessionLogRecord[];
    const logChanged = !sameJson(log, remappedLog);
    if (logChanged) normalizeSessionLogRecordsInPlace(remappedLog);

    const nextReconciliations = {
      ...reconciliations,
      [sourceCharacterId]: {
        targetCharacterId,
        reconciledAt: new Date().toISOString(),
      },
    };

    const writes: Record<string, unknown> = {
      [ABILITIES_STATE_KEY]: nextAbilities,
      [HP_STATE_KEY]: nextHp,
      [CONDITIONS_STATE_KEY]: nextConditions,
      [CHARACTER_LIFECYCLE_STATE_KEY]: nextLifecycle,
      [LEGACY_RECONCILIATIONS_STATE_KEY]: nextReconciliations,
    };
    if (inventoryChanged) writes[INVENTORY_STATE_KEY] = remappedInventory;
    if (missionsChanged) writes[MISSIONS_STATE_KEY] = remappedMissions;
    if (initiativeChanged && remappedInitiative) {
      writes[INITIATIVE_STATE_KEY] = remappedInitiative;
    }
    if (logChanged) writes[SESSION_LOG_KEY] = remappedLog;

    await this.ctx.storage.put(writes);

    const sockets = this.ctx.getWebSockets();
    for (const socket of sockets) {
      refreshConnectionVisibility(socket, runtimeConfig, nextLifecycle);
    }
    await broadcastAllVisibleCharacterSnapshots(this.ctx.storage, sockets);

    if (inventoryChanged && remappedInventory !== undefined) {
      broadcastVisibilityFiltered(sockets, {
        type: "session.inventory.updated",
        state: remappedInventory,
      });
    }
    if (missionsChanged && remappedMissions !== undefined) {
      broadcastVisibilityFiltered(sockets, {
        type: "session.missions.updated",
        state: remappedMissions,
      });
    }
    if (initiativeChanged && remappedInitiative) {
      broadcastVisibilityFiltered(sockets, {
        type: "session.initiative.updated",
        state: remappedInitiative,
      });
    }
    if (logChanged) broadcastSessionLogToMasters(sockets, remappedLog);
  }
}

function parseLegacyCharacterReconciliation(
  raw: string,
): LegacyCharacterReconciliationOperation[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.type !== "session.character.operation") {
    return null;
  }
  const operation = value.operation;
  if (
    !isRecord(operation) ||
    operation.type !== "character.session.reconcile" ||
    operation.characterId !== "session" ||
    !Array.isArray(operation.pairs) ||
    operation.pairs.length === 0 ||
    operation.pairs.length > 100
  ) {
    return null;
  }

  const result: LegacyCharacterReconciliationOperation[] = [];
  const seenSources = new Set<string>();
  const seenTargets = new Set<string>();
  for (const pair of operation.pairs) {
    if (
      !isRecord(pair) ||
      !isNonEmptyString(pair.sourceCharacterId) ||
      !isNonEmptyString(pair.targetCharacterId)
    ) {
      return null;
    }
    const sourceCharacterId = pair.sourceCharacterId.trim();
    const targetCharacterId = pair.targetCharacterId.trim();
    if (
      sourceCharacterId === targetCharacterId ||
      seenSources.has(sourceCharacterId) ||
      seenTargets.has(targetCharacterId)
    ) {
      return null;
    }
    seenSources.add(sourceCharacterId);
    seenTargets.add(targetCharacterId);
    result.push({
      type: "character.session.reconcile",
      characterId: targetCharacterId,
      sourceCharacterId,
    });
  }
  return result;
}

function shouldPreferSourceCopy(args: {
  sourceActivity: number;
  targetActivity: number;
  sourceAbility?: RevisionedCharacterState;
  targetAbility?: RevisionedCharacterState;
  sourceHp?: RevisionedCharacterState;
  targetHp?: RevisionedCharacterState;
  sourceConditions?: RevisionedCharacterState;
  targetConditions?: RevisionedCharacterState;
}): boolean {
  if (args.sourceActivity >= 0 && args.targetActivity < 0) return true;
  if (args.targetActivity >= 0 && args.sourceActivity < 0) return false;

  const sourceRevision = totalRevision(
    args.sourceAbility,
    args.sourceHp,
    args.sourceConditions,
  );
  const targetRevision = totalRevision(
    args.targetAbility,
    args.targetHp,
    args.targetConditions,
  );
  return sourceRevision > targetRevision;
}

function totalRevision(...states: Array<RevisionedCharacterState | undefined>): number {
  return states.reduce((total, state) => total + Math.max(0, state?.revision ?? 0), 0);
}

function pickPreferredState<T>(
  preferSource: boolean,
  source: T | undefined,
  target: T | undefined,
): T | undefined {
  const preferred = preferSource ? source : target;
  const fallback = preferSource ? target : source;
  return preferred !== undefined
    ? structuredClone(preferred)
    : fallback !== undefined
      ? structuredClone(fallback)
      : undefined;
}

function latestMeaningfulCharacterActivity(
  log: SessionLogRecord[],
  characterId: string,
): number {
  const scope = `character:${characterId}`;
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const record = log[index];
    if (record.undoneAt) continue;
    const operationType = record.operation.type;
    if (operationType.startsWith("character.session.")) continue;
    const operationCharacterId = typeof record.operation.characterId === "string"
      ? record.operation.characterId
      : "";
    const reverseCharacterId = record.reverseOperation.characterId;
    if (
      operationCharacterId === characterId ||
      reverseCharacterId === characterId ||
      logRecordScopes(record).includes(scope)
    ) {
      return index;
    }
  }
  return -1;
}

function remapCharacterReferences(
  value: unknown,
  sourceCharacterId: string,
  targetCharacterId: string,
): unknown {
  if (typeof value === "string") {
    if (value === sourceCharacterId) return targetCharacterId;
    if (value === `character:${sourceCharacterId}`) {
      return `character:${targetCharacterId}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      remapCharacterReferences(entry, sourceCharacterId, targetCharacterId),
    );
  }
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  const entries = Object.entries(value).sort(([left], [right]) => {
    if (left === targetCharacterId && right !== targetCharacterId) return -1;
    if (right === targetCharacterId && left !== targetCharacterId) return 1;
    return 0;
  });
  for (const [key, entry] of entries) {
    const remappedKey = key === sourceCharacterId
      ? targetCharacterId
      : key === `character:${sourceCharacterId}`
        ? `character:${targetCharacterId}`
        : key;
    const remappedEntry = remapCharacterReferences(
      entry,
      sourceCharacterId,
      targetCharacterId,
    );
    if (!(remappedKey in next)) {
      next[remappedKey] = remappedEntry;
      continue;
    }
    next[remappedKey] = preferRevisionedValue(next[remappedKey], remappedEntry);
  }
  return next;
}

function preferRevisionedValue(current: unknown, incoming: unknown): unknown {
  const currentRevision = numericRevision(current);
  const incomingRevision = numericRevision(incoming);
  if (incomingRevision > currentRevision) return incoming;
  return current;
}

function numericRevision(value: unknown): number {
  if (!isRecord(value) || typeof value.revision !== "number") return -1;
  return Number.isFinite(value.revision) ? value.revision : -1;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readConnection(socket: WebSocket): SessionConnection | null {
  try {
    return socket.deserializeAttachment() as SessionConnection;
  } catch {
    return null;
  }
}

function sendError(socket: WebSocket, code: string, message: string): void {
  try {
    socket.send(JSON.stringify({ type: "session.error", code, message }));
  } catch {}
}
