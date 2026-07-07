import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

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
  const missions = useMemo(
    () => normalizeMissions(state.missions),
    [state.missions],
  )
  const canManageMissions = userRole === "master"

  function addMission(mission: Mission) {
    if (!canManageMissions) return

    const normalized = normalizeMission(mission)

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

    setState((previous) => ({
      ...previous,
      missions: normalizeMissions(previous.missions).map((mission) =>
        mission.id === missionId
          ? normalizeMission({
              ...updater(mission),
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

    setState((previous) => ({
      ...previous,
      missions: normalizeMissions(previous.missions).filter(
        (mission) => mission.id !== missionId,
      ),
    }))
  }

  function moveMission(missionId: string, status: MissionStatus) {
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

export function useMissions() {
  const context = useContext(MissionContext)

  if (!context) {
    throw new Error("useMissions must be used inside MissionProvider")
  }

  return context
}
