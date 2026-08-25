import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import {
  createCustomSlotPool,
  getCustomClassConfig,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../../models/characters/customClassConfig"
import type { Attribute } from "../../../../models/sheet/Attribute"
import type { KnownSpellMode } from "../../../../models/sheet/Class"

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
  onApply?: (config: CustomClassRuntimeConfig) => void | Promise<void>
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

export function CustomClassConfigurationEditor({
  config,
  onApply,
  readOnly = false,
  applyLabel = "Aplicar alterações",
}: EditorProps) {
  const normalizedConfig = useMemo(() => normalizeCustomClassConfig(config), [config])
  const [draft, setDraft] = useState<CustomClassRuntimeConfig>(normalizedConfig)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    setDraft(normalizedConfig)
  }, [normalizedConfig])

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

  function setProgressionCell(
    progression: Record<string, Record<string, number>>,
    level: number,
    circle: number,
    amount: number,
  ) {
    const next = { ...progression }
    const levelKey = String(level)
    const circleKey = String(circle)
    const row = { ...(next[levelKey] ?? {}) }

    if (amount > 0) row[circleKey] = amount
    else delete row[circleKey]

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

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-textH">Nome da classe</span>
            <Input disabled={readOnly} value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Dado de vida</span>
            <Select
              disabled={readOnly}
              value={draft.hitDie}
              onChange={(event) =>
                patch({ hitDie: event.target.value as CustomClassRuntimeConfig["hitDie"] })
              }
            >
              {HIT_DICE.map((die) => <option key={die} value={die}>{die}</option>)}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Perícias de classe</span>
            <Input
              disabled={readOnly}
              type="number"
              min={0}
              max={18}
              value={draft.skillChoices}
              onChange={(event) => patch({ skillChoices: Math.max(0, Math.min(18, Math.trunc(Number(event.target.value) || 0))) })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Tipo de conjurador</span>
            <Select disabled={readOnly} value={draft.casterType} onChange={(event) => patch({ casterType: event.target.value as CustomClassRuntimeConfig["casterType"] })}>
              <option value="none">Não conjurador</option>
              <option value="full">Conjurador completo</option>
              <option value="half">Meio conjurador</option>
              <option value="third">1/3 de conjurador</option>
            </Select>
          </label>

          {draft.casterType !== "none" ? (
            <>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-textH">Atributo de conjuração</span>
                <Select disabled={readOnly} value={draft.castingAttribute} onChange={(event) => patch({ castingAttribute: event.target.value as Attribute })}>
                  {ATTRIBUTES.map((attribute) => <option key={attribute.value} value={attribute.value}>{attribute.label}</option>)}
                </Select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-textH">Modelo de magias</span>
                <Select disabled={readOnly} value={draft.knownSpellMode} onChange={(event) => patch({ knownSpellMode: event.target.value as KnownSpellMode })}>
                  <option value="limited">Magias conhecidas</option>
                  <option value="spellbook">Grimório</option>
                  <option value="prepared-only">Somente preparadas</option>
                </Select>
              </label>

              {draft.knownSpellMode !== "prepared-only" ? (
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
            </>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-bg-subtle p-3">
          <div className="text-xs font-semibold text-textH">
            Proficiências em testes de resistência
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {ATTRIBUTES.map((attribute) => {
              const selected = draft.savingThrows.includes(attribute.value)
              return (
                <button
                  key={attribute.value}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={selected}
                  onClick={() => toggleSavingThrow(attribute.value)}
                  className={[
                    "rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-default disabled:opacity-70",
                    selected
                      ? "border-accentBorder bg-accentBg text-textH"
                      : "border-border bg-bg text-text",
                  ].join(" ")}
                >
                  {selected ? "✓ " : ""}{attribute.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {draft.casterType !== "none" ? (
        <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-textH">Progressão de espaços de magia</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
                Use a progressão automática de conjurador ou defina exatamente quantos espaços de cada círculo a classe possui em cada nível.
              </p>
            </div>
            <label className="grid min-w-56 gap-1">
              <span className="text-[11px] font-medium text-textH">Modo de progressão</span>
              <Select
                disabled={readOnly}
                value={draft.slotProgressionMode}
                onChange={(event) => patch({ slotProgressionMode: event.target.value === "table" ? "table" : "formula" })}
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
                              value={draft.spellSlotProgression[String(level)]?.[String(circle)] ?? ""}
                              placeholder="—"
                              onChange={(event) => {
                                const amount = Math.max(0, Math.trunc(Number(event.target.value) || 0))
                                patch({
                                  spellSlotProgression: setProgressionCell(
                                    draft.spellSlotProgression,
                                    level,
                                    circle,
                                    amount,
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
                    onChange={(event) => {
                      const pools = [...draft.additionalSlotPools]
                      pools[poolIndex] = { ...pool, recovery: event.target.value === "short" ? "short" : "long" }
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
                              value={pool.progression[String(level)]?.[String(circle)] ?? ""}
                              placeholder="—"
                              onChange={(event) => {
                                const amount = Math.max(0, Math.trunc(Number(event.target.value) || 0))
                                const pools = [...draft.additionalSlotPools]
                                pools[poolIndex] = {
                                  ...pool,
                                  progression: setProgressionCell(pool.progression, level, circle, amount),
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
