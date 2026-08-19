import spellData from "../../src/data/spells.v1.json"
import type { Spell } from "../../src/models/magic/spells/Spell"

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"
const MAX_PAGE_SIZE = 1000

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
  const page = Math.max(1, parsePositiveInteger(url.searchParams.get("page"), 1))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parsePositiveInteger(url.searchParams.get("pageSize"), 100)),
  )
  const includeDetails = url.searchParams.get("includeDetails") === "true"

  const filtered = officialSpells.filter((spell) => {
    if (level !== null && spell.slotLevel !== level) return false
    if (className && !spell.classes.some((entry) => normalizeSearch(entry) === className)) {
      return false
    }
    if (school && normalizeSearch(String(spell.school)) !== school) return false
    if (concentration !== null && spell.concentration !== concentration) return false
    if (ritual !== null && spell.ritual !== ritual) return false

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
