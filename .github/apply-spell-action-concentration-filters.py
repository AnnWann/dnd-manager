from pathlib import Path

path = Path("src/features/characters/magic/knownSpellsList.tsx")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"{label} not found")
    text = text.replace(old, new, 1)


replace_once(
    'import { Input } from "../../../components/ui/Input"\n',
    'import { Input } from "../../../components/ui/Input"\nimport { cn } from "../../../lib/cn"\n',
    "cn import",
)

replace_once(
    'type ListViewMode = "detailed" | "compact"\n',
    'type ListViewMode = "detailed" | "compact"\n'
    'type CastingTimeFilter = "all" | "action" | "bonusAction" | "reaction"\n'
    'type ConcentrationFilter = "all" | "concentration" | "no-concentration"\n',
    "filter types",
)

replace_once(
    '''  specificSourceFilter: SpecificSourceFilter
  viewMode: ListViewMode
}''',
    '''  specificSourceFilter: SpecificSourceFilter
  castingTimeFilter: CastingTimeFilter
  concentrationFilter: ConcentrationFilter
  viewMode: ListViewMode
}''',
    "preference fields",
)

replace_once(
    '''  sourceTypeFilter: "all",
  specificSourceFilter: "all",
  viewMode: "detailed",''',
    '''  sourceTypeFilter: "all",
  specificSourceFilter: "all",
  castingTimeFilter: "all",
  concentrationFilter: "all",
  viewMode: "detailed",''',
    "default filters",
)

replace_once(
    '''    sourceTypeFilter,
    specificSourceFilter,
    viewMode,
  } = preferences''',
    '''    sourceTypeFilter,
    specificSourceFilter,
    castingTimeFilter,
    concentrationFilter,
    viewMode,
  } = preferences''',
    "destructure filters",
)

replace_once(
    '''    const matchesSpecificSource =
      effectiveSpecificSourceFilter === "all" ||
      getSourceKey(source) === effectiveSpecificSourceFilter

    return (
      matchesName &&
      matchesPrepared &&
      matchesSourceType &&
      matchesSpecificSource
    )''',
    '''    const matchesSpecificSource =
      effectiveSpecificSourceFilter === "all" ||
      getSourceKey(source) === effectiveSpecificSourceFilter

    const matchesCastingTime =
      castingTimeFilter === "all" ||
      spell.castingTime.type === castingTimeFilter

    const matchesConcentration =
      concentrationFilter === "all" ||
      (concentrationFilter === "concentration" && spell.concentration) ||
      (concentrationFilter === "no-concentration" && !spell.concentration)

    return (
      matchesName &&
      matchesPrepared &&
      matchesSourceType &&
      matchesSpecificSource &&
      matchesCastingTime &&
      matchesConcentration
    )''',
    "filter logic",
)

filters_ui = '''

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <fieldset className="grid gap-1.5">
            <legend className="text-[11px] text-textMuted">
              Tempo de conjuração
            </legend>
            <div
              className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-bg-subtle p-1"
              aria-label="Filtrar magias pelo tempo de conjuração"
            >
              {CASTING_TIME_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={castingTimeFilter === option.value}
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      castingTimeFilter: option.value,
                    }))
                  }
                  className={cn(
                    "min-h-9 rounded-md px-2 py-1.5 text-[11px] font-semibold leading-4 transition-colors",
                    castingTimeFilter === option.value
                      ? "bg-accentBg text-textH shadow-theme-sm"
                      : "text-textMuted hover:bg-bg hover:text-textH",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-1.5">
            <legend className="text-[11px] text-textMuted">
              Concentração
            </legend>
            <div
              className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-bg-subtle p-1"
              aria-label="Filtrar magias por concentração"
            >
              {CONCENTRATION_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={concentrationFilter === option.value}
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      concentrationFilter: option.value,
                    }))
                  }
                  className={cn(
                    "min-h-9 rounded-md px-2 py-1.5 text-[11px] font-semibold leading-4 transition-colors",
                    concentrationFilter === option.value
                      ? "bg-accentBg text-textH shadow-theme-sm"
                      : "text-textMuted hover:bg-bg hover:text-textH",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>'''

replace_once(
    '''          </label>
        </div>

        {spells.length ? (''',
    '''          </label>
        </div>''' + filters_ui + '''

        {spells.length ? (''',
    "filter controls",
)

replace_once(
    '''      specificSourceFilter:
        typeof parsed.specificSourceFilter === "string"
          ? parsed.specificSourceFilter
          : DEFAULT_SPELL_LIST_PREFERENCES.specificSourceFilter,
      viewMode: isListViewMode(parsed.viewMode)''',
    '''      specificSourceFilter:
        typeof parsed.specificSourceFilter === "string"
          ? parsed.specificSourceFilter
          : DEFAULT_SPELL_LIST_PREFERENCES.specificSourceFilter,
      castingTimeFilter: isCastingTimeFilter(parsed.castingTimeFilter)
        ? parsed.castingTimeFilter
        : DEFAULT_SPELL_LIST_PREFERENCES.castingTimeFilter,
      concentrationFilter: isConcentrationFilter(parsed.concentrationFilter)
        ? parsed.concentrationFilter
        : DEFAULT_SPELL_LIST_PREFERENCES.concentrationFilter,
      viewMode: isListViewMode(parsed.viewMode)''',
    "load filters",
)

replace_once(
    '''function isListViewMode(value: unknown): value is ListViewMode {
  return value === "detailed" || value === "compact"
}
''',
    '''function isListViewMode(value: unknown): value is ListViewMode {
  return value === "detailed" || value === "compact"
}

function isCastingTimeFilter(value: unknown): value is CastingTimeFilter {
  return (
    value === "all" ||
    value === "action" ||
    value === "bonusAction" ||
    value === "reaction"
  )
}

function isConcentrationFilter(value: unknown): value is ConcentrationFilter {
  return (
    value === "all" ||
    value === "concentration" ||
    value === "no-concentration"
  )
}
''',
    "filter guards",
)

replace_once(
    '''const DEFAULT_SPELL_LIST_PREFERENCES: SpellListPreferences = {''',
    '''const CASTING_TIME_FILTER_OPTIONS: Array<{
  value: CastingTimeFilter
  label: string
}> = [
  { value: "all", label: "Todas" },
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
]

const CONCENTRATION_FILTER_OPTIONS: Array<{
  value: ConcentrationFilter
  label: string
}> = [
  { value: "all", label: "Todas" },
  { value: "concentration", label: "Concentração" },
  { value: "no-concentration", label: "Sem concentração" },
]

const DEFAULT_SPELL_LIST_PREFERENCES: SpellListPreferences = {''',
    "filter options",
)

path.write_text(text)

required = [
    'castingTimeFilter: "all"',
    'concentrationFilter: "all"',
    'spell.castingTime.type === castingTimeFilter',
    'concentrationFilter === "no-concentration"',
    'Tempo de conjuração',
    'Sem concentração',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f"missing expected output: {needle}")
