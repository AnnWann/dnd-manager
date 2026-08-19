import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { queryOfficialSpellDetails } from "../../../api/spell-compendium"
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

const CASTING_ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

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
  const [officialSpells, setOfficialSpells] = useState<Spell[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    if (!open) return
    setQuery("")
    setLevelFilter("all")
    setSchoolFilter("all")
    setSelectedOnly(false)
    setLoadError("")

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    let cancelled = false
    setLoading(true)

    void Promise.all([
      queryOfficialSpellDetails({ page: 1, pageSize: 1000 }),
      ensureOfficialSpells(selected),
    ])
      .then(([page]) => {
        if (!cancelled) setOfficialSpells(page.spells)
      })
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar as magias oficiais.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      document.body.style.overflow = previousOverflow
    }
  }, [ensureOfficialSpells, kind, open, selected])

  const candidates = useMemo(() => {
    const homebrew = spells.filter((spell) => spell.homebrew)
    const byIndex = new Map<string, Spell>()
    for (const spell of officialSpells) byIndex.set(spell.index, spell)
    for (const spell of homebrew) byIndex.set(spell.index, spell)
    return Array.from(byIndex.values()).filter((spell) =>
      kind === "cantrip" ? spell.slotLevel === 0 : spell.slotLevel > 0,
    )
  }, [kind, officialSpells, spells])

  const schools = useMemo(
    () =>
      Array.from(new Set(candidates.map((spell) => String(spell.school))))
        .map((school) => ({
          value: school,
          label: MAGIC_SCHOOLS_MAP[school] ?? school,
        }))
        .toSorted((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [candidates],
  )
  const normalizedQuery = normalize(query)
  const visible = useMemo(
    () =>
      candidates
        .filter((spell) => {
          const matchesQuery =
            !normalizedQuery ||
            normalize(
              `${spellName(spell)} ${spell.description ?? ""} ${MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}`,
            ).includes(normalizedQuery)
          const matchesLevel =
            kind === "cantrip" ||
            levelFilter === "all" ||
            spell.slotLevel === Number(levelFilter)
          const matchesSchool =
            schoolFilter === "all" || String(spell.school) === schoolFilter
          const matchesSelected = !selectedOnly || selected.includes(spell.index)
          return matchesQuery && matchesLevel && matchesSchool && matchesSelected
        })
        .toSorted(
          (left, right) =>
            left.slotLevel - right.slotLevel ||
            spellName(left).localeCompare(spellName(right), "pt-BR"),
        ),
    [
      candidates,
      kind,
      levelFilter,
      normalizedQuery,
      schoolFilter,
      selected,
      selectedOnly,
    ],
  )

  if (!open) return null

  async function toggle(spell: Spell) {
    if (!selected.includes(spell.index) && !spell.homebrew) {
      await ensureOfficialSpells([spell.index])
    }
    onChange(
      selected.includes(spell.index)
        ? selected.filter((entry) => entry !== spell.index)
        : [...selected, spell.index],
    )
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
                {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                  <option key={level} value={level}>{level}º círculo</option>
                ))}
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
          {!loading && visible.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((spell) => {
                const isSelected = selected.includes(spell.index)
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
                    <details className="mt-3 border-t border-border pt-3 text-xs text-text">
                      <summary className="cursor-pointer font-medium text-textH">Ver descrição completa</summary>
                      <div className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">{spell.description?.trim() || "Sem descrição cadastrada."}</div>
                      {spell.higherLevelText?.trim() ? <div className="mt-3 whitespace-pre-wrap leading-5 text-textMuted"><strong className="text-textH">Em círculos superiores: </strong>{spell.higherLevelText.trim()}</div> : null}
                    </details>
                  </article>
                )
              })}
            </div>
          ) : !loading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted">Nenhuma magia corresponde aos filtros.</div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>Concluir seleção</Button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

function spellName(spell: Spell): string {
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
}
