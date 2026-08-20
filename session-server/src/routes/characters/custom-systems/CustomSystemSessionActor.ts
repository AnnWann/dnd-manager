import {
  adjustCustomResource,
  CustomSystemOperationError,
  removeCustomFieldValue,
  resetCustomResource,
  setCustomFieldValue,
  setCustomResourceState,
  type CustomSystemActor,
} from "../../../../../src/lib/customSystems/CustomSystemState";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../../src/models/characters/CharacterTemplate";
import type { CharacterCustomSystemState } from "../../../../../src/models/customSystems/CustomSystemDefinition";
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

    let nextState: CharacterCustomSystemState;
    try {
      nextState = applyOperation(
        definition,
        currentState,
        operation,
        connection.role === "MASTER" ? "master" : "owner",
      );
    } catch (error) {
      if (error instanceof CustomSystemOperationError) {
        const first = error.errors[0];
        sendError(webSocket, `CUSTOM_SYSTEM_${(first?.code ?? "OPERATION_REJECTED").toUpperCase()}`, first?.message ?? error.message);
        return;
      }
      sendError(webSocket, "CUSTOM_SYSTEM_OPERATION_REJECTED", "The custom-system operation is invalid for the current state.");
      return;
    }

    if (JSON.stringify(currentState) === JSON.stringify(nextState)) {
      sendError(webSocket, "CUSTOM_SYSTEM_OPERATION_NO_CHANGE", "The requested custom-system operation does not change the current state.");
      return;
    }

    const nextStates = states.map((state) => state.systemId === operation.systemId ? nextState : state);
    const nextCharacter = character.withSheet("customSystems", nextStates);
    const nextAbility: SessionAbilityState = {
      characterId: operation.characterId,
      character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };
    abilityState[operation.characterId] = nextAbility;

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,
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

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [ABILITIES_STATE_KEY]: abilityState },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });

    broadcastVisibilityFiltered(this.ctx.getWebSockets(), {
      type: "session.abilities.updated",
      character: nextAbility,
    });
  }
}

function applyOperation(
  definition: Parameters<typeof setCustomFieldValue>[0],
  state: CharacterCustomSystemState,
  operation: SessionCustomSystemOperation,
  actor: CustomSystemActor,
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
  }
}

function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection | null; }
  catch { return null; }
}

function sendError(webSocket: WebSocket, code: string, message: string): void {
  try { webSocket.send(JSON.stringify({ type: "session.error", code, message })); } catch {}
}
