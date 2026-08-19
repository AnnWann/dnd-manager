export type SessionMissionStatus = "available" | "accepted" | "completed";
export type SessionMissionPriority = "low" | "normal" | "high" | "urgent";

export type SessionMissionObjective = {
  id: string;
  text: string;
  completed: boolean;
};

export type SessionMission = {
  id: string;
  title: string;
  summary: string;
  description: string;
  status: SessionMissionStatus;
  priority: SessionMissionPriority;
  giver: string;
  location: string;
  reward: string;
  notes: string;
  tags: string[];
  objectives: SessionMissionObjective[];
  recommendedLevel?: number;
  deadline?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionMissionState = {
  initialized: boolean;
  revision: number;
  missions: SessionMission[];
};

export type SessionMissionOperation =
  | { type: "mission.add"; characterId: "session"; mission: Record<string, unknown> }
  | { type: "mission.update"; characterId: "session"; missionId: string; mission: Record<string, unknown> }
  | { type: "mission.delete"; characterId: "session"; missionId: string }
  | { type: "mission.status.set"; characterId: "session"; missionId: string; status: SessionMissionStatus }
  | { type: "mission.objective.toggle"; characterId: "session"; missionId: string; objectiveId: string };

export type SessionMissionClientMessage =
  | { type: "session.missions.initialize"; missions: Record<string, unknown>[] }
  | { type: "session.missions.operation"; operation: SessionMissionOperation };

export function parseMissionClientMessage(raw: string): SessionMissionClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;

  if (value.type === "session.missions.initialize") {
    if (!Array.isArray(value.missions) || !value.missions.every(isRecord)) return null;
    return value as SessionMissionClientMessage;
  }

  if (value.type !== "session.missions.operation" || !isRecord(value.operation)) return null;
  const operation = value.operation;
  if (operation.characterId !== "session" || typeof operation.type !== "string") return null;

  switch (operation.type) {
    case "mission.add":
      if (!isRecord(operation.mission)) return null;
      break;
    case "mission.update":
      if (!readId(operation.missionId) || !isRecord(operation.mission)) return null;
      break;
    case "mission.delete":
      if (!readId(operation.missionId)) return null;
      break;
    case "mission.status.set":
      if (!readId(operation.missionId) || !isMissionStatus(operation.status)) return null;
      break;
    case "mission.objective.toggle":
      if (!readId(operation.missionId) || !readId(operation.objectiveId)) return null;
      break;
    default:
      return null;
  }

  return value as SessionMissionClientMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function readId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function isMissionStatus(value: unknown): value is SessionMissionStatus {
  return value === "available" || value === "accepted" || value === "completed";
}
