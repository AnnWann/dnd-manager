import type { Mission, MissionStatus } from "../../models/missions/Mission"

export type SessionMissionState = {
  initialized: boolean
  revision: number
  missions: Mission[]
}

export type SessionMissionOperation =
  | { type: "mission.add"; characterId: "session"; mission: Mission }
  | { type: "mission.update"; characterId: "session"; missionId: string; mission: Mission }
  | { type: "mission.delete"; characterId: "session"; missionId: string }
  | { type: "mission.status.set"; characterId: "session"; missionId: string; status: MissionStatus }
  | { type: "mission.objective.toggle"; characterId: "session"; missionId: string; objectiveId: string }

export type SessionMissionClientMessage =
  | { type: "session.missions.initialize"; missions: Mission[] }
  | { type: "session.missions.operation"; operation: SessionMissionOperation }

export type SessionMissionServerMessage =
  | { type: "session.missions.snapshot"; state: SessionMissionState }
  | { type: "session.missions.updated"; state: SessionMissionState }

export function parseMissionServerMessage(raw: string): SessionMissionServerMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value?.type !== "session.missions.snapshot" && value?.type !== "session.missions.updated") return null
    if (!value.state || typeof value.state !== "object") return null
    return value as SessionMissionServerMessage
  } catch {
    return null
  }
}
