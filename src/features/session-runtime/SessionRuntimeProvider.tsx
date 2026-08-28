import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { SessionSocket, type SessionRuntimeStatus } from "./sessionSocket"
import { toSheetOperationMessage } from "./sheetRoutes"
import type {
  SessionAbilityOperation,
  SessionAbilitySeed,
  SessionAbilityState,
} from "./abilitySessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import type { SessionProficiencyOperation } from "./proficiencySessionProtocol"
import type { SessionRaceOperation } from "./raceSessionProtocol"
import type { SessionProfileOperation } from "./profileSessionProtocol"
import type { SessionCustomClassOperation } from "./customClassSessionProtocol"
import type { SessionCustomSystemOperation } from "./customSystemSessionProtocol"
import type {
  SessionCharacterLifecycleOperation,
  SessionCharacterLifecycleState,
} from "./characterLifecycleSessionProtocol"
import type { SessionLogRecord } from "./sessionLogProtocol"
import type {
  SessionInventoryOperation,
  SessionSharedInventoryState,
} from "./inventorySessionProtocol"
import type {
  SessionMissionOperation,
  SessionMissionState,
} from "./missionSessionProtocol"
import type {
  SessionInitiativeOperation,
  SessionInitiativeState,
} from "./initiativeSessionProtocol"
import type { Itemmable } from "../../models/items/item"
import type { Mission } from "../../models/missions/Mission"
import type { InitiativeSession } from "../../models/initiative/Initiative"
import type { SessionRuntimeConfigSnapshot } from "../../shared/session-runtime/sessionRuntimeConfig"
import type {
  SessionAuthoritativeOperation,
  SessionCondition,
  SessionConditionOperation,
  SessionConditionSeed,
  SessionConcentrationOperation,
  SessionConditionsState,
  SessionHpSeed,
  SessionHpState,
  SessionLoggedOperation,
  SessionRuntimePresenceUser,
  SessionRuntimeRole,
} from "./sessionProtocol"

const CONCENTRATION_TAG = "dnd-manager:concentrating"
const MAX_SESSION_LOGS_IN_MEMORY = 100

type OptionalViteImportMeta = ImportMeta & {
  env?: {
    DEV?: boolean
    VITE_SESSION_SERVER_URL?: string
  }
}

export type SessionRuntimeContextValue = {
  status: SessionRuntimeStatus
  sessionId: string
  clientId: string
  role: SessionRuntimeRole
  presence: SessionRuntimePresenceUser[]
  lastHeartbeatAckAt: number | null
  runtimeConfigSnapshot: SessionRuntimeConfigSnapshot | null
  hpByCharacterId: Readonly<Record<string, SessionHpState>>
  conditionsByCharacterId: Readonly<Record<string, SessionConditionsState>>
  abilitiesByCharacterId: Readonly<Record<string, SessionAbilityState>>
  sessionCharactersById: Readonly<Record<string, SessionCharacterLifecycleState>>
  characterSnapshotReady: boolean
  inventoryState: SessionSharedInventoryState | null
  missionState: SessionMissionState | null
  initiativeState: SessionInitiativeState | null
  hpLog: SessionLogRecord[]
  publishRuntimeConfig: (snapshot: SessionRuntimeConfigSnapshot) => boolean
  initializeAbilities: (characters: SessionAbilitySeed[]) => boolean
  initializeHp: (characters: SessionHpSeed[]) => boolean
  initializeConditions: (characters: SessionConditionSeed[]) => boolean
  initializeInventory: (partyInventory: Itemmable[], groundInventory: Itemmable[]) => boolean
  initializeMissions: (missions: Mission[]) => boolean
  initializeInitiative: (session: InitiativeSession) => boolean
  dispatchSheetOperation: (operation: SessionLoggedOperation) => boolean
  dispatchHpOperation: (operation: SessionAuthoritativeOperation) => boolean
  dispatchConditionOperation: (operation: SessionConditionOperation) => boolean
  dispatchConcentrationOperation: (operation: SessionConcentrationOperation) => boolean
  dispatchAbilityOperation: (operation: SessionAbilityOperation) => boolean
  dispatchMagicOperation: (operation: SessionMagicOperation) => boolean
  dispatchEquipmentOperation: (operation: SessionEquipmentOperation) => boolean
  dispatchInventoryOperation: (operation: SessionInventoryOperation) => boolean
  dispatchMissionOperation: (operation: SessionMissionOperation) => boolean
  dispatchInitiativeOperation: (operation: SessionInitiativeOperation) => boolean
  dispatchProficiencyOperation: (operation: SessionProficiencyOperation) => boolean
  dispatchRaceOperation: (operation: SessionRaceOperation) => boolean
  dispatchProfileOperation: (operation: SessionProfileOperation) => boolean
  dispatchCustomClassOperation: (operation: SessionCustomClassOperation) => boolean
  dispatchCustomSystemOperation: (operation: SessionCustomSystemOperation) => boolean
  dispatchCharacterLifecycleOperation: (operation: SessionCharacterLifecycleOperation) => boolean
  undoLog: (logId: string) => boolean
}

export const SessionRuntimeContext = createContext<SessionRuntimeContextValue | null>(null)

function getOrCreateClientId(sessionId: string): string {
  const key = `dnd-manager.session-runtime.client-id.${sessionId}`
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const clientId = crypto.randomUUID()
  window.sessionStorage.setItem(key, clientId)
  return clientId
}

function resolveSessionServerUrl(): string {
  const viteEnv = (import.meta as OptionalViteImportMeta).env
  const configured = viteEnv?.VITE_SESSION_SERVER_URL?.trim()
  if (configured) return configured
  if (viteEnv?.DEV === true) return "http://localhost:8787"
  return ""
}

export function SessionRuntimeProvider(props: {
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  children: ReactNode
}) {
  const parent = useContext(SessionRuntimeContext)
  if (parent?.sessionId === props.sessionId) return <>{props.children}</>
  return <SessionRuntimeProviderInner {...props} />
}

function SessionRuntimeProviderInner({ sessionId, userId, role, children }: {
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  children: ReactNode
}) {
  const [status, setStatus] = useState<SessionRuntimeStatus>("disconnected")
  const [presence, setPresence] = useState<SessionRuntimePresenceUser[]>([])
  const [lastHeartbeatAckAt, setLastHeartbeatAckAt] = useState<number | null>(null)
  const [runtimeConfigSnapshot, setRuntimeConfigSnapshot] = useState<SessionRuntimeConfigSnapshot | null>(null)
  const [hpByCharacterId, setHpByCharacterId] = useState<Record<string, SessionHpState>>({})
  const [conditionsByCharacterId, setConditionsByCharacterId] = useState<Record<string, SessionConditionsState>>({})
  const [abilitiesByCharacterId, setAbilitiesByCharacterId] = useState<Record<string, SessionAbilityState>>({})
  const [sessionCharactersById, setSessionCharactersById] = useState<Record<string, SessionCharacterLifecycleState>>({})
  const [characterSnapshotReady, setCharacterSnapshotReady] = useState(false)
  const [inventoryState, setInventoryState] = useState<SessionSharedInventoryState | null>(null)
  const [missionState, setMissionState] = useState<SessionMissionState | null>(null)
  const [initiativeState, setInitiativeState] = useState<SessionInitiativeState | null>(null)
  const [hpLog, setHpLog] = useState<SessionLogRecord[]>([])
  const socketRef = useRef<SessionSocket | null>(null)
  const clientId = useMemo(() => getOrCreateClientId(sessionId), [sessionId])
  const baseUrl = resolveSessionServerUrl()

  useEffect(() => {
    setPresence([])
    setLastHeartbeatAckAt(null)
    setRuntimeConfigSnapshot(null)
    setHpByCharacterId({})
    setConditionsByCharacterId({})
    setAbilitiesByCharacterId({})
    setSessionCharactersById({})
    setCharacterSnapshotReady(false)
    setInventoryState(null)
    setMissionState(null)
    setInitiativeState(null)
    setHpLog([])

    if (!baseUrl) {
      console.warn("[session-runtime] VITE_SESSION_SERVER_URL is not configured; realtime session runtime is disabled.")
      setStatus("disconnected")
      return
    }

    const socket = new SessionSocket({
      baseUrl,
      sessionId,
      userId,
      role,
      clientId,
      onStatusChange: setStatus,
      onMessage: (message) => {
        if (message.type === "session.config.snapshot") {
          setRuntimeConfigSnapshot(message.snapshot)
          return
        }
        if (message.type === "session.presence") { setPresence(message.users); return }
        if (message.type === "session.heartbeat.ack") { setLastHeartbeatAckAt(Date.now()); return }
        if (message.type === "session.hp.snapshot") {
          setHpByCharacterId(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          return
        }
        if (message.type === "session.hp.updated") {
          setHpByCharacterId((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.conditions.snapshot") {
          setConditionsByCharacterId(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          return
        }
        if (message.type === "session.conditions.updated") {
          setConditionsByCharacterId((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.abilities.snapshot") {
          setAbilitiesByCharacterId(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          return
        }
        if (message.type === "session.abilities.updated") {
          setAbilitiesByCharacterId((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.characters.snapshot") {
          setSessionCharactersById(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          setCharacterSnapshotReady(true)
          return
        }
        if (message.type === "session.character.updated") {
          setSessionCharactersById((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.character.removed") {
          setSessionCharactersById((current) => {
            const existing = current[message.characterId]
            return {
              ...current,
              [message.characterId]: existing
                ? { ...existing, active: false }
                : { characterId: message.characterId, character: {}, active: false, revision: 0 },
            }
          })
          setHpByCharacterId((current) => {
            const next = { ...current }
            delete next[message.characterId]
            return next
          })
          setConditionsByCharacterId((current) => {
            const next = { ...current }
            delete next[message.characterId]
            return next
          })
          setAbilitiesByCharacterId((current) => {
            const next = { ...current }
            delete next[message.characterId]
            return next
          })
          return
        }
        if (message.type === "session.inventory.snapshot" || message.type === "session.inventory.updated") {
          setInventoryState(message.state)
          return
        }
        if (message.type === "session.missions.snapshot" || message.type === "session.missions.updated") {
          setMissionState(message.state)
          return
        }
        if (message.type === "session.initiative.snapshot" || message.type === "session.initiative.updated") {
          setInitiativeState(message.state)
          return
        }
        if (message.type === "session.hp.log") {
          setHpLog((current) => mergeSessionLogs(current, message.records as SessionLogRecord[]))
          return
        }
        if (message.type === "session.error") console.error(`[session-runtime] ${message.code}: ${message.message}`)
      },
    })

    socketRef.current = socket
    socket.connect()
    return () => {
      if (socketRef.current === socket) socketRef.current = null
      socket.disconnect()
    }
  }, [baseUrl, clientId, role, sessionId, userId])

  const publishRuntimeConfig = useCallback((snapshot: SessionRuntimeConfigSnapshot) =>
    socketRef.current?.send({ type: "session.config.publish", snapshot }) ?? false, [])
  const initializeHp = useCallback((characters: SessionHpSeed[]) =>
    socketRef.current?.send({ type: "session.hp.initialize", characters }) ?? false, [])
  const initializeConditions = useCallback((characters: SessionConditionSeed[]) =>
    socketRef.current?.send({ type: "session.conditions.initialize", characters }) ?? false, [])
  const initializeAbilities = useCallback((characters: SessionAbilitySeed[]) => {
    if (!characterSnapshotReady) return true
    const pending = characters.filter((character) => !sessionCharactersById[character.characterId])
    if (!pending.length) return true
    return pending.every((character) => socketRef.current?.send({
      type: "session.character.operation",
      operation: {
        type: "character.session.add",
        characterId: character.characterId,
        character: character.character,
      },
    }) ?? false)
  }, [characterSnapshotReady, sessionCharactersById])
  const initializeInventory = useCallback((partyInventory: Itemmable[], groundInventory: Itemmable[]) =>
    socketRef.current?.send({ type: "session.inventory.initialize", partyInventory, groundInventory }) ?? false, [])
  const initializeMissions = useCallback((missions: Mission[]) =>
    socketRef.current?.send({ type: "session.missions.initialize", missions }) ?? false, [])
  const initializeInitiative = useCallback((session: InitiativeSession) =>
    socketRef.current?.send({ type: "session.initiative.initialize", session }) ?? false, [])
  const dispatchSheetOperation = useCallback((operation: SessionLoggedOperation) =>
    socketRef.current?.send(toSheetOperationMessage(operation)) ?? false, [])
  const dispatchHpOperation = useCallback((operation: SessionAuthoritativeOperation) =>
    dispatchSheetOperation(operation), [dispatchSheetOperation])
  const dispatchConcentrationOperation = useCallback((operation: SessionConcentrationOperation) =>
    dispatchSheetOperation(operation), [dispatchSheetOperation])
  const dispatchAbilityOperation = useCallback((operation: SessionAbilityOperation) =>
    socketRef.current?.send({ type: "session.abilities.operation", operation }) ?? false, [])
  const dispatchMagicOperation = useCallback((operation: SessionMagicOperation) =>
    socketRef.current?.send({ type: "session.magic.operation", operation }) ?? false, [])
  const dispatchEquipmentOperation = useCallback((operation: SessionEquipmentOperation) =>
    socketRef.current?.send({ type: "session.equipment.operation", operation }) ?? false, [])
  const dispatchInventoryOperation = useCallback((operation: SessionInventoryOperation) =>
    socketRef.current?.send({ type: "session.inventory.operation", operation }) ?? false, [])
  const dispatchMissionOperation = useCallback((operation: SessionMissionOperation) =>
    socketRef.current?.send({ type: "session.missions.operation", operation }) ?? false, [])
  const dispatchInitiativeOperation = useCallback((operation: SessionInitiativeOperation) =>
    socketRef.current?.send({ type: "session.initiative.operation", operation }) ?? false, [])
  const dispatchProficiencyOperation = useCallback((operation: SessionProficiencyOperation) =>
    socketRef.current?.send({ type: "session.proficiency.operation", operation }) ?? false, [])
  const dispatchRaceOperation = useCallback((operation: SessionRaceOperation) =>
    socketRef.current?.send({ type: "session.race.operation", operation }) ?? false, [])
  const dispatchProfileOperation = useCallback((operation: SessionProfileOperation) =>
    socketRef.current?.send({ type: "session.profile.operation", operation }) ?? false, [])
  const dispatchCustomClassOperation = useCallback((operation: SessionCustomClassOperation) =>
    socketRef.current?.send({ type: "session.custom-class.operation", operation }) ?? false, [])
  const dispatchCustomSystemOperation = useCallback((operation: SessionCustomSystemOperation) =>
    socketRef.current?.send({ type: "session.customSystem.operation", operation }) ?? false, [])
  const dispatchCharacterLifecycleOperation = useCallback((operation: SessionCharacterLifecycleOperation) =>
    socketRef.current?.send({ type: "session.character.operation", operation }) ?? false, [])

  const dispatchConditionOperation = useCallback((operation: SessionConditionOperation) => {
    if (operation.type === "character.condition.add" || operation.type === "character.condition.update") {
      if (isConcentrationCondition(operation.condition)) {
        return dispatchConcentrationOperation({
          type: "character.concentration.start",
          characterId: operation.characterId,
          spellIndex: concentrationSpellIndex(operation.condition),
          spellName: operation.condition.source.trim() || "Concentração",
        })
      }
    }
    if (operation.type === "character.condition.remove") {
      const condition = conditionsByCharacterId[operation.characterId]?.conditions.find((entry) => entry.id === operation.conditionId)
      if (condition && isConcentrationCondition(condition)) {
        return dispatchConcentrationOperation({ type: "character.concentration.end", characterId: operation.characterId, reason: "manual" })
      }
    }
    return dispatchSheetOperation(operation)
  }, [conditionsByCharacterId, dispatchConcentrationOperation, dispatchSheetOperation])

  const undoLog = useCallback((logId: string) =>
    socketRef.current?.send({ type: "session.log.undo", logId }) ?? false, [])

  const value = useMemo<SessionRuntimeContextValue>(() => ({
    status, sessionId, clientId, role, presence, lastHeartbeatAckAt, runtimeConfigSnapshot,
    hpByCharacterId, conditionsByCharacterId, abilitiesByCharacterId, sessionCharactersById, characterSnapshotReady,
    inventoryState, missionState, initiativeState, hpLog,
    publishRuntimeConfig,
    initializeHp, initializeConditions, initializeAbilities, initializeInventory, initializeMissions, initializeInitiative,
    dispatchSheetOperation, dispatchHpOperation, dispatchConditionOperation,
    dispatchConcentrationOperation, dispatchAbilityOperation, dispatchMagicOperation,
    dispatchEquipmentOperation, dispatchInventoryOperation, dispatchMissionOperation, dispatchInitiativeOperation, dispatchProficiencyOperation,
    dispatchRaceOperation, dispatchProfileOperation, dispatchCustomClassOperation, dispatchCustomSystemOperation,
    dispatchCharacterLifecycleOperation, undoLog,
  }), [
    abilitiesByCharacterId, characterSnapshotReady, clientId, conditionsByCharacterId,
    dispatchAbilityOperation, dispatchCharacterLifecycleOperation, dispatchConditionOperation, dispatchConcentrationOperation,
    dispatchCustomClassOperation, dispatchCustomSystemOperation, dispatchEquipmentOperation, dispatchHpOperation,
    dispatchInitiativeOperation, dispatchInventoryOperation, dispatchMagicOperation, dispatchMissionOperation,
    dispatchProficiencyOperation, dispatchProfileOperation, dispatchRaceOperation, dispatchSheetOperation,
    hpByCharacterId, hpLog, initializeAbilities, initializeConditions, initializeHp, initializeInitiative, initializeInventory, initializeMissions,
    initiativeState, inventoryState, lastHeartbeatAckAt, missionState, presence, publishRuntimeConfig, role, runtimeConfigSnapshot,
    sessionCharactersById, sessionId, status, undoLog,
  ])

  return <SessionRuntimeContext.Provider value={value}>{children}</SessionRuntimeContext.Provider>
}

export function useOptionalSessionRuntime(): SessionRuntimeContextValue | null {
  return useContext(SessionRuntimeContext)
}

function mergeSessionLogs(current: SessionLogRecord[], incoming: SessionLogRecord[]): SessionLogRecord[] {
  const byId = new Map(current.map((record) => [record.id, record]))
  for (const record of incoming) byId.set(record.id, record)
  return [...byId.values()]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(-MAX_SESSION_LOGS_IN_MEMORY)
}

function isConcentrationCondition(condition: SessionCondition): boolean {
  return condition.tags.includes(CONCENTRATION_TAG) || normalize(condition.name) === "concentrando"
}
function concentrationSpellIndex(condition: SessionCondition): string {
  const notes = condition.notes.trim()
  return notes.startsWith("spell:") ? notes.slice("spell:".length).trim() || "unknown" : "unknown"
}
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR")
}
