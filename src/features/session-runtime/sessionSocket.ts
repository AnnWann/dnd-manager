import { SessionMessageClient } from "../../../packages/session-client/src/sessionMessageClient"
import {
  parseServerSessionMessage,
  type ClientSessionMessage,
  type ServerSessionMessage,
  type SessionRuntimeRole,
} from "./sessionProtocol"
import {
  parseAbilityServerMessage,
  type SessionAbilityClientMessage,
  type SessionAbilityServerMessage,
  type SessionAbilityState,
} from "./abilitySessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import type { SessionProficiencyClientMessage } from "./proficiencySessionProtocol"
import type { SessionRaceClientMessage } from "./raceSessionProtocol"
import type { SessionProfileClientMessage } from "./profileSessionProtocol"
import type { SessionCustomClassClientMessage } from "./customClassSessionProtocol"
import type { SessionCustomSystemClientMessage } from "./customSystemSessionProtocol"
import {
  parseCharacterLifecycleServerMessage,
  type SessionCharacterLifecycleClientMessage,
  type SessionCharacterLifecycleServerMessage,
} from "./characterLifecycleSessionProtocol"
import type {
  SessionInventoryClientMessage,
  SessionInventoryServerMessage,
} from "./inventorySessionProtocol"
import {
  parseMissionServerMessage,
  type SessionMissionClientMessage,
  type SessionMissionServerMessage,
} from "./missionSessionProtocol"
import {
  parseInitiativeServerMessage,
  type SessionInitiativeClientMessage,
  type SessionInitiativeServerMessage,
} from "./initiativeSessionProtocol"
import {
  parseRuntimeConfigServerMessage,
  type SessionRuntimeConfigClientMessage,
  type SessionRuntimeConfigServerMessage,
} from "./runtimeConfigSessionProtocol"
import { setRuntimeCustomSystemOverride } from "../../lib/customSystems/creationCustomSystemsBridge"
import type { SessionSheetOperationMessage } from "./sheetRoutes"

export type SessionRuntimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

export type SessionSocketOptions = {
  baseUrl: string
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  clientId: string
  onStatusChange: (status: SessionRuntimeStatus) => void
  onMessage: (
    message:
      | ServerSessionMessage
      | SessionAbilityServerMessage
      | SessionInventoryServerMessage
      | SessionCharacterLifecycleServerMessage
      | SessionMissionServerMessage
      | SessionInitiativeServerMessage
      | SessionRuntimeConfigServerMessage
  ) => void
}

type SessionOutgoingMessage = | ClientSessionMessage
    | SessionSheetOperationMessage
    | SessionAbilityClientMessage
    | SessionInventoryClientMessage
    | SessionMissionClientMessage
    | SessionInitiativeClientMessage
    | SessionProficiencyClientMessage
    | SessionRaceClientMessage
    | SessionProfileClientMessage
    | SessionCustomClassClientMessage
    | SessionCharacterLifecycleClientMessage
    | SessionRuntimeConfigClientMessage
    | SessionCustomSystemClientMessage
    | { type: "session.magic.operation"; operation: SessionMagicOperation }
    | { type: "session.equipment.operation"; operation: SessionEquipmentOperation }
type SessionIncomingMessage = Parameters<SessionSocketOptions["onMessage"]>[0]
type DecodedSessionMessage = {
  message: SessionIncomingMessage
  abilityMessage: SessionAbilityServerMessage | null
  lifecycleMessage: SessionCharacterLifecycleServerMessage | null
  runtimeConfigMessage: SessionRuntimeConfigServerMessage | null
}

function decodeSessionMessage(raw: string): DecodedSessionMessage | null {
  const runtimeConfigMessage = parseRuntimeConfigServerMessage(raw)
  const lifecycleMessage = parseCharacterLifecycleServerMessage(raw)
  const inventoryMessage = parseInventoryServerMessage(raw)
  const missionMessage = parseMissionServerMessage(raw)
  const initiativeMessage = parseInitiativeServerMessage(raw)
  const abilityMessage = parseAbilityServerMessage(raw)
  const message = runtimeConfigMessage ?? lifecycleMessage ?? inventoryMessage ?? missionMessage ?? initiativeMessage ?? abilityMessage ?? parseServerSessionMessage(raw)
  return message ? { message, abilityMessage, lifecycleMessage, runtimeConfigMessage } : null
}

export class SessionSocket {
  private readonly transport: SessionMessageClient<SessionOutgoingMessage, DecodedSessionMessage>
  private pendingMagicOperations: SessionMagicOperation[] = []
  private magicFlushQueued = false
  private latestAbilityStates = new Map<string, SessionAbilityState>()

  constructor(private readonly options: SessionSocketOptions) {
    const configured = import.meta.env.VITE_SESSION_AUTH_MODE?.trim().toLowerCase()
    const useTokenAuth = configured === "token" ? true : configured === "development" ? false : !import.meta.env.DEV
    this.transport = new SessionMessageClient({
      baseUrl: options.baseUrl,
      sessionId: options.sessionId,
      userId: options.userId,
      role: options.role,
      clientId: options.clientId,
      useTokenAuth,
      tokenEndpoint: "/api/session-connection",
      onStatusChange: options.onStatusChange,
      onDisconnected: () => this.clearLocalState(),
      onKicked: () => window.location.assign("/user"),
    }, decodeSessionMessage, (decoded) => this.handleMessage(decoded))
  }


  connect(): void { this.transport.connect() }

  send(message: SessionOutgoingMessage): boolean {
    if (!this.transport.connected) return false

    if (message.type === "session.magic.operation") {
      if (message.operation.type === "character.spell.cast") {
        this.flushMagicOperations()
        this.transport.send(message)
        return true
      }
      this.pendingMagicOperations.push(message.operation)
      this.scheduleMagicFlush()
      return true
    }

    this.transport.sendRaw(JSON.stringify(message))
    return true
  }

  disconnect(): void {
    this.transport.disconnect()
    this.clearLocalState()
  }

  private clearLocalState(): void {
    this.pendingMagicOperations = []
    this.magicFlushQueued = false
    this.latestAbilityStates.clear()
    setRuntimeCustomSystemOverride(null)
  }

  private handleMessage({ message, abilityMessage, lifecycleMessage, runtimeConfigMessage }: DecodedSessionMessage): void {
      if (abilityMessage?.type === "session.abilities.snapshot") {
        this.latestAbilityStates = new Map(
          abilityMessage.characters.map((character) => [character.characterId, character]),
        )
      } else if (abilityMessage?.type === "session.abilities.updated") {
        this.latestAbilityStates.set(
          abilityMessage.character.characterId,
          abilityMessage.character,
        )
      }
      if (lifecycleMessage?.type === "session.character.removed") {
        this.latestAbilityStates.delete(lifecycleMessage.characterId)
      }

      if (runtimeConfigMessage) {
        setRuntimeCustomSystemOverride(
          runtimeConfigMessage.snapshot?.config.customSystems ?? null,
        )
      }
      this.options.onMessage(message)

      // A Creation configuration change can alter formula fields, resource
      // maxima and native stat overrides without changing the raw ability-state
      // character snapshot. Re-emit the latest snapshots after activating the
      // new definitions so CharacterTemplate.fromJSON rebuilds those derived
      // custom-system values immediately.
      if (runtimeConfigMessage && this.latestAbilityStates.size > 0) {
        for (const character of this.latestAbilityStates.values()) {
          this.options.onMessage({
            type: "session.abilities.updated",
            character,
          })
        }
      }
  }
  private scheduleMagicFlush(): void {
    if (this.magicFlushQueued) return
    this.magicFlushQueued = true

    queueMicrotask(() => {
      this.flushMagicOperations()
    })
  }

  private flushMagicOperations(): void {
    this.magicFlushQueued = false
    const transport = this.transport
    const pending = this.pendingMagicOperations.splice(0)
    if (!pending.length || !transport.connected) return

    const byCharacter = new Map<string, SessionMagicOperation[]>()
    for (const operation of pending) {
      const group = byCharacter.get(operation.characterId)
      if (group) group.push(operation)
      else byCharacter.set(operation.characterId, [operation])
    }

    for (const operations of byCharacter.values()) {
      const payload = operations.length === 1
        ? { type: "session.magic.operation", operation: operations[0] }
        : { type: "session.magic.operations", operations }
      transport.sendRaw(JSON.stringify(payload))
    }
  }

}

function parseInventoryServerMessage(raw: string): SessionInventoryServerMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value?.type !== "session.inventory.snapshot" && value?.type !== "session.inventory.updated") return null
    if (!value.state || typeof value.state !== "object") return null
    return value as SessionInventoryServerMessage
  } catch {
    return null
  }
}
