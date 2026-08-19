import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import type { AppStateV1 } from "../lib/remoteState"
import {
  normalizeMission,
  normalizeMissions,
  type Mission,
  type MissionStatus,
} from "../models/missions/Mission"

export type MissionAppState = AppStateV1 & {
  missions?: Mission[]
}

type MissionContextValue = {
  missions: Mission[]
  canManageMissions: boolean
  addMission: (mission: Mission) => void
  updateMission: (
    missionId: string,
    updater: (mission: Mission) => Mission,
  ) => void
  deleteMission: (missionId: string) => void
  moveMission: (missionId: string, status: MissionStatus) => void
  toggleObjective: (missionId: string, objectiveId: string) => void
}

type Props = {
  children: ReactNode
  state: MissionAppState
  setState: Dispatch<SetStateAction<MissionAppState>>
  userRole: "master" | "player"
  userKey: string
}

const MissionContext = createContext<MissionContextValue | null>(null)

export function MissionProvider({
  children,
  state,
  setState,
  userRole,
  userKey,
}: Props) {
  const runtime = useOptionalSessionRuntime()
  const localMissions = useMemo(
    () => normalizeMissions(state.missions),
    [state.missions],
  )
  const missions = useMemo(
    () => runtime
      ? runtime.missionState?.initialized
        ? normalizeMissions(runtime.missionState.missions)
        : []
      : localMissions,
    [localMissions, runtime],
  )
  const canManageMissions = runtime ? runtime.role === "MASTER" : userRole === "master"

  useEffect(() => {
    if (!runtime || runtime.role !== "MASTER" || runtime.status !== "connected") return
    if (!runtime.missionState || runtime.missionState.initialized) return
    runtime.initializeMissions(localMissions)
  }, [localMissions, runtime])

  function addMission(mission: Mission) {
    if (!canManageMissions) return
    const normalized = normalizeMission(mission)

    if (runtime) {
      runtime.dispatchMissionOperation({
        type: "mission.add",
        characterId: "session",
        mission: normalized,
      })
      return
    }

    setState((previous) => ({
      ...previous,
      missions: [
        ...normalizeMissions(previous.missions),
        {
          ...normalized,
          id: crypto.randomUUID(),
          status: normalized.status ?? "available",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }))
  }

  function updateMission(
    missionId: string,
    updater: (mission: Mission) => Mission,
  ) {
    if (!canManageMissions) return
    const current = missions.find((mission) => mission.id === missionId)
    if (!current) return
    const next = normalizeMission({
      ...updater(current),
      id: current.id,
      createdAt: current.createdAt,
    })

    if (runtime) {
      runtime.dispatchMissionOperation({
        type: "mission.update",
        characterId: "session",
        missionId,
        mission: next,
      })
      return
    }

    setState((previous) => ({
      ...previous,
      missions: normalizeMissions(previous.missions).map((mission) =>
        mission.id === missionId
          ? normalizeMission({
              ...next,
              id: mission.id,
              createdAt: mission.createdAt,
              updatedAt: new Date().toISOString(),
            })
          : mission,
      ),
    }))
  }

  function deleteMission(missionId: string) {
    if (!canManageMissions) return

    if (runtime) {
      runtime.dispatchMissionOperation({
        type: "mission.delete",
        characterId: "session",
        missionId,
      })
      return
    }

    setState((previous) => ({
      ...previous,
      missions: normalizeMissions(previous.missions).filter(
        (mission) => mission.id !== missionId,
      ),
    }))
  }

  function moveMission(missionId: string, status: MissionStatus) {
    if (runtime) {
      runtime.dispatchMissionOperation({
        type: "mission.status.set",
        characterId: "session",
        missionId,
        status,
      })
      return
    }

    const now = new Date().toISOString()
    setState((previous) => ({
      ...previous,
      missions: normalizeMissions(previous.missions).map((mission) => {
        if (mission.id !== missionId) return mission
        return {
          ...mission,
          status,
          acceptedBy:
            status === "accepted"
              ? mission.acceptedBy || userKey.trim() || undefined
              : status === "available"
                ? undefined
                : mission.acceptedBy,
          acceptedAt:
            status === "accepted"
              ? mission.acceptedAt || now
              : status === "available"
                ? undefined
                : mission.acceptedAt,
          completedAt: status === "completed" ? now : undefined,
          updatedAt: now,
        }
      }),
    }))
  }

  function toggleObjective(missionId: string, objectiveId: string) {
    if (runtime) {
      runtime.dispatchMissionOperation({
        type: "mission.objective.toggle",
        characterId: "session",
        missionId,
        objectiveId,
      })
      return
    }

    setState((previous) => ({
      ...previous,
      missions: normalizeMissions(previous.missions).map((mission) =>
        mission.id === missionId
          ? {
              ...mission,
              objectives: mission.objectives.map((objective) =>
                objective.id === objectiveId
                  ? { ...objective, completed: !objective.completed }
                  : objective,
              ),
              updatedAt: new Date().toISOString(),
            }
          : mission,
      ),
    }))
  }

  return (
    <MissionContext.Provider
      value={{
        missions,
        canManageMissions,
        addMission,
        updateMission,
        deleteMission,
        moveMission,
        toggleObjective,
      }}
    >
      {children}
    </MissionContext.Provider>
  )
}

export function SessionMissionAuthorityProvider({ children }: { children: ReactNode }) {
  const seed = useContext(MissionContext)
  const runtime = useOptionalSessionRuntime()
  const missions = runtime?.missionState?.initialized
    ? normalizeMissions(runtime.missionState.missions)
    : []

  useEffect(() => {
    if (!seed || !runtime || runtime.role !== "MASTER" || runtime.status !== "connected") return
    if (!runtime.missionState || runtime.missionState.initialized) return
    runtime.initializeMissions(seed.missions)
  }, [runtime, seed])

  if (!seed) throw new Error("SessionMissionAuthorityProvider must be used inside MissionProvider")
  if (!runtime) return <>{children}</>

  function addMission(mission: Mission) {
    if (runtime.role !== "MASTER") return
    runtime.dispatchMissionOperation({
      type: "mission.add",
      characterId: "session",
      mission: normalizeMission(mission),
    })
  }

  function updateMission(missionId: string, updater: (mission: Mission) => Mission) {
    if (runtime.role !== "MASTER") return
    const current = missions.find((mission) => mission.id === missionId)
    if (!current) return
    runtime.dispatchMissionOperation({
      type: "mission.update",
      characterId: "session",
      missionId,
      mission: normalizeMission({
        ...updater(current),
        id: current.id,
        createdAt: current.createdAt,
      }),
    })
  }

  function deleteMission(missionId: string) {
    if (runtime.role !== "MASTER") return
    runtime.dispatchMissionOperation({ type: "mission.delete", characterId: "session", missionId })
  }

  function moveMission(missionId: string, status: MissionStatus) {
    runtime.dispatchMissionOperation({
      type: "mission.status.set",
      characterId: "session",
      missionId,
      status,
    })
  }

  function toggleObjective(missionId: string, objectiveId: string) {
    runtime.dispatchMissionOperation({
      type: "mission.objective.toggle",
      characterId: "session",
      missionId,
      objectiveId,
    })
  }

  return (
    <MissionContext.Provider value={{
      missions,
      canManageMissions: runtime.role === "MASTER",
      addMission,
      updateMission,
      deleteMission,
      moveMission,
      toggleObjective,
    }}>
      {children}
    </MissionContext.Provider>
  )
}

export function useMissions() {
  const context = useContext(MissionContext)

  if (!context) {
    throw new Error("useMissions must be used inside MissionProvider")
  }

  return context
}
