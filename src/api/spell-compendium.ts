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
  minLevel?: number
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

const SPELL_INDEX_BATCH_SIZE = 100
const spellDetailCache = new Map<string, Spell>()
let allOfficialSpellSummariesCache: SpellCompendiumPage<SpellCompendiumSummary> | null = null
let allOfficialSpellSummariesRequest: Promise<SpellCompendiumPage<SpellCompendiumSummary>> | null = null

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
    { params: toQueryParams(query) },
  )
  return response.data
}

export async function queryOfficialSpellDetails(
  query: SpellCompendiumQuery = {},
): Promise<SpellCompendiumPage<Spell>> {
  if (import.meta.env.DEV && LOCAL_AUTH_BYPASS) {
    const spells = await loadLocalOfficialSpells()
    const filtered = filterLocalSpells(spells, query)
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.max(1, query.pageSize ?? 100)
    const start = (page - 1) * pageSize
    const selected = filtered.slice(start, start + pageSize)
    for (const spell of selected) spellDetailCache.set(spell.index, spell)
    return {
      spells: selected,
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    }
  }

  const response = await apiClient.get<SpellCompendiumPage<Spell>>(
    "/compendium/spells",
    { params: { ...toQueryParams(query), includeDetails: true } },
  )
  for (const spell of response.data.spells) spellDetailCache.set(spell.index, spell)
  return response.data
}

export function getCachedAllOfficialSpellSummaries(): SpellCompendiumPage<SpellCompendiumSummary> | null {
  return allOfficialSpellSummariesCache
}

export function preloadAllOfficialSpellSummaries(): Promise<SpellCompendiumPage<SpellCompendiumSummary>> {
  return queryAllOfficialSpellSummaries()
}

export async function queryAllOfficialSpellSummaries(
  query: Omit<SpellCompendiumQuery, "page" | "pageSize"> = {},
): Promise<SpellCompendiumPage<SpellCompendiumSummary>> {
  const canUseSharedCache = isUnfilteredSpellQuery(query)

  if (canUseSharedCache && allOfficialSpellSummariesCache) {
    return allOfficialSpellSummariesCache
  }
  if (canUseSharedCache && allOfficialSpellSummariesRequest) {
    return allOfficialSpellSummariesRequest
  }

  const load = async () => {
    const pageSize = 1000
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

  if (!canUseSharedCache) return load()

  allOfficialSpellSummariesRequest = load()
    .then((page) => {
      allOfficialSpellSummariesCache = page
      return page
    })
    .finally(() => {
      allOfficialSpellSummariesRequest = null
    })

  return allOfficialSpellSummariesRequest
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
    const batches = Array.from(
      { length: Math.ceil(missing.length / SPELL_INDEX_BATCH_SIZE) },
      (_, batchIndex) =>
        missing.slice(
          batchIndex * SPELL_INDEX_BATCH_SIZE,
          (batchIndex + 1) * SPELL_INDEX_BATCH_SIZE,
        ),
    )

    const pages = await Promise.all(
      batches.map(async (batch) => {
        const response = await apiClient.get<SpellCompendiumPage<Spell>>(
          "/compendium/spells",
          {
            params: {
              indexes: batch.join(","),
              includeDetails: true,
              pageSize: batch.length,
            },
          },
        )
        return response.data.spells
      }),
    )
    loaded = pages.flat()
  }

  for (const spell of loaded) spellDetailCache.set(spell.index, spell)

  const byIndex = new Map([...cached, ...loaded].map((spell) => [spell.index, spell]))
  return normalizedIndexes
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
}

async function loadLocalOfficialSpells(): Promise<Spell[]> {
  const module = await import("../data/spells.v1.json")
  const rawSpells = (module.default.spells as unknown[]) ?? []
  return rawSpells.map((rawSpell) => {
    const { source: _source, ...spell } = rawSpell as Record<string, unknown>
    return spell as unknown as Spell
  })
}

function toQueryParams(query: SpellCompendiumQuery) {
  return {
    q: query.q || undefined,
    level: query.level,
    minLevel: query.minLevel,
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
  }
}

function isUnfilteredSpellQuery(
  query: Omit<SpellCompendiumQuery, "page" | "pageSize">,
): boolean {
  return (
    !query.q &&
    query.level === undefined &&
    query.minLevel === undefined &&
    query.maxLevel === undefined &&
    !query.className &&
    !query.school &&
    query.concentration === undefined &&
    query.ritual === undefined &&
    query.attack === undefined &&
    query.save === undefined &&
    !query.castingTime
  )
}

function filterLocalSpells(spells: Spell[], query: SpellCompendiumQuery): Spell[] {
  const normalizedQuery = normalizeSearch(query.q ?? "")
  const normalizedClass = normalizeSearch(query.className ?? "")
  const normalizedSchool = normalizeSearch(query.school ?? "")

  return spells.filter((spell) => {
    if (query.level !== undefined && spell.slotLevel !== query.level) return false
    if (query.minLevel !== undefined && spell.slotLevel < query.minLevel) return false
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
