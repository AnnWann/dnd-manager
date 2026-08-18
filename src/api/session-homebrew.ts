import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { Spell } from "../models/magic/spells/Spell"
import { apiClient } from "./api-client"
import { getMyCampaigns, reviewCampaignSpell } from "./user-campaigns"
import { getAccessibleHomebrewSpells } from "./user-spells"

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
  if (LOCAL_AUTH_BYPASS) {
    const [campaigns, records] = await Promise.all([
      getMyCampaigns(),
      getAccessibleHomebrewSpells(),
    ])
    const campaign = campaigns.find((entry) => entry.id === campaignId)
    if (!campaign) throw new Error("Sessão local não encontrada.")

    const isMaster = campaign.isOwner || campaign.role === "MASTER"
    const spells: SessionHomebrewSpell[] = []

    for (const record of records) {
      const link = record.campaigns.find((entry) => entry.id === campaignId)
      if (!link) continue
      if (!isMaster && link.status !== "APPROVED") continue

      spells.push({
        linkId: link.linkId,
        id: record.id,
        index: record.index,
        name: record.name,
        data: record.data,
        status: link.status,
        note: link.note,
        author: {
          id: record.ownerId,
          name: record.ownedByCurrentUser ? "Usuário local" : "Autor",
        },
        submittedBy: {
          id: record.ownerId,
          name: record.ownedByCurrentUser ? "Usuário local" : "Usuário",
        },
        submittedAt: link.submittedAt,
        reviewedAt: link.reviewedAt,
        reviewedBy: link.reviewedAt
          ? {
              id: campaign.owner.id,
              name: campaign.owner.name,
            }
          : null,
      })
    }

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        isMaster,
      },
      spells,
    }
  }

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
  if (LOCAL_AUTH_BYPASS) {
    await reviewCampaignSpell(campaignId, spellId, status, note)
    return
  }

  await apiClient.patch(
    `/campaigns/${encodeURIComponent(campaignId)}/spells/${encodeURIComponent(spellId)}`,
    {
      status,
      note,
    },
  )
}
