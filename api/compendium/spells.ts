import spellData from "../../src/data/spells.v1.json"
import type { Spell } from "../../src/models/magic/spells/Spell"

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"
const MAX_PAGE_SIZE = 1000
const MAX_INDEX_FILTER_SIZE = 100

const officialSpells = (spellData.spells as unknown[]).map((rawSpell) => {
  const { source: _source, ...spell } = rawSpell as Record<string, unknown>
  return spell as unknown as Spell
})

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const query = normalizeSearch(url.searchParams.get("q") ?? "")
  const level = parseOptionalNumber(url.searchParams.get("level"))
  const className = normalizeSearch(url.searchParams.get("class") ?? "")
  const school = normalizeSearch(url.searchParams.get("school") ?? "")
  const concentration = parseOptionalBoolean(url.searchParams.get("concentration"))
  const ritual = parseOptionalBoolean(url.searchParams.get("ritual"))
  const attack = parseOptionalBoolean(url.searchParams.get("attack"))
  const save = parseOptionalBoolean(url.searchParams.get("save"))
  const castingTime = url.searchParams.get("castingTime")?.trim() ?? ""
  const indexes = parseIndexes(url.searchParams.get("indexes"))
  const page = Math.max(1, parsePositiveInteger(url.searchParams.get("page"), 1))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parsePositiveInteger(url.searchParams.get("pageSize"), 100)),
  )
  const includeDetails = url.searchParams.get("includeDetails") === "true"

  const filtered = officialSpells.filter((spell) => {
    if (indexes && !indexes.has(spell.index)) return false
    if (level !== null && spell.slotLevel !== level) return false
    if (className && !spell.classes.some((entry) => normalizeSearch(entry) === className)) {
      return false
    }
    if (school && normalizeSearch(String(spell.school)) !== school) return false
    if (concentration !== null && spell.concentration !== concentration) return false
    if (ritual !== null && spell.ritual !== ritual) return false
    if (attack !== null && spell.targeting.hasAttackRoll !== attack) return false
    if (save !== null && spell.targeting.hasSavingThrow !== save) return false
    if (castingTime && spell.castingTime.type !== castingTime) return false

    if (query) {
      const searchable = normalizeSearch(
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
      )
      if (!searchable.includes(query)) return false
    }

    return true
  })

  const start = (page - 1) * pageSize
  const selected = filtered.slice(start, start + pageSize)

  return cachedJson({
    spells: includeDetails ? selected : selected.map(toSpellSummary),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  })
}

function toSpellSummary(spell: Spell) {
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

function cachedJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": CACHE_CONTROL,
    },
  })
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function parseOptionalNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalBoolean(value: string | null): boolean | null {
  if (value === "true") return true
  if (value === "false") return false
  return null
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseIndexes(value: string | null): Set<string> | null {
  if (!value?.trim()) return null

  const indexes = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, MAX_INDEX_FILTER_SIZE)

  return indexes.length ? new Set(indexes) : null
}
