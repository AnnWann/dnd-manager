import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { Spell } from "../models/magic/spells/Spell"
import { apiClient } from "./api-client"

export type SpellCompendiumSummary = Pick<
  Spell,
  | "index"
  | "name"
  | "displayName"
  | "description"
  | "homebrew"
  | "slotLevel"
  | "school"
  | "classes"
  | "concentration"
  | "ritual"
  | "castingTime"
  | "range"
  | "duration"
  | "components"
  | "material"
> & {
  targeting: Pick<Spell["targeting"], "hasAttackRoll" | "hasSavingThrow">
}

export type SpellCompendiumQuery = {
  q?: string
  level?: number
  maxLevel?: number
  className?: string
  school?: string
  concentration?: boolean
  ritual?: boolean
  attack?: boolean
  save?: boolean
  castingTime?: string
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
        maxLevel: query.maxLevel,
        class: query.className || undefined,
        school: query.school || undefined,
        concentration: query.concentration,
        ritual: query.ritual,
        attack: query.attack,
        save: query.save,
        castingTime: query.castingTime || undefined,
        page: query.page,
        pageSize: query.pageSize,
      },
    },
  )
  return response.data
}

export async function queryAllOfficialSpellSummaries(
  query: Omit<SpellCompendiumQuery, "page" | "pageSize"> = {},
): Promise<SpellCompendiumPage<SpellCompendiumSummary>> {
  const pageSize = 250
  const first = await queryOfficialSpells({ ...query, page: 1, pageSize })
  if (first.totalPages <= 1) return first

  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      queryOfficialSpells({ ...query, page: index + 2, pageSize }),
    ),
  )

  return {
    ...first,
    spells: [first, ...remaining].flatMap((page) => page.spells),
    page: 1,
    pageSize: first.total,
  }
}

export async function getOfficialSpell(index: string): Promise<Spell> {
  const normalizedIndex = index.trim()
  const cached = spellDetailCache.get(normalizedIndex)
  if (cached) return cached

  const [spell] = await getOfficialSpellsByIndexes([normalizedIndex])
  if (!spell) throw new Error("Magia oficial não encontrada.")
  return spell
}

export async function getOfficialSpellsByIndexes(
  indexes: readonly string[],
): Promise<Spell[]> {
  const normalizedIndexes = Array.from(
    new Set(indexes.map((entry) => entry.trim()).filter(Boolean)),
  )
  if (!normalizedIndexes.length) return []

  const cached: Spell[] = []
  const missing: string[] = []
  for (const index of normalizedIndexes) {
    const spell = spellDetailCache.get(index)
    if (spell) cached.push(spell)
    else missing.push(index)
  }
  if (!missing.length) return cached

  let loaded: Spell[]
  if (import.meta.env.DEV && LOCAL_AUTH_BYPASS) {
    const local = await loadLocalOfficialSpells()
    const wanted = new Set(missing)
    loaded = local.filter((spell) => wanted.has(spell.index))
  } else {
    const response = await apiClient.get<SpellCompendiumPage<Spell>>(
      "/compendium/spells",
      {
        params: {
          indexes: missing.join(","),
          includeDetails: true,
          pageSize: Math.min(100, missing.length),
        },
      },
    )
    loaded = response.data.spells
  }

  for (const spell of loaded) spellDetailCache.set(spell.index, spell)

  const byIndex = new Map([...cached, ...loaded].map((spell) => [spell.index, spell]))
  return normalizedIndexes
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
}

/** Compatibility loader kept only for legacy consumers still being migrated. */
export function getAllOfficialSpells(): Promise<Spell[]> {
  if (officialSpellsPromise) return officialSpellsPromise

  officialSpellsPromise = (async () => {
    if (import.meta.env.DEV && LOCAL_AUTH_BYPASS) return loadLocalOfficialSpells()

    const response = await apiClient.get<SpellCompendiumPage<Spell>>(
      "/compendium/spells",
      { params: { includeDetails: true, pageSize: 1000 } },
    )
    for (const spell of response.data.spells) spellDetailCache.set(spell.index, spell)
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

function filterLocalSpells(spells: Spell[], query: SpellCompendiumQuery): Spell[] {
  const normalizedQuery = normalizeSearch(query.q ?? "")
  const normalizedClass = normalizeSearch(query.className ?? "")
  const normalizedSchool = normalizeSearch(query.school ?? "")

  return spells.filter((spell) => {
    if (query.level !== undefined && spell.slotLevel !== query.level) return false
    if (query.maxLevel !== undefined && spell.slotLevel > query.maxLevel) return false
    if (normalizedClass && !spell.classes.some((entry) => normalizeSearch(entry) === normalizedClass)) return false
    if (normalizedSchool && normalizeSearch(String(spell.school)) !== normalizedSchool) return false
    if (query.concentration !== undefined && spell.concentration !== query.concentration) return false
    if (query.ritual !== undefined && spell.ritual !== query.ritual) return false
    if (query.attack !== undefined && spell.targeting.hasAttackRoll !== query.attack) return false
    if (query.save !== undefined && spell.targeting.hasSavingThrow !== query.save) return false
    if (query.castingTime && spell.castingTime.type !== query.castingTime) return false
    if (!normalizedQuery) return true

    return normalizeSearch(
      [spell.displayName, spell.name, spell.description, spell.higherLevelText, spell.school, ...spell.classes]
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
    description: spell.description,
    homebrew: false,
    slotLevel: spell.slotLevel,
    school: spell.school,
    classes: spell.classes,
    concentration: spell.concentration,
    ritual: spell.ritual,
    castingTime: spell.castingTime,
    range: spell.range,
    duration: spell.duration,
    components: spell.components,
    material: spell.material,
    targeting: {
      hasAttackRoll: spell.targeting.hasAttackRoll,
      hasSavingThrow: spell.targeting.hasSavingThrow,
    },
  }
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim()
}
