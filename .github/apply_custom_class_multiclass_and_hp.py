from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Keep currentMax synchronized with the real maximum when the character is not
# under a max-HP reduction. Session projection uses currentMax as the effective
# base maximum, so leaving the old value behind makes level-up look like it did
# not increase HP.
replace_once(
    "src/models/leveling/applyCharacterProgression.ts",
    '''  const gain = Math.max(1, Math.trunc(hpGain))
  return character.withSheet("HP", {
    ...hp,
    max: hp.max + gain,
    current: hp.current + gain,
''',
    '''  const gain = Math.max(1, Math.trunc(hpGain))
  const currentMax = Number(hp.currentMax)
  const nextMax = hp.max + gain
  const nextCurrentMax =
    Number.isFinite(currentMax) && currentMax < hp.max
      ? currentMax
      : nextMax
  return character.withSheet("HP", {
    ...hp,
    max: nextMax,
    currentMax: nextCurrentMax,
    current: hp.current + gain,
''',
)

replace_once(
    "src/models/characters/customClassProgression.ts",
    '''  const gain = Math.max(1, Math.trunc(hpGain || 1))

  return character.withSheet("HP", {
    ...hp,
    max: hp.max + gain,
    current: hp.current + gain,
''',
    '''  const gain = Math.max(1, Math.trunc(hpGain || 1))
  const currentMax = Number(hp.currentMax)
  const nextMax = hp.max + gain
  const nextCurrentMax =
    Number.isFinite(currentMax) && currentMax < hp.max
      ? currentMax
      : nextMax

  return character.withSheet("HP", {
    ...hp,
    max: nextMax,
    currentMax: nextCurrentMax,
    current: hp.current + gain,
''',
)

# Character selector: resolve each custom runtime id to the configured class
# name. Keep the raw id only as a last-resort fallback for malformed legacy
# entries.
replace_once(
    "src/features/characters/selector/campaignCharacterSelectorAdapter.ts",
    '''import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
''',
    '''import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import {
  getCustomClassConfigFromEntry,
  isCustomClassEntry,
} from "../../../models/characters/customClassConfig"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
''',
)
replace_once(
    "src/features/characters/selector/campaignCharacterSelectorAdapter.ts",
    '''  const classLabel = classes
    .map((entry) => CLASS_NAMES[entry.className] ?? entry.className)
    .filter(Boolean)
    .join(" / ")
''',
    '''  const classLabel = classes
    .map((entry) =>
      isCustomClassEntry(entry)
        ? getCustomClassConfigFromEntry(entry)?.name ?? String(entry.className)
        : CLASS_NAMES[entry.className] ?? entry.className,
    )
    .filter(Boolean)
    .join(" / ")
''',
)

# Custom-class sheet: enumerate every custom class entry in a multiclass
# character and target edits by the stable runtime class id.
replace_once(
    "src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx",
    '''import { useMemo, useState } from "react"
''',
    '''import { useEffect, useMemo, useState } from "react"
''',
)
replace_once(
    "src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx",
    '''  createCustomSlotPool,
  getCustomCantripsKnownAtLevel,
  getCustomClassConfig,
  getCustomLeveledSpellsKnownAtLevel,
  getCustomProgressionValueAtLevel,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
''',
    '''  createCustomSlotPool,
  getCustomCantripsKnownAtLevel,
  getCustomClassConfigFromEntry,
  getCustomLeveledSpellsKnownAtLevel,
  getCustomProgressionValueAtLevel,
  isCustomClassEntry,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
''',
)
replace_once(
    "src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx",
    '''import type { KnownSpellMode } from "../../../../models/sheet/Class"
''',
    '''import type { ClassName, KnownSpellMode } from "../../../../models/sheet/Class"
''',
)
replace_once(
    "src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx",
    '''  onApply?: (config: CustomClassRuntimeConfig) => void | Promise<void>
''',
    '''  onApply?: (
    className: ClassName,
    config: CustomClassRuntimeConfig,
  ) => void | Promise<void>
''',
)
replace_once(
    "src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx",
    '''export function CustomClassConfigurationTab({
  character,
  updateCharacter,
  onApply,
  readOnly = false,
  applyLabel,
}: TabProps) {
  const config = useMemo(() => getCustomClassConfig(character), [character])

  if (!config) return null

  return (
    <CustomClassConfigurationEditor
      key={`${character.get("id")}:${JSON.stringify(config)}`}
      config={config}
      readOnly={readOnly}
      applyLabel={applyLabel}
      onApply={async (nextConfig) => {
        if (onApply) {
          await onApply(nextConfig)
          return
        }
        if (!updateCharacter || readOnly) return
        updateCharacter(character.get("id"), (current) =>
          updateCustomClassConfig(current, nextConfig),
        )
      }}
    />
  )
}
''',
    '''export function CustomClassConfigurationTab({
  character,
  updateCharacter,
  onApply,
  readOnly = false,
  applyLabel,
}: TabProps) {
  const customClasses = useMemo(
    () => (character.get("sheet").classes ?? []).flatMap((entry) => {
      if (!isCustomClassEntry(entry)) return []
      const config = getCustomClassConfigFromEntry(entry)
      return config
        ? [{ className: entry.className, level: entry.level, config }]
        : []
    }),
    [character],
  )
  const [selectedClassName, setSelectedClassName] = useState<ClassName | null>(
    () => customClasses[0]?.className ?? null,
  )

  useEffect(() => {
    if (!customClasses.length) {
      if (selectedClassName !== null) setSelectedClassName(null)
      return
    }
    if (
      !selectedClassName ||
      !customClasses.some((entry) => entry.className === selectedClassName)
    ) {
      setSelectedClassName(customClasses[0].className)
    }
  }, [customClasses, selectedClassName])

  const selectedClass = customClasses.find(
    (entry) => entry.className === selectedClassName,
  ) ?? customClasses[0]

  if (!selectedClass) return null

  return (
    <div className="grid gap-4">
      {customClasses.length > 1 ? (
        <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="text-sm font-semibold text-textH">Classes personalizadas</div>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Selecione qual classe do multiclass você deseja configurar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {customClasses.map((entry) => {
              const selected = entry.className === selectedClass.className
              return (
                <button
                  key={String(entry.className)}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedClassName(entry.className)}
                  className={[
                    "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors",
                    selected
                      ? "border-accentBorder bg-accentBg text-textH"
                      : "border-border bg-bg-subtle text-text hover:bg-accentBg",
                  ].join(" ")}
                >
                  <span>{entry.config.name}</span>
                  <span className="ml-2 font-normal text-textMuted">Nível {entry.level}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <CustomClassConfigurationEditor
        key={`${character.get("id")}:${String(selectedClass.className)}:${JSON.stringify(selectedClass.config)}`}
        config={selectedClass.config}
        readOnly={readOnly}
        applyLabel={applyLabel}
        onApply={async (nextConfig) => {
          if (onApply) {
            await onApply(selectedClass.className, nextConfig)
            return
          }
          if (!updateCharacter || readOnly) return
          updateCharacter(character.get("id"), (current) =>
            updateCustomClassConfig(current, nextConfig, selectedClass.className),
          )
        }}
      />
    </div>
  )
}
''',
)

# Route the selected custom class id through the session protocol.
replace_once(
    "src/views/CharacterView.tsx",
    '''              onApply={(config) => {
                const sent = sessionRuntime?.dispatchCustomClassOperation({
                  type: "character.class.custom.configure",
                  characterId: routeCharacter.get("id"),
                  config,
''',
    '''              onApply={(className, config) => {
                const sent = sessionRuntime?.dispatchCustomClassOperation({
                  type: "character.class.custom.configure",
                  characterId: routeCharacter.get("id"),
                  className,
                  config,
''',
)

replace_once(
    "src/features/session-runtime/customClassSessionProtocol.ts",
    '''import type { CustomClassRuntimeConfig } from "../../models/characters/customClassConfig"
''',
    '''import type { CustomClassRuntimeConfig } from "../../models/characters/customClassConfig"
import type { ClassName } from "../../models/sheet/Class"
''',
)
replace_once(
    "src/features/session-runtime/customClassSessionProtocol.ts",
    '''  characterId: string
  config: CustomClassRuntimeConfig
''',
    '''  characterId: string
  /** Optional during the rolling frontend/Worker upgrade; omitted legacy messages target the first custom class. */
  className?: ClassName
  config: CustomClassRuntimeConfig
''',
)

replace_once(
    "session-server/src/routes/characters/classes/customClassProtocol.ts",
    '''import type { CustomClassRuntimeConfig } from "../../../../../src/models/characters/customClassConfig";
''',
    '''import type { CustomClassRuntimeConfig } from "../../../../../src/models/characters/customClassConfig";
import type { ClassName } from "../../../../../src/models/sheet/Class";
''',
)
replace_once(
    "session-server/src/routes/characters/classes/customClassProtocol.ts",
    '''  characterId: string;
  config: CustomClassRuntimeConfig;
''',
    '''  characterId: string;
  /** Optional for backward compatibility with clients deployed before multiclass targeting. */
  className?: ClassName;
  config: CustomClassRuntimeConfig;
''',
)
replace_once(
    "session-server/src/routes/characters/classes/customClassProtocol.ts",
    '''      || typeof operation.characterId !== "string"
      || !operation.config
''',
    '''      || typeof operation.characterId !== "string"
      || (operation.className !== undefined && typeof operation.className !== "string")
      || !operation.config
''',
)

replace_once(
    "session-server/src/routes/characters/classes/CustomClassSessionActor.ts",
    '''    if (!getCustomClassConfig(character)) {
''',
    '''    if (!getCustomClassConfig(character, operation.className)) {
''',
)
replace_once(
    "session-server/src/routes/characters/classes/CustomClassSessionActor.ts",
    '''    const normalized = normalizeCustomClassConfig(operation.config);
    const next = updateCustomClassConfig(character, normalized);
''',
    '''    const normalized = normalizeCustomClassConfig(operation.config);
    const next = updateCustomClassConfig(character, normalized, operation.className);
''',
)

# Sanity checks for the intended cross-layer contract.
assert "currentMax: nextCurrentMax" in Path("src/models/leveling/applyCharacterProgression.ts").read_text()
assert "currentMax: nextCurrentMax" in Path("src/models/characters/customClassProgression.ts").read_text()
assert "Classes personalizadas" in Path("src/features/characters/characterSheet/classes/CustomClassConfigurationTab.tsx").read_text()
assert "className," in Path("src/views/CharacterView.tsx").read_text()
assert "operation.className" in Path("session-server/src/routes/characters/classes/CustomClassSessionActor.ts").read_text()
