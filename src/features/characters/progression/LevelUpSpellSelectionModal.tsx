import { useEffect, useMemo, useState } from "react"

import { queryOfficialSpellDetails } from "../../../api/spell-compendium"
import { CLASS_NAMES } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import {
  getClassSpellSelectionRule,
  isSpellAllowedForClassSelection,
} from "../../../models/leveling/SpellSelectionRules"
import {
  SpellSelectionModal,
  type SpellSelectionEntry,
} from "../magic/SpellSelectionModal"

export type LevelUpSpellSelection = {
  selected: string[]
  prepared: string[]
}

export type LevelUpSpellSelectionKind = "cantrip" | "leveled"

type Props = {
  open: boolean
  kind?: LevelUpSpellSelectionKind
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
  kind = "leveled",
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
  const { ensureOfficialSpells } = useMagicContext()
  const [officialSpells, setOfficialSpells] = useState<Spell[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")

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
  const canUseModal =
    kind === "cantrip"
      ? rule.mode !== "none" && rule.maxCantrips > 0
      : rule.mode === "limited-known" || rule.mode === "spellbook"

  useEffect(() => {
    if (!open || !canUseModal) return

    let cancelled = false
    setLoading(true)
    setLoadError("")

    void Promise.all([
      queryOfficialSpellDetails({
        className,
        maxLevel: Number(rule.maxSpellLevel),
        page: 1,
        pageSize: 250,
      }),
      ensureOfficialSpells(selection.selected),
    ])
      .then(([page]) => {
        if (!cancelled) setOfficialSpells(page.spells)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Não foi possível carregar as magias desta classe.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    canUseModal,
    className,
    ensureOfficialSpells,
    open,
    rule.maxSpellLevel,
    selection.selected,
  ])

  const availableSpells = useMemo(() => {
    const homebrew = spells.filter(
      (spell) => spell.homebrew && spell.classes.includes(className),
    )
    const byIndex = new Map<string, Spell>()
    for (const spell of officialSpells) byIndex.set(spell.index, spell)
    for (const spell of homebrew) byIndex.set(spell.index, spell)

    return Array.from(byIndex.values()).filter(
      (spell) =>
        isSpellAllowedForClassSelection(spell, rule, []) &&
        (kind === "cantrip" ? spell.slotLevel === 0 : spell.slotLevel > 0),
    )
  }, [className, kind, officialSpells, rule, spells])

  const byIndex = useMemo(
    () =>
      new Map(
        [...spells, ...officialSpells].map((spell) => [spell.index, spell]),
      ),
    [officialSpells, spells],
  )

  const originalIndexes = useMemo(
    () =>
      (character.get("magic")?.spells.knownSpells ?? [])
        .filter((entry) => {
          if (entry.source.type !== "class") return false
          if (
            resolveSourceClass(entry.source.sourceId, entry.source.name) !==
            className
          ) {
            return false
          }
          const spell = byIndex.get(entry.spells.id)
          return kind === "cantrip"
            ? spell?.slotLevel === 0
            : Boolean(spell && spell.slotLevel > 0)
        })
        .map((entry) => entry.spells.id),
    [byIndex, character, className, kind],
  )

  const previousMaximum =
    previousLevel <= 0
      ? 0
      : kind === "cantrip"
        ? previousRule.maxCantrips
        : previousRule.maxLeveledSpells
  const maximum =
    kind === "cantrip" ? rule.maxCantrips : rule.maxLeveledSpells
  const gained = Math.max(0, maximum - previousMaximum)
  const replacementLimit =
    kind === "cantrip" ? rule.swap.cantrips : rule.swap.leveledKnown
  const originalSet = useMemo(() => new Set(originalIndexes), [originalIndexes])
  const replacementsUsed = originalIndexes.filter(
    (index) => !selection.selected.includes(index),
  ).length
  const selectedSpells = selection.selected
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
  const selectedCount = selectedSpells.filter((spell) =>
    kind === "cantrip" ? spell.slotLevel === 0 : spell.slotLevel > 0,
  ).length

  if (!canUseModal) return null

  async function toggleSpell(entry: SpellSelectionEntry) {
    const spell = byIndex.get(entry.index)
    if (!spell) return

    const selected = selection.selected.includes(spell.index)
    if (selected) {
      if (
        originalSet.has(spell.index) &&
        (replacementLimit <= 0 || replacementsUsed >= replacementLimit)
      ) {
        return
      }
      onChange({
        selected: selection.selected.filter((current) => current !== spell.index),
        prepared: selection.prepared.filter((current) => current !== spell.index),
      })
      return
    }

    if (selectedCount >= maximum) return
    if (!spell.homebrew) await ensureOfficialSpells([spell.index])
    onChange({
      selected: [...selection.selected, spell.index],
      prepared: selection.prepared,
    })
  }

  const title = getTitle(
    kind,
    rule.mode,
    className,
    gained,
    replacementLimit,
  )
  const counterLabel =
    kind === "cantrip"
      ? "Truques conhecidos"
      : rule.mode === "spellbook"
        ? "Magias no grimório"
        : "Magias conhecidas"

  return (
    <SpellSelectionModal
      open={open}
      title={title}
      subtitle={`Somente opções da lista de ${CLASS_NAMES[className]} são exibidas.`}
      spells={availableSpells}
      selectedIds={selection.selected}
      loading={loading}
      errorMessage={loadError}
      emptyMessage={`Nenhuma opção da lista de ${CLASS_NAMES[className]} corresponde aos filtros.`}
      summary={
        <div className="grid gap-2 sm:grid-cols-2">
          <Counter
            label={counterLabel}
            current={selectedCount}
            maximum={maximum}
            gained={gained}
            replacementsUsed={replacementsUsed}
            replacementLimit={replacementLimit}
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
      }
      isDisabled={(entry) => {
        const selected = selection.selected.includes(entry.index)
        const cannotRemoveOriginal =
          selected &&
          originalSet.has(entry.index) &&
          (replacementLimit <= 0 || replacementsUsed >= replacementLimit)
        return cannotRemoveOriginal || (!selected && selectedCount >= maximum)
      }}
      getSelectionLabel={(entry) =>
        selection.selected.includes(entry.index)
          ? originalSet.has(entry.index)
            ? "Conhecida"
            : "Nova"
          : undefined
      }
      onSelect={toggleSpell}
      onClose={onClose}
    />
  )
}

function Counter({
  label,
  current,
  maximum,
  gained,
  replacementsUsed,
  replacementLimit,
}: {
  label: string
  current: number
  maximum: number
  gained: number
  replacementsUsed: number
  replacementLimit: number
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3 text-xs">
      <div className="text-textMuted">{label}</div>
      <strong className="mt-1 block text-sm text-textH">
        {current}/{maximum}
      </strong>
      <div className="mt-1 text-[10px] text-textMuted">
        {gained > 0 ? `+${gained} neste nível` : "Sem aumento neste nível"}
        {replacementLimit > 0
          ? ` · ${replacementsUsed}/${replacementLimit} substituição`
          : ""}
      </div>
    </div>
  )
}

function getTitle(
  kind: LevelUpSpellSelectionKind,
  mode: ReturnType<typeof getClassSpellSelectionRule>["mode"],
  className: ClassName,
  gained: number,
  replacementLimit: number,
): string {
  const classLabel = CLASS_NAMES[className]
  if (kind === "cantrip") {
    if (gained > 0 && replacementLimit > 0) {
      return `Aprender / substituir truques — ${classLabel}`
    }
    if (replacementLimit > 0) return `Substituir truque — ${classLabel}`
    return `Aprender truques — ${classLabel}`
  }
  if (mode === "spellbook") return `Adicionar ao grimório — ${classLabel}`
  if (gained > 0 && replacementLimit > 0) {
    return `Aprender / substituir magias — ${classLabel}`
  }
  if (replacementLimit > 0) return `Substituir magia — ${classLabel}`
  return `Aprender magias — ${classLabel}`
}

function resolveSourceClass(
  sourceId: string | undefined,
  sourceName: string,
): ClassName {
  return String(sourceId ?? sourceName).split(":")[0] as ClassName
}

function formatSpellLevel(level: number): string {
  return level === 0 ? "Truque" : `${level}º círculo`
}
