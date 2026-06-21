import { useState } from "react"

import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { CLASS_NAMES } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type {
  CharacterClassInterface,
  ClassName,
} from "../../../models/sheet/Class"
import { SpellCard } from "./spellCard"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type PreparedFilter = "all" | "prepared" | "not-prepared"
type ClassFilter = "all" | ClassName

type SpellLimitInfo = {
  className: ClassName
  label: string
  reachedLimit?: boolean
}

type DisplaySpellEntry = {
  key: string
  spell: Spell
  source: SpellSource
  prepared: boolean
  alwaysPrepared: boolean
  removable: boolean
  accessLabel?: string
}

export function KnownSpellsList({ character, updateCharacter }: Props) {
  const { getSpellByIndex } = useMagicContext()
  const [preparedFilter, setPreparedFilter] =
    useState<PreparedFilter>("all")
  const [classFilter, setClassFilter] = useState<ClassFilter>("all")
  const classes = character.get("sheet").classes ?? []

  const regularSpells: DisplaySpellEntry[] = []

  for (const entry of character.get("magic")?.spells.knownSpells ?? []) {
    const spell = getSpellByIndex(entry.spells.id)
    if (!spell) continue

    const alwaysPrepared = isAlwaysAvailableSpell(
      spell,
      entry.source,
      classes,
    )

    regularSpells.push({
      key: `known:${entry.source.type}:${entry.source.sourceId}:${spell.index}`,
      spell,
      source: entry.source,
      prepared: alwaysPrepared || entry.spells.prepared,
      alwaysPrepared,
      removable: true,
    })
  }

  const grantedSpells: DisplaySpellEntry[] = []

  for (const entry of getCharacterGrantedSpells(character)) {
    const spell = getSpellByIndex(entry.index)
    if (!spell) continue

    const remaining = entry.usage
      ? Math.max(0, entry.usage.max - entry.usage.used)
      : undefined

    grantedSpells.push({
      key: entry.key,
      spell,
      source: entry.source,
      prepared: true,
      alwaysPrepared: true,
      removable: false,
      accessLabel:
        entry.castingMode === "known"
          ? "Usa espaços normais"
          : entry.usage
            ? `Pela origem: ${remaining}/${entry.usage.max} usos`
            : "Apenas pela origem",
    })
  }

  const spells: DisplaySpellEntry[] = [
    ...regularSpells,
    ...grantedSpells,
  ]
  const spellLimits = getSpellClassLimits(character, regularSpells)

  const filteredSpells = spells.filter(({ prepared, source }) => {
    const matchesPrepared =
      preparedFilter === "all" ||
      (preparedFilter === "prepared" && prepared) ||
      (preparedFilter === "not-prepared" && !prepared)

    const matchesClass =
      classFilter === "all" ||
      (source.type === "class" && source.name === classFilter)

    return matchesPrepared && matchesClass
  })

  function canPrepareSpell(entry: DisplaySpellEntry): boolean {
    if (entry.alwaysPrepared || entry.prepared) return true
    if (entry.source.type !== "class") return true

    const classData = classes.find(
      (classEntry) => classEntry.className === entry.source.name,
    )
    if (!classData?.knownSpells?.canPrepare) return true

    const limit = getPreparedSpellLimit(character, classData)
    if (limit === undefined) return true

    const preparedCount = regularSpells.filter(
      (knownSpell) =>
        knownSpell.spell.slotLevel > 0 &&
        !knownSpell.alwaysPrepared &&
        knownSpell.prepared &&
        knownSpell.source.type === "class" &&
        knownSpell.source.name === entry.source.name,
    ).length

    return preparedCount < limit
  }

  function togglePrepared(entry: DisplaySpellEntry) {
    if (entry.alwaysPrepared) return
    if (!entry.prepared && !canPrepareSpell(entry)) return

    updateCharacter(character.get("id"), (current) =>
      current.setSpellPrepared(entry.spell.index, !entry.prepared),
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Magias disponíveis
        </div>
        <div className="mt-1 text-xs text-text">
          Magias conhecidas e magias concedidas por habilidades, raça e equipamentos.
        </div>

        {spellLimits.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {spellLimits.map((entry) => (
              <span
                key={entry.className}
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  entry.reachedLimit
                    ? "border-accentBorder text-accent"
                    : "border-border text-text",
                ].join(" ")}
              >
                {entry.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            className="h-10 min-w-0 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
            value={preparedFilter}
            onChange={(event) =>
              setPreparedFilter(event.target.value as PreparedFilter)
            }
          >
            <option value="all">Todas as magias</option>
            <option value="prepared">Apenas disponíveis</option>
            <option value="not-prepared">Apenas não preparadas</option>
          </select>

          <select
            className="h-10 min-w-0 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
            value={classFilter}
            onChange={(event) =>
              setClassFilter(event.target.value as ClassFilter)
            }
          >
            <option value="all">Todas as origens</option>
            {classes.map((classData) => (
              <option key={classData.className} value={classData.className}>
                Classe: {CLASS_NAMES[classData.className]}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredSpells.length === 0 ? (
          <p className="text-xs text-text">Nenhuma magia encontrada.</p>
        ) : (
          <div className="grid gap-3">
            {filteredSpells
              .toSorted((left, right) => {
                const levelDifference =
                  left.spell.slotLevel - right.spell.slotLevel
                if (levelDifference !== 0) return levelDifference

                return (left.spell.displayName || left.spell.name).localeCompare(
                  right.spell.displayName || right.spell.name,
                  "pt-BR",
                )
              })
              .map((entry) => (
                <SpellCard
                  key={entry.key}
                  spell={entry.spell}
                  prepared={entry.prepared}
                  source={entry.source}
                  alwaysPrepared={entry.alwaysPrepared}
                  accessLabel={entry.accessLabel}
                  onTogglePrepared={
                    entry.alwaysPrepared
                      ? undefined
                      : () => togglePrepared(entry)
                  }
                  onRemove={
                    entry.removable
                      ? () =>
                          updateCharacter(character.get("id"), (current) =>
                            current.removeSpell(entry.spell.index),
                          )
                      : undefined
                  }
                />
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function isAlwaysAvailableSpell(
  spell: Spell,
  source: SpellSource,
  classes: CharacterClassInterface[],
): boolean {
  if (spell.slotLevel === 0) return true
  if (source.type !== "class") return true

  const classData = classes.find(
    (entry) => entry.className === source.name,
  )

  if (!classData?.knownSpells) return true
  return classData.knownSpells.mode === "limited"
}

function getSpellClassLimits(
  character: CharacterTemplate,
  spells: DisplaySpellEntry[],
): SpellLimitInfo[] {
  if (character.get("sheet").type !== "pc") return []

  return (character.get("sheet").classes ?? [])
    .map((classData): SpellLimitInfo | null => {
      const knownLimit = getClassKnownSpellLimit(classData)
      const known = spells.filter(
        (entry) =>
          entry.spell.slotLevel > 0 &&
          entry.source.type === "class" &&
          entry.source.name === classData.className,
      ).length
      const preparedLimit = getPreparedSpellLimit(character, classData)
      const prepared = spells.filter(
        (entry) =>
          entry.spell.slotLevel > 0 &&
          !entry.alwaysPrepared &&
          entry.prepared &&
          entry.source.type === "class" &&
          entry.source.name === classData.className,
      ).length
      const parts: string[] = []

      if (knownLimit !== undefined) {
        if (isSpellbookCaster(classData)) {
          parts.push(`${known}/${knownLimit}+ no grimório`)
        } else if (isLimitedKnownCaster(classData)) {
          parts.push(`${known}/${knownLimit} conhecidas`)
        } else {
          parts.push(`${known} conhecidas`)
        }
      }

      if (preparedLimit !== undefined) {
        parts.push(`${prepared}/${preparedLimit} preparadas`)
      }
      if (parts.length === 0) return null

      return {
        className: classData.className,
        label: `${CLASS_NAMES[classData.className]}: ${parts.join(" • ")}`,
        reachedLimit:
          preparedLimit !== undefined && prepared >= preparedLimit,
      }
    })
    .filter((entry): entry is SpellLimitInfo => entry !== null)
}

function getClassKnownSpellLimit(
  classData: CharacterClassInterface,
): number | undefined {
  const knownSpells = classData.knownSpells
  if (!knownSpells) return undefined
  const override = knownSpells.overrides?.[classData.level]
  if (override !== undefined) return override
  return (
    knownSpells.baseAtLevel1 +
    Math.max(0, classData.level - 1) * knownSpells.perLevel
  )
}

function isLimitedKnownCaster(classData: CharacterClassInterface): boolean {
  return classData.knownSpells?.mode === "limited"
}

function isSpellbookCaster(classData: CharacterClassInterface): boolean {
  return classData.knownSpells?.mode === "spellbook"
}

function getPreparedSpellLimit(
  character: CharacterTemplate,
  classData: CharacterClassInterface,
): number | undefined {
  if (!classData.knownSpells) return undefined
  const mode = classData.knownSpells.mode
  if (mode !== "prepared-only" && mode !== "spellbook") return undefined
  const modifier = getCastingAttributeModifier(character, classData)

  switch (classData.className) {
    case "artificer":
      return Math.max(1, Math.floor(classData.level / 2) + modifier)
    case "cleric":
    case "druid":
    case "wizard":
      return Math.max(1, classData.level + modifier)
    case "paladin":
      return Math.max(1, Math.floor(classData.level / 2) + modifier)
    default:
      return undefined
  }
}

function getCastingAttributeModifier(
  character: CharacterTemplate,
  classData: CharacterClassInterface,
): number {
  if (!classData.castingAttribute) return 0
  return character.getEffectiveAttributeModifier(classData.castingAttribute)
}
