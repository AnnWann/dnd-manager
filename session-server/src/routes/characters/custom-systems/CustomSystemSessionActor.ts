import {
  addCustomAbility,
  adjustCustomResource,
  CustomSystemOperationError,
  removeCustomAbility,
  removeCustomFieldValue,
  resetCustomResource,
  setCustomAbilityUsage,
  setCustomFieldValue,
  setCustomResourceState,
  updateCustomAbilityField,
  type CustomSystemActor,
} from "../../../../../src/lib/customSystems/CustomSystemState";
import {
  initializeCustomAbilityProgress,
  setCustomAbilityLearned,
  setCustomAbilityPrepared,
} from "../../../../../src/lib/customSystems/CustomAbilityManagement";
import { activateCustomAbilityWithRoll } from "../../../../../src/lib/customSystems/CustomAbilityRoll";
import { activateCustomSystemAction } from "../../../../../src/lib/customSystems/CustomSystemActions";
import {
  runCustomSystemAutomation,
  runCustomSystemAutomations,
} from "../../../../../src/lib/customSystems/CustomAutomationRuntime";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../../src/models/characters/CharacterTemplate";
import { getCharacterConditions } from "../../../../../src/models/characters/characterConditionStorage";
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../../../src/models/customSystems/CustomSystemDefinition";
import { SessionActor as BaseSessionActor } from "../../session/SessionActor";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
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
import { readRuntimeConfig } from "../../session/runtimeConfigAccess";
import { broadcastVisibilityFiltered } from "../../session/visibilityDelivery";
import { MAX_HP_LOG_RECORDS } from "../sheet/hpState";
import {
  parseCustomSystemClientMessage,
  type SessionCustomSystemOperation,
} from "./customSystemProtocol";
import { validateRuntimeCustomSystemAccess } from "./runtimeCustomSystemAccess";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";

type RuntimeConfigSnapshot = NonNullable<Awaited<ReturnType<typeof readRuntimeConfig>>>;
type AccessError = { ok: false; code: string; message: string };
type AggregateCustomSystemOperation = Extract<
  SessionCustomSystemOperation,
  {
    type:
      | "character.customSystem.ability.activate"
      | "character.customSystem.action.execute"
      | "character.customSystem.automation.execute";
  }
>;

export class SessionActor extends BaseSessionActor {
  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseCustomSystemClientMessage(raw);
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
    operation: SessionCustomSystemOperation,
  ): Promise<void> {
    const [runtimeConfig, abilityState, hpState, conditionsState, log] = await Promise.all([
      readRuntimeConfig(this.ctx.storage),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      readSessionLog(this.ctx.storage),
    ]);

    const access = validateRuntimeCustomSystemAccess(
      runtimeConfig,
      operation.characterId,
      operation.systemId,
    );
    if (!access.ok) {
      sendError(webSocket, access.code, access.message);
      return;
    }
    const activeRuntimeConfig = runtimeConfig as RuntimeConfigSnapshot;
    const { definition, installation } = access.value;

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];
    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      sendError(webSocket, "CUSTOM_SYSTEM_STATE_NOT_INITIALIZED", "Authoritative character state must be initialized before custom-system state can change.");
      return;
    }

    let character: CharacterTemplate;
    try {
      character = CharacterTemplate.fromJSON(storedAbility.character as Partial<CharacterTemplateProps>);
    } catch {
      sendError(webSocket, "CUSTOM_SYSTEM_CHARACTER_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    const states = character.get("sheet").customSystems ?? [];
    const currentState = states.find((state) => state.systemId === operation.systemId);
    if (!currentState) {
      sendError(webSocket, "CUSTOM_SYSTEM_RUNTIME_STATE_MISSING", "The character does not have runtime state for this installed custom system.");
      return;
    }
    if (!currentState.enabled) {
      sendError(webSocket, "CUSTOM_SYSTEM_RUNTIME_DISABLED", "The character runtime state for this custom system is disabled.");
      return;
    }
    if (currentState.systemVersion !== installation.systemVersion) {
      sendError(webSocket, "CUSTOM_SYSTEM_RUNTIME_VERSION_MISMATCH", "The live custom-system state does not match the installed Creation version.");
      return;
    }

    let nextCharacter: CharacterTemplate;
    let loggedOperation: SessionCustomSystemOperation = operation;
    try {
      if (operation.type === "character.customSystem.ability.activate") {
        const activation = activateCustomAbilityWithRoll(
          character,
          activeRuntimeConfig.config.customSystems,
          operation.systemId,
          operation.abilityId,
          operation.rollValue,
        );
        nextCharacter = activation.character;
        if (activation.roll) {
          loggedOperation = {
            ...operation,
            rollValue: activation.roll.value,
          };
        }
        nextCharacter = runCustomSystemAutomations(
          nextCharacter,
          activeRuntimeConfig.config.customSystems,
          "abilityUsed",
        ).character;
      } else if (operation.type === "character.customSystem.action.execute") {
        nextCharacter = activateCustomSystemAction(
          character,
          activeRuntimeConfig.config.customSystems,
          operation.systemId,
          operation.actionId,
        );
      } else if (operation.type === "character.customSystem.automation.execute") {
        nextCharacter = runCustomSystemAutomation(
          character,
          activeRuntimeConfig.config.customSystems,
          operation.systemId,
          operation.automationId,
        ).character;
      } else {
        const nextState = applyOperation(
          definition,
          currentState,
          operation,
          connection.role === "MASTER" ? "master" : "owner",
          character,
        );
        if (JSON.stringify(currentState) === JSON.stringify(nextState)) {
          sendError(webSocket, "CUSTOM_SYSTEM_OPERATION_NO_CHANGE", "The requested custom-system operation does not change the current state.");
          return;
        }
        const nextStates = states.map((state) => state.systemId === operation.systemId ? nextState : state);
        nextCharacter = character.withSheet("customSystems", nextStates);
      }
    } catch (error) {
      if (error instanceof CustomSystemOperationError) {
        const first = error.errors[0];
        sendError(webSocket, `CUSTOM_SYSTEM_${(first?.code ?? "OPERATION_REJECTED").toUpperCase()}`, first?.message ?? error.message);
        return;
      }
      sendError(
        webSocket,
        "CUSTOM_SYSTEM_OPERATION_REJECTED",
        error instanceof Error ? error.message : "The custom-system operation is invalid for the current state.",
      );
      return;
    }

    const aggregateOperation = isAggregateOperation(operation);
    if (aggregateOperation) {
      const validation = validateRuntimeSystemChanges(
        activeRuntimeConfig,
        operation.characterId,
        character,
        nextCharacter,
      );
      if (!validation.ok) {
        sendError(webSocket, validation.code, validation.message);
        return;
      }
    }

    if (JSON.stringify(character.toJSON()) === JSON.stringify(nextCharacter.toJSON())) {
      sendError(webSocket, "CUSTOM_SYSTEM_OPERATION_NO_CHANGE", "The requested custom-system operation does not change the current state.");
      return;
    }

    const nextAbility: SessionAbilityState = {
      characterId: operation.characterId,
      character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };
    abilityState[operation.characterId] = nextAbility;

    const nextHp = aggregateOperation
      ? projectAggregateHp(hp, nextCharacter)
      : hp;
    const nextConditions = aggregateOperation
      ? projectAggregateConditions(conditions, nextCharacter)
      : conditions;
    const hpChanged = JSON.stringify(nextHp) !== JSON.stringify(hp);
    const conditionsChanged = JSON.stringify(nextConditions) !== JSON.stringify(conditions);
    if (hpChanged) hpState[operation.characterId] = nextHp;
    if (conditionsChanged) conditionsState[operation.characterId] = nextConditions;

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: loggedOperation,
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: structuredClone(storedAbility),
          hp: structuredClone(hp),
          conditions: structuredClone(conditions),
        },
      },
    });

    const writes: Record<string, unknown> = { [ABILITIES_STATE_KEY]: abilityState };
    if (hpChanged) writes[HP_STATE_KEY] = hpState;
    if (conditionsChanged) writes[CONDITIONS_STATE_KEY] = conditionsState;

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });

    const sockets = this.ctx.getWebSockets();
    broadcastVisibilityFiltered(sockets, {
      type: "session.abilities.updated",
      character: nextAbility,
    });
    if (hpChanged) {
      broadcastVisibilityFiltered(sockets, {
        type: "session.hp.updated",
        character: nextHp,
      });
    }
    if (conditionsChanged) {
      broadcastVisibilityFiltered(sockets, {
        type: "session.conditions.updated",
        character: nextConditions,
      });
    }
  }
}

function applyOperation(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  operation: Exclude<SessionCustomSystemOperation, AggregateCustomSystemOperation>,
  actor: CustomSystemActor,
  character: CharacterTemplate,
): CharacterCustomSystemState {
  switch (operation.type) {
    case "character.customSystem.field.set":
      return setCustomFieldValue(definition, state, operation.fieldId, operation.value, actor);
    case "character.customSystem.field.remove":
      return removeCustomFieldValue(definition, state, operation.fieldId, actor);
    case "character.customSystem.resource.set":
      return setCustomResourceState(definition, state, operation.resourceId, operation.state, actor);
    case "character.customSystem.resource.adjust":
      return adjustCustomResource(definition, state, operation.resourceId, operation.amount, actor);
    case "character.customSystem.resource.reset":
      return resetCustomResource(definition, state, operation.resourceId, actor);
    case "character.customSystem.ability.add":
      return addCustomAbility(
        definition,
        state,
        normalizeAddedAbility(definition, operation.ability),
        actor,
      );
    case "character.customSystem.ability.remove":
      return removeCustomAbility(definition, state, operation.abilityId, actor);
    case "character.customSystem.ability.field.set":
      return updateCustomAbilityField(
        definition,
        state,
        operation.abilityId,
        operation.fieldId,
        operation.value,
        actor,
      );
    case "character.customSystem.ability.learned.set":
      return setCustomAbilityLearned(
        definition,
        state,
        operation.abilityId,
        operation.learned,
        character,
      );
    case "character.customSystem.ability.prepared.set":
      return setCustomAbilityPrepared(
        definition,
        state,
        operation.abilityId,
        operation.prepared,
        character,
      );
    case "character.customSystem.ability.usage.set":
      return setCustomAbilityUsage(
        definition,
        state,
        operation.abilityId,
        operation.used,
        actor,
      );
  }
}

function normalizeAddedAbility(
  definition: CustomSystemDefinition,
  submitted: CustomAbilityInstance,
): CustomAbilityInstance {
  const type = definition.abilityTypes.find((entry) => entry.id === submitted.abilityTypeId);
  if (!type) throw new Error(`Tipo de habilidade “${submitted.abilityTypeId}” não encontrado.`);
  const preset = submitted.predefinedAbilityId
    ? type.predefinedAbilities?.find((entry) => entry.id === submitted.predefinedAbilityId)
    : undefined;
  if (submitted.predefinedAbilityId && !preset) {
    throw new Error(`Habilidade predefinida “${submitted.predefinedAbilityId}” não encontrada.`);
  }

  const effectiveType = preset?.acquisition
    ? { ...type, acquisition: { ...type.acquisition, ...preset.acquisition } }
    : type;
  const progress = initializeCustomAbilityProgress(effectiveType, {
    ...submitted,
    enabled: submitted.enabled !== false,
  });
  const usageDefinition = preset?.activation?.usage ?? type.activation?.usage;
  const usage = usageDefinition && (usageDefinition.mode ?? "limited") === "limited"
    ? { used: 0, maximum: usageDefinition.maximum }
    : undefined;

  return {
    ...progress,
    usage,
  };
}

function validateRuntimeSystemChanges(
  runtimeConfig: RuntimeConfigSnapshot,
  characterId: string,
  before: CharacterTemplate,
  after: CharacterTemplate,
): { ok: true } | AccessError {
  const beforeStates = before.get("sheet").customSystems ?? [];
  const afterStates = after.get("sheet").customSystems ?? [];
  const beforeById = new Map(beforeStates.map((state) => [state.systemId, state]));
  const afterIds = new Set(afterStates.map((state) => state.systemId));

  if (beforeStates.some((state) => !afterIds.has(state.systemId))) {
    return {
      ok: false,
      code: "CUSTOM_SYSTEM_EFFECT_INVALID_STATE_CHANGE",
      message: "Custom-system runtime effects cannot install or remove custom systems.",
    };
  }

  for (const nextState of afterStates) {
    const previous = beforeById.get(nextState.systemId);
    if (!previous) {
      return {
        ok: false,
        code: "CUSTOM_SYSTEM_EFFECT_INVALID_STATE_CHANGE",
        message: "Custom-system runtime effects cannot install or remove custom systems.",
      };
    }
    if (JSON.stringify(previous) === JSON.stringify(nextState)) continue;

    const access = validateRuntimeCustomSystemAccess(
      runtimeConfig,
      characterId,
      nextState.systemId,
    );
    if (!access.ok) return access;
    if (!nextState.enabled) {
      return {
        ok: false,
        code: "CUSTOM_SYSTEM_RUNTIME_DISABLED",
        message: `Custom system “${nextState.systemId}” changed by this effect is disabled at runtime.`,
      };
    }
    if (nextState.systemVersion !== access.value.installation.systemVersion) {
      return {
        ok: false,
        code: "CUSTOM_SYSTEM_RUNTIME_VERSION_MISMATCH",
        message: `Custom system “${nextState.systemId}” changed by this effect does not match its saved Creation version.`,
      };
    }
  }

  return { ok: true };
}

function projectAggregateHp(
  previous: SessionHpState,
  character: CharacterTemplate,
): SessionHpState {
  const sheet = character.get("sheet");
  const hp = sheet.HP;
  const inspiration = sheet.stats.inspiration ?? false;
  const exhaustion = sheet.stats.exhaustion ?? 0;
  const changed = previous.current !== hp.current
    || previous.temporary !== hp.temporary
    || previous.stats.inspiration !== inspiration
    || previous.stats.exhaustion !== exhaustion;
  if (!changed) return previous;

  return {
    ...previous,
    current: hp.current,
    temporary: hp.temporary,
    stats: {
      ...previous.stats,
      inspiration,
      exhaustion,
    },
    statsInitialized: true,
    revision: previous.revision + 1,
  };
}

function projectAggregateConditions(
  previous: SessionConditionsState,
  character: CharacterTemplate,
): SessionConditionsState {
  const conditions = getCharacterConditions(character);
  if (JSON.stringify(previous.conditions) === JSON.stringify(conditions)) return previous;
  return {
    ...previous,
    conditions,
    initialized: true,
    revision: previous.revision + 1,
  };
}

function isAggregateOperation(
  operation: SessionCustomSystemOperation,
): operation is AggregateCustomSystemOperation {
  return operation.type === "character.customSystem.ability.activate"
    || operation.type === "character.customSystem.action.execute"
    || operation.type === "character.customSystem.automation.execute";
}

function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection | null; }
  catch { return null; }
}

function sendError(webSocket: WebSocket, code: string, message: string): void {
  try { webSocket.send(JSON.stringify({ type: "session.error", code, message })); } catch {}
}
