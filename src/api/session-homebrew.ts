import type { Spell } from "../models/magic/spells/Spell"
import { apiClient } from "./api-client"

export type SessionHomebrewSpellStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"

export type SessionHomebrewSpell = {
  linkId: string
  id: string
  index: string
  name: string
  data: Spell
  status: SessionHomebrewSpellStatus
  note?: string | null
  author: {
    id: string
    name: string
  }
  submittedBy: {
    id: string
    name: string
  }
  reviewedBy?: {
    id: string
    name: string
  } | null
  submittedAt: string
  reviewedAt?: string | null
}

export type SessionHomebrewCatalog = {
  campaign: {
    id: string
    name: string
    isMaster: boolean
  }
  spells: SessionHomebrewSpell[]
}

export async function getSessionHomebrew(
  campaignId: string,
): Promise<SessionHomebrewCatalog> {
  const response = await apiClient.get<SessionHomebrewCatalog>(
    `/campaigns/${encodeURIComponent(campaignId)}/homebrew`,
  )
  return response.data
}

export async function reviewSessionHomebrewSpell(
  campaignId: string,
  spellId: string,
  status: "APPROVED" | "REJECTED" | "REVOKED",
  note?: string,
): Promise<void> {
  await apiClient.patch(
    `/campaigns/${encodeURIComponent(campaignId)}/spells/${encodeURIComponent(spellId)}`,
    {
      status,
      note,
    },
  )
}
