export type CampaignProgressionMode = "xp" | "milestone" | "custom"

export type CampaignProgressionMilestone = {
  name: string
  description?: string
  /** Hidden milestones are not projected into the player runtime at all. */
  revealed: boolean
  /** The MASTER decides when a milestone actually unlocks the next level. */
  levelUpAvailable: boolean
}

export type CampaignProgressionTrack = {
  id: string
  name: string
  description?: string
  current: number
  maximum: number
  /** Reaching this value makes the track level-up ready when grantsLevel is true. */
  levelUpAt: number
  unit: string
  /** Hidden tracks are omitted from the runtime sent to players. */
  revealed: boolean
  grantsLevel: boolean
  /** Set after the unlocked level has actually been consumed by the party. */
  levelGranted: boolean
}

export type CampaignProgressionSettings = {
  mode: CampaignProgressionMode
  /** Heading shown on the character sheet for milestone/custom progression. */
  title?: string
  milestone?: CampaignProgressionMilestone
  customTracks?: CampaignProgressionTrack[]
}

export const DEFAULT_CAMPAIGN_PROGRESSION: CampaignProgressionSettings = {
  mode: "xp",
}

export function normalizeCampaignProgressionSettings(
  value: unknown,
): CampaignProgressionSettings {
  if (!isRecord(value)) return { ...DEFAULT_CAMPAIGN_PROGRESSION }

  const mode: CampaignProgressionMode =
    value.mode === "milestone" || value.mode === "custom" ? value.mode : "xp"
  const title = cleanOptionalString(value.title)

  const milestone = isRecord(value.milestone)
    ? {
        name: cleanString(value.milestone.name, "Próximo marco"),
        description: cleanOptionalString(value.milestone.description),
        revealed: value.milestone.revealed !== false,
        levelUpAvailable: value.milestone.levelUpAvailable === true,
      }
    : undefined

  const customTracks = Array.isArray(value.customTracks)
    ? value.customTracks
        .filter(isRecord)
        .map((track, index) => {
          const maximum = positiveNumber(track.maximum, 100)
          return {
            id: cleanString(track.id, `track-${index + 1}`),
            name: cleanString(track.name, `Objetivo ${index + 1}`),
            description: cleanOptionalString(track.description),
            current: clampNumber(track.current, 0, maximum, 0),
            maximum,
            levelUpAt: clampNumber(track.levelUpAt, 0, maximum, maximum),
            unit: cleanString(track.unit, "%"),
            revealed: track.revealed === true,
            grantsLevel: track.grantsLevel !== false,
            levelGranted: track.levelGranted === true,
          }
        })
    : []

  return {
    mode,
    title,
    milestone,
    customTracks,
  }
}

export function projectCampaignProgressionForPlayers(
  value: CampaignProgressionSettings | undefined,
): CampaignProgressionSettings {
  const normalized = normalizeCampaignProgressionSettings(value)

  if (normalized.mode === "milestone") {
    return {
      ...normalized,
      milestone: normalized.milestone?.revealed
        ? normalized.milestone
        : undefined,
    }
  }

  if (normalized.mode === "custom") {
    return {
      ...normalized,
      customTracks: (normalized.customTracks ?? []).filter(
        (track) => track.revealed,
      ),
    }
  }

  return normalized
}

export function isCampaignProgressionSettings(
  value: unknown,
): value is CampaignProgressionSettings {
  if (!isRecord(value)) return false
  if (value.mode !== "xp" && value.mode !== "milestone" && value.mode !== "custom") {
    return false
  }
  if (value.title !== undefined && typeof value.title !== "string") return false

  if (value.milestone !== undefined) {
    if (!isRecord(value.milestone)) return false
    if (
      typeof value.milestone.name !== "string"
      || typeof value.milestone.revealed !== "boolean"
      || typeof value.milestone.levelUpAvailable !== "boolean"
      || (
        value.milestone.description !== undefined
        && typeof value.milestone.description !== "string"
      )
    ) {
      return false
    }
  }

  if (value.customTracks !== undefined) {
    if (!Array.isArray(value.customTracks)) return false
    if (!value.customTracks.every(isProgressionTrack)) return false
  }

  return true
}

function isProgressionTrack(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.current === "number"
    && Number.isFinite(value.current)
    && typeof value.maximum === "number"
    && Number.isFinite(value.maximum)
    && value.maximum > 0
    && typeof value.levelUpAt === "number"
    && Number.isFinite(value.levelUpAt)
    && typeof value.unit === "string"
    && typeof value.revealed === "boolean"
    && typeof value.grantsLevel === "boolean"
    && typeof value.levelGranted === "boolean"
    && (
      value.description === undefined
      || typeof value.description === "string"
    )
  )
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? value : fallback
  return Math.max(minimum, Math.min(maximum, numeric))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
