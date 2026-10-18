import type { Mission, MissionStatus } from "../../session-protocol/src/mission"

/** Shared, side-effect-free mission board selectors for website and VTT clients. */
export function filterMissions(missions: readonly Mission[], search: string): Mission[] {
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR")
  if (!normalizedSearch) return [...missions]
  return missions.filter((mission) => [
    mission.title, mission.summary, mission.description, mission.giver,
    mission.location, mission.reward, mission.notes, ...mission.tags,
    ...mission.objectives.map((objective) => objective.text),
  ].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch))
}

export function countMissionsByStatus(missions: readonly Mission[]): Record<MissionStatus, number> {
  return {
    available: missions.filter((mission) => mission.status === "available").length,
    accepted: missions.filter((mission) => mission.status === "accepted").length,
    completed: missions.filter((mission) => mission.status === "completed").length,
  }
}
