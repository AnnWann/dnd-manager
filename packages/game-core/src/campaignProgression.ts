export type CampaignProgressionMode = "xp" | "milestone" | "custom"

export type CampaignProgressionMilestone = {
  name: string
  description?: string
  /** Hidden milestones are not projected into the player runtime at all. */
  revealed: boolean
  /** The MASTER decides when a milestone actually unlocks the next level. */
  levelUpAvailable: boolean
}

export type CampaignProgressionRewardType = "none" | "points" | "level"

export type CampaignProgressionPointSystem = {
  /** Player-facing name, e.g. "Pontos de exploração". */
  name: string
  /** Compact unit used beside values, e.g. "PE". */
  unit: string
  /** Cost paid from the shared pool for each level. */
  pointsPerLevel: number
  /** Ad-hoc points not tied to a track. Can also be negative. */
  manualPoints: number
  /** Points already consumed by completed level-ups. */
  spentPoints: number
  /** Whether the shared point bank is shown on player sheets. */
  visibleToPlayers: boolean
  /**
   * Runtime-only aggregate calculated before secret tracks are removed.
   * This lets the player see the correct bank without receiving hidden goals.
   */
  earnedPoints?: number
}

export type CampaignProgressionTrack = {
  id: string
  name: string
  description?: string
  current: number
  maximum: number
  /** Reaching this value unlocks this track's configured reward. */
  levelUpAt: number
  unit: string
  /** Hidden tracks are omitted from the runtime sent to players. */
  revealed: boolean
  /** What happens when this track reaches its threshold. */
  rewardType: CampaignProgressionRewardType
  /** Number of progression points or direct levels granted. */
  rewardAmount: number
  /**
   * Direct-level rewards can be consumed so they do not remain available
   * forever. Point rewards are consumed through pointSystem.spentPoints.
   */
  rewardConsumed: number
  /** @deprecated Legacy format retained only for older persisted documents. */
  grantsLevel?: boolean
  /** @deprecated Legacy format retained only for older persisted documents. */
  levelGranted?: boolean
}

export type CampaignProgressionSettings = {
  mode: CampaignProgressionMode
  /** Heading shown on the character sheet for milestone/custom progression. */
  title?: string
  milestone?: CampaignProgressionMilestone
  customTracks?: CampaignProgressionTrack[]
  pointSystem?: CampaignProgressionPointSystem
}

export type CustomProgressionSummary = {
  earnedPoints: number
  availablePoints: number
  pointsPerLevel: number
  levelsAvailableFromPoints: number
  directLevelsAvailable: number
  totalLevelsAvailable: number
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

  const pointSystem = normalizePointSystem(value.pointSystem)

  const customTracks = Array.isArray(value.customTracks)
    ? value.customTracks
        .filter(isRecord)
        .map((track, index) => normalizeTrack(track, index))
    : []

  return {
    mode,
    title,
    milestone,
    customTracks,
    pointSystem,
  }
}

export function getCustomProgressionSummary(
  value: CampaignProgressionSettings | undefined,
): CustomProgressionSummary {
  const normalized = normalizeCampaignProgressionSettings(value)
  const pointSystem = normalized.pointSystem ?? defaultPointSystem()
  const tracks = normalized.customTracks ?? []

  const calculatedTrackPoints = tracks.reduce((total, track) => {
    if (
      track.rewardType !== "points"
      || track.current < track.levelUpAt
    ) {
      return total
    }
    return total + Math.max(0, track.rewardAmount)
  }, 0)

  const earnedPoints = Number.isFinite(pointSystem.earnedPoints)
    ? Math.max(0, pointSystem.earnedPoints ?? 0)
    : Math.max(0, pointSystem.manualPoints + calculatedTrackPoints)
  const availablePoints = Math.max(0, earnedPoints - pointSystem.spentPoints)
  const pointsPerLevel = Math.max(1, pointSystem.pointsPerLevel)
  const levelsAvailableFromPoints = Math.floor(
    availablePoints / pointsPerLevel,
  )

  const directLevelsAvailable = tracks.reduce((total, track) => {
    if (
      track.rewardType !== "level"
      || track.current < track.levelUpAt
    ) {
      return total
    }
    return total + Math.max(
      0,
      Math.floor(track.rewardAmount) - Math.floor(track.rewardConsumed),
    )
  }, 0)

  return {
    earnedPoints,
    availablePoints,
    pointsPerLevel,
    levelsAvailableFromPoints,
    directLevelsAvailable,
    totalLevelsAvailable:
      levelsAvailableFromPoints + directLevelsAvailable,
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
    const summary = getCustomProgressionSummary(normalized)
    return {
      ...normalized,
      pointSystem: normalized.pointSystem
        ? {
            ...normalized.pointSystem,
            earnedPoints: summary.earnedPoints,
          }
        : undefined,
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

  if (value.pointSystem !== undefined && !isPointSystem(value.pointSystem)) {
    return false
  }

  if (value.customTracks !== undefined) {
    if (!Array.isArray(value.customTracks)) return false
    if (!value.customTracks.every(isProgressionTrack)) return false
  }

  return true
}

function normalizePointSystem(
  value: unknown,
): CampaignProgressionPointSystem {
  if (!isRecord(value)) return defaultPointSystem()

  return {
    name: cleanString(value.name, "Pontos de progressão"),
    unit: cleanString(value.unit, "PP"),
    pointsPerLevel: positiveNumber(value.pointsPerLevel, 5),
    manualPoints: finiteNumber(value.manualPoints, 0),
    spentPoints: Math.max(0, finiteNumber(value.spentPoints, 0)),
    visibleToPlayers: value.visibleToPlayers !== false,
    earnedPoints:
      typeof value.earnedPoints === "number" && Number.isFinite(value.earnedPoints)
        ? Math.max(0, value.earnedPoints)
        : undefined,
  }
}

function defaultPointSystem(): CampaignProgressionPointSystem {
  return {
    name: "Pontos de progressão",
    unit: "PP",
    pointsPerLevel: 5,
    manualPoints: 0,
    spentPoints: 0,
    visibleToPlayers: true,
  }
}

function normalizeTrack(
  track: Record<string, unknown>,
  index: number,
): CampaignProgressionTrack {
  const maximum = positiveNumber(track.maximum, 100)

  const legacyGrantsLevel =
    typeof track.grantsLevel === "boolean" ? track.grantsLevel : undefined
  const legacyLevelGranted =
    typeof track.levelGranted === "boolean" ? track.levelGranted : false

  const rewardType: CampaignProgressionRewardType =
    track.rewardType === "points" || track.rewardType === "level"
      ? track.rewardType
      : track.rewardType === "none"
        ? "none"
        : legacyGrantsLevel === false
          ? "none"
          : "level"

  const rewardAmount = Math.max(
    0,
    finiteNumber(
      track.rewardAmount,
      rewardType === "none" ? 0 : 1,
    ),
  )

  return {
    id: cleanString(track.id, `track-${index + 1}`),
    name: cleanString(track.name, `Objetivo ${index + 1}`),
    description: cleanOptionalString(track.description),
    current: clampNumber(track.current, 0, maximum, 0),
    maximum,
    levelUpAt: clampNumber(track.levelUpAt, 0, maximum, maximum),
    unit: cleanString(track.unit, "%"),
    revealed: track.revealed === true,
    rewardType,
    rewardAmount,
    rewardConsumed: clampNumber(
      track.rewardConsumed,
      0,
      rewardType === "level" ? rewardAmount : 0,
      legacyLevelGranted && rewardType === "level" ? rewardAmount : 0,
    ),
  }
}

function isPointSystem(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.name === "string"
    && typeof value.unit === "string"
    && typeof value.pointsPerLevel === "number"
    && Number.isFinite(value.pointsPerLevel)
    && value.pointsPerLevel > 0
    && typeof value.manualPoints === "number"
    && Number.isFinite(value.manualPoints)
    && typeof value.spentPoints === "number"
    && Number.isFinite(value.spentPoints)
    && value.spentPoints >= 0
    && typeof value.visibleToPlayers === "boolean"
    && (
      value.earnedPoints === undefined
      || (
        typeof value.earnedPoints === "number"
        && Number.isFinite(value.earnedPoints)
      )
    )
  )
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
    && (
      value.rewardType === "none"
      || value.rewardType === "points"
      || value.rewardType === "level"
    )
    && typeof value.rewardAmount === "number"
    && Number.isFinite(value.rewardAmount)
    && value.rewardAmount >= 0
    && typeof value.rewardConsumed === "number"
    && Number.isFinite(value.rewardConsumed)
    && value.rewardConsumed >= 0
    && (
      value.description === undefined
      || typeof value.description === "string"
    )
  )
}

function cleanString(value: unknown, fallback: string): string {
  // Preserve the user's exact in-progress text while editing. Trimming here
  // made a trailing space disappear on every keystroke, so typing
  // "Pontos de Descoberta" became "PontosdeDescoberta".
  return typeof value === "string" && value.trim() ? value : fallback
}

function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const numeric = finiteNumber(value, fallback)
  return Math.max(minimum, Math.min(maximum, numeric))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
