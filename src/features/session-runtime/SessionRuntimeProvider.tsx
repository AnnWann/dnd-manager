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
import type {
  SessionCharacterLifecycleOperation,
  SessionCharacterLifecycleState,
} from "./characterLifecycleSessionProtocol"
import type { SessionLogRecord } from "./sessionLogProtocol"
import type {
  SessionInventoryOperation,
  SessionSharedInventoryState,
} from "./inventorySessionProtocol"
import type { Itemmable } from "../../models/items/item"
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

export type SessionRuntimeContextValue = {
  status: SessionRuntimeStatus
  sessionId: string
  clientId: string
  role: SessionRuntimeRole
  presence: SessionRuntimePresenceUser[]
  lastHeartbeatAckAt: number | null
  hpByCharacterId: Readonly<Record<string, SessionHpState>>
  conditionsByCharacterId: Readonly<Record<string, SessionConditionsState>>
  abilitiesByCharacterId: Readonly<Record<string, SessionAbilityState>>
  sessionCharactersById: Readonly<Record<string, SessionCharacterLifecycleState>>
  inventoryState: SessionSharedInventoryState | null
  hpLog: SessionLogRecord[]
  /** Legacy name retained as the bootstrap boundary; it now initializes the full session character. */
  initializeAbilities: (characters: SessionAbilitySeed[]) => boolean
  initializeHp: (characters: SessionHpSeed[]) => boolean
  initializeConditions: (characters: SessionConditionSeed[]) => boolean
  initializeInventory: (partyInventory: Itemmable[], groundInventory: Itemmable[]) => boolean
  dispatchSheetOperation: (operation: SessionLoggedOperation) => boolean
  dispatchHpOperation: (operation: SessionAuthoritativeOperation) => boolean
  dispatchConditionOperation: (operation: SessionConditionOperation) => boolean
  dispatchConcentrationOperation: (operation: SessionConcentrationOperation) => boolean
  dispatchAbilityOperation: (operation: SessionAbilityOperation) => boolean
  dispatchMagicOperation: (operation: SessionMagicOperation) => boolean
  dispatchEquipmentOperation: (operation: SessionEquipmentOperation) => boolean
  dispatchInventoryOperation: (operation: SessionInventoryOperation) => boolean
  dispatchProficiencyOperation: (operation: SessionProficiencyOperation) => boolean
  dispatchRaceOperation: (operation: SessionRaceOperation) => boolean
  dispatchProfileOperation: (operation: SessionProfileOperation) => boolean
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
  const configured = import.meta.env.VITE_SESSION_SERVER_URL?.trim()
  if (configured) return configured
  if (import.meta.env.DEV) return "http://localhost:8787"
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
  const [hpByCharacterId, setHpByCharacterId] = useState<Record<string, SessionHpState>>({})
  const [conditionsByCharacterId, setConditionsByCharacterId] = useState<Record<string, SessionConditionsState>>({})
  const [abilitiesByCharacterId, setAbilitiesByCharacterId] = useState<Record<string, SessionAbilityState>>({})
  const [sessionCharactersById, setSessionCharactersById] = useState<Record<string, SessionCharacterLifecycleState>>({})
  const [inventoryState, setInventoryState] = useState<SessionSharedInventoryState | null>(null)
  const [hpLog, setHpLog] = useState<SessionLogRecord[]>([])
  const socketRef = useRef<SessionSocket | null>(null)
  const clientId = useMemo(() => getOrCreateClientId(sessionId), [sessionId])
  const baseUrl = resolveSessionServerUrl()

  useEffect(() => {
    setPresence([])
    setLastHeartbeatAckAt(null)
    setHpByCharacterId({})
    setConditionsByCharacterId({})
    setAbilitiesByCharacterId({})
    setSessionCharactersById({})
    setInventoryState(null)
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

  const initializeHp = useCallback((characters: SessionHpSeed[]) =>
    socketRef.current?.send({ type: "session.hp.initialize", characters }) ?? false, [])
  const initializeConditions = useCallback((characters: SessionConditionSeed[]) =>
    socketRef.current?.send({ type: "session.conditions.initialize", characters }) ?? false, [])
  const initializeAbilities = useCallback((characters: SessionAbilitySeed[]) => {
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
  }, [sessionCharactersById])
  const initializeInventory = useCallback((partyInventory: Itemmable[], groundInventory: Itemmable[]) =>
    socketRef.current?.send({ type: "session.inventory.initialize", partyInventory, groundInventory }) ?? false, [])
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
  const dispatchProficiencyOperation = useCallback((operation: SessionProficiencyOperation) =>
    socketRef.current?.send({ type: "session.proficiency.operation", operation }) ?? false, [])
  const dispatchRaceOperation = useCallback((operation: SessionRaceOperation) =>
    socketRef.current?.send({ type: "session.race.operation", operation }) ?? false, [])
  const dispatchProfileOperation = useCallback((operation: SessionProfileOperation) =>
    socketRef.current?.send({ type: "session.profile.operation", operation }) ?? false, [])
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
    status, sessionId, clientId, role, presence, lastHeartbeatAckAt,
    hpByCharacterId, conditionsByCharacterId, abilitiesByCharacterId, sessionCharactersById, inventoryState, hpLog,
    initializeHp, initializeConditions, initializeAbilities, initializeInventory,
    dispatchSheetOperation, dispatchHpOperation, dispatchConditionOperation,
    dispatchConcentrationOperation, dispatchAbilityOperation, dispatchMagicOperation,
    dispatchEquipmentOperation, dispatchInventoryOperation, dispatchProficiencyOperation,
    dispatchRaceOperation, dispatchProfileOperation, dispatchCharacterLifecycleOperation, undoLog,
  }), [
    abilitiesByCharacterId, clientId, conditionsByCharacterId,
    dispatchAbilityOperation, dispatchCharacterLifecycleOperation, dispatchConditionOperation, dispatchConcentrationOperation,
    dispatchEquipmentOperation, dispatchHpOperation, dispatchInventoryOperation, dispatchMagicOperation,
    dispatchProficiencyOperation, dispatchProfileOperation, dispatchRaceOperation, dispatchSheetOperation,
    hpByCharacterId, hpLog, initializeAbilities, initializeConditions, initializeHp, initializeInventory,
    inventoryState, lastHeartbeatAckAt, presence, role, sessionCharactersById, sessionId, status, undoLog,
  ])

  return <SessionRuntimeContext.Provider value={value}>{children}</SessionRuntimeContext.Provider>
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
