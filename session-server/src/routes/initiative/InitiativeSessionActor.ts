import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../characters/sheet/characterState";
import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import type { SessionCondition, SessionConditionsState, SessionConnection, SessionHpState } from "../session/protocol";
import {
  characterScope,
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../session/sessionLog";
import { readRuntimeConfig } from "../session/runtimeConfigAccess";
import { broadcastVisibilityFiltered } from "../session/visibilityDelivery";
import { runCustomSystemAutomations } from "../../../../src/lib/customSystems/CustomAutomationRuntime";
import type { CustomSystemEventType } from "../../../../src/models/customSystems/CustomAutomationDefinition";
import type { CustomSystemDefinition } from "../../../../src/models/customSystems/CustomSystemDefinition";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import {
  addInitiativeEntries,
  advanceInitiativeTurn,
  applyInitiativeCondition,
  canTradeConsecutiveAllies,
  createInitiativeSession,
  endInitiativeCombat,
  normalizeInitiativeSession,
  removeInitiativeCondition,
  removeInitiativeEntry,
  rewindInitiativeTurn,
  sortInitiativeEntries,
  startInitiativeCombat,
  tradeConsecutiveAllies,
  updateInitiativeEntry,
  type InitiativeEntry,
  type InitiativeSession,
  type NewInitiativeEntry,
} from "../../../../src/models/initiative/Initiative";
import {
  parseInitiativeClientMessage,
  type SessionInitiativeOperation,
  type SessionInitiativeState,
} from "./initiativeProtocol";
import {
  linkedCharacterIdForInitiativeEntry,
  projectInitiativeSessionFromCharacterState,
  synchronizeInitiativeEditsToCharacterState,
} from "./initiativeCharacterProjection";

export const INITIATIVE_STATE_KEY = "initiative-state";
export const INITIATIVE_SHARED_SCOPE = "initiative:shared";
const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";

type InitiativeAutomationEvent = {
  event: CustomSystemEventType;
  characterIds: string[];
};

export class SessionActor {
  declare protected readonly ctx: DurableObjectState;

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseInitiativeClientMessage(raw);
    if (!parsed) return;

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    if (
      connection.role !== "MASTER" &&
      !(
        parsed.type === "session.initiative.operation" &&
        parsed.operation.type === "initiative.deathSaves.set"
      )
    ) {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can mutate initiative state.");
      return;
    }

    if (parsed.type === "session.initiative.initialize") {
      const current = await readInitiativeState(this.ctx.storage);
      if (current.initialized) {
        send(webSocket, { type: "session.initiative.snapshot", state: current });
        return;
      }
      const normalized = normalizeInitiativeSession(parsed.session as Partial<InitiativeSession>);
      const state: SessionInitiativeState = {
        initialized: true,
        revision: 0,
        session: normalized as unknown as Record<string, unknown>,
      };
      await this.ctx.storage.put(INITIATIVE_STATE_KEY, state);
      broadcast(this.ctx.getWebSockets(), { type: "session.initiative.snapshot", state });
      return;
    }

    await this.handleOperation(webSocket, connection, parsed.operation);
  }

  private async handleOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionInitiativeOperation,
  ): Promise<void> {
    const [state, abilities, hp, conditions, runtimeConfig, log] = await Promise.all([
      readInitiativeState(this.ctx.storage),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      readRuntimeConfig(this.ctx.storage),
      readSessionLog(this.ctx.storage),
    ]);
    if (!state.initialized) {
      sendError(webSocket, "INITIATIVE_STATE_NOT_INITIALIZED", "Initiative has not been initialized by the MASTER.");
      return;
    }

    const current = normalizeInitiativeSession(state.session as Partial<InitiativeSession>);
    if (connection.role !== "MASTER" && operation.type === "initiative.deathSaves.set") {
      const entry = current.entries.find((candidate) => candidate.id === operation.entryId);
      const linkedCharacterId = linkedCharacterIdForInitiativeEntry(entry);
      const linkedHp = linkedCharacterId ? hp[linkedCharacterId] : undefined;
      if (
        !entry ||
        entry.sourceType !== "character" ||
        !linkedCharacterId ||
        linkedHp?.ownerUserId !== connection.userId ||
        !current.deathSaveOwnerCanEdit
      ) {
        sendError(webSocket, "DEATH_SAVES_ACCESS_DENIED", "This player cannot edit these death saves.");
        return;
      }
    }

    const before = structuredClone(state);
    const result = applyInitiativeOperation(current, operation, runtimeConfig);
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    const sourceSync = synchronizeInitiativeEditsToCharacterState(
      current,
      result.session,
      { abilities, hp, conditions },
    );
    if (!sourceSync.ok) {
      sendError(webSocket, sourceSync.code, sourceSync.message);
      return;
    }
    let nextSession = sourceSync.session;
    if (operation.type === "initiative.customAction.execute") {
      enrichCustomInitiativeActionConditions(
        operation,
        runtimeConfig,
        current,
        conditions,
        sourceSync.previousConditions,
      );
    }

    const previousAbilities: Record<string, SessionAbilityState> = {};
    const changedAbilityIds = new Set<string>();

    const deathSaveEntry = operation.type === "initiative.deathSaves.set"
      ? nextSession.entries.find((entry) => entry.id === operation.entryId)
      : operation.type === "initiative.entry.update" && "deathSaves" in operation.patch
        ? nextSession.entries.find((entry) => entry.id === operation.entryId)
        : undefined;
    const deathSaveCharacterId = linkedCharacterIdForInitiativeEntry(deathSaveEntry);
    if (deathSaveEntry?.deathSaves && deathSaveCharacterId) {
      const storedAbility = abilities[deathSaveCharacterId];
      if (storedAbility?.initialized) {
        previousAbilities[deathSaveCharacterId] = structuredClone(storedAbility);
        const character = CharacterTemplate.fromJSON(
          storedAbility.character as Partial<CharacterTemplateProps>,
        );
        const updatedCharacter = character.with("deathSaves", {
          ...deathSaveEntry.deathSaves,
        });
        abilities[deathSaveCharacterId] = {
          characterId: deathSaveCharacterId,
          character: updatedCharacter.toJSON() as unknown as Record<string, unknown>,
          initialized: true,
          revision: storedAbility.revision + 1,
        };
        changedAbilityIds.add(deathSaveCharacterId);
      }
    }

    if (runtimeConfig) {
      try {
        const events = initiativeAutomationEvents(current, nextSession, operation);
        for (const { event, characterIds } of events) {
          for (const characterId of characterIds) {
            const storedAbility = abilities[characterId];
            const storedHp = hp[characterId];
            if (!storedAbility?.initialized || !storedHp) continue;

            if (!previousAbilities[characterId]) {
              previousAbilities[characterId] = structuredClone(storedAbility);
            }

            const character = hydrateCharacterForAutomation(storedAbility, storedHp);
            const definitions = runtimeDefinitionsForCharacter(character, runtimeConfig, characterId);
            if (!definitions.length) continue;
            const automation = runCustomSystemAutomations(character, definitions, event);
            if (!automation.applied.length) continue;

            abilities[characterId] = {
              characterId,
              character: automation.character.toJSON() as unknown as Record<string, unknown>,
              initialized: true,
              revision: storedAbility.revision + 1,
            };
            changedAbilityIds.add(characterId);
          }
        }
      } catch (error) {
        sendError(
          webSocket,
          "CUSTOM_AUTOMATION_REJECTED",
          error instanceof Error ? error.message : "An initiative custom automation failed.",
        );
        return;
      }
    }

    nextSession = projectInitiativeSessionFromCharacterState(
      nextSession,
      { abilities, hp, conditions },
    ).session;
    state.session = nextSession as unknown as Record<string, unknown>;
    state.revision += 1;
    const changedCharacterIds = new Set([
      ...changedAbilityIds,
      ...sourceSync.changedHpIds,
      ...sourceSync.changedConditionIds,
    ]);
    const affectedScopes = [
      INITIATIVE_SHARED_SCOPE,
      ...Array.from(changedCharacterIds, characterScope),
    ];
    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: result.operation,
      affectedScopes,
      reverseOperation: {
        type: "session.initiative.restore",
        characterId: "session",
        affectedScopes,
        snapshot: before,
        ...(changedAbilityIds.size
          ? {
              abilities: Object.fromEntries(
                Array.from(changedAbilityIds).map((characterId) => [
                  characterId,
                  previousAbilities[characterId],
                ]),
              ),
            }
          : {}),
        ...(sourceSync.changedHpIds.size ? { hp: sourceSync.previousHp } : {}),
        ...(sourceSync.changedConditionIds.size ? { conditions: sourceSync.previousConditions } : {}),
      },
    });

    const writes: Record<string, unknown> = { [INITIATIVE_STATE_KEY]: state };
    if (changedAbilityIds.size) writes[ABILITIES_STATE_KEY] = abilities;
    if (sourceSync.changedHpIds.size) writes[HP_STATE_KEY] = hp;
    if (sourceSync.changedConditionIds.size) writes[CONDITIONS_STATE_KEY] = conditions;
    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });
    broadcastVisibilityFiltered(this.ctx.getWebSockets(), { type: "session.initiative.updated", state });
    for (const characterId of changedAbilityIds) {
      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {
        type: "session.abilities.updated",
        character: abilities[characterId],
      });
    }
    for (const characterId of sourceSync.changedHpIds) {
      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {
        type: "session.hp.updated",
        character: hp[characterId],
      });
    }
    for (const characterId of sourceSync.changedConditionIds) {
      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {
        type: "session.conditions.updated",
        character: conditions[characterId],
      });
    }
  }
}

export async function readInitiativeState(storage: DurableObjectStorage): Promise<SessionInitiativeState> {
  return (await storage.get<SessionInitiativeState>(INITIATIVE_STATE_KEY)) ?? {
    initialized: false,
    revision: 0,
    session: emptyInitiativeSession() as unknown as Record<string, unknown>,
  };
}

function initiativeAutomationEvents(
  before: InitiativeSession,
  after: InitiativeSession,
  operation: SessionInitiativeOperation,
): InitiativeAutomationEvent[] {
  const beforeParticipants = characterSourceIds(before.entries);
  const afterParticipants = characterSourceIds(after.entries);
  const events: InitiativeAutomationEvent[] = [];

  if (operation.type === "initiative.combat.start") {
    if (afterParticipants.length) {
      events.push({ event: "combatStarted", characterIds: afterParticipants });
      events.push({ event: "roundStarted", characterIds: afterParticipants });
    }
    const active = activeCharacterId(after);
    if (active) events.push({ event: "turnStarted", characterIds: [active] });
    return events;
  }

  if (operation.type === "initiative.combat.end") {
    const active = activeCharacterId(before);
    if (active) events.push({ event: "turnEnded", characterIds: [active] });
    if (beforeParticipants.length) {
      events.push({ event: "combatEnded", characterIds: beforeParticipants });
    }
    return events;
  }

  if (operation.type === "initiative.turn.next") {
    const ending = activeCharacterId(before);
    if (ending) events.push({ event: "turnEnded", characterIds: [ending] });
    if (after.round > before.round && beforeParticipants.length) {
      events.push({ event: "roundEnded", characterIds: beforeParticipants });
      events.push({ event: "roundStarted", characterIds: afterParticipants });
    }
    const starting = activeCharacterId(after);
    if (starting) events.push({ event: "turnStarted", characterIds: [starting] });
  }

  // Rewinding/resetting initiative is administrative state correction. It must
  // not replay gameplay automations and duplicate their effects.
  return events;
}

function activeCharacterId(session: InitiativeSession): string | null {
  const entry = session.entries.find((candidate) => candidate.id === session.activeEntryId);
  return entry?.sourceType === "character" && entry.sourceId?.trim()
    ? entry.sourceId.trim()
    : null;
}

function characterSourceIds(entries: InitiativeEntry[]): string[] {
  return Array.from(new Set(
    entries.flatMap((entry) =>
      entry.sourceType === "character" && entry.sourceId?.trim()
        ? [entry.sourceId.trim()]
        : [],
    ),
  ));
}

function hydrateCharacterForAutomation(
  state: SessionAbilityState,
  hp: SessionHpState,
): CharacterTemplate {
  const character = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>);
  const sheet = character.get("sheet");
  return character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized
        ? { ...hp.savingThrows }
        : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
      stats: hp.statsInitialized
        ? {
            ...sheet.stats,
            armorClassAdjustment: hp.stats.armorClassAdjustment,
            initiativeAdjustment: hp.stats.initiativeAdjustment,
            mobilityAdjustment: hp.stats.mobilityAdjustment,
            passivePerceptionAdjustment: hp.stats.passivePerceptionAdjustment,
            exhaustion: hp.stats.exhaustion,
            inspiration: hp.stats.inspiration,
            experience: hp.stats.experience,
          }
        : sheet.stats,
      HP: {
        ...sheet.HP,
        current: hp.current,
        temporary: hp.temporary,
        max: hp.max,
        currentMax: hp.currentMax,
      },
    },
  });
}

function runtimeDefinitionsForCharacter(
  character: CharacterTemplate,
  runtimeConfig: SessionRuntimeConfigSnapshot,
  characterId: string,
): CustomSystemDefinition[] {
  const configured = runtimeConfig.config.characters.find((entry) => entry.characterId === characterId);
  if (!configured) return [];
  const installations = new Map(
    configured.customSystems
      .filter((entry) => entry.enabled)
      .map((entry) => [entry.systemId, entry]),
  );
  const states = new Map(
    (character.get("sheet").customSystems ?? []).map((state) => [state.systemId, state]),
  );
  return runtimeConfig.config.customSystems.filter((definition) => {
    const installation = installations.get(definition.id);
    const state = states.get(definition.id);
    return Boolean(
      installation
      && state?.enabled
      && installation.systemVersion === definition.version
      && state.systemVersion === installation.systemVersion,
    );
  });
}

function enrichCustomInitiativeActionConditions(
  operation: Extract<SessionInitiativeOperation, { type: "initiative.customAction.execute" }>,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
  before: InitiativeSession,
  conditions: Record<string, SessionConditionsState>,
  previousConditions: Record<string, SessionConditionsState>,
): void {
  const system = runtimeConfig?.config.customSystems.find((definition) => definition.id === operation.systemId);
  const action = system?.actions?.find((candidate) => candidate.id === operation.actionId);
  if (!system || !action) return;
  const additions = (action.conditionChanges ?? []).filter((change) => change.operation === "add");
  if (!additions.length) return;

  for (const entryId of operation.entryIds) {
    const entry = before.entries.find((candidate) => candidate.id === entryId);
    const characterId = linkedCharacterIdForInitiativeEntry(entry);
    if (!characterId) continue;
    const state = conditions[characterId];
    const previous = previousConditions[characterId];
    if (!state?.initialized || !previous?.initialized) continue;

    const previousIds = new Set(previous.conditions.map((condition) => condition.id));
    const unmatched = state.conditions.filter((condition) =>
      !previousIds.has(condition.id)
      && condition.linkedCombatantId === entryId,
    );
    const used = new Set<string>();

    for (const change of additions) {
      const condition = unmatched.find((candidate) =>
        !used.has(candidate.id)
        && normalizeName(candidate.name) === normalizeName(change.name),
      );
      if (!condition) continue;
      used.add(condition.id);
      condition.description = change.description ?? condition.description;
      condition.behavior = change.behavior ?? condition.behavior;
      condition.source = change.source ?? system.name;
      condition.notes = change.notes ?? condition.notes;
      condition.tags = change.tags ? [...change.tags] : condition.tags;
      if (change.bonuses) condition.bonuses = structuredClone(change.bonuses);
      if (change.sourceCharacterId) condition.sourceCharacterId = change.sourceCharacterId;
      condition.duration = richCustomConditionDuration(change.duration, condition.duration);
    }
  }
}

function richCustomConditionDuration(
  duration: import("../../../../src/models/characters/CharacterCondition").CharacterConditionDuration & { amount?: number } | undefined,
  fallback: SessionCondition["duration"],
): SessionCondition["duration"] {
  if (!duration) return fallback;
  const { amount, ...rich } = duration;
  const normalizedAmount = typeof amount === "number" && Number.isFinite(amount)
    ? Math.max(0, Math.trunc(amount))
    : undefined;
  return {
    ...rich,
    ...(rich.total === undefined && normalizedAmount !== undefined ? { total: normalizedAmount } : {}),
    ...(rich.remaining === undefined && normalizedAmount !== undefined ? { remaining: normalizedAmount } : {}),
  } as SessionCondition["duration"];
}

function applyInitiativeOperation(
  current: InitiativeSession,
  operation: SessionInitiativeOperation,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): { ok: true; session: InitiativeSession; operation: SessionInitiativeOperation } | { ok: false; code: string; message: string } {
  switch (operation.type) {
    case "initiative.entries.add": {
      if (!operation.entries.length || operation.entries.length > 50) return invalid("INITIATIVE_ENTRIES_INVALID", "Add between 1 and 50 initiative entries at a time.");
      const inputs = operation.entries.flatMap((entry) => normalizeEntryInput(entry));
      if (inputs.length !== operation.entries.length) return invalid("INITIATIVE_ENTRY_INVALID", "One or more initiative entries are invalid.");
      const existingIds = new Set(current.entries.map((entry) => entry.id));
      const session = current.started
        ? addEntriesDuringCombat(current, inputs)
        : addInitiativeEntries(current, inputs);
      const addedEntries = session.entries.filter((entry) => !existingIds.has(entry.id));
      return {
        ok: true,
        session,
        operation: {
          ...operation,
          entries: addedEntries as unknown as Record<string, unknown>[],
        },
      };
    }
    case "initiative.entry.update": {
      const existing = current.entries.find((entry) => entry.id === operation.entryId);
      if (!existing) return invalid("INITIATIVE_ENTRY_NOT_FOUND", "Initiative entry was not found.");
      const patch = normalizeEntryPatch(operation.patch);
      if (!Object.keys(patch).length) return invalid("INITIATIVE_PATCH_INVALID", "No supported initiative fields were supplied.");
      const session = updateInitiativeEntry(current, operation.entryId, (entry) => ({ ...entry, ...patch, id: entry.id, order: entry.order, createdAt: entry.createdAt }));
      return { ok: true, session, operation: { ...operation, patch } };
    }
    case "initiative.entry.remove": {
      if (!current.entries.some((entry) => entry.id === operation.entryId)) return invalid("INITIATIVE_ENTRY_NOT_FOUND", "Initiative entry was not found.");
      return { ok: true, session: removeInitiativeEntry(current, operation.entryId), operation };
    }
    case "initiative.conditions.bulk": {
      const entryIds = Array.from(new Set(operation.entryIds));
      if (!entryIds.length || entryIds.length > 50) return invalid("INITIATIVE_BULK_TARGETS_INVALID", "Select between 1 and 50 initiative targets.");
      if (entryIds.some((entryId) => !current.entries.some((entry) => entry.id === entryId))) {
        return invalid("INITIATIVE_ENTRY_NOT_FOUND", "One or more initiative targets were not found.");
      }
      let session = current;
      if (operation.mode === "add") {
        const condition = normalizeInitiativeConditionInput(operation.condition);
        if (!condition) return invalid("INITIATIVE_CONDITION_INVALID", "The initiative condition is invalid.");
        for (const entryId of entryIds) {
          session = applyInitiativeCondition(session, entryId, {
            ...condition,
            id: crypto.randomUUID(),
          });
        }
      } else {
        const conditionName = operation.conditionName?.trim();
        if (!conditionName) return invalid("INITIATIVE_CONDITION_INVALID", "Choose a condition to remove.");
        const normalizedName = normalizeName(conditionName);
        for (const entryId of entryIds) {
          const entry = session.entries.find((candidate) => candidate.id === entryId);
          if (!entry) continue;
          for (const condition of entry.conditions.filter((candidate) => normalizeName(candidate.name) === normalizedName)) {
            session = removeInitiativeCondition(session, entryId, condition.id);
          }
        }
      }
      if (JSON.stringify(session.entries) === JSON.stringify(current.entries)) {
        return invalid("INITIATIVE_BULK_NO_CHANGE", "The bulk condition operation did not change any target.");
      }
      return { ok: true, session, operation: { ...operation, entryIds } };
    }
    case "initiative.customAction.execute": {
      const system = runtimeConfig?.config.customSystems.find((definition) => definition.id === operation.systemId);
      const action = system?.actions?.find((candidate) => candidate.id === operation.actionId);
      const systemIsActive = Boolean(
        system && runtimeConfig?.config.characters.some((character) =>
          character.customSystems.some((installation) =>
            installation.systemId === system.id
            && installation.enabled
            && !installation.suppressed
            && installation.systemVersion === system.version,
          ),
        ),
      );
      if (!system || !action || !systemIsActive || action.enabled === false || !action.initiative?.enabled) {
        return invalid("INITIATIVE_CUSTOM_ACTION_NOT_FOUND", "This initiative custom-system action is not available in the active session.");
      }
      const entryIds = Array.from(new Set(operation.entryIds));
      const targets = entryIds.flatMap((entryId) => {
        const entry = current.entries.find((candidate) => candidate.id === entryId);
        return entry ? [entry] : [];
      });
      if (targets.length !== entryIds.length) return invalid("INITIATIVE_ENTRY_NOT_FOUND", "One or more initiative targets were not found.");
      const minimum = Math.max(1, Math.trunc(action.initiative.minimumTargets ?? 1));
      const maximum = Math.max(minimum, Math.min(50, Math.trunc(action.initiative.maximumTargets ?? 50)));
      if (targets.length < minimum || targets.length > maximum) {
        return invalid("INITIATIVE_CUSTOM_ACTION_TARGET_COUNT", `Select between ${minimum} and ${maximum} targets for this action.`);
      }
      const targetSide = action.initiative.targetSide ?? "any";
      if (targetSide !== "any" && targets.some((target) => target.side !== targetSide)) {
        return invalid("INITIATIVE_CUSTOM_ACTION_TARGET_SIDE", "One or more selected targets do not match the action target side.");
      }
      const changes = action.conditionChanges ?? [];
      if (!changes.length) return invalid("INITIATIVE_CUSTOM_ACTION_NO_EFFECTS", "This action has no condition changes to apply in initiative.");
      let session = current;
      for (const target of targets) {
        for (const change of changes) {
          if (change.operation === "add") {
            session = applyInitiativeCondition(session, target.id, {
              id: crypto.randomUUID(),
              name: change.name,
              description: change.description,
              duration: customConditionDuration(change.duration, target.id),
            });
          } else {
            const latest = session.entries.find((candidate) => candidate.id === target.id);
            if (!latest) continue;
            const normalizedName = normalizeName(change.name);
            for (const condition of latest.conditions.filter((candidate) => normalizeName(candidate.name) === normalizedName)) {
              session = removeInitiativeCondition(session, target.id, condition.id);
            }
          }
        }
      }
      if (JSON.stringify(session.entries) === JSON.stringify(current.entries)) {
        return invalid("INITIATIVE_CUSTOM_ACTION_NO_CHANGE", "The custom action did not change any selected target.");
      }
      return { ok: true, session, operation: { ...operation, entryIds } };
    }
    case "initiative.sort": {
      if (current.started) return invalid("INITIATIVE_COMBAT_STARTED", "Initiative cannot be manually sorted after combat starts.");
      return { ok: true, session: sortInitiativeEntries(current), operation };
    }
    case "initiative.combat.start": {
      if (current.started) return invalid("INITIATIVE_ALREADY_STARTED", "Combat is already running.");
      if (!current.entries.length) return invalid("INITIATIVE_EMPTY", "Add at least one creature before starting combat.");
      return { ok: true, session: startInitiativeCombat(current), operation };
    }
    case "initiative.combat.end": {
      if (!current.started) return invalid("INITIATIVE_NOT_STARTED", "Combat is not running.");
      return { ok: true, session: endInitiativeCombat(current), operation };
    }
    case "initiative.turn.next": {
      if (!current.started) return invalid("INITIATIVE_NOT_STARTED", "Combat is not running.");
      return { ok: true, session: advanceInitiativeTurn(current), operation };
    }
    case "initiative.turn.previous": {
      if (!current.started) return invalid("INITIATIVE_NOT_STARTED", "Combat is not running.");
      return { ok: true, session: rewindInitiativeTurn(current), operation };
    }
    case "initiative.allies.trade": {
      if (!canTradeConsecutiveAllies(current, operation.entryId, 1)) return invalid("INITIATIVE_TRADE_INVALID", "These entries cannot trade initiative positions.");
      return { ok: true, session: tradeConsecutiveAllies(current, operation.entryId, 1), operation };
    }
    case "initiative.viewMode.set": {
      if (current.viewMode === operation.viewMode) return invalid("INITIATIVE_VIEW_UNCHANGED", "Initiative already uses this view mode.");
      return { ok: true, session: { ...current, viewMode: operation.viewMode, updatedAt: Date.now() }, operation };
    }
    case "initiative.settings.update": {
      const visibility = operation.patch.deathSaveVisibility;
      if (
        visibility !== undefined &&
        visibility !== "masterOnly" &&
        visibility !== "owner" &&
        visibility !== "everyone"
      ) {
        return invalid("INITIATIVE_SETTINGS_INVALID", "Invalid death-save visibility setting.");
      }
      if (
        operation.patch.deathSaveOwnerCanEdit !== undefined &&
        typeof operation.patch.deathSaveOwnerCanEdit !== "boolean"
      ) {
        return invalid("INITIATIVE_SETTINGS_INVALID", "Invalid death-save edit setting.");
      }
      return {
        ok: true,
        session: {
          ...current,
          ...(visibility !== undefined ? { deathSaveVisibility: visibility } : {}),
          ...(operation.patch.deathSaveOwnerCanEdit !== undefined
            ? { deathSaveOwnerCanEdit: operation.patch.deathSaveOwnerCanEdit }
            : {}),
          updatedAt: Date.now(),
        },
        operation,
      };
    }
    case "initiative.deathSaves.set": {
      const existing = current.entries.find((entry) => entry.id === operation.entryId);
      if (!existing || existing.sourceType !== "character") {
        return invalid("INITIATIVE_ENTRY_NOT_FOUND", "Player initiative entry was not found.");
      }
      if (!existing.downed && (existing.currentHp ?? 0) > 0) {
        return invalid("DEATH_SAVES_NOT_ACTIVE", "Death saves are only active while the character is downed.");
      }
      const deathSaves = {
        successes: operation.successes,
        failures: operation.failures,
      };
      return {
        ok: true,
        session: updateInitiativeEntry(current, operation.entryId, (entry) => ({
          ...entry,
          deathSaves,
        })),
        operation,
      };
    }
    case "initiative.reset": {
      return { ok: true, session: createInitiativeSession(current.name || "Combate da sessão"), operation };
    }
  }
}

/**
 * Inserts reinforcements without re-sorting existing combatants. Existing
 * manual trades and the current turn therefore remain intact. The round anchor
 * stays at the front of the cycle; a reinforcement inserted before the current
 * actor naturally waits until the next cycle, while one inserted after it can
 * still act this round.
 */
function addEntriesDuringCombat(current: InitiativeSession, inputs: NewInitiativeEntry[]): InitiativeSession {
  const seeded = addInitiativeEntries({ ...current, started: false }, inputs);
  const additions = seeded.entries
    .slice(current.entries.length)
    .sort(compareInitiative);
  const entries = [...current.entries];
  const anchorIndex = current.roundAnchorEntryId
    ? Math.max(0, entries.findIndex((entry) => entry.id === current.roundAnchorEntryId))
    : 0;
  const minimumInsertIndex = Math.min(entries.length, anchorIndex + 1);

  for (const addition of additions) {
    let insertAt = entries.length;
    for (let index = minimumInsertIndex; index < entries.length; index += 1) {
      if (compareInitiative(addition, entries[index]) < 0) {
        insertAt = index;
        break;
      }
    }
    entries.splice(insertAt, 0, addition);
  }

  return {
    ...current,
    entries: entries.map((entry, order) => ({ ...entry, order })),
    activeEntryId: current.activeEntryId,
    roundAnchorEntryId: current.roundAnchorEntryId,
    updatedAt: Date.now(),
  };
}

function compareInitiative(left: InitiativeEntry, right: InitiativeEntry): number {
  if (right.initiative !== left.initiative) return right.initiative - left.initiative;
  if (right.initiativeBonus !== left.initiativeBonus) return right.initiativeBonus - left.initiativeBonus;
  if ((right.dexterity ?? 0) !== (left.dexterity ?? 0)) return (right.dexterity ?? 0) - (left.dexterity ?? 0);
  return left.createdAt - right.createdAt;
}

function normalizeEntryInput(value: Record<string, unknown>): NewInitiativeEntry[] {
  const name = readString(value.name);
  const initiative = finite(value.initiative);
  const initiativeBonus = finite(value.initiativeBonus);
  const sourceType = value.sourceType;
  const side = value.side;
  if (!name || initiative === null || initiativeBonus === null) return [];
  if (sourceType !== "character" && sourceType !== "npc" && sourceType !== "monster" && sourceType !== "custom") return [];
  if (side !== "ally" && side !== "enemy" && side !== "neutral") return [];
  return [{
    sourceId: optionalString(value.sourceId),
    sourceType,
    name,
    realName: optionalString(value.realName),
    basicName: optionalString(value.basicName),
    customName: optionalString(value.customName),
    revealRealName: value.revealRealName === true,
    imageUrl: optionalString(value.imageUrl),
    initiative,
    initiativeBonus,
    dexterity: optionalFinite(value.dexterity),
    side,
    armorClass: optionalFinite(value.armorClass),
    currentHp: optionalFinite(value.currentHp),
    maxHp: optionalFinite(value.maxHp),
    temporaryHp: optionalFinite(value.temporaryHp),
    hidden: value.hidden === true,
    defeated: value.defeated === true,
    downed: value.downed === true,
    defeatReason:
      value.defeatReason === "manual" || value.defeatReason === "zeroHp"
        ? value.defeatReason
        : undefined,
    deathSaves: sourceType === "character"
      ? normalizeDeathSaves(value.deathSaves)
      : undefined,
    conditions: Array.isArray(value.conditions) ? structuredClone(value.conditions) as InitiativeEntry["conditions"] : [],
  }];
}

function normalizeEntryPatch(value: Record<string, unknown>): Partial<InitiativeEntry> {
  const patch: Partial<InitiativeEntry> = {};
  if (typeof value.name === "string" && value.name.trim()) patch.name = value.name.trim();
  for (const key of ["realName", "basicName", "customName"] as const) {
    if (!(key in value)) continue;
    patch[key] = optionalString(value[key]);
  }
  if (typeof value.revealRealName === "boolean") patch.revealRealName = value.revealRealName;
  for (const key of ["initiative", "initiativeBonus", "dexterity", "armorClass", "currentHp", "maxHp", "temporaryHp"] as const) {
    if (!(key in value)) continue;
    const parsed = optionalFinite(value[key]);
    if (parsed !== undefined) patch[key] = parsed;
  }
  if (value.side === "ally" || value.side === "enemy" || value.side === "neutral") patch.side = value.side;
  if (typeof value.hidden === "boolean") patch.hidden = value.hidden;
  if (typeof value.defeated === "boolean") patch.defeated = value.defeated;
  if (typeof value.downed === "boolean") patch.downed = value.downed;
  if ("defeatReason" in value) {
    patch.defeatReason = value.defeatReason === "manual" || value.defeatReason === "zeroHp"
      ? value.defeatReason
      : undefined;
  }
  if ("deathSaves" in value) patch.deathSaves = normalizeDeathSaves(value.deathSaves);
  if (Array.isArray(value.conditions)) patch.conditions = structuredClone(value.conditions) as InitiativeEntry["conditions"];
  return patch;
}

function normalizeInitiativeConditionInput(value: unknown): Omit<InitiativeEntry["conditions"][number], "id"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = readString(record.name);
  if (!name || name.length > 200) return null;
  const description = optionalString(record.description);
  const duration = normalizeInitiativeDuration(record.duration);
  if (!duration) return null;
  return { name, description, duration };
}

function normalizeInitiativeDuration(value: unknown): InitiativeEntry["conditions"][number]["duration"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: "manual" };
  const record = value as Record<string, unknown>;
  if (record.type === "manual") return { type: "manual" };
  if (record.type === "turns" || record.type === "rounds") {
    const remaining = finite(record.remaining);
    return remaining !== null && remaining >= 0
      ? { type: record.type, remaining: Math.trunc(remaining) }
      : null;
  }
  if (record.type === "untilTurnStart" || record.type === "untilTurnEnd") {
    const ownerEntryId = readString(record.ownerEntryId);
    return ownerEntryId ? { type: record.type, ownerEntryId } : null;
  }
  return null;
}

function customConditionDuration(
  duration: import("../../../../src/models/characters/CharacterCondition").CharacterConditionDuration & { amount?: number } | undefined,
  targetEntryId: string,
): InitiativeEntry["conditions"][number]["duration"] {
  if (!duration) return { type: "manual" };
  if (duration.type === "rounds" || duration.type === "turns") {
    return {
      type: duration.type,
      remaining: Math.max(1, Math.trunc(duration.remaining ?? duration.total ?? duration.amount ?? 1)),
    };
  }
  if (duration.type === "until-start-of-turn") return { type: "untilTurnStart", ownerEntryId: targetEntryId };
  if (duration.type === "until-end-of-turn") return { type: "untilTurnEnd", ownerEntryId: targetEntryId };
  return { type: "manual" };
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function emptyInitiativeSession(): InitiativeSession {
  return {
    version: 1,
    id: "session-initiative",
    name: "Combate da sessão",
    entries: [],
    round: 1,
    started: false,
    viewMode: "table",
    deathSaveVisibility: "owner",
    deathSaveOwnerCanEdit: false,
    createdAt: 0,
    updatedAt: 0,
  };
}
function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function normalizeDeathSaves(value: unknown): NonNullable<InitiativeEntry["deathSaves"]> {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const successes = typeof record.successes === "number" && Number.isFinite(record.successes)
    ? Math.max(0, Math.min(3, Math.trunc(record.successes)))
    : 0;
  const failures = typeof record.failures === "number" && Number.isFinite(record.failures)
    ? Math.max(0, Math.min(3, Math.trunc(record.failures)))
    : 0;
  return { successes, failures };
}

function optionalFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function optionalString(value: unknown): string | undefined {
  return readString(value) || undefined;
}
function invalid(code: string, message: string) {
  return { ok: false as const, code, message };
}
function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection; } catch { return null; }
}
function send(webSocket: WebSocket, value: unknown): void {
  try { webSocket.send(JSON.stringify(value)); } catch {}
}
function sendError(webSocket: WebSocket, code: string, message: string): void {
  send(webSocket, { type: "session.error", code, message });
}
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}
