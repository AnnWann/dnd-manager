import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { LegacyCampaignBackupV1 } from "../shared/legacy/legacyCampaignBackup"
import { apiClient } from "./api-client"
import type { UserCampaign } from "./user-campaigns"

export type LegacyCampaignImportResult = {
  campaign: UserCampaign
  imported: {
    characters: number
    partyItems: number
    groundItems: number
    spells: number
    customSystems: number
    missions: number
    ownersReassignedToImporter: number
  }
}

export async function importLegacyCampaign(input: {
  name: string
  description?: string
  backup: LegacyCampaignBackupV1
}): Promise<LegacyCampaignImportResult> {
  if (LOCAL_AUTH_BYPASS) {
    throw new Error(
      "A importação de campanhas legacy exige o backend para criar a campanha e os personagens de forma atômica.",
    )
  }

  const response = await apiClient.post<LegacyCampaignImportResult>(
    "/me/campaigns/import-legacy",
    input,
  )
  return response.data
}
