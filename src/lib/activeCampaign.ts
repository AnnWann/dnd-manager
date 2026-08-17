export const ACTIVE_SESSION_STORAGE_KEY = "dndmm.activeSessionId.v1"
const LEGACY_ACTIVE_CAMPAIGN_STORAGE_KEY = "dndmm.activeCampaignId.v1"

export function rememberActiveSession(sessionId: string): void {
  sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId)
  sessionStorage.removeItem(LEGACY_ACTIVE_CAMPAIGN_STORAGE_KEY)
}

export function readActiveSession(): string | null {
  return (
    sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) ??
    sessionStorage.getItem(LEGACY_ACTIVE_CAMPAIGN_STORAGE_KEY)
  )
}

export function clearActiveSession(): void {
  sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
  sessionStorage.removeItem(LEGACY_ACTIVE_CAMPAIGN_STORAGE_KEY)
}

/** Compatibility aliases for code that still names the backing campaign id. */
export const ACTIVE_CAMPAIGN_STORAGE_KEY = ACTIVE_SESSION_STORAGE_KEY
export const rememberActiveCampaign = rememberActiveSession
export const readActiveCampaign = readActiveSession
export const clearActiveCampaign = clearActiveSession
