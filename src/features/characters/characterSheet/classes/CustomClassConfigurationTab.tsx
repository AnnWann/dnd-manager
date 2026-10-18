import { ConfigurationToggleGrid } from "../../../../../packages/game-ui/src/ConfigurationToggleGrid"
import { CustomClassBasicFields } from "../../../../../packages/game-ui/src/CustomClassBasicFields"
import { LevelSelectionGrid } from "../../../../../packages/game-ui/src/LevelSelectionGrid"
import { ClassConfigurationSelector } from "../../../../../packages/game-ui/src/ClassConfigurationSelector"
import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import {
  createCustomSlotPool,
  getCustomCantripsKnownAtLevel,
  getCustomClassConfigFromEntry,
  getCustomLeveledSpellsKnownAtLevel,
  getCustomProgressionValueAtLevel,
  isCustomClassEntry,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../../models/characters/customClassConfig"
import type { Attribute } from "../../../../models/sheet/Attribute"
import type { ClassName, KnownSpellMode } from "../../../../models/sheet/Class"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "Força" },
  { value: "dex", label: "Destreza" },
  { value: "con", label: "Constituição" },
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

const HIT_DICE: CustomClassRuntimeConfig["hitDie"][] = ["d4", "d6", "d8", "d10", "d12"]
const LEVELS = Array.from({ length: 20 }, (_, index) => index + 1)
const CIRCLES = Array.from({ length: 9 }, (_, index) => index + 1)

type TabProps = {
  character: CharacterTemplate
  updateCharacter?: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  onApply?: (
    className: ClassName,
    config: CustomClassRuntimeConfig,
  ) => void | Promise<void>
  readOnly?: boolean
  applyLabel?: string
}

type EditorProps = {
  config: CustomClassRuntimeConfig
  onApply: (config: CustomClassRuntimeConfig) => void | Promise<void>
  readOnly?: boolean
  applyLabel?: string
}

export function CustomClassConfigurationTab({
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
      <ClassConfigurationSelector
        choices={customClasses.map(entry => ({
          id: entry.className,
          name: entry.config.name,
          level: entry.level,
        }))}
        selectedId={selectedClass.className}
        onSelect={setSelectedClassName}
      />

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

export function CustomClassConfigurationEditor({
  config,
  onApply,
  readOnly = false,
  applyLabel = "Aplicar alterações",
}: EditorProps) {
  const normalizedConfig = useMemo(() => normalizeCustomClassConfig(config), [config])
  const [draft, setDraft] = useState<CustomClassRuntimeConfig>(normalizedConfig)
  const [applying, setApplying] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(normalizedConfig)

  function patch(value: Partial<CustomClassRuntimeConfig>) {
    if (readOnly) return
    setDraft((current) => ({ ...current, ...value }))
  }

  async function save() {
    if (readOnly || !dirty || applying) return
    const currentDraft = normalizeCustomClassConfig(draft)
    setApplying(true)
    try {
      await onApply(currentDraft)
      setDraft(currentDraft)
    } finally {
      setApplying(false)
    }
  }

  function toggleSavingThrow(attribute: Attribute) {
    if (readOnly) return
    patch({
      savingThrows: draft.savingThrows.includes(attribute)
        ? draft.savingThrows.filter((entry) => entry !== attribute)
        : [...draft.savingThrows, attribute],
    })
  }

  function toggleAsiLevel(level: number) {
    if (readOnly) return
    patch({
      asiLevels: draft.asiLevels.includes(level)
        ? draft.asiLevels.filter((entry) => entry !== level)
        : [...draft.asiLevels, level].sort((left, right) => left - right),
    })
  }

  function setCantripsAtLevel(level: number, raw: string) {
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
    progression: Record<string, Record<string, number>>,
    level: number,
    circle: number,
    raw: string,
  ) {
    const next = { ...progression }
    const levelKey = String(level)
    const circleKey = String(circle)
    const row = { ...(next[levelKey] ?? {}) }

    if (raw.trim() === "") delete row[circleKey]
    else row[circleKey] = Math.max(0, Math.trunc(Number(raw) || 0))

    if (Object.keys(row).length) next[levelKey] = row
    else delete next[levelKey]

    return next
  }

  return (
    <div className="grid gap-4">
      {readOnly ? (
        <div className="rounded-xl border border-border bg-bg-subtle px-4 py-3 text-xs leading-5 text-textMuted">
          A configuração da classe está em modo de visualização. Ative a edição da ficha para alterá-la.
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">Configuração da classe</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
              Estas opções existem somente para classes personalizadas. A classe é persistida como personalizada e não como o chassi de uma classe oficial renomeada.
            </p>
          </div>
          {!readOnly ? (
            <Button variant="primary" disabled={!dirty || applying} onClick={() => void save()}>
              {applying ? "Aplicando…" : applyLabel}
            </Button>
          ) : null}
        </div>

        <CustomClassBasicFields
          value={draft}
          hitDice={HIT_DICE}
          casterTypes={[
            { value: "none", label: "Não conjurador" },
            { value: "full", label: "Conjurador completo" },
            { value: "half", label: "Meio conjurador" },
            { value: "third", label: "1/3 de conjurador" },
          ]}
          attributes={ATTRIBUTES}
          spellModes={[
            { value: "limited", label: "Magias conhecidas" },
            { value: "spellbook", label: "Grimório" },
            { value: "prepared-only", label: "Somente preparadas" },
          ]}
          noneCasterValue="none"
          disabled={readOnly}
          onChange={patch}
        />

        <LevelSelectionGrid
          title="Níveis de ASI / talentos"
          description="Marque os níveis da classe em que o personagem recebe um aumento de atributo ou talento."
          levels={LEVELS}
          selectedLevels={draft.asiLevels}
          disabled={readOnly}
          onToggle={toggleAsiLevel}
        />

        <ConfigurationToggleGrid
          title="Proficiências em testes de resistência"
          choices={ATTRIBUTES}
          selected={draft.savingThrows}
          disabled={readOnly}
          onToggle={toggleSavingThrow}
        />
      </section>

      {draft.casterType !== "none" ? (
        <>
          <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
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

          <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-textH">Progressão de espaços de magia</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
                Use a progressão automática de conjurador ou defina os espaços manualmente. Valores continuam nos níveis seguintes até que você informe outro valor; um valor alterado abaixo vira uma substituição independente.
              </p>
            </div>
            <label className="grid min-w-56 gap-1">
              <span className="text-[11px] font-medium text-textH">Modo de progressão</span>
              <Select
                disabled={readOnly}
                value={draft.slotProgressionMode}
                onInput={(event) => patch({ slotProgressionMode: event.currentTarget.value === "table" ? "table" : "formula" })}
              >
                <option value="formula">Padrão do tipo de conjurador</option>
                <option value="table">Tabela exata por nível</option>
              </Select>
            </label>
          </div>

          {draft.slotProgressionMode === "table" ? (
            <>
              <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs leading-5 text-text">
                A tabela abaixo é a progressão real da classe. Esses espaços não usam o chassi de full/half/third caster. Em multiclasse, eles são somados aos espaços derivados das outras classes.
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-bg" data-no-tab-swipe>
                <table className="min-w-[760px] w-full border-collapse text-center text-xs">
                  <thead>
                    <tr className="border-b border-border text-textMuted">
                      <th className="sticky left-0 bg-bg px-2 py-2 text-left">Nível</th>
                      {CIRCLES.map((circle) => <th key={circle} className="px-2 py-2">{circle}º</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {LEVELS.map((level) => (
                      <tr key={level} className="border-b border-border/70 last:border-0">
                        <th className="sticky left-0 bg-bg px-2 py-1.5 text-left font-semibold text-textH">{level}</th>
                        {CIRCLES.map((circle) => (
                          <td key={circle} className="p-1">
                            <input
                              disabled={readOnly}
                              type="number"
                              min={0}
                              max={20}
                              inputMode="numeric"
                              aria-label={`Nível ${level}, círculo ${circle}`}
                              className="h-8 w-14 rounded-md border border-border bg-bg-subtle px-1 text-center text-xs text-textH disabled:opacity-70"
                              value={
                                draft.spellSlotProgression[String(level)]?.[String(circle)] ??
                                (getCustomProgressionValueAtLevel(
                                  draft.spellSlotProgression,
                                  level,
                                  circle,
                                ) || "")
                              }
                              placeholder="—"
                              onChange={(event) => {
                                patch({
                                  spellSlotProgression: setProgressionCell(
                                    draft.spellSlotProgression,
                                    level,
                                    circle,
                                    event.target.value,
                                  ),
                                })
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">
              A progressão será calculada automaticamente usando {draft.casterType === "full" ? "conjurador completo" : draft.casterType === "half" ? "meio conjurador" : "1/3 de conjurador"}.
            </div>
          )}
          </section>
        </>
      ) : null}

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">Pools adicionais de espaços</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
              Crie pools independentes da progressão principal. Isso permite, por exemplo, ter a tabela normal da classe e ainda um pool separado de “Espaços de Arcanomancer”.
            </p>
          </div>
          {!readOnly ? (
            <Button
              variant="secondary"
              onClick={() => patch({ additionalSlotPools: [...draft.additionalSlotPools, createCustomSlotPool()] })}
            >
              + Adicionar pool
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4">
          {draft.additionalSlotPools.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
              Nenhum pool adicional configurado.
            </div>
          ) : null}

          {draft.additionalSlotPools.map((pool, poolIndex) => (
            <div key={pool.id} className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid min-w-52 flex-1 gap-1">
                  <span className="text-[11px] font-medium text-textH">Nome do recurso</span>
                  <Input
                    disabled={readOnly}
                    value={pool.name}
                    onChange={(event) => {
                      const pools = [...draft.additionalSlotPools]
                      pools[poolIndex] = { ...pool, name: event.target.value }
                      patch({ additionalSlotPools: pools })
                    }}
                  />
                </label>
                <label className="grid min-w-40 gap-1">
                  <span className="text-[11px] font-medium text-textH">Recupera em</span>
                  <Select
                    disabled={readOnly}
                    value={pool.recovery}
                    onInput={(event) => {
                      const pools = [...draft.additionalSlotPools]
                      pools[poolIndex] = { ...pool, recovery: event.currentTarget.value === "short" ? "short" : "long" }
                      patch({ additionalSlotPools: pools })
                    }}
                  >
                    <option value="long">Descanso longo</option>
                    <option value="short">Descanso curto</option>
                  </Select>
                </label>
                {!readOnly ? (
                  <Button
                    variant="secondary"
                    onClick={() => patch({ additionalSlotPools: draft.additionalSlotPools.filter((_, index) => index !== poolIndex) })}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-bg" data-no-tab-swipe>
                <table className="min-w-[760px] w-full border-collapse text-center text-xs">
                  <thead>
                    <tr className="border-b border-border text-textMuted">
                      <th className="sticky left-0 bg-bg px-2 py-2 text-left">Nível</th>
                      {CIRCLES.map((circle) => <th key={circle} className="px-2 py-2">{circle}º</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {LEVELS.map((level) => (
                      <tr key={level} className="border-b border-border/70 last:border-0">
                        <th className="sticky left-0 bg-bg px-2 py-1.5 text-left font-semibold text-textH">{level}</th>
                        {CIRCLES.map((circle) => (
                          <td key={circle} className="p-1">
                            <input
                              disabled={readOnly}
                              type="number"
                              min={0}
                              max={20}
                              inputMode="numeric"
                              aria-label={`Nível ${level}, círculo ${circle}`}
                              className="h-8 w-14 rounded-md border border-border bg-bg-subtle px-1 text-center text-xs text-textH disabled:opacity-70"
                              value={
                                pool.progression[String(level)]?.[String(circle)] ??
                                (getCustomProgressionValueAtLevel(
                                  pool.progression,
                                  level,
                                  circle,
                                ) || "")
                              }
                              placeholder="—"
                              onChange={(event) => {
                                const pools = [...draft.additionalSlotPools]
                                pools[poolIndex] = {
                                  ...pool,
                                  progression: setProgressionCell(
                                    pool.progression,
                                    level,
                                    circle,
                                    event.target.value,
                                  ),
                                }
                                patch({ additionalSlotPools: pools })
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}