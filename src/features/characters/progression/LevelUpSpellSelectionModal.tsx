import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
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

type Props = {
  open: boolean
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

export function LevelUpSpellSelectionModal({
  open,
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

  useEffect(() => {
    if (!open) return
    setQuery("")
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

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
  const previousCantrips = previousLevel > 0 ? previousRule.maxCantrips : 0
  const previousLeveled = previousLevel > 0 ? previousRule.maxLeveledSpells : 0

  const selectedSpells = useMemo(
    () => resolveSpells(selection.selected, spells),
    [selection.selected, spells],
  )
  const selectedCantrips = selectedSpells.filter(
    (spell) => spell.slotLevel === 0,
  ).length
  const selectedLeveled = selectedSpells.filter(
    (spell) => spell.slotLevel > 0,
  ).length
  const normalizedQuery = normalize(query)
  const visible = useMemo(
    () =>
      spells
        .filter((spell) =>
          isSpellAllowedForClassSelection(spell, rule, []),
        )
        .filter(
          (spell) =>
            !normalizedQuery ||
            normalize(
              `${spell.displayName ?? ""} ${spell.name} ${spell.school}`,
            ).includes(normalizedQuery),
        )
        .toSorted(
          (left, right) =>
            left.slotLevel - right.slotLevel ||
            spellName(left).localeCompare(spellName(right), "pt-BR"),
        ),
    [normalizedQuery, rule, spells],
  )

  if (!open || rule.mode === "none") return null

  function toggleSpell(spell: Spell) {
    const selected = selection.selected.includes(spell.index)
    if (selected) {
      onChange({
        selected: selection.selected.filter((entry) => entry !== spell.index),
        prepared: selection.prepared.filter((entry) => entry !== spell.index),
      })
      return
    }

    if (spell.slotLevel === 0) {
      if (selectedCantrips >= rule.maxCantrips) return
    } else if (selectedLeveled >= rule.maxLeveledSpells) {
      return
    }

    onChange({
      selected: [...selection.selected, spell.index],
      prepared:
        rule.mode === "prepared" && spell.slotLevel > 0
          ? [...selection.prepared, spell.index]
          : selection.prepared,
    })
  }

  function togglePrepared(spellIndex: string) {
    if (!selection.selected.includes(spellIndex)) return
    onChange({
      ...selection,
      prepared: selection.prepared.includes(spellIndex)
        ? selection.prepared.filter((entry) => entry !== spellIndex)
        : [...selection.prepared, spellIndex],
    })
  }

  const leveledLabel =
    rule.mode === "spellbook"
      ? "Magias no grimório"
      : rule.mode === "prepared"
        ? "Magias preparadas"
        : "Magias conhecidas"

  return createPortal(
    <div className="fixed inset-0 z-[12500] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escolher magias"
        className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">
              Escolher magias
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              O aplicativo aplica os limites numéricos da progressão. Consulte sua referência para verificar quais magias pertencem à classe.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-b border-border pb-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Counter
              label="Truques"
              current={selectedCantrips}
              maximum={rule.maxCantrips}
              gained={Math.max(0, rule.maxCantrips - previousCantrips)}
            />
            <Counter
              label={leveledLabel}
              current={selectedLeveled}
              maximum={rule.maxLeveledSpells}
              gained={Math.max(0, rule.maxLeveledSpells - previousLeveled)}
            />
            <div className="rounded-lg border border-border bg-bg p-3 text-xs">
              <div className="text-textMuted">Nível máximo de magia</div>
              <strong className="mt-1 block text-sm text-textH">
                {rule.maxSpellLevel}
              </strong>
            </div>
          </div>
          <Input
            value={query}
            placeholder="Buscar magia no compêndio"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="mt-4 grid min-h-0 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {visible.map((spell) => {
            const selected = selection.selected.includes(spell.index)
            const prepared = selection.prepared.includes(spell.index)
            const atLimit =
              spell.slotLevel === 0
                ? selectedCantrips >= rule.maxCantrips
                : selectedLeveled >= rule.maxLeveledSpells
            return (
              <article
                key={spell.index}
                className={
                  selected
                    ? "rounded-lg border border-accentBorder bg-accentBg p-3"
                    : "rounded-lg border border-border bg-bg p-3"
                }
              >
                <button
                  type="button"
                  disabled={!selected && atLimit}
                  className="w-full text-left disabled:opacity-45"
                  onClick={() => toggleSpell(spell)}
                >
                  <div className="font-medium text-textH">
                    {spellName(spell)}
                  </div>
                  <div className="mt-1 text-xs text-textMuted">
                    {spell.slotLevel === 0
                      ? "Truque"
                      : `Nível ${spell.slotLevel}`} · {String(spell.school)}
                  </div>
                </button>

                {selected && rule.mode === "spellbook" && spell.slotLevel > 0 ? (
                  <label className="mt-3 flex items-center gap-2 text-xs text-text">
                    <input
                      type="checkbox"
                      checked={prepared}
                      onChange={() => togglePrepared(spell.index)}
                    />
                    Preparar esta magia
                  </label>
                ) : null}
              </article>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
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
        {gained > 0 ? `+${gained} de capacidade neste nível` : "Sem aumento neste nível"}
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
}
