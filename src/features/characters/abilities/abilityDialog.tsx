import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"
import { normalizeAbilityText } from "../../../lib/textNormalization"
import type {
  Ability,
  AbilityActionKind,
  AbilityCategory,
  AbilityEffectDuration,
  AbilityEffectPersistence,
  AbilityKind,
  AbilityUsageCooldownUnit,
  AbilityUsageResetKind,
  Trigger,
} from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  normalizeAbilityActivation,
} from "../../../models/abilities/abilityActivation"
import { BonusesFields } from "../inventory/equipmentBonusFields"
import {
  GrantedSpellsEditor,
  type EditableSpellGrant,
} from "../magic/grantedSpellsEditor"
import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_KIND_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

type Props = {
  open: boolean
  ability: Ability | null
  onClose: () => void
  onSave: (ability: Ability) => void
}

function createEmptyAbility(): Ability {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    kind: "active",
    category: "general",
    actionKind: "action",
    effectDuration: "instant",
    effectPersistence: "untilEnd",
    trigger: "always",
    grantedSpells: [],
    grantedProficiencies: [],
    bonuses: {},
    benefitsActive: false,
  }
}

function usesSharedClassResource(category: AbilityCategory | undefined): boolean {
  return category === "channelDivinity" || category === "martialArts"
}

export function AbilityDialog({ open, ability, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Ability>(() =>
    ability ?? createEmptyAbility(),
  )

  useEffect(() => {
    if (open) setDraft(ability ?? createEmptyAbility())
  }, [open, ability])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const sharedClassResource = usesSharedClassResource(draft.category)
  const hasUsage = !sharedClassResource && draft.usage !== undefined
  const maximumFormula = draft.usage?.maxFormula?.trim() ?? ""
  const maximumFormulaError = maximumFormula
    ? validateCharacterSheetFormula(maximumFormula)
    : undefined
  const requiresActivation = abilityRequiresActivation(draft)
  const duration =
    draft.effectDuration ?? (draft.kind === "active" ? "instant" : "lasting")
  const persistence = draft.effectPersistence ?? "untilEnd"
  const triggerInputValue =
    ABILITY_TRIGGER_OPTIONS.find(
      (option) => option.value === (draft.trigger ?? "always"),
    )?.label ?? draft.trigger ?? ""

  function updateUsageMaximum(rawValue: string) {
    if (!draft.usage) return

    const trimmed = rawValue.trim()
    const numeric = Number(trimmed)

    if (trimmed && Number.isFinite(numeric)) {
      const max = Math.max(1, Math.floor(numeric))
      setDraft({
        ...draft,
        usage: {
          ...draft.usage,
          max,
          maxFormula: undefined,
          used: Math.min(draft.usage.used, max),
        },
      })
      return
    }

    setDraft({
      ...draft,
      usage: {
        ...draft.usage,
        maxFormula: rawValue,
      },
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ability ? "Editar habilidade" : "Adicionar habilidade"}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">
              {ability ? "Editar habilidade" : "Adicionar habilidade"}
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Configure categoria, comportamento, usos, bônus, proficiências e magias concedidas.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Nome</span>
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Descrição</span>
            <Textarea
              className="min-h-24"
              value={draft.description ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Categoria</span>
              <Select
                value={draft.category ?? "general"}
                onChange={(event) => {
                  const category = event.target.value as AbilityCategory
                  setDraft({
                    ...draft,
                    category,
                    usage: usesSharedClassResource(category) ? undefined : draft.usage,
                  })
                }}
              >
                <option value="general">Habilidade</option>
                <option value="invocation">Evocação</option>
                <option value="feat">Talento</option>
                <option value="channelDivinity">Canalizar Divindade</option>
                <option value="martialArts">Artes marciais</option>
              </Select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Tipo</span>
              <Select
                value={draft.kind ?? "active"}
                onChange={(event) => {
                  const kind = event.target.value as AbilityKind
                  setDraft({
                    ...draft,
                    kind,
                    effectDuration:
                      kind === "feature"
                        ? undefined
                        : kind === "active"
                          ? "instant"
                          : "lasting",
                    effectDurationText: undefined,
                    effectPersistence: "untilEnd",
                    benefitsActive: false,
                  })
                }}
              >
                {ABILITY_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Ação</span>
              <Select
                value={draft.actionKind ?? "action"}
                disabled={draft.kind !== "active"}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    actionKind: event.target.value as AbilityActionKind,
                  })
                }
              >
                {ABILITY_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {draft.kind !== "feature" ? (
            <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-textH">
                    Duração do efeito
                  </span>
                  <Select
                    value={duration}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        effectDuration: event.target.value as AbilityEffectDuration,
                        benefitsActive: false,
                      })
                    }
                  >
                    <option value="instant">Instantânea</option>
                    <option value="lasting">Duradoura</option>
                  </Select>
                  <span className="text-[10px] text-textMuted">
                    Instantânea executa no mesmo clique. Duradoura cria uma condição ativa.
                  </span>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-textH">
                    Após o uso ou término
                  </span>
                  <Select
                    value={persistence}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        effectPersistence: event.target
                          .value as AbilityEffectPersistence,
                        benefitsActive: false,
                      })
                    }
                  >
                    <option value="untilEnd">Remover os benefícios</option>
                    <option value="permanent">Manter os benefícios</option>
                  </Select>
                  <span className="text-[10px] text-textMuted">
                    Escolha se os modificadores somem junto com o efeito ou permanecem na ficha.
                  </span>
                </label>
              </div>

              {duration === "lasting" ? (
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-textH">
                    Duração descrita
                  </span>
                  <Input
                    value={draft.effectDurationText ?? ""}
                    placeholder="Ex.: 1 minuto, até o próximo descanso, enquanto concentrar"
                    onChange={(event) =>
                      setDraft({ ...draft, effectDurationText: event.target.value })
                    }
                  />
                  <span className="text-[10px] text-textMuted">
                    Este texto aparecerá na condição criada enquanto o efeito estiver ativo.
                  </span>
                </label>
              ) : null}
            </section>
          ) : null}

          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Gatilho</span>
            <Input
              list="ability-trigger-suggestions"
              value={triggerInputValue}
              placeholder="Ex.: Quando um aliado cair a 0 PV"
              onChange={(event) => {
                const preset = ABILITY_TRIGGER_OPTIONS.find(
                  (option) => option.label === event.target.value,
                )
                setDraft({
                  ...draft,
                  trigger: (preset?.value ?? event.target.value) as Trigger,
                })
              }}
            />
            <datalist id="ability-trigger-suggestions">
              {ABILITY_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.label} />
              ))}
            </datalist>
            <span className="text-[10px] text-textMuted">
              Escolha uma sugestão ou escreva qualquer condição de acionamento.
            </span>
          </label>

          <section className="rounded-xl border border-border bg-bg-subtle p-3">
            {sharedClassResource ? (
              <div className="text-xs leading-5 text-text">
                {draft.category === "martialArts"
                  ? "Esta habilidade usa o recurso compartilhado de Ki do personagem. O máximo é calculado automaticamente pelo nível de Monge e não precisa de um contador próprio."
                  : "Esta habilidade usa o recurso compartilhado de Canalizar Divindade e não precisa de um contador próprio."}
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs font-medium text-textH">
                  <input
                    type="checkbox"
                    checked={hasUsage}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        usage: event.target.checked
                          ? { max: 1, used: 0, reset: "shortRest" }
                          : undefined,
                      })
                    }
                  />
                  Tem contador de usos
                </label>

                {hasUsage && draft.usage ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">
                        Máximo ou fórmula
                      </span>
                      <Input
                        type="text"
                        value={draft.usage.maxFormula ?? String(draft.usage.max)}
                        placeholder="Ex.: character.proficiencyBonus"
                        onChange={(event) => updateUsageMaximum(event.target.value)}
                      />
                      {maximumFormulaError ? (
                        <span className="text-[10px] text-danger">
                          {maximumFormulaError}
                        </span>
                      ) : maximumFormula ? (
                        <span className="text-[10px] text-textMuted">
                          A fórmula é recalculada com os valores atuais da ficha.
                        </span>
                      ) : null}
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Usado</span>
                      <Input
                        type="number"
                        min={0}
                        value={draft.usage.used}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            usage: {
                              ...draft.usage!,
                              used: Math.max(
                                0,
                                Math.min(
                                  draft.usage!.max,
                                  Number(event.target.value) || 0,
                                ),
                              ),
                            },
                          })
                        }
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Reset</span>
                      <Select
                        value={draft.usage.reset}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            usage: {
                              ...draft.usage!,
                              reset: event.target.value as AbilityUsageResetKind,
                            },
                          })
                        }
                      >
                        {USAGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>

                    {draft.usage.reset === "cooldown" ? (
                      <>
                        <label className="grid gap-1">
                          <span className="text-xs text-textMuted">Cooldown</span>
                          <Input
                            type="number"
                            min={1}
                            value={draft.usage.cooldownAmount ?? 1}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                usage: {
                                  ...draft.usage!,
                                  cooldownAmount: Math.max(
                                    1,
                                    Number(event.target.value) || 1,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs text-textMuted">Unidade</span>
                          <Select
                            value={draft.usage.cooldownUnit ?? "turns"}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                usage: {
                                  ...draft.usage!,
                                  cooldownUnit: event.target
                                    .value as AbilityUsageCooldownUnit,
                                },
                              })
                            }
                          >
                            {COOLDOWN_UNIT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>

          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? persistence === "permanent"
                ? "Ao acionar, os modificadores permanecem ativos mesmo após o uso ou o término da condição. A habilidade não poderá ser acionada novamente enquanto esses benefícios estiverem ativos."
                : duration === "lasting"
                  ? `${draft.kind === "active" ? "Usar" : "Acionar"} aplica o efeito e cria uma condição duradoura. Encerrar ou remover a condição encerra os modificadores.`
                  : `${draft.kind === "active" ? "Usar" : "Acionar"} executa o efeito e termina automaticamente. Alterações gravadas diretamente na ficha permanecem.`
              : draft.kind === "feature"
                ? "Esta característica não possui condição e concede seus benefícios permanentemente. Ela não aparece na seção de ações."
                : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>

          <BonusesFields
            bonuses={draft.bonuses ?? {}}
            onChange={(bonuses) => setDraft({ ...draft, bonuses })}
          />

          <GrantedProficienciesEditor
            proficiencies={draft.grantedProficiencies ?? []}
            onChange={(grantedProficiencies) =>
              setDraft({ ...draft, grantedProficiencies })
            }
          />

          <GrantedSpellsEditor
            variant="ability"
            grants={(draft.grantedSpells ?? []) as EditableSpellGrant[]}
            abilityHasUsage={hasUsage}
            onChange={(grantedSpells) =>
              setDraft({ ...draft, grantedSpells })
            }
          />
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!draft.name.trim() || Boolean(maximumFormulaError)}
            onClick={() =>
              onSave(
                normalizeAbilityActivation(normalizeAbilityText(draft)),
              )
            }
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
