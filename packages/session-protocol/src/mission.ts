/** Environment-neutral mission data contract shared across clients and server. */
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
