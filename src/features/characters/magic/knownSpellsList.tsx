import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { CLASS_NAMES } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import {
  addSpellCastingDescription,
  getSpellCastingDescriptions,
  removeSpellCastingDescription,
  updateSpellCastingDescription,
} from "../../../models/characters/characterMagic"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type {
  CharacterClassInterface,
  ClassName,
} from "../../../models/sheet/Class"
import { CompactSpellCard } from "./compactSpellCard"
import { SpellCard } from "./spellCard"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type PreparedFilter = "all" | "prepared" | "not-prepared"
type SourceTypeFilter = "all" | SpellSource["type"]
type SpecificSourceFilter = "all" | string
type ListViewMode = "detailed" | "compact"

type SpellListPreferences = {
  searchQuery: string
  preparedFilter: PreparedFilter
  sourceTypeFilter: SourceTypeFilter
  specificSourceFilter: SpecificSourceFilter
  viewMode: ListViewMode
}

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
  availableAsRitual: boolean
  removable: boolean
  accessLabel?: string
}

type SourceOption = {
  key: string
  label: string
  type: SpellSource["type"]
  count: number
}

const SOURCE_TYPE_ORDER: SpellSource["type"][] = [
  "class",
  "ability",
  "feat",
  "race",
  "equipment",
]

const DEFAULT_SPELL_LIST_PREFERENCES: SpellListPreferences = {
  searchQuery: "",
  preparedFilter: "all",
  sourceTypeFilter: "all",
  specificSourceFilter: "all",
  viewMode: "detailed",
}

export function KnownSpellsList({ character, updateCharacter }: Props) {
  const { getSpellByIndex } = useMagicContext()
  const characterId = character.get("id")
  const [preferences, setPreferences] = useState<SpellListPreferences>(() =>
    loadSpellListPreferences(characterId),
  )
  const {
    searchQuery,
    preparedFilter,
    sourceTypeFilter,
    specificSourceFilter,
    viewMode,
  } = preferences
  const classes = character.get("sheet").classes ?? []

  useEffect(() => {
    saveSpellListPreferences(characterId, preferences)
  }, [characterId, preferences])

  const regularSpells: DisplaySpellEntry[] = []

  for (const entry of character.get("magic")?.spells.knownSpells ?? []) {
    const spell = getSpellByIndex(entry.spells.id)
    if (!spell) continue

    const alwaysPrepared = isAlwaysAvailableSpell(
      spell,
      entry.source,
      classes,
    )
    const prepared = alwaysPrepared || entry.spells.prepared
    const availableAsRitual = spell.ritual

    regularSpells.push({
      key: `known:${entry.source.type}:${entry.source.sourceId}:${spell.index}`,
      spell,
      source: entry.source,
      prepared,
      alwaysPrepared,
      availableAsRitual,
      removable: true,
      accessLabel: availableAsRitual
        ? prepared
          ? "Ritual"
          : "Disponível como ritual"
        : undefined,
    })
  }

  const grantedSpells: DisplaySpellEntry[] = []

  for (const entry of getCharacterGrantedSpells(character)) {
    const spell = getSpellByIndex(entry.index)
    if (!spell) continue

    const remaining = entry.usage
      ? Math.max(0, entry.usage.max - entry.usage.used)
      : undefined
    const originAccessLabel =
      entry.castingMode === "known"
        ? "Usa espaços normais"
        : entry.usage
          ? `Pela origem: ${remaining}/${entry.usage.max} usos`
          : "Apenas pela origem"

    grantedSpells.push({
      key: entry.key,
      spell,
      source: entry.source,
      prepared: true,
      alwaysPrepared: true,
      availableAsRitual: spell.ritual,
      removable: false,
      accessLabel: spell.ritual
        ? `${originAccessLabel} • Ritual`
        : originAccessLabel,
    })
  }

  const spells: DisplaySpellEntry[] = [
    ...regularSpells,
    ...grantedSpells,
  ]
  const spellLimits = getSpellClassLimits(character, regularSpells)
  const sourceTypeOptions = getAvailableSourceTypes(spells)
  const effectiveSourceTypeFilter =
    sourceTypeFilter === "all" || sourceTypeOptions.includes(sourceTypeFilter)
      ? sourceTypeFilter
      : "all"
  const specificSourceOptions = getSpecificSourceOptions(
    spells,
    effectiveSourceTypeFilter,
  )
  const effectiveSpecificSourceFilter =
    specificSourceFilter === "all" ||
    specificSourceOptions.some((option) => option.key === specificSourceFilter)
      ? specificSourceFilter
      : "all"
  const normalizedSearchQuery = normalizeSearchText(searchQuery)

  const filteredSpells = spells.filter((entry) => {
    const { spell, source } = entry
    const matchesName =
      !normalizedSearchQuery ||
      normalizeSearchText(spell.displayName || spell.name).includes(
        normalizedSearchQuery,
      ) ||
      normalizeSearchText(spell.name).includes(normalizedSearchQuery)

    const available = isSpellAvailable(entry)
    const matchesPrepared =
      preparedFilter === "all" ||
      (preparedFilter === "prepared" && available) ||
      (preparedFilter === "not-prepared" && !available)

    const matchesSourceType =
      effectiveSourceTypeFilter === "all" ||
      source.type === effectiveSourceTypeFilter

    const matchesSpecificSource =
      effectiveSpecificSourceFilter === "all" ||
      getSourceKey(source) === effectiveSpecificSourceFilter

    return (
      matchesName &&
      matchesPrepared &&
      matchesSourceType &&
      matchesSpecificSource
    )
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

    updateCharacter(characterId, (current) =>
      current.setSpellPrepared(entry.spell.index, !entry.prepared),
    )
  }

  function addCastingDescription(spellIndex: string) {
    updateCharacter(characterId, (current) =>
      addSpellCastingDescription(current, spellIndex),
    )
  }

  function changeCastingDescription(
    spellIndex: string,
    descriptionIndex: number,
    description: string,
  ) {
    updateCharacter(characterId, (current) =>
      updateSpellCastingDescription(
        current,
        spellIndex,
        descriptionIndex,
        description,
      ),
    )
  }

  function removeCastingDescription(
    spellIndex: string,
    descriptionIndex: number,
  ) {
    updateCharacter(characterId, (current) =>
      removeSpellCastingDescription(current, spellIndex, descriptionIndex),
    )
  }

  const sortedSpells = filteredSpells.toSorted((left, right) => {
    const levelDifference = left.spell.slotLevel - right.spell.slotLevel
    if (levelDifference !== 0) return levelDifference

    return (left.spell.displayName || left.spell.name).localeCompare(
      right.spell.displayName || right.spell.name,
      "pt-BR",
    )
  })

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Magias disponíveis
        </div>
        <div className="mt-1 text-xs text-text">
          Magias aprendidas por classes e concedidas por habilidades, talentos,
          raça e equipamentos equipados. Magias de ritual também contam como
          disponíveis e são identificadas separadamente.
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

        <label className="mt-3 grid gap-1 text-[11px] text-textMuted">
          Buscar magia
          <Input
            value={searchQuery}
            placeholder="Digite o nome da magia"
            aria-label="Buscar magia pelo nome"
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                searchQuery: event.target.value,
              }))
            }
          />
        </label>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <label className="grid gap-1 text-[11px] text-textMuted">
            Visualização
            <select
              className="h-10 min-w-0 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
              value={viewMode}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  viewMode: event.target.value as ListViewMode,
                }))
              }
            >
              <option value="detailed">Completa</option>
              <option value="compact">Simplificada</option>
            </select>
          </label>

          <label className="grid gap-1 text-[11px] text-textMuted">
            Disponibilidade
            <select
              className="h-10 min-w-0 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
              value={preparedFilter}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  preparedFilter: event.target.value as PreparedFilter,
                }))
              }
            >
              <option value="all">Todas as magias</option>
              <option value="prepared">Apenas disponíveis</option>
              <option value="not-prepared">Apenas indisponíveis</option>
            </select>
          </label>

          <label className="grid gap-1 text-[11px] text-textMuted">
            Forma de aquisição
            <select
              className="h-10 min-w-0 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
              value={effectiveSourceTypeFilter}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  sourceTypeFilter: event.target.value as SourceTypeFilter,
                  specificSourceFilter: "all",
                }))
              }
            >
              <option value="all">Todas as formas</option>
              {sourceTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {getSourceTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] text-textMuted">
            Origem específica
            <select
              className="h-10 min-w-0 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent disabled:opacity-60"
              value={effectiveSpecificSourceFilter}
              disabled={specificSourceOptions.length === 0}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  specificSourceFilter: event.target.value,
                }))
              }
            >
              <option value="all">Todas as origens específicas</option>
              {specificSourceOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        {spells.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sourceTypeOptions.map((type) => {
              const count = spells.filter(
                (entry) => entry.source.type === type,
              ).length

              return (
                <span
                  key={type}
                  className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-[10px] text-textMuted"
                >
                  {getSourceTypeLabel(type)}: {count}
                </span>
              )
            })}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {sortedSpells.length === 0 ? (
          <p className="text-xs text-text">Nenhuma magia encontrada.</p>
        ) : (
          <div className={viewMode === "compact" ? "grid gap-2" : "grid gap-3"}>
            {sortedSpells.map((entry) => {
              const castingDescriptions = getSpellCastingDescriptions(
                character,
                entry.spell.index,
              )

              if (viewMode === "compact") {
                return (
                  <CompactSpellCard
                    key={entry.key}
                    spell={entry.spell}
                    source={entry.source}
                    prepared={entry.prepared}
                    alwaysPrepared={entry.alwaysPrepared}
                    accessLabel={entry.accessLabel}
                    castingDescriptions={castingDescriptions}
                  />
                )
              }

              return (
                <SpellCard
                  key={entry.key}
                  spell={entry.spell}
                  prepared={entry.prepared}
                  source={entry.source}
                  alwaysPrepared={entry.alwaysPrepared}
                  accessLabel={entry.accessLabel}
                  castingDescriptions={castingDescriptions}
                  onAddCastingDescription={() =>
                    addCastingDescription(entry.spell.index)
                  }
                  onChangeCastingDescription={(index, description) =>
                    changeCastingDescription(
                      entry.spell.index,
                      index,
                      description,
                    )
                  }
                  onRemoveCastingDescription={(index) =>
                    removeCastingDescription(entry.spell.index, index)
                  }
                  onTogglePrepared={
                    entry.alwaysPrepared
                      ? undefined
                      : () => togglePrepared(entry)
                  }
                  onRemove={
                    entry.removable
                      ? () =>
                          updateCharacter(characterId, (current) =>
                            current.removeSpell(entry.spell.index),
                          )
                      : undefined
                  }
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function isSpellAvailable(entry: DisplaySpellEntry): boolean {
  return entry.prepared || entry.alwaysPrepared || entry.availableAsRitual
}

function loadSpellListPreferences(characterId: string): SpellListPreferences {
  if (typeof window === "undefined") return DEFAULT_SPELL_LIST_PREFERENCES

  try {
    const raw = window.localStorage.getItem(getSpellListStorageKey(characterId))
    if (!raw) return DEFAULT_SPELL_LIST_PREFERENCES

    const parsed = JSON.parse(raw) as Record<string, unknown>

    return {
      searchQuery:
        typeof parsed.searchQuery === "string"
          ? parsed.searchQuery
          : DEFAULT_SPELL_LIST_PREFERENCES.searchQuery,
      preparedFilter: isPreparedFilter(parsed.preparedFilter)
        ? parsed.preparedFilter
        : DEFAULT_SPELL_LIST_PREFERENCES.preparedFilter,
      sourceTypeFilter: isSourceTypeFilter(parsed.sourceTypeFilter)
        ? parsed.sourceTypeFilter
        : DEFAULT_SPELL_LIST_PREFERENCES.sourceTypeFilter,
      specificSourceFilter:
        typeof parsed.specificSourceFilter === "string"
          ? parsed.specificSourceFilter
          : DEFAULT_SPELL_LIST_PREFERENCES.specificSourceFilter,
      viewMode: isListViewMode(parsed.viewMode)
        ? parsed.viewMode
        : DEFAULT_SPELL_LIST_PREFERENCES.viewMode,
    }
  } catch {
    return DEFAULT_SPELL_LIST_PREFERENCES
  }
}

function saveSpellListPreferences(
  characterId: string,
  preferences: SpellListPreferences,
) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      getSpellListStorageKey(characterId),
      JSON.stringify(preferences),
    )
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function getSpellListStorageKey(characterId: string): string {
  return `dnd-manager:character-spell-list:${characterId}`
}

function isPreparedFilter(value: unknown): value is PreparedFilter {
  return value === "all" || value === "prepared" || value === "not-prepared"
}

function isSourceTypeFilter(value: unknown): value is SourceTypeFilter {
  return (
    value === "all" ||
    SOURCE_TYPE_ORDER.includes(value as SpellSource["type"])
  )
}

function isListViewMode(value: unknown): value is ListViewMode {
  return value === "detailed" || value === "compact"
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function getAvailableSourceTypes(
  spells: DisplaySpellEntry[],
): SpellSource["type"][] {
  const present = new Set(spells.map((entry) => entry.source.type))
  return SOURCE_TYPE_ORDER.filter((type) => present.has(type))
}

function getSpecificSourceOptions(
  spells: DisplaySpellEntry[],
  typeFilter: SourceTypeFilter,
): SourceOption[] {
  const options = new Map<string, SourceOption>()

  for (const entry of spells) {
    if (typeFilter !== "all" && entry.source.type !== typeFilter) continue

    const key = getSourceKey(entry.source)
    const existing = options.get(key)

    if (existing) {
      existing.count += 1
      continue
    }

    options.set(key, {
      key,
      label: getSpecificSourceLabel(entry.source),
      type: entry.source.type,
      count: 1,
    })
  }

  return Array.from(options.values()).toSorted((left, right) => {
    const typeDifference =
      SOURCE_TYPE_ORDER.indexOf(left.type) -
      SOURCE_TYPE_ORDER.indexOf(right.type)
    if (typeDifference !== 0) return typeDifference
    return left.label.localeCompare(right.label, "pt-BR")
  })
}

function getSourceKey(source: SpellSource): string {
  return `${source.type}:${source.sourceId || source.name}`
}

function getSourceTypeLabel(type: SpellSource["type"]): string {
  if (type === "class") return "Classes"
  if (type === "ability") return "Habilidades"
  if (type === "feat") return "Talentos"
  if (type === "race") return "Raça"
  return "Equipamentos"
}

function getSpecificSourceLabel(source: SpellSource): string {
  if (source.type === "class") {
    return `Classe: ${CLASS_NAMES[source.name as ClassName] ?? source.name}`
  }
  if (source.type === "ability") {
    return `Habilidade: ${source.name || "Sem nome"}`
  }
  if (source.type === "feat") {
    return `Talento: ${source.name || "Sem nome"}`
  }
  if (source.type === "race") {
    return `Raça: ${source.name || "Sem nome"}`
  }
  return `Equipamento: ${source.name || "Sem nome"}`
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
