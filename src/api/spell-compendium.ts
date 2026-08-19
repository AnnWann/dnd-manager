import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { Spell } from "../models/magic/spells/Spell"
import { apiClient } from "./api-client"

export type SpellCompendiumSummary = Pick<
  Spell,
  | "index"
  | "name"
  | "displayName"
  | "slotLevel"
  | "school"
  | "classes"
  | "concentration"
  | "ritual"
  | "castingTime"
> & {
  targeting: Pick<Spell["targeting"], "hasAttackRoll" | "hasSavingThrow">
}

export type SpellCompendiumQuery = {
  q?: string
  level?: number
  className?: string
  school?: string
  concentration?: boolean
  ritual?: boolean
  page?: number
  pageSize?: number
}

export type SpellCompendiumPage<T> = {
  spells: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

let officialSpellsPromise: Promise<Spell[]> | null = null
const spellDetailCache = new Map<string, Spell>()

export async function queryOfficialSpells(
  query: SpellCompendiumQuery = {},
): Promise<SpellCompendiumPage<SpellCompendiumSummary>> {
  if (import.meta.env.DEV && LOCAL_AUTH_BYPASS) {
    const spells = await loadLocalOfficialSpells()
    const filtered = filterLocalSpells(spells, query)
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.max(1, query.pageSize ?? 100)
    const start = (page - 1) * pageSize
    return {
      spells: filtered.slice(start, start + pageSize).map(toSummary),
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    }
  }

  const response = await apiClient.get<SpellCompendiumPage<SpellCompendiumSummary>>(
    "/compendium/spells",
    {
      params: {
        q: query.q || undefined,
        level: query.level,
        class: query.className || undefined,
        school: query.school || undefined,
        concentration: query.concentration,
        ritual: query.ritual,
        page: query.page,
        pageSize: query.pageSize,
      },
    },
  )
  return response.data
}

export async function getOfficialSpell(index: string): Promise<Spell> {
  const normalizedIndex = index.trim()
  const cached = spellDetailCache.get(normalizedIndex)
  if (cached) return cached

  if (import.meta.env.DEV && LOCAL_AUTH_BYPASS) {
    const spells = await loadLocalOfficialSpells()
    const spell = spells.find((entry) => entry.index === normalizedIndex)
    if (!spell) throw new Error("Magia oficial não encontrada.")
    spellDetailCache.set(normalizedIndex, spell)
    return spell
  }

  const response = await apiClient.get<{ spell: Spell }>(
    `/compendium/spells/${encodeURIComponent(normalizedIndex)}`,
  )
  spellDetailCache.set(normalizedIndex, response.data.spell)
  return response.data.spell
}

/**
 * Compatibility loader for existing MagicContext consumers. This keeps the
 * official compendium out of the JavaScript bundle while the UI migrates to
 * query/detail reads incrementally.
 */
export function getAllOfficialSpells(): Promise<Spell[]> {
  if (officialSpellsPromise) return officialSpellsPromise

  officialSpellsPromise = (async () => {
    if (import.meta.env.DEV && LOCAL_AUTH_BYPASS) {
      return loadLocalOfficialSpells()
    }

    const response = await apiClient.get<SpellCompendiumPage<Spell>>(
      "/compendium/spells",
      {
        params: {
          includeDetails: true,
          pageSize: 1000,
        },
      },
    )
    for (const spell of response.data.spells) {
      spellDetailCache.set(spell.index, spell)
    }
    return response.data.spells
  })().catch((error) => {
    officialSpellsPromise = null
    throw error
  })

  return officialSpellsPromise
}

async function loadLocalOfficialSpells(): Promise<Spell[]> {
  const module = await import("../data/spells.v1.json")
  const rawSpells = (module.default.spells as unknown[]) ?? []
  return rawSpells.map((rawSpell) => {
    const { source: _source, ...spell } = rawSpell as Record<string, unknown>
    return spell as unknown as Spell
  })
}

function filterLocalSpells(
  spells: Spell[],
  query: SpellCompendiumQuery,
): Spell[] {
  const normalizedQuery = normalizeSearch(query.q ?? "")
  const normalizedClass = normalizeSearch(query.className ?? "")
  const normalizedSchool = normalizeSearch(query.school ?? "")

  return spells.filter((spell) => {
    if (query.level !== undefined && spell.slotLevel !== query.level) return false
    if (
      normalizedClass &&
      !spell.classes.some((entry) => normalizeSearch(entry) === normalizedClass)
    ) {
      return false
    }
    if (normalizedSchool && normalizeSearch(String(spell.school)) !== normalizedSchool) {
      return false
    }
    if (
      query.concentration !== undefined &&
      spell.concentration !== query.concentration
    ) {
      return false
    }
    if (query.ritual !== undefined && spell.ritual !== query.ritual) return false
    if (!normalizedQuery) return true

    return normalizeSearch(
      [
        spell.displayName,
        spell.name,
        spell.description,
        spell.higherLevelText,
        spell.school,
        ...spell.classes,
      ]
        .filter(Boolean)
        .join(" "),
    ).includes(normalizedQuery)
  })
}

function toSummary(spell: Spell): SpellCompendiumSummary {
  return {
    index: spell.index,
    name: spell.name,
    displayName: spell.displayName,
    slotLevel: spell.slotLevel,
    school: spell.school,
    classes: spell.classes,
    concentration: spell.concentration,
    ritual: spell.ritual,
    castingTime: spell.castingTime,
    targeting: {
      hasAttackRoll: spell.targeting.hasAttackRoll,
      hasSavingThrow: spell.targeting.hasSavingThrow,
    },
  }
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}
