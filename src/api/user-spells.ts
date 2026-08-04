import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { Spell } from "../models/magic/spells/Spell"
import { apiClient } from "./api-client"

export type CampaignSpellAccess = {
  linkId: string
  id: string
  name: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"
  note?: string | null
  submittedAt: string
  reviewedAt?: string | null
}

export type CharacterSpellAccess = {
  id: string
  name: string
}

export type AccessibleHomebrewSpell = {
  id: string
  index: string
  name: string
  data: Spell
  status: "ACTIVE" | "ARCHIVED"
  revision: number
  ownerId: string
  ownedByCurrentUser: boolean
  characters: CharacterSpellAccess[]
  campaigns: CampaignSpellAccess[]
  createdAt: string
  updatedAt: string
}

const LOCAL_KEY = "dnd-manager:user-relational-spells:v1"

export async function getAccessibleHomebrewSpells(): Promise<AccessibleHomebrewSpell[]> {
  if (LOCAL_AUTH_BYPASS) return readLocalSpells()

  const response = await apiClient.get<{
    spells: AccessibleHomebrewSpell[]
  }>("/me/spells")

  return response.data.spells ?? []
}

export async function createOwnedHomebrewSpell(
  spell: Spell,
): Promise<AccessibleHomebrewSpell> {
  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    const index = createLocalIndex(spell.name)
    const record: AccessibleHomebrewSpell = {
      id: crypto.randomUUID(),
      index,
      name: spell.name,
      data: {
        ...spell,
        index,
        name: spell.name,
        homebrew: true,
      },
      status: "ACTIVE",
      revision: 1,
      ownerId: "local-user",
      ownedByCurrentUser: true,
      characters: [],
      campaigns: [],
      createdAt: now,
      updatedAt: now,
    }

    writeLocalSpells([record, ...readLocalSpells()])
    return record
  }

  const response = await apiClient.post<{
    spell: AccessibleHomebrewSpell
  }>("/me/spells", {
    name: spell.name,
    data: spell,
  })

  return response.data.spell
}

export async function updateOwnedHomebrewSpell(
  record: AccessibleHomebrewSpell,
  spell: Spell,
): Promise<AccessibleHomebrewSpell> {
  if (LOCAL_AUTH_BYPASS) {
    const updated: AccessibleHomebrewSpell = {
      ...record,
      name: spell.name,
      data: {
        ...spell,
        index: record.index,
        name: spell.name,
        homebrew: true,
      },
      revision: record.revision + 1,
      updatedAt: new Date().toISOString(),
    }

    writeLocalSpells(
      readLocalSpells().map((entry) =>
        entry.id === record.id ? updated : entry,
      ),
    )
    return updated
  }

  const response = await apiClient.patch<{
    spell: AccessibleHomebrewSpell
  }>(`/me/spells/${encodeURIComponent(record.id)}`, {
    name: spell.name,
    data: spell,
    expectedRevision: record.revision,
  })

  return {
    ...response.data.spell,
    ownedByCurrentUser: true,
    characters: record.characters,
    campaigns: record.campaigns,
  }
}

export async function archiveOwnedHomebrewSpell(
  record: AccessibleHomebrewSpell,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    writeLocalSpells(
      readLocalSpells().filter((entry) => entry.id !== record.id),
    )
    return
  }

  await apiClient.delete(
    `/me/spells/${encodeURIComponent(record.id)}`,
  )
}

function readLocalSpells(): AccessibleHomebrewSpell[] {
  if (typeof window === "undefined") return []

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LOCAL_KEY) ?? "[]",
    ) as unknown

    return Array.isArray(parsed)
      ? (parsed as AccessibleHomebrewSpell[]).map((record) => ({
          ...record,
          characters: record.characters ?? [],
          campaigns: record.campaigns ?? [],
        }))
      : []
  } catch {
    return []
  }
}

function writeLocalSpells(spells: AccessibleHomebrewSpell[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(spells))
  } catch {
    // Local development storage is best-effort only.
  }
}

function createLocalIndex(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "spell"

  return `homebrew-local-${slug}-${crypto.randomUUID().slice(0, 8)}`
}
