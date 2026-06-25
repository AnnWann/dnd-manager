export type MissionStatus = "available" | "accepted" | "completed"

export type MissionPriority = "low" | "normal" | "high" | "urgent"

export type MissionObjective = {
  id: string
  text: string
  completed: boolean
}

export type Mission = {
  id: string
  title: string
  summary: string
  description: string
  status: MissionStatus
  priority: MissionPriority
  giver: string
  location: string
  reward: string
  notes: string
  tags: string[]
  objectives: MissionObjective[]
  recommendedLevel?: number
  deadline?: string
  acceptedBy?: string
  acceptedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export function createEmptyMission(): Mission {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    title: "",
    summary: "",
    description: "",
    status: "available",
    priority: "normal",
    giver: "",
    location: "",
    reward: "",
    notes: "",
    tags: [],
    objectives: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizeMission(value: unknown): Mission {
  const raw = isRecord(value) ? value : {}
  const now = new Date().toISOString()
  const recommendedLevel = readOptionalPositiveInteger(raw.recommendedLevel)

  return {
    id: readString(raw.id) || crypto.randomUUID(),
    title: readString(raw.title) || "Missão sem título",
    summary: readString(raw.summary),
    description: readString(raw.description),
    status: normalizeStatus(raw.status),
    priority: normalizePriority(raw.priority),
    giver: readString(raw.giver),
    location: readString(raw.location),
    reward: readString(raw.reward),
    notes: readString(raw.notes),
    tags: Array.isArray(raw.tags)
      ? unique(raw.tags.map(readString).filter(Boolean))
      : [],
    objectives: Array.isArray(raw.objectives)
      ? raw.objectives.map(normalizeObjective)
      : [],
    recommendedLevel,
    deadline: readOptionalString(raw.deadline),
    acceptedBy: readOptionalString(raw.acceptedBy),
    acceptedAt: readOptionalString(raw.acceptedAt),
    completedAt: readOptionalString(raw.completedAt),
    createdAt: readString(raw.createdAt) || now,
    updatedAt: readString(raw.updatedAt) || now,
  }
}

export function normalizeMissions(value: unknown): Mission[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()

  return value.map((entry) => {
    const mission = normalizeMission(entry)
    const id = seen.has(mission.id) ? crypto.randomUUID() : mission.id
    seen.add(id)

    return id === mission.id ? mission : { ...mission, id }
  })
}

function normalizeObjective(value: unknown): MissionObjective {
  const raw = isRecord(value) ? value : {}

  return {
    id: readString(raw.id) || crypto.randomUUID(),
    text: readString(raw.text),
    completed: raw.completed === true,
  }
}

function normalizeStatus(value: unknown): MissionStatus {
  return value === "accepted" || value === "completed"
    ? value
    : "available"
}

function normalizePriority(value: unknown): MissionPriority {
  return value === "low" || value === "high" || value === "urgent"
    ? value
    : "normal"
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.trunc(parsed)
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readOptionalString(value: unknown): string | undefined {
  const parsed = readString(value)
  return parsed || undefined
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
