import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  createCustomSlotPool,
  getCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../models/characters/customClassConfig"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { ClassLevel, KnownSpellMode } from "../../../models/sheet/Class"
import type { DieSides } from "../../../models/dice/Die"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "Força" },
  { value: "dex", label: "Destreza" },
  { value: "con", label: "Constituição" },
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

const HIT_DICE: DieSides[] = ["d4", "d6", "d8", "d10", "d12"]
const LEVELS = Array.from({ length: 20 }, (_, index) => (index + 1) as ClassLevel)
const CIRCLES = Array.from({ length: 9 }, (_, index) => (index + 1) as MagicCircleLevel)

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CustomClassConfigurationTab({ character, updateCharacter }: Props) {
  const persisted = useMemo(() => getCustomClassConfig(character), [character])
  const [draft, setDraft] = useState<CustomClassRuntimeConfig | undefined>(persisted)

  if (!persisted || !draft) return null

  const dirty = JSON.stringify(draft) !== JSON.stringify(persisted)

  function patch(value: Partial<CustomClassRuntimeConfig>) {
    setDraft((current) => (current ? { ...current, ...value } : current))
  }

  function save() {
    updateCharacter(character.get("id"), (current) =>
      updateCustomClassConfig(current, draft),
    )
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">Configuração da classe</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
              Estas opções existem somente para classes personalizadas. Elas controlam a estrutura básica da classe e sua progressão mágica.
            </p>
          </div>
          <Button variant="primary" disabled={!dirty} onClick={save}>
            Salvar alterações
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-textH">Nome da classe</span>
            <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Dado de vida</span>
            <Select value={draft.hitDie} onChange={(event) => patch({ hitDie: event.target.value as DieSides })}>
              {HIT_DICE.map((die) => <option key={die} value={die}>{die}</option>)}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Progressão padrão de conjurador</span>
            <Select value={draft.casterType} onChange={(event) => patch({ casterType: event.target.value as CustomClassRuntimeConfig["casterType"] })}>
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
                <Select value={draft.castingAttribute} onChange={(event) => patch({ castingAttribute: event.target.value as Attribute })}>
                  {ATTRIBUTES.map((attribute) => <option key={attribute.value} value={attribute.value}>{attribute.label}</option>)}
                </Select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-textH">Modelo de magias</span>
                <Select value={draft.knownSpellMode} onChange={(event) => patch({ knownSpellMode: event.target.value as KnownSpellMode })}>
                  <option value="limited">Magias conhecidas</option>
                  <option value="spellbook">Grimório</option>
                  <option value="prepared-only">Somente preparadas</option>
                </Select>
              </label>

              {draft.knownSpellMode !== "prepared-only" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">Conhecidas no N1</span>
                    <Input type="number" min={0} value={draft.knownAtLevel1} onChange={(event) => patch({ knownAtLevel1: Math.max(0, Number(event.target.value) || 0) })} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">Por nível</span>
                    <Input type="number" min={0} step="0.5" value={draft.knownPerLevel} onChange={(event) => patch({ knownPerLevel: Math.max(0, Number(event.target.value) || 0) })} />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">Pools adicionais de espaços</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
              Crie pools independentes da progressão padrão. Isso permite, por exemplo, usar progressão de conjurador completo e ainda ter um pool separado de “Espaços de Arcanomancer”.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => patch({ additionalSlotPools: [...draft.additionalSlotPools, createCustomSlotPool()] })}
          >
            + Adicionar pool
          </Button>
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
                <Button
                  variant="secondary"
                  onClick={() => patch({ additionalSlotPools: draft.additionalSlotPools.filter((_, index) => index !== poolIndex) })}
                >
                  Remover
                </Button>
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
                              type="number"
                              min={0}
                              max={20}
                              inputMode="numeric"
                              aria-label={`Nível ${level}, círculo ${circle}`}
                              className="h-8 w-14 rounded-md border border-border bg-bg-subtle px-1 text-center text-xs text-textH"
                              value={pool.progression[level]?.[circle] ?? ""}
                              placeholder="—"
                              onChange={(event) => {
                                const amount = Math.max(0, Math.trunc(Number(event.target.value) || 0))
                                const progression = { ...pool.progression }
                                const row = { ...(progression[level] ?? {}) }
                                if (amount > 0) row[circle] = amount
                                else delete row[circle]
                                if (Object.keys(row).length) progression[level] = row
                                else delete progression[level]
                                const pools = [...draft.additionalSlotPools]
                                pools[poolIndex] = { ...pool, progression }
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
