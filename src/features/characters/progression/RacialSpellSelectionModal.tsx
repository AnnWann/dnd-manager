import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import {
  getOfficialSpell,
  queryOfficialSpells,
  type SpellCompendiumSummary,
} from "../../../api/spell-compendium"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Attribute } from "../../../models/sheet/Attribute"

export type RacialSpellSelectionKind = "cantrip" | "leveled"

type Props = {
  open: boolean
  kind: RacialSpellSelectionKind
  raceName: string
  spells: Spell[]
  selected: string[]
  attribute: Attribute
  onAttributeChange: (attribute: Attribute) => void
  onChange: (selected: string[]) => void
  onClose: () => void
}

type Candidate = Spell | SpellCompendiumSummary

const CASTING_ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

const PAGE_SIZE = 100

export function RacialSpellSelectionModal({
  open,
  kind,
  raceName,
  spells,
  selected,
  attribute,
  onAttributeChange,
  onChange,
  onClose,
}: Props) {
  const { ensureOfficialSpells } = useMagicContext()
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [officialSpells, setOfficialSpells] = useState<SpellCompendiumSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [details, setDetails] = useState<Map<string, Spell>>(() => new Map())

  useEffect(() => {
    if (!open) return
    setQuery("")
    setLevelFilter("all")
    setSchoolFilter("all")
    setSelectedOnly(false)
    setOfficialSpells([])
    setPage(1)
    setTotalPages(1)
    setLoadError("")
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [kind, open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setLoadError("")
      void queryOfficialSpells({
        q: query.trim() || undefined,
        level: kind === "cantrip" ? 0 : levelFilter === "all" ? undefined : Number(levelFilter),
        minLevel: kind === "leveled" && levelFilter === "all" ? 1 : undefined,
        school: schoolFilter === "all" ? undefined : schoolFilter,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((result) => {
          if (cancelled) return
          setOfficialSpells(result.spells)
          setTotalPages(result.totalPages)
        })
        .catch(() => {
          if (!cancelled) setLoadError("Não foi possível carregar as magias oficiais.")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [kind, levelFilter, open, page, query, schoolFilter])

  useEffect(() => {
    setPage(1)
  }, [kind, levelFilter, query, schoolFilter])

  useEffect(() => {
    if (!open || !selected.length) return
    void ensureOfficialSpells(selected)
  }, [ensureOfficialSpells, open, selected])

  const candidates = useMemo<Candidate[]>(() => {
    const homebrew = spells.filter((spell) => {
      if (!spell.homebrew) return false
      if (kind === "cantrip" && spell.slotLevel !== 0) return false
      if (kind === "leveled" && spell.slotLevel <= 0) return false
      if (levelFilter !== "all" && spell.slotLevel !== Number(levelFilter)) return false
      if (schoolFilter !== "all" && spell.school !== schoolFilter) return false
      const normalized = normalize(query)
      return !normalized || normalize(`${spellName(spell)} ${spell.description ?? ""}`).includes(normalized)
    })
    const merged = [...officialSpells, ...homebrew]
    return selectedOnly ? merged.filter((spell) => selected.includes(spell.index)) : merged
  }, [kind, levelFilter, officialSpells, query, schoolFilter, selected, selectedOnly, spells])

  const schools = useMemo(
    () => Object.keys(MAGIC_SCHOOLS_MAP)
      .map((school) => ({ value: school, label: MAGIC_SCHOOLS_MAP[school] ?? school }))
      .toSorted((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [],
  )

  if (!open) return null

  async function toggle(spell: Candidate) {
    if (!selected.includes(spell.index) && !spell.homebrew) {
      await ensureOfficialSpells([spell.index])
    }
    onChange(
      selected.includes(spell.index)
        ? selected.filter((entry) => entry !== spell.index)
        : [...selected, spell.index],
    )
  }

  async function loadDetail(index: string) {
    if (details.has(index)) return
    try {
      const spell = await getOfficialSpell(index)
      setDetails((current) => new Map(current).set(index, spell))
    } catch {
      setLoadError("Não foi possível carregar os detalhes da magia.")
    }
  }

  const title = kind === "cantrip" ? "Truques raciais" : "Magias raciais"

  return createPortal(
    <div className="fixed inset-0 z-[12500] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <section className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">{title} — {raceName}</h2>
            <div className="mt-1 text-xs text-textMuted">{selected.length} selecionado(s)</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
        </header>

        <div className="mt-4 grid gap-3 border-b border-border pb-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
            <Input value={query} placeholder="Buscar por nome ou descrição" onChange={(event) => setQuery(event.target.value)} />
            {kind === "leveled" ? (
              <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                <option value="all">Todos os círculos</option>
                {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => <option key={level} value={level}>{level}º círculo</option>)}
              </Select>
            ) : (
              <div className="flex h-10 items-center rounded-lg border border-border bg-bg px-3 text-xs text-textMuted">Truques</div>
            )}
            <Select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
              <option value="all">Todas as escolas</option>
              {schools.map((school) => <option key={school.value} value={school.value}>{school.label}</option>)}
            </Select>
            <Select value={attribute} onChange={(event) => onAttributeChange(event.target.value as Attribute)}>
              {CASTING_ATTRIBUTES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-text">
              <input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />
              Selecionadas
            </label>
          </div>
        </div>

        <div className="mt-4 min-h-0 overflow-y-auto pr-1">
          {loading ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted">Carregando magias...</div> : null}
          {loadError ? <div className="mb-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{loadError}</div> : null}
          {!loading && candidates.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {candidates.map((spell) => {
                const isSelected = selected.includes(spell.index)
                const detail = details.get(spell.index)
                return (
                  <article key={spell.index} className={isSelected ? "rounded-xl border border-accentBorder bg-accentBg p-4" : "rounded-xl border border-border bg-bg p-4"}>
                    <button type="button" className="w-full text-left" onClick={() => void toggle(spell)}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-textH">{spellName(spell)}</div>
                          <div className="mt-1 text-xs text-textMuted">
                            {formatSpellLevel(spell.slotLevel)} · {MAGIC_SCHOOLS_MAP[spell.school] ?? String(spell.school)}
                            {spell.concentration ? " · Concentração" : ""}
                            {spell.ritual ? " · Ritual" : ""}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-textH">{isSelected ? "Selecionada" : ""}</span>
                      </div>
                    </button>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-textMuted">{spell.description?.trim() || "Sem descrição cadastrada."}</p>
                    <details className="mt-3 border-t border-border pt-3 text-xs text-text" onToggle={(event) => {
                      if ((event.currentTarget as HTMLDetailsElement).open && !spell.homebrew) void loadDetail(spell.index)
                    }}>
                      <summary className="cursor-pointer font-medium text-textH">Ver descrição completa</summary>
                      <div className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">{(detail?.description ?? spell.description)?.trim() || "Sem descrição cadastrada."}</div>
                      {detail?.higherLevelText?.trim() ? <div className="mt-3 whitespace-pre-wrap leading-5 text-textMuted"><strong className="text-textH">Em círculos superiores: </strong>{detail.higherLevelText.trim()}</div> : null}
                    </details>
                  </article>
                )
              })}
            </div>
          ) : !loading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted">Nenhuma magia corresponde aos filtros.</div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-xs text-textMuted">Página {page} de {totalPages}</div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Próxima</Button>
            <Button variant="primary" onClick={onClose}>Concluir seleção</Button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}

function spellName(spell: Pick<Spell, "name" | "displayName">): string {
  return spell.displayName?.trim() || spell.name
}

function formatSpellLevel(level: number): string {
  return level === 0 ? "Truque" : `${level}º círculo`
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}
