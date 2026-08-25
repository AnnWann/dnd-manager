import { useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import type { Spell } from "../../../models/magic/spells/Spell"

type SpellSelectionEntry = Pick<
  Spell,
  | "index"
  | "name"
  | "displayName"
  | "description"
  | "slotLevel"
  | "school"
  | "concentration"
  | "ritual"
> &
  Partial<Pick<Spell, "higherLevelText">>

type Props = {
  open: boolean
  title: string
  subtitle?: string
  spells: SpellSelectionEntry[]
  selectedIds?: readonly string[]
  loading?: boolean
  errorMessage?: string
  summary?: ReactNode
  emptyMessage?: string
  footerLabel?: string
  allowSelectedOnly?: boolean
  isDisabled?: (spell: SpellSelectionEntry) => boolean
  getSelectionLabel?: (spell: SpellSelectionEntry) => string | undefined
  onSelect: (spell: SpellSelectionEntry) => void | Promise<void>
  onClose: () => void
}

type LevelFilter = "all" | "cantrip" | `${number}`

/**
 * Shared spell-picker surface used by progression and character definition
 * flows. It owns only presentation/filtering; callers own the selection rules.
 */
export function SpellSelectionModal({
  open,
  title,
  subtitle,
  spells,
  selectedIds = [],
  loading = false,
  errorMessage = "",
  summary,
  emptyMessage = "Nenhuma magia corresponde aos filtros.",
  footerLabel = "Concluir seleção",
  allowSelectedOnly = true,
  isDisabled,
  getSelectionLabel,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [selectedOnly, setSelectedOnly] = useState(false)
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  const availableSchools = useMemo(
    () =>
      Array.from(new Set(spells.map((spell) => String(spell.school))))
        .map((school) => ({
          value: school,
          label: MAGIC_SCHOOLS_MAP[school] ?? school,
        }))
        .toSorted((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [spells],
  )

  const availableLevels = useMemo(
    () =>
      Array.from(new Set(spells.map((spell) => spell.slotLevel)))
        .filter((level) => level > 0)
        .toSorted((left, right) => left - right),
    [spells],
  )

  const visible = useMemo(() => {
    const normalizedQuery = normalize(query)

    return spells
      .filter((spell) => {
        const searchable = normalize(
          `${spell.displayName ?? ""} ${spell.name} ${spell.description ?? ""} ${MAGIC_SCHOOLS_MAP[String(spell.school)] ?? String(spell.school)}`,
        )
        const matchesLevel =
          levelFilter === "all" ||
          (levelFilter === "cantrip"
            ? spell.slotLevel === 0
            : spell.slotLevel === Number(levelFilter))
        const matchesSchool =
          schoolFilter === "all" || String(spell.school) === schoolFilter
        const matchesSelected = !selectedOnly || selected.has(spell.index)

        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          matchesLevel &&
          matchesSchool &&
          matchesSelected
        )
      })
      .toSorted(
        (left, right) =>
          left.slotLevel - right.slotLevel ||
          spellName(left).localeCompare(spellName(right), "pt-BR"),
      )
  }, [levelFilter, query, schoolFilter, selected, selectedOnly, spells])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[12500] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-textH">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-xs leading-5 text-textMuted">{subtitle}</p>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-b border-border pb-4">
          {summary ? <div>{summary}</div> : null}

          <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
            <Input
              value={query}
              placeholder="Buscar por nome ou descrição"
              onChange={(event) => setQuery(event.target.value)}
            />

            <select
              className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
            >
              <option value="all">Todos os círculos</option>
              {spells.some((spell) => spell.slotLevel === 0) ? (
                <option value="cantrip">Truques</option>
              ) : null}
              {availableLevels.map((level) => (
                <option key={level} value={level}>
                  {level}º círculo
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
              value={schoolFilter}
              onChange={(event) => setSchoolFilter(event.target.value)}
            >
              <option value="all">Todas as escolas</option>
              {availableSchools.map((school) => (
                <option key={school.value} value={school.value}>
                  {school.label}
                </option>
              ))}
            </select>

            {allowSelectedOnly ? (
              <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-text">
                <input
                  type="checkbox"
                  checked={selectedOnly}
                  onChange={(event) => setSelectedOnly(event.target.checked)}
                />
                Selecionadas
              </label>
            ) : (
              <div />
            )}
          </div>
        </div>

        <div className="mt-4 min-h-0 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted">
              Carregando magias...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
              {errorMessage}
            </div>
          ) : visible.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((spell) => {
                const selectionLabel = getSelectionLabel?.(spell)
                const disabled = isDisabled?.(spell) ?? false
                const isSelected = selected.has(spell.index)

                return (
                  <article
                    key={spell.index}
                    className={
                      isSelected
                        ? "rounded-xl border border-accentBorder bg-accentBg p-4"
                        : "rounded-xl border border-border bg-bg p-4"
                    }
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      className="w-full text-left disabled:opacity-45"
                      onClick={() => void onSelect(spell)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-textH">
                            {spellName(spell)}
                          </div>
                          <div className="mt-1 text-xs text-textMuted">
                            {formatSpellLevel(spell.slotLevel)} · {MAGIC_SCHOOLS_MAP[String(spell.school)] ?? String(spell.school)}
                            {spell.concentration ? " · Concentração" : ""}
                            {spell.ritual ? " · Ritual" : ""}
                          </div>
                        </div>
                        {selectionLabel ? (
                          <span className="shrink-0 text-xs font-semibold text-textH">
                            {selectionLabel}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-textMuted">
                      {spell.description?.trim() || "Sem descrição cadastrada."}
                    </p>
                    <details className="mt-3 border-t border-border pt-3 text-xs text-text">
                      <summary className="cursor-pointer font-medium text-textH">
                        Ver descrição completa
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">
                        {spell.description?.trim() || "Sem descrição cadastrada."}
                      </div>
                      {spell.higherLevelText?.trim() ? (
                        <div className="mt-3 whitespace-pre-wrap leading-5 text-textMuted">
                          <strong className="text-textH">Em círculos superiores: </strong>
                          {spell.higherLevelText.trim()}
                        </div>
                      ) : null}
                    </details>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted">
              {emptyMessage}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>
            {footerLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function spellName(spell: SpellSelectionEntry): string {
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

export type { SpellSelectionEntry }
