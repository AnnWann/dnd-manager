import { MAX_HP_LOG_RECORDS } from "../characters/sheet/hpState";
import type { SessionConnection } from "../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../session/sessionLog";
import {
  parseMissionClientMessage,
  type SessionMission,
  type SessionMissionOperation,
  type SessionMissionState,
} from "./missionProtocol";

export const MISSIONS_STATE_KEY = "missions-state";
export const MISSIONS_SHARED_SCOPE = "missions:shared";

export class SessionActor {
  declare protected readonly ctx: DurableObjectState;

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseMissionClientMessage(raw);
    if (!parsed) return;

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    if (parsed.type === "session.missions.initialize") {
      if (connection.role !== "MASTER") {
        sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize mission state.");
        return;
      }
      const current = await readMissionState(this.ctx.storage);
      if (current.initialized) {
        send(webSocket, { type: "session.missions.snapshot", state: current });
        return;
      }
      const state: SessionMissionState = {
        initialized: true,
        revision: 0,
        missions: normalizeInitialMissions(parsed.missions),
      };
      await this.ctx.storage.put(MISSIONS_STATE_KEY, state);
      broadcast(this.ctx.getWebSockets(), { type: "session.missions.snapshot", state });
      return;
    }

    await this.handleMissionOperation(webSocket, connection, parsed.operation);
  }

  private async handleMissionOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionMissionOperation,
  ): Promise<void> {
    const [state, log] = await Promise.all([
      readMissionState(this.ctx.storage),
      readSessionLog(this.ctx.storage),
    ]);
    if (!state.initialized) {
      sendError(webSocket, "MISSIONS_STATE_NOT_INITIALIZED", "Mission state has not been initialized by the MASTER.");
      return;
    }
    if (isMasterOnly(operation) && connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can perform this mission operation.");
      return;
    }

    const before = structuredClone(state);
    const result = applyMissionOperation(state, operation, connection.userId);
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: result.operation,
      affectedScopes: [MISSIONS_SHARED_SCOPE],
      reverseOperation: {
        type: "session.missions.restore",
        characterId: "session",
        affectedScopes: [MISSIONS_SHARED_SCOPE],
        snapshot: before,
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [MISSIONS_STATE_KEY]: state },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.missions.updated", state });
  }
}

export async function readMissionState(storage: DurableObjectStorage): Promise<SessionMissionState> {
  return (await storage.get<SessionMissionState>(MISSIONS_STATE_KEY)) ?? {
    initialized: false,
    revision: 0,
    missions: [],
  };
}

function applyMissionOperation(
  state: SessionMissionState,
  operation: SessionMissionOperation,
  actorId: string,
): { ok: true; operation: SessionMissionOperation } | { ok: false; code: string; message: string } {
  const now = new Date().toISOString();

  switch (operation.type) {
    case "mission.add": {
      const mission = normalizeMissionInput(operation.mission, now);
      if (!mission.title) return invalid("MISSION_TITLE_REQUIRED", "Mission title is required.");
      mission.id = crypto.randomUUID();
      mission.createdAt = now;
      mission.updatedAt = now;
      mission.acceptedBy = undefined;
      mission.acceptedAt = undefined;
      mission.completedAt = undefined;
      state.missions.push(mission);
      state.revision += 1;
      return { ok: true, operation: { ...operation, mission: mission as unknown as Record<string, unknown> } };
    }
    case "mission.update": {
      const index = state.missions.findIndex((mission) => mission.id === operation.missionId);
      if (index < 0) return invalid("MISSION_NOT_FOUND", "Mission was not found.");
      const current = state.missions[index];
      const next = normalizeMissionInput(operation.mission, now);
      if (!next.title) return invalid("MISSION_TITLE_REQUIRED", "Mission title is required.");
      state.missions[index] = {
        ...next,
        id: current.id,
        status: current.status,
        acceptedBy: current.acceptedBy,
        acceptedAt: current.acceptedAt,
        completedAt: current.completedAt,
        createdAt: current.createdAt,
        updatedAt: now,
      };
      state.revision += 1;
      return { ok: true, operation: { ...operation, mission: state.missions[index] as unknown as Record<string, unknown> } };
    }
    case "mission.delete": {
      const index = state.missions.findIndex((mission) => mission.id === operation.missionId);
      if (index < 0) return invalid("MISSION_NOT_FOUND", "Mission was not found.");
      state.missions.splice(index, 1);
      state.revision += 1;
      return { ok: true, operation };
    }
    case "mission.status.set": {
      const mission = state.missions.find((entry) => entry.id === operation.missionId);
      if (!mission) return invalid("MISSION_NOT_FOUND", "Mission was not found.");
      if (!isMissionStatus(operation.status)) return invalid("MISSION_STATUS_INVALID", "Mission status is invalid.");
      if (mission.status === operation.status) return invalid("MISSION_STATUS_UNCHANGED", "Mission already has this status.");
      mission.status = operation.status;
      mission.updatedAt = now;
      if (operation.status === "available") {
        mission.acceptedBy = undefined;
        mission.acceptedAt = undefined;
        mission.completedAt = undefined;
      } else if (operation.status === "accepted") {
        mission.acceptedBy = mission.acceptedBy || actorId;
        mission.acceptedAt = mission.acceptedAt || now;
        mission.completedAt = undefined;
      } else {
        mission.completedAt = now;
      }
      state.revision += 1;
      return { ok: true, operation };
    }
    case "mission.objective.toggle": {
      const mission = state.missions.find((entry) => entry.id === operation.missionId);
      if (!mission) return invalid("MISSION_NOT_FOUND", "Mission was not found.");
      const objective = mission.objectives.find((entry) => entry.id === operation.objectiveId);
      if (!objective) return invalid("MISSION_OBJECTIVE_NOT_FOUND", "Mission objective was not found.");
      objective.completed = !objective.completed;
      mission.updatedAt = now;
      state.revision += 1;
      return { ok: true, operation };
    }
  }
}

function normalizeInitialMissions(values: Record<string, unknown>[]): SessionMission[] {
  const seen = new Set<string>();
  return values.map((value) => {
    const now = new Date().toISOString();
    const mission = normalizeMissionInput(value, now);
    const requestedId = readString(value.id);
    mission.id = requestedId && !seen.has(requestedId) ? requestedId : crypto.randomUUID();
    seen.add(mission.id);
    mission.createdAt = readString(value.createdAt) || now;
    mission.updatedAt = readString(value.updatedAt) || mission.createdAt;
    mission.acceptedBy = readOptionalString(value.acceptedBy);
    mission.acceptedAt = readOptionalString(value.acceptedAt);
    mission.completedAt = readOptionalString(value.completedAt);
    return mission;
  });
}

function normalizeMissionInput(value: Record<string, unknown>, now: string): SessionMission {
  const objectives = Array.isArray(value.objectives)
    ? value.objectives.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const raw = entry as Record<string, unknown>;
        return [{
          id: readString(raw.id) || crypto.randomUUID(),
          text: readString(raw.text),
          completed: raw.completed === true,
        }];
      })
    : [];

  return {
    id: readString(value.id),
    title: readString(value.title),
    summary: readString(value.summary),
    description: readString(value.description),
    status: isMissionStatus(value.status) ? value.status : "available",
    priority: isMissionPriority(value.priority) ? value.priority : "normal",
    giver: readString(value.giver),
    location: readString(value.location),
    reward: readString(value.reward),
    notes: readString(value.notes),
    tags: Array.isArray(value.tags) ? [...new Set(value.tags.map(readString).filter(Boolean))] : [],
    objectives,
    recommendedLevel: readPositiveInteger(value.recommendedLevel),
    deadline: readOptionalString(value.deadline),
    createdAt: now,
    updatedAt: now,
  };
}

function isMasterOnly(operation: SessionMissionOperation): boolean {
  return operation.type === "mission.add" || operation.type === "mission.update" || operation.type === "mission.delete";
}

function isMissionStatus(value: unknown): value is SessionMission["status"] {
  return value === "available" || value === "accepted" || value === "completed";
}
function isMissionPriority(value: unknown): value is SessionMission["priority"] {
  return value === "low" || value === "normal" || value === "high" || value === "urgent";
}
function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function readOptionalString(value: unknown): string | undefined {
  return readString(value) || undefined;
}
function readPositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}
function invalid(code: string, message: string) {
  return { ok: false as const, code, message };
}
function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection; } catch { return null; }
}
function send(webSocket: WebSocket, value: unknown): void {
  try { webSocket.send(JSON.stringify(value)); } catch {}
}
function sendError(webSocket: WebSocket, code: string, message: string): void {
  send(webSocket, { type: "session.error", code, message });
}
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}
