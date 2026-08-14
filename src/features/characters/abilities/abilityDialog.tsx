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
import { AbilityAdvancedEffectsEditor } from "./abilityAdvancedEffectsEditor"
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

type EditorTab = "basic" | "resource" | "effects" | "grants"

const EDITOR_TABS: Array<{ value: EditorTab; label: string }> = [
  { value: "basic", label: "Básico" },
  { value: "resource", label: "Recurso" },
  { value: "effects", label: "Efeitos" },
  { value: "grants", label: "Concede" },
]

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

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-textH">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
    </div>
  )
}

function SummaryPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[10px] font-medium text-textMuted">
      {children}
    </span>
  )
}

export function AbilityDialog({ open, ability, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Ability>(() => ability ?? createEmptyAbility())
  const [tab, setTab] = useState<EditorTab>("basic")

  useEffect(() => {
    if (!open) return
    setDraft(ability ?? createEmptyAbility())
    setTab("basic")
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
  const duration = draft.effectDuration ?? (draft.kind === "active" ? "instant" : "lasting")
  const persistence = draft.effectPersistence ?? "untilEnd"
  const triggerInputValue =
    ABILITY_TRIGGER_OPTIONS.find((option) => option.value === (draft.trigger ?? "always"))?.label ??
    draft.trigger ??
    ""

  const grantedCount =
    (draft.grantedSpells?.length ?? 0) + (draft.grantedProficiencies?.length ?? 0)
  const hasAdvancedEffects =
    Boolean(draft.conditionOnUse) ||
    (draft.activationOptions?.length ?? 0) > 0 ||
    Object.values(draft.bonuses ?? {}).some((value) => Array.isArray(value) && value.length > 0)

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

    setDraft({ ...draft, usage: { ...draft.usage, maxFormula: rawValue } })
  }

  function save() {
    onSave(normalizeAbilityActivation(normalizeAbilityText(draft)))
  }

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-2 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ability ? "Editar habilidade" : "Adicionar habilidade"}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="shrink-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-textH">
                {ability ? "Editar habilidade" : "Adicionar habilidade"}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <SummaryPill>{ABILITY_KIND_OPTIONS.find((item) => item.value === draft.kind)?.label ?? "Habilidade"}</SummaryPill>
                <SummaryPill>{ABILITY_ACTION_OPTIONS.find((item) => item.value === draft.actionKind)?.label ?? "Sem ação"}</SummaryPill>
                {hasUsage ? <SummaryPill>{draft.usage?.maxFormula || `${draft.usage?.max ?? 0} uso(s)`}</SummaryPill> : null}
                {sharedClassResource ? <SummaryPill>{draft.category === "martialArts" ? "Ki" : "Canalizar Divindade"}</SummaryPill> : null}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
          </div>

          <nav className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-bg-subtle p-1" aria-label="Seções da habilidade">
            {EDITOR_TABS.map((item) => {
              const badge = item.value === "effects" && hasAdvancedEffects
                ? "•"
                : item.value === "grants" && grantedCount > 0
                  ? String(grantedCount)
                  : undefined
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    tab === item.value
                      ? "bg-accentBg text-accent"
                      : "text-textMuted hover:bg-bg-elevated hover:text-textH"
                  }`}
                >
                  {item.label}{badge ? ` ${badge}` : ""}
                </button>
              )
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {tab === "basic" ? (
            <div className="grid gap-4">
              <SectionIntro
                title="Identidade e funcionamento"
                description="Defina o que a habilidade é e quando pode ser usada. Os detalhes avançados ficam nas outras abas."
              />

              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Nome</span>
                <Input
                  autoFocus
                  value={draft.name}
                  placeholder="Ex.: Encarnação Lunar"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Descrição</span>
                <Textarea
                  className="min-h-28"
                  value={draft.description ?? ""}
                  placeholder="Descreva a regra da habilidade em linguagem natural."
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-3">
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
                          kind === "feature" ? undefined : kind === "active" ? "instant" : "lasting",
                        effectDurationText: undefined,
                        effectPersistence: "untilEnd",
                        benefitsActive: false,
                      })
                    }}
                  >
                    {ABILITY_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-textH">Ação</span>
                  <Select
                    value={draft.actionKind ?? "action"}
                    disabled={draft.kind !== "active"}
                    onChange={(event) => setDraft({ ...draft, actionKind: event.target.value as AbilityActionKind })}
                  >
                    {ABILITY_ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Gatilho</span>
                <Input
                  list="ability-trigger-suggestions"
                  value={triggerInputValue}
                  placeholder="Ex.: Quando um aliado cair a 0 PV"
                  onChange={(event) => {
                    const preset = ABILITY_TRIGGER_OPTIONS.find((option) => option.label === event.target.value)
                    setDraft({ ...draft, trigger: (preset?.value ?? event.target.value) as Trigger })
                  }}
                />
                <datalist id="ability-trigger-suggestions">
                  {ABILITY_TRIGGER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.label} />
                  ))}
                </datalist>
              </label>

              {draft.kind !== "feature" ? (
                <div className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-textH">Duração do efeito</span>
                      <Select
                        value={duration}
                        onChange={(event) => setDraft({
                          ...draft,
                          effectDuration: event.target.value as AbilityEffectDuration,
                          benefitsActive: false,
                        })}
                      >
                        <option value="instant">Instantânea</option>
                        <option value="lasting">Duradoura</option>
                      </Select>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-textH">Ao terminar</span>
                      <Select
                        value={persistence}
                        onChange={(event) => setDraft({
                          ...draft,
                          effectPersistence: event.target.value as AbilityEffectPersistence,
                          benefitsActive: false,
                        })}
                      >
                        <option value="untilEnd">Remover benefícios</option>
                        <option value="permanent">Manter benefícios</option>
                      </Select>
                    </label>
                  </div>

                  {duration === "lasting" ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-textH">Duração descrita</span>
                      <Input
                        value={draft.effectDurationText ?? ""}
                        placeholder="Ex.: 1 minuto, até o próximo descanso"
                        onChange={(event) => setDraft({ ...draft, effectDurationText: event.target.value })}
                      />
                    </label>
                  ) : null}

                  <p className="text-[11px] leading-5 text-textMuted">
                    {requiresActivation
                      ? persistence === "permanent"
                        ? "Os benefícios continuam mesmo após o efeito terminar."
                        : duration === "lasting"
                          ? "Ao usar, o sistema cria uma condição para controlar a duração."
                          : "O efeito é resolvido imediatamente no uso."
                      : "Os benefícios ficam ativos sem exigir uso manual."}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "resource" ? (
            <div className="grid gap-4">
              <SectionIntro
                title="Usos e recurso"
                description="Configure apenas se a habilidade precisar gastar alguma carga. Recursos de classe compartilhados são tratados automaticamente."
              />

              {sharedClassResource ? (
                <div className="rounded-xl border border-accentBorder bg-accentBg p-4">
                  <div className="text-sm font-semibold text-textH">
                    {draft.category === "martialArts" ? "Usa Ki" : "Usa Canalizar Divindade"}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-textMuted">
                    O contador é compartilhado entre todas as habilidades desta categoria e calculado pelo personagem.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-bg-subtle p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-xs font-semibold text-textH">Contador de usos</span>
                      <span className="mt-0.5 block text-[11px] text-textMuted">Ative para limitar quantas vezes a habilidade pode ser usada.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={hasUsage}
                      onChange={(event) => setDraft({
                        ...draft,
                        usage: event.target.checked ? { max: 1, used: 0, reset: "shortRest" } : undefined,
                      })}
                    />
                  </label>

                  {hasUsage && draft.usage ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs text-textMuted">Máximo ou fórmula</span>
                        <Input
                          type="text"
                          value={draft.usage.maxFormula ?? String(draft.usage.max)}
                          placeholder="Ex.: character.proficiencyBonus"
                          onChange={(event) => updateUsageMaximum(event.target.value)}
                        />
                        {maximumFormulaError ? (
                          <span className="text-[10px] text-danger">{maximumFormulaError}</span>
                        ) : maximumFormula ? (
                          <span className="text-[10px] text-textMuted">Recalculado pelos valores atuais da ficha.</span>
                        ) : null}
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs text-textMuted">Usos já gastos</span>
                        <Input
                          type="number"
                          min={0}
                          value={draft.usage.used}
                          onChange={(event) => setDraft({
                            ...draft,
                            usage: {
                              ...draft.usage!,
                              used: Math.max(0, Math.min(draft.usage!.max, Number(event.target.value) || 0)),
                            },
                          })}
                        />
                      </label>

                      <label className="grid gap-1 sm:col-span-2">
                        <span className="text-xs text-textMuted">Recupera em</span>
                        <Select
                          value={draft.usage.reset}
                          onChange={(event) => setDraft({
                            ...draft,
                            usage: { ...draft.usage!, reset: event.target.value as AbilityUsageResetKind },
                          })}
                        >
                          {USAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
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
                              onChange={(event) => setDraft({
                                ...draft,
                                usage: {
                                  ...draft.usage!,
                                  cooldownAmount: Math.max(1, Number(event.target.value) || 1),
                                },
                              })}
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-xs text-textMuted">Unidade</span>
                            <Select
                              value={draft.usage.cooldownUnit ?? "turns"}
                              onChange={(event) => setDraft({
                                ...draft,
                                usage: {
                                  ...draft.usage!,
                                  cooldownUnit: event.target.value as AbilityUsageCooldownUnit,
                                },
                              })}
                            >
                              {COOLDOWN_UNIT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {tab === "effects" ? (
            <div className="grid gap-4">
              <SectionIntro
                title="Efeitos"
                description="Tudo que acontece ao usar ou manter a habilidade: bônus, condições e opções de ativação."
              />
              <AbilityAdvancedEffectsEditor ability={draft} onChange={setDraft} />
              <div className="border-t border-border pt-4">
                <BonusesFields
                  bonuses={draft.bonuses ?? {}}
                  onChange={(bonuses) => setDraft({ ...draft, bonuses })}
                />
              </div>
            </div>
          ) : null}

          {tab === "grants" ? (
            <div className="grid gap-5">
              <SectionIntro
                title="Benefícios concedidos"
                description="Adicione apenas o que a habilidade concede ao personagem: proficiências e magias."
              />
              <GrantedProficienciesEditor
                proficiencies={draft.grantedProficiencies ?? []}
                onChange={(grantedProficiencies) => setDraft({ ...draft, grantedProficiencies })}
              />
              <div className="border-t border-border pt-4">
                <GrantedSpellsEditor
                  variant="ability"
                  grants={(draft.grantedSpells ?? []) as EditableSpellGrant[]}
                  abilityHasUsage={hasUsage}
                  onChange={(grantedSpells) => setDraft({ ...draft, grantedSpells })}
                />
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-bg-elevated px-4 py-3 sm:px-5">
          <span className="hidden text-[11px] text-textMuted sm:block">
            {draft.name.trim() ? "As alterações são aplicadas ao salvar." : "Dê um nome para salvar a habilidade."}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!draft.name.trim() || Boolean(maximumFormulaError)}
              onClick={save}
            >
              Salvar
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
