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
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;

  if (message.type === "session.missions.initialize") {
    if (!Array.isArray(message.missions)) return null;
    return message as SessionMissionClientMessage;
  }

  if (message.type !== "session.missions.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (typeof operation.type !== "string" || operation.characterId !== "session") return null;
  return message as SessionMissionClientMessage;
}
