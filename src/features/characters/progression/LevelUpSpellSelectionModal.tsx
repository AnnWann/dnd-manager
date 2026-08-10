import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import {
  CLASS_NAMES,
  MAGIC_SCHOOLS_MAP,
} from "../../../contexts/consts"
import spellData from "../../../data/spells.v1.json"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import {
  getClassSpellSelectionRule,
  isSpellAllowedForClassSelection,
} from "../../../models/leveling/SpellSelectionRules"

export type LevelUpSpellSelection = {
  selected: string[]
  prepared: string[]
}

export type LevelUpSpellSelectionKind = "cantrip" | "leveled"
type LevelFilter = "all" | `${number}`

type Props = {
  open: boolean
  kind: LevelUpSpellSelectionKind
  character: CharacterTemplate
  className: ClassName
  previousLevel: number
  targetLevel: number
  subclassId?: string
  spells: Spell[]
  selection: LevelUpSpellSelection
  onChange: (selection: LevelUpSpellSelection) => void
  onClose: () => void
}

const LOCALIZED_SPELLS = new Map(
  (spellData.spells as unknown as Spell[]).map((spell) => [spell.index, spell]),
)

export function LevelUpSpellSelectionModal({
  open,
  kind,
  character,
  className,
  previousLevel,
  targetLevel,
  subclassId,
  spells,
  selection,
  onChange,
  onClose,
}: Props) {
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [selectedOnly, setSelectedOnly] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setLevelFilter("all")
    setSchoolFilter("all")
    setSelectedOnly(false)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [kind, open])

  const rule = getClassSpellSelectionRule(
    character,
    className,
    targetLevel,
    subclassId,
  )
  const previousRule = getClassSpellSelectionRule(
    character,
    className,
    Math.max(1, previousLevel),
    subclassId,
  )
  const canLearnSpells =
    rule.mode === "limited-known" || rule.mode === "spellbook"
  const previousMaximum =
    previousLevel <= 0
      ? 0
      : kind === "cantrip"
        ? previousRule.maxCantrips
        : previousRule.maxLeveledSpells
  const maximum =
    kind === "cantrip" ? rule.maxCantrips : rule.maxLeveledSpells
  const gained = Math.max(0, maximum - previousMaximum)

  const localizedSpells = useMemo(
    () => spells.map(localizeOfficialSpell),
    [spells],
  )
  const selectedSpells = useMemo(
    () => resolveSpells(selection.selected, localizedSpells),
    [selection.selected, localizedSpells],
  )
  const selectedCantrips = selectedSpells.filter(
    (spell) => spell.slotLevel === 0,
  ).length
  const selectedLeveled = selectedSpells.filter(
    (spell) => spell.slotLevel > 0,
  ).length
  const selectedCount = kind === "cantrip" ? selectedCantrips : selectedLeveled

  const classSpells = useMemo(
    () =>
      localizedSpells
        .filter((spell) =>
          isSpellAllowedForClassSelection(spell, rule, []),
        )
        .filter((spell) =>
          kind === "cantrip" ? spell.slotLevel === 0 : spell.slotLevel > 0,
        ),
    [kind, localizedSpells, rule],
  )
  const availableSchools = useMemo(
    () =>
      Array.from(new Set(classSpells.map((spell) => String(spell.school))))
        .map((school) => ({
          value: school,
          label: MAGIC_SCHOOLS_MAP[school] ?? school,
        }))
        .toSorted((left, right) =>
          left.label.localeCompare(right.label, "pt-BR"),
        ),
    [classSpells],
  )
  const normalizedQuery = normalize(query)
  const visible = useMemo(
    () =>
      classSpells
        .filter((spell) => {
          const matchesQuery =
            !normalizedQuery ||
            normalize(
              `${spell.displayName ?? ""} ${spell.name} ${spell.description} ${MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}`,
            ).includes(normalizedQuery)
          const matchesLevel =
            kind === "cantrip" ||
            levelFilter === "all" ||
            spell.slotLevel === Number(levelFilter)
          const matchesSchool =
            schoolFilter === "all" || String(spell.school) === schoolFilter
          const matchesSelected =
            !selectedOnly || selection.selected.includes(spell.index)

          return (
            matchesQuery &&
            matchesLevel &&
            matchesSchool &&
            matchesSelected
          )
        })
        .toSorted(
          (left, right) =>
            left.slotLevel - right.slotLevel ||
            spellName(left).localeCompare(spellName(right), "pt-BR"),
        ),
    [
      classSpells,
      kind,
      levelFilter,
      normalizedQuery,
      schoolFilter,
      selectedOnly,
      selection.selected,
    ],
  )

  if (!open || !canLearnSpells) return null

  function toggleSpell(spell: Spell) {
    const selected = selection.selected.includes(spell.index)
    if (selected) {
      onChange({
        selected: selection.selected.filter((entry) => entry !== spell.index),
        prepared: selection.prepared.filter((entry) => entry !== spell.index),
      })
      return
    }

    if (selectedCount >= maximum) return
    onChange({
      selected: [...selection.selected, spell.index],
      prepared: selection.prepared,
    })
  }

  const title =
    kind === "cantrip"
      ? `Aprender truques — ${CLASS_NAMES[className]}`
      : rule.mode === "spellbook"
        ? `Adicionar ao grimório — ${CLASS_NAMES[className]}`
        : `Aprender magias — ${CLASS_NAMES[className]}`
  const counterLabel =
    kind === "cantrip"
      ? "Truques conhecidos"
      : rule.mode === "spellbook"
        ? "Magias no grimório"
        : "Magias conhecidas"

  return createPortal(
    <div className="fixed inset-0 z-[12500] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Somente opções da lista de {CLASS_NAMES[className]} são exibidas.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-b border-border pb-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Counter
              label={counterLabel}
              current={selectedCount}
              maximum={maximum}
              gained={gained}
            />
            {kind === "leveled" ? (
              <div className="rounded-lg border border-border bg-bg p-3 text-xs">
                <div className="text-textMuted">Círculo máximo disponível</div>
                <strong className="mt-1 block text-sm text-textH">
                  {formatSpellLevel(rule.maxSpellLevel)}
                </strong>
              </div>
            ) : null}
          </div>

          <div
            className={
              kind === "leveled"
                ? "grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]"
                : "grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_auto]"
            }
          >
            <Input
              value={query}
              placeholder="Buscar por nome ou descrição"
              onChange={(event) => setQuery(event.target.value)}
            />

            {kind === "leveled" ? (
              <select
                className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                value={levelFilter}
                onChange={(event) =>
                  setLevelFilter(event.target.value as LevelFilter)
                }
              >
                <option value="all">Todos os círculos</option>
                {Array.from(
                  { length: Math.max(0, Number(rule.maxSpellLevel)) },
                  (_, index) => index + 1,
                ).map((level) => (
                  <option key={level} value={level}>
                    {level}º círculo
                  </option>
                ))}
              </select>
            ) : null}

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

            <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-text">
              <input
                type="checkbox"
                checked={selectedOnly}
                onChange={(event) => setSelectedOnly(event.target.checked)}
              />
              Selecionadas
            </label>
          </div>
        </div>

        <div className="mt-4 min-h-0 overflow-y-auto pr-1">
          {visible.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((spell) => {
                const selected = selection.selected.includes(spell.index)
                const atLimit = selectedCount >= maximum
                return (
                  <article
                    key={spell.index}
                    className={
                      selected
                        ? "rounded-xl border border-accentBorder bg-accentBg p-4"
                        : "rounded-xl border border-border bg-bg p-4"
                    }
                  >
                    <button
                      type="button"
                      disabled={!selected && atLimit}
                      className="w-full text-left disabled:opacity-45"
                      onClick={() => toggleSpell(spell)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-textH">
                            {spellName(spell)}
                          </div>
                          <div className="mt-1 text-xs text-textMuted">
                            {formatSpellLevel(spell.slotLevel)} ·{" "}
                            {MAGIC_SCHOOLS_MAP[spell.school] ?? String(spell.school)}
                            {spell.concentration ? " · Concentração" : ""}
                            {spell.ritual ? " · Ritual" : ""}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-textH">
                          {selected ? "Selecionada" : ""}
                        </span>
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
                          <strong className="text-textH">
                            Em círculos superiores:{" "}
                          </strong>
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
              Nenhuma opção da lista de {CLASS_NAMES[className]} corresponde aos filtros.
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>
            Concluir seleção
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function localizeOfficialSpell(spell: Spell): Spell {
  if (spell.homebrew) return spell
  const localized = LOCALIZED_SPELLS.get(spell.index)
  if (!localized) return spell

  return {
    ...spell,
    name: localized.name,
    displayName: localized.displayName ?? localized.name,
    description: localized.description,
    higherLevelText: localized.higherLevelText,
    school: localized.school,
    classes: localized.classes,
  }
}

function Counter({
  label,
  current,
  maximum,
  gained,
}: {
  label: string
  current: number
  maximum: number
  gained: number
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3 text-xs">
      <div className="text-textMuted">{label}</div>
      <strong className="mt-1 block text-sm text-textH">
        {current}/{maximum}
      </strong>
      <div className="mt-1 text-[10px] text-textMuted">
        {gained > 0
          ? `+${gained} neste nível`
          : "Sem aumento neste nível"}
      </div>
    </div>
  )
}

function resolveSpells(indexes: string[], spells: Spell[]): Spell[] {
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  return indexes
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
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
