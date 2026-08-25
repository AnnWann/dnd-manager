from pathlib import Path


def replace_once(path: Path, old: str, new: str):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}\n{old[:260]}")
    path.write_text(text.replace(old, new, 1))


# Runtime configuration + migration from the old N1/per-level model.
path = Path("src/models/characters/customClassConfig.ts")

replace_once(
    path,
    """  knownAtLevel1: number
  knownPerLevel: number
  cantripsKnownProgression: Record<string, number>
""",
    """  /** @deprecated Kept only to migrate older custom-class configs. */
  knownAtLevel1: number
  /** @deprecated Kept only to migrate older custom-class configs. */
  knownPerLevel: number
  leveledSpellsKnownProgression: Record<string, number>
  cantripsKnownProgression: Record<string, number>
""",
)

replace_once(
    path,
    """  knownAtLevel1: 2,
  knownPerLevel: 1,
  cantripsKnownProgression: {},
""",
    """  knownAtLevel1: 2,
  knownPerLevel: 1,
  leveledSpellsKnownProgression: { "1": 2 },
  cantripsKnownProgression: {},
""",
)

replace_once(
    path,
    """    knownSpellMode: entry.knownSpells?.mode ?? "limited",
    knownAtLevel1: entry.knownSpells?.baseAtLevel1 ?? 2,
    knownPerLevel: entry.knownSpells?.perLevel ?? 1,
  })
""",
    """    knownSpellMode: entry.knownSpells?.mode ?? "limited",
    knownAtLevel1: entry.knownSpells?.baseAtLevel1 ?? 2,
    knownPerLevel: entry.knownSpells?.perLevel ?? 1,
    leveledSpellsKnownProgression: {
      "1": entry.knownSpells?.baseAtLevel1 ?? 2,
    },
  })
""",
)

replace_once(
    path,
    """    knownSpells: normalized.casterType === "none" ? undefined : {
      mode: normalized.knownSpellMode,
      baseAtLevel1: normalized.knownSpellMode === "prepared-only" ? 0 : normalized.knownAtLevel1,
      perLevel: normalized.knownSpellMode === "prepared-only" ? 0 : normalized.knownPerLevel,
    },
""",
    """    knownSpells: normalized.casterType === "none" ? undefined : {
      mode: normalized.knownSpellMode,
      baseAtLevel1:
        normalized.knownSpellMode === "prepared-only"
          ? 0
          : getCustomLeveledSpellsKnownAtLevel(normalized, 1),
      perLevel: 0,
    },
""",
)

replace_once(
    path,
    """  const savingThrows = Array.isArray(config.savingThrows)
    ? Array.from(new Set(config.savingThrows.filter((entry): entry is Attribute => ATTRIBUTE_KEYS.includes(entry))))
    : []

  return {
""",
    """  const savingThrows = Array.isArray(config.savingThrows)
    ? Array.from(new Set(config.savingThrows.filter((entry): entry is Attribute => ATTRIBUTE_KEYS.includes(entry))))
    : []
  const legacyKnownAtLevel1 = Math.max(
    0,
    Math.trunc(Number(value?.knownAtLevel1 ?? DEFAULT_CUSTOM_CLASS_CONFIG.knownAtLevel1) || 0),
  )
  const legacyKnownPerLevel = Math.max(
    0,
    Number(value?.knownPerLevel ?? DEFAULT_CUSTOM_CLASS_CONFIG.knownPerLevel) || 0,
  )
  const leveledSpellsKnownProgression =
    value?.leveledSpellsKnownProgression &&
    typeof value.leveledSpellsKnownProgression === "object"
      ? normalizeScalarLevelProgression(value.leveledSpellsKnownProgression)
      : value === undefined
        ? { ...DEFAULT_CUSTOM_CLASS_CONFIG.leveledSpellsKnownProgression }
        : Object.fromEntries(
            Array.from({ length: 20 }, (_, index) => {
              const level = index + 1
              return [
                String(level),
                Math.max(
                  0,
                  Math.floor(legacyKnownAtLevel1 + index * legacyKnownPerLevel),
                ),
              ]
            }),
          )

  return {
""",
)

replace_once(
    path,
    """    knownAtLevel1: Math.max(0, Math.trunc(Number(config.knownAtLevel1) || 0)),
    knownPerLevel: Math.max(0, Number(config.knownPerLevel) || 0),
    cantripsKnownProgression:
      config.cantripsKnownProgression && typeof config.cantripsKnownProgression === "object"
        ? Object.fromEntries(
            Object.entries(config.cantripsKnownProgression).map(([level, amount]) => [
              String(Math.max(1, Math.min(20, Math.trunc(Number(level) || 1)))),
              Math.max(0, Math.trunc(Number(amount) || 0)),
            ]),
          )
        : {},
""",
    """    knownAtLevel1: legacyKnownAtLevel1,
    knownPerLevel: legacyKnownPerLevel,
    leveledSpellsKnownProgression,
    cantripsKnownProgression:
      config.cantripsKnownProgression && typeof config.cantripsKnownProgression === "object"
        ? normalizeScalarLevelProgression(config.cantripsKnownProgression)
        : {},
""",
)

replace_once(
    path,
    """export function getCustomCantripsKnownAtLevel(
  config: CustomClassRuntimeConfig,
  classLevel: number,
): number {
""",
    """function normalizeScalarLevelProgression(
  progression: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(progression).map(([level, amount]) => [
      String(Math.max(1, Math.min(20, Math.trunc(Number(level) || 1)))),
      Math.max(0, Math.trunc(Number(amount) || 0)),
    ]),
  )
}

export function getCustomLeveledSpellsKnownAtLevel(
  config: CustomClassRuntimeConfig,
  classLevel: number,
): number {
  return getInheritedScalarProgressionValue(
    config.leveledSpellsKnownProgression,
    classLevel,
  )
}

export function getCustomCantripsKnownAtLevel(
  config: CustomClassRuntimeConfig,
  classLevel: number,
): number {
""",
)

replace_once(
    path,
    """  const target = Math.max(1, Math.min(20, Math.trunc(classLevel || 1)))
  let amount = 0
  for (let level = 1; level <= target; level += 1) {
    const configured = config.cantripsKnownProgression[String(level)]
    if (configured === undefined) continue
    amount = Math.max(0, Math.trunc(Number(configured) || 0))
  }
  return amount
}
""",
    """  return getInheritedScalarProgressionValue(
    config.cantripsKnownProgression,
    classLevel,
  )
}

function getInheritedScalarProgressionValue(
  progression: Record<string, number>,
  classLevel: number,
): number {
  const target = Math.max(1, Math.min(20, Math.trunc(classLevel || 1)))
  let amount = 0
  for (let level = 1; level <= target; level += 1) {
    const configured = progression[String(level)]
    if (configured === undefined) continue
    amount = Math.max(0, Math.trunc(Number(configured) || 0))
  }
  return amount
}
""",
)

# Spell-selection rule uses the explicit inherited table.
path = Path("src/models/leveling/SpellSelectionRules.ts")
replace_once(
    path,
    """  createCustomClassEntry,
  getCustomCantripsKnownAtLevel,
  getCustomClassConfigFromEntry,
""",
    """  createCustomClassEntry,
  getCustomCantripsKnownAtLevel,
  getCustomClassConfigFromEntry,
  getCustomLeveledSpellsKnownAtLevel,
""",
)

replace_once(
    path,
    """  const maxLeveledSpells =
    config.knownSpellMode === "prepared-only"
      ? 0
      : Math.max(
          0,
          Math.floor(
            config.knownAtLevel1 +
              Math.max(0, level - 1) * config.knownPerLevel,
          ),
        )
  const maxCantrips = getCustomCantripsKnownAtLevel(config, level)
""",
    """  const maxLeveledSpells =
    config.knownSpellMode === "prepared-only"
      ? 0
      : getCustomLeveledSpellsKnownAtLevel(config, level)
  const maxCantrips = getCustomCantripsKnownAtLevel(config, level)
""",
)

# Editor: remove formula fields and add inherited learned-spell table.
path = Path("src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx")
replace_once(
    path,
    """  getCustomCantripsKnownAtLevel,
  getCustomClassConfig,
""",
    """  getCustomCantripsKnownAtLevel,
  getCustomClassConfig,
  getCustomLeveledSpellsKnownAtLevel,
""",
)

replace_once(
    path,
    """  function setCantripsAtLevel(level: number, raw: string) {
    if (readOnly) return
    const progression = { ...draft.cantripsKnownProgression }
    if (raw.trim() === "") delete progression[String(level)]
    else progression[String(level)] = Math.max(0, Math.trunc(Number(raw) || 0))
    patch({ cantripsKnownProgression: progression })
  }

  function setProgressionCell(
""",
    """  function setCantripsAtLevel(level: number, raw: string) {
    if (readOnly) return
    const progression = { ...draft.cantripsKnownProgression }
    if (raw.trim() === "") delete progression[String(level)]
    else progression[String(level)] = Math.max(0, Math.trunc(Number(raw) || 0))
    patch({ cantripsKnownProgression: progression })
  }

  function setLeveledSpellsAtLevel(level: number, raw: string) {
    if (readOnly) return
    const progression = { ...draft.leveledSpellsKnownProgression }
    if (raw.trim() === "") delete progression[String(level)]
    else progression[String(level)] = Math.max(0, Math.trunc(Number(raw) || 0))
    patch({ leveledSpellsKnownProgression: progression })
  }

  function setProgressionCell(
""",
)

replace_once(
    path,
    """              {draft.knownSpellMode !== "prepared-only" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">Conhecidas no N1</span>
                    <Input disabled={readOnly} type="number" min={0} value={draft.knownAtLevel1} onChange={(event) => patch({ knownAtLevel1: Math.max(0, Number(event.target.value) || 0) })} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">Por nível</span>
                    <Input disabled={readOnly} type="number" min={0} step="0.5" value={draft.knownPerLevel} onChange={(event) => patch({ knownPerLevel: Math.max(0, Number(event.target.value) || 0) })} />
                  </label>
                </div>
              ) : null}
""",
    "",
)

cantrip_section = """          <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
            <div>
              <h2 className="text-sm font-semibold text-textH">Progressão de truques conhecidos</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
                Informe o total de truques conhecidos nos níveis em que esse total muda. O último valor é preenchido automaticamente nos níveis seguintes, mas qualquer nível pode sobrescrevê-lo independentemente.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
              {LEVELS.map((level) => (
                <label key={level} className="grid gap-1">
                  <span className="text-[11px] text-textMuted">N{level}</span>
                  <input
                    disabled={readOnly}
                    type="number"
                    min={0}
                    max={20}
                    inputMode="numeric"
                    className="h-9 w-full rounded-md border border-border bg-bg-subtle px-2 text-center text-xs text-textH disabled:opacity-70"
                    value={
                      draft.cantripsKnownProgression[String(level)] ??
                      (getCustomCantripsKnownAtLevel(draft, level) || "")
                    }
                    placeholder="—"
                    onChange={(event) => setCantripsAtLevel(level, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
"""

learned_section = cantrip_section + """
          {draft.knownSpellMode !== "prepared-only" ? (
            <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
              <div>
                <h2 className="text-sm font-semibold text-textH">
                  {draft.knownSpellMode === "spellbook"
                    ? "Progressão de magias no grimório"
                    : "Progressão de magias conhecidas"}
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
                  Informe o total de magias de 1º círculo ou superior aprendidas em cada nível. O último valor é preenchido automaticamente nos níveis seguintes e pode ser sobrescrito em qualquer nível.
                </p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
                {LEVELS.map((level) => (
                  <label key={level} className="grid gap-1">
                    <span className="text-[11px] text-textMuted">N{level}</span>
                    <input
                      disabled={readOnly}
                      type="number"
                      min={0}
                      max={200}
                      inputMode="numeric"
                      className="h-9 w-full rounded-md border border-border bg-bg-subtle px-2 text-center text-xs text-textH disabled:opacity-70"
                      value={
                        draft.leveledSpellsKnownProgression[String(level)] ??
                        (getCustomLeveledSpellsKnownAtLevel(draft, level) || "")
                      }
                      placeholder="—"
                      onChange={(event) => setLeveledSpellsAtLevel(level, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>
          ) : null}
"""
replace_once(path, cantrip_section, learned_section)
