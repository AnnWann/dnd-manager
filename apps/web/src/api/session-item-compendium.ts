import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { Itemmable } from "../models/items/item"
import { apiClient } from "./api-client"

export type SessionItemCompendiumVisibility = "PUBLIC" | "MASTER"

export type SessionItemCompendiumEntry = {
  id: string
  templateId: string
  item?: Itemmable | null
  custom: boolean
  visibility: SessionItemCompendiumVisibility
  createdById?: string
  createdAt?: string
  updatedAt?: string
}

export type SessionItemCompendiumCatalog = {
  campaign: {
    id: string
    isMaster: boolean
  }
  entries: SessionItemCompendiumEntry[]
}

const LOCAL_KEY_PREFIX = "dnd-manager:session-item-compendium:v1:"

export async function getSessionItemCompendium(
  campaignId: string,
): Promise<SessionItemCompendiumCatalog> {
  if (LOCAL_AUTH_BYPASS) {
    return {
      campaign: {
        id: campaignId,
        isMaster: true,
      },
      entries: readLocalEntries(campaignId),
    }
  }

  const response = await apiClient.get<SessionItemCompendiumCatalog>(
    `/campaigns/${encodeURIComponent(campaignId)}/item-compendium`,
  )

  return {
    campaign: response.data.campaign,
    entries: response.data.entries ?? [],
  }
}

export async function upsertSessionItemCompendiumEntry(
  campaignId: string,
  input: {
    item: Itemmable
    custom: boolean
    visibility: SessionItemCompendiumVisibility
  },
): Promise<SessionItemCompendiumEntry> {
  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    const current = readLocalEntries(campaignId)
    const previous = current.find(
      (entry) => entry.templateId === input.item.id,
    )
    const next: SessionItemCompendiumEntry = {
      id: previous?.id ?? crypto.randomUUID(),
      templateId: input.item.id,
      item: structuredClone(input.item),
      custom: input.custom,
      visibility: input.visibility,
      createdById: previous?.createdById ?? "local-development-user",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }

    writeLocalEntries(campaignId, [
      ...current.filter((entry) => entry.templateId !== input.item.id),
      next,
    ])
    return next
  }

  const response = await apiClient.post<{
    entry: SessionItemCompendiumEntry
  }>(`/campaigns/${encodeURIComponent(campaignId)}/item-compendium`, input)
  return response.data.entry
}

export async function deleteSessionItemCompendiumEntry(
  campaignId: string,
  templateId: string,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    writeLocalEntries(
      campaignId,
      readLocalEntries(campaignId).filter(
        (entry) => entry.templateId !== templateId,
      ),
    )
    return
  }

  await apiClient.delete(
    `/campaigns/${encodeURIComponent(campaignId)}/item-compendium/${encodeURIComponent(templateId)}`,
  )
}

function readLocalEntries(campaignId: string): SessionItemCompendiumEntry[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(`${LOCAL_KEY_PREFIX}${campaignId}`) ?? "[]",
    ) as unknown
    return Array.isArray(parsed)
      ? (parsed as SessionItemCompendiumEntry[])
      : []
  } catch {
    return []
  }
}

function writeLocalEntries(
  campaignId: string,
  entries: SessionItemCompendiumEntry[],
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      `${LOCAL_KEY_PREFIX}${campaignId}`,
      JSON.stringify(entries),
    )
  } catch {
    // Development fallback only.
  }
}
