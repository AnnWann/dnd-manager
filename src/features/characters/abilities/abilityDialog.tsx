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
  title?: string
  fixedCategory?: AbilityCategory
}

function createEmptyAbility(category: AbilityCategory = "general"): Ability {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    kind: "feature",
    category,
    actionKind: "action",
    effectDuration: undefined,
    effectPersistence: "untilEnd",
    trigger: "always",
    grantedSpells: [],
    grantedProficiencies: [],
    bonuses: {},
    benefitsActive: false,
  }
}

export function AbilityDialog({
  open,
  ability,
  onClose,
  onSave,
  title,
  fixedCategory,
}: Props) {
  const [draft, setDraft] = useState<Ability>(() => ({
    ...(ability ?? createEmptyAbility(fixedCategory)),
    category: fixedCategory ?? ability?.category ?? "general",
  }))

  useEffect(() => {
    if (!open) return
    setDraft({
      ...(ability ?? createEmptyAbility(fixedCategory)),
      category: fixedCategory ?? ability?.category ?? "general",
    })
  }, [ability, fixedCategory, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const hasUsage = draft.usage !== undefined
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
  const dialogTitle =
    title ?? (ability ? "Editar habilidade" : "Adicionar habilidade")

  function changeKind(kind: AbilityKind) {
    setDraft({
      ...draft,
      kind,
      actionKind:
        kind === "active" ? draft.actionKind ?? "action" : draft.actionKind,
      effectDuration:
        kind === "feature"
          ? undefined
          : draft.effectDuration ??
            (kind === "active" ? "instant" : "lasting"),
      effectDurationText:
        kind === "feature" ? undefined : draft.effectDurationText,
      effectPersistence: draft.effectPersistence ?? "untilEnd",
      benefitsActive: false,
    })
  }

  function updateUsageMaximum(rawValue: string) {
    if (!draft.usage) return
    const numeric = Number(rawValue)
    if (!rawValue.trim() || !Number.isFinite(numeric)) return
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
  }

  function save() {
    const normalized = normalizeAbilityActivation(
      normalizeAbilityText({
        ...draft,
        category: fixedCategory ?? draft.category ?? "general",
      }),
    )
    onSave(normalized)
  }

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-textH">{dialogTitle}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Nome</span>
            <Input
              autoFocus
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Descrição</span>
            <Textarea
              className="min-h-28"
              value={draft.description ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            {fixedCategory ? (
              <div className="grid gap-1">
                <span className="text-xs font-medium text-textH">Categoria</span>
                <div className="flex h-9 items-center rounded-xl border border-border bg-bg-subtle px-3 text-sm text-text">
                  {formatCategory(fixedCategory)}
                </div>
              </div>
            ) : (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Categoria</span>
                <Select
                  value={draft.category === "feat" ? "general" : draft.category ?? "general"}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      category: event.target.value as AbilityCategory,
                    })
                  }
                >
                  <option value="general">Habilidade</option>
                  <option value="channelDivinity">Canalizar Divindade</option>
                </Select>
              </label>
            )}

            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Tipo</span>
              <Select
                value={draft.kind ?? "feature"}
                onChange={(event) =>
                  changeKind(event.target.value as AbilityKind)
                }
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

          <section className="rounded-xl border border-border bg-bg-subtle p-3">
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
              Possui limite de usos
            </label>

            {draft.usage ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs text-textMuted">Usos máximos</span>
                  <Input
                    type="number"
                    min={1}
                    value={draft.usage.max}
                    onChange={(event) => updateUsageMaximum(event.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-textMuted">Recupera em</span>
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
              </div>
            ) : null}
          </section>

          <details className="rounded-xl border border-border bg-bg p-3">
            <summary className="cursor-pointer text-sm font-semibold text-textH">
              Opções avançadas
            </summary>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Gatilho</span>
                <Input
                  list="ability-trigger-suggestions"
                  value={triggerInputValue}
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
              </label>

              {draft.kind !== "feature" ? (
                <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Duração</span>
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
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Após o término</span>
                      <Select
                        value={persistence}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            effectPersistence: event.target.value as AbilityEffectPersistence,
                            benefitsActive: false,
                          })
                        }
                      >
                        <option value="untilEnd">Remover benefícios</option>
                        <option value="permanent">Manter benefícios</option>
                      </Select>
                    </label>
                  </div>
                  {duration === "lasting" ? (
                    <Input
                      value={draft.effectDurationText ?? ""}
                      placeholder="Duração descrita"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          effectDurationText: event.target.value,
                        })
                      }
                    />
                  ) : null}
                </section>
              ) : null}

              {draft.usage ? (
                <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Fórmula do máximo</span>
                      <Input
                        value={draft.usage.maxFormula ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            usage: {
                              ...draft.usage!,
                              maxFormula: event.target.value || undefined,
                            },
                          })
                        }
                      />
                      {maximumFormulaError ? (
                        <span className="text-[10px] text-danger">
                          {maximumFormulaError}
                        </span>
                      ) : null}
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Usos gastos</span>
                      <Input
                        type="number"
                        min={0}
                        value={draft.usage.used}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            usage: {
                              ...draft.usage!,
                              used: Math.max(0, Number(event.target.value) || 0),
                            },
                          })
                        }
                      />
                    </label>
                  </div>

                  {draft.usage.reset === "cooldown" ? (
                    <div className="grid gap-2 md:grid-cols-2">
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
                      <Select
                        value={draft.usage.cooldownUnit ?? "turns"}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            usage: {
                              ...draft.usage!,
                              cooldownUnit: event.target.value as AbilityUsageCooldownUnit,
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
                    </div>
                  ) : null}
                </section>
              ) : null}

              <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
                {requiresActivation
                  ? persistence === "permanent"
                    ? "Ao acionar, os modificadores permanecem ativos."
                    : duration === "lasting"
                      ? "Ao acionar, a habilidade cria um efeito duradouro."
                      : "Ao acionar, o efeito é executado imediatamente."
                  : "A característica concede seus benefícios sem ativação."}
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
          </details>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!draft.name.trim() || Boolean(maximumFormulaError)}
            onClick={save}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function formatCategory(category: AbilityCategory): string {
  switch (category) {
    case "invocation":
      return "Evocação"
    case "feat":
      return "Talento"
    case "channelDivinity":
      return "Canalizar Divindade"
    default:
      return "Habilidade"
  }
}
