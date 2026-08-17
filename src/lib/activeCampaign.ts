export const ACTIVE_CAMPAIGN_STORAGE_KEY = "dndmm.activeCampaignId.v1"

export function rememberActiveCampaign(campaignId: string): void {
  sessionStorage.setItem(ACTIVE_CAMPAIGN_STORAGE_KEY, campaignId)
}

export function readActiveCampaign(): string | null {
  return sessionStorage.getItem(ACTIVE_CAMPAIGN_STORAGE_KEY)
}

export function clearActiveCampaign(): void {
  sessionStorage.removeItem(ACTIVE_CAMPAIGN_STORAGE_KEY)
}
