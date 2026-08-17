import { useState, type ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type {
  Ability,
  AbilityActionKind,
  AbilityActivationOption,
  AbilityCategory,
  AbilityEffectDuration,
  AbilityEffectPersistence,
  AbilityKind,
  AbilityUsageResetKind,
  Trigger,
} from "../../../models/abilities/Ability"
import { getActivationOptionAbilities } from "../../../models/abilities/abilityActivation"
import type { CharacterConditionGrant } from "../../../models/characters/CharacterCondition"
import { BonusesFields } from "../inventory/equipmentBonusFields"
import { GrantedSpellsEditor, type EditableSpellGrant } from "../magic/grantedSpellsEditor"
import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_KIND_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

export function AbilityAdvancedEffectsEditor({ ability, onChange }: {
  ability: Ability
  onChange: (ability: Ability) => void
}) {
  const condition = ability.conditionOnUse
  const options = ability.activationOptions ?? []

  function updateOption(id: string, patch: Partial<AbilityActivationOption>) {
    onChange({
      ...ability,
      activationOptions: options.map((option) => option.id === id ? { ...option, ...patch } : option),
    })
  }

  function optionAbilities(option: AbilityActivationOption): Ability[] {
    return getActivationOptionAbilities(option)
  }

  function setOptionAbilities(option: AbilityActivationOption, abilities: Ability[]) {
    updateOption(option.id, {
      abilities,
      ability: undefined,
      condition: undefined,
    })
  }

  return (
    <div className="grid gap-4">
      <ConditionSection
        title="Condição ao usar"
        description="Aplicada automaticamente quando esta habilidade é usada."
        condition={condition}
        onToggle={() => onChange({ ...ability, conditionOnUse: condition ? undefined : createConditionGrant(ability.name) })}
        onChange={(conditionOnUse) => onChange({ ...ability, conditionOnUse })}
      />

      <section className="rounded-xl border border-border bg-bg-subtle p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-textH">Opções de ativação</div>
            <p className="mt-1 text-[10px] leading-4 text-textMuted">
              Cada opção pode conceder várias habilidades completas enquanto estiver ativa.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const name = `Opção ${options.length + 1}`
              onChange({
                ...ability,
                activationOptions: [
                  ...options,
                  {
                    id: crypto.randomUUID(),
                    name,
                    duration: createOptionDuration(ability.effectDurationText),
                    abilities: [],
                  },
                ],
              })
            }}
          >
            + Opção
          </Button>
        </div>

        {options.length ? (
          <div className="mt-3 grid gap-3">
            {options.map((option) => {
              const abilities = optionAbilities(option)
              const optionDuration = option.duration ?? option.condition?.duration ?? createOptionDuration(ability.effectDurationText)
              return (
                <details key={option.id} className="rounded-xl border border-border bg-bg" open={options.length === 1}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-textH">{option.name || "Opção"}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-textMuted">
                        <SummaryPill>{formatOptionDuration(optionDuration)}</SummaryPill>
                        <SummaryPill>{abilities.length} habilidade{abilities.length === 1 ? "" : "s"}</SummaryPill>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.preventDefault()
                        onChange({ ...ability, activationOptions: options.filter((entry) => entry.id !== option.id) })
                      }}
                    >
                      Remover
                    </Button>
                  </summary>

                  <div className="grid gap-4 border-t border-border p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1 text-xs text-textMuted">
                        Nome da opção
                        <Input value={option.name} onChange={(event) => updateOption(option.id, { name: event.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs text-textMuted">
                        Disponível por
                        <Input
                          value={optionDuration.customLabel ?? ""}
                          placeholder="Ex.: até o próximo descanso longo"
                          onChange={(event) => updateOption(option.id, {
                            duration: {
                              type: "custom",
                              customLabel: event.target.value,
                              tickOn: "manual",
                              tickOwner: "affected",
                              autoRemoveAtZero: false,
                            },
                          })}
                        />
                      </label>
                    </div>

                    <label className="grid gap-1 text-xs text-textMuted">
                      Descrição da opção
                      <Textarea
                        className="min-h-14"
                        value={option.description ?? ""}
                        placeholder="Ex.: Postura do Rato"
                        onChange={(event) => updateOption(option.id, { description: event.target.value })}
                      />
                    </label>

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <div>
                        <div className="text-xs font-semibold text-textH">Habilidades concedidas</div>
                        <p className="mt-0.5 text-[10px] text-textMuted">Ex.: Chicote de água e Medicina podem existir juntas nesta postura.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setOptionAbilities(option, [...abilities, createEmbeddedAbility(`Habilidade ${abilities.length + 1}`)])}
                      >
                        + Habilidade
                      </Button>
                    </div>

                    {abilities.length ? abilities.map((embedded, index) => (
                      <details key={embedded.id || index} className="rounded-xl border border-border bg-bg-subtle" open={abilities.length === 1}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-textH">{embedded.name || `Habilidade ${index + 1}`}</div>
                            <div className="mt-0.5 text-[10px] text-textMuted">{formatEmbeddedSummary(embedded)}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.preventDefault()
                              setOptionAbilities(option, abilities.filter((_, currentIndex) => currentIndex !== index))
                            }}
                          >
                            Remover
                          </Button>
                        </summary>
                        <div className="border-t border-border p-3">
                          <MiniAbilityEditor
                            ability={embedded}
                            onChange={(next) => setOptionAbilities(
                              option,
                              abilities.map((current, currentIndex) => currentIndex === index ? next : current),
                            )}
                          />
                        </div>
                      </details>
                    )) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-textMuted">
                        Nenhuma habilidade concedida. Adicione todas as habilidades que esta opção deve liberar.
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-textMuted">Sem opções. A habilidade é usada diretamente.</p>
        )}
      </section>
    </div>
  )
}

function MiniAbilityEditor({ ability, onChange }: { ability: Ability; onChange: (ability: Ability) => void }) {
  const [tab, setTab] = useState<"basic" | "resource" | "effects" | "grants">("basic")
  const duration = ability.effectDuration ?? (ability.kind === "active" ? "instant" : "lasting")
  const persistence = ability.effectPersistence ?? "untilEnd"
  const hasUsage = Boolean(ability.usage)
  const condition = ability.conditionOnUse
  const grantsCount = (ability.grantedSpells?.length ?? 0) + (ability.grantedProficiencies?.length ?? 0)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <div className="border-b border-border p-3">
        <div className="flex flex-wrap gap-1.5 text-[10px] text-textMuted">
          <SummaryPill>{formatEmbeddedSummary(ability)}</SummaryPill>
          {grantsCount > 0 ? <SummaryPill>{grantsCount} benefício{grantsCount === 1 ? "" : "s"}</SummaryPill> : null}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-bg-subtle p-1">
          <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>Básico</TabButton>
          <TabButton active={tab === "resource"} onClick={() => setTab("resource")} marked={hasUsage}>Recurso</TabButton>
          <TabButton active={tab === "effects"} onClick={() => setTab("effects")} marked={Boolean(condition)}>Efeitos</TabButton>
          <TabButton active={tab === "grants"} onClick={() => setTab("grants")} marked={grantsCount > 0}>Concede</TabButton>
        </div>
      </div>

      <div className="p-3">
        {tab === "basic" ? (
          <div className="grid gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-textMuted">Nome<Input value={ability.name} onChange={(event) => onChange({ ...ability, name: event.target.value })} /></label>
              <label className="grid gap-1 text-xs text-textMuted">
                Categoria
                <Select value={ability.category ?? "general"} onChange={(event) => onChange({ ...ability, category: event.target.value as AbilityCategory })}>
                  <option value="general">Habilidade</option>
                  <option value="invocation">Evocação</option>
                  <option value="feat">Talento</option>
                  <option value="channelDivinity">Canalizar Divindade</option>
                  <option value="martialArts">Artes marciais</option>
                </Select>
              </label>
            </div>
            <label className="grid gap-1 text-xs text-textMuted">Descrição<Textarea className="min-h-20" value={ability.description ?? ""} onChange={(event) => onChange({ ...ability, description: event.target.value })} /></label>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="grid gap-1 text-xs text-textMuted">Tipo<Select value={ability.kind ?? "active"} onChange={(event) => { const kind = event.target.value as AbilityKind; onChange({ ...ability, kind, effectDuration: kind === "active" ? "instant" : kind === "feature" ? undefined : "lasting" }) }}>{ABILITY_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
              <label className="grid gap-1 text-xs text-textMuted">Ação<Select value={ability.actionKind ?? "free"} disabled={(ability.kind ?? "active") !== "active"} onChange={(event) => onChange({ ...ability, actionKind: event.target.value as AbilityActionKind })}>{ABILITY_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
              <label className="grid gap-1 text-xs text-textMuted">Gatilho<Select value={ability.trigger ?? "always"} onChange={(event) => onChange({ ...ability, trigger: event.target.value as Trigger })}>{ABILITY_TRIGGER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-textMuted">Duração do efeito<Select value={duration} onChange={(event) => onChange({ ...ability, effectDuration: event.target.value as AbilityEffectDuration })}><option value="instant">Instantânea</option><option value="lasting">Duradoura</option></Select></label>
              <label className="grid gap-1 text-xs text-textMuted">Ao terminar<Select value={persistence} onChange={(event) => onChange({ ...ability, effectPersistence: event.target.value as AbilityEffectPersistence })}><option value="untilEnd">Remover benefícios</option><option value="permanent">Manter benefícios</option></Select></label>
            </div>
          </div>
        ) : null}

        {tab === "resource" ? (
          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-textH">
              <input type="checkbox" checked={hasUsage} onChange={(event) => onChange({ ...ability, usage: event.target.checked ? { max: 1, used: 0, reset: "longRest" } : undefined })} />
              Possui contador próprio
            </label>
            {ability.usage ? (
              <div className="grid gap-2 md:grid-cols-3">
                <label className="grid gap-1 text-xs text-textMuted">Máximo<Input type="number" min={1} value={ability.usage.max} onChange={(event) => onChange({ ...ability, usage: { ...ability.usage!, max: Math.max(1, Number(event.target.value) || 1) } })} /></label>
                <label className="grid gap-1 text-xs text-textMuted">Usado<Input type="number" min={0} value={ability.usage.used} onChange={(event) => onChange({ ...ability, usage: { ...ability.usage!, used: Math.max(0, Number(event.target.value) || 0) } })} /></label>
                <label className="grid gap-1 text-xs text-textMuted">Recupera<Select value={ability.usage.reset} onChange={(event) => onChange({ ...ability, usage: { ...ability.usage!, reset: event.target.value as AbilityUsageResetKind } })}>{USAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
              </div>
            ) : <p className="text-xs text-textMuted">Sem contador próprio.</p>}
          </div>
        ) : null}

        {tab === "effects" ? (
          <div className="grid gap-3">
            <BonusesFields bonuses={ability.bonuses ?? {}} onChange={(bonuses) => onChange({ ...ability, bonuses })} />
            <ConditionSection
              title="Condição ao usar"
              description="É aplicada quando esta habilidade concedida é usada."
              condition={condition}
              onToggle={() => onChange({ ...ability, conditionOnUse: condition ? undefined : createConditionGrant(ability.name) })}
              onChange={(conditionOnUse) => onChange({ ...ability, conditionOnUse })}
            />
          </div>
        ) : null}

        {tab === "grants" ? (
          <div className="grid gap-3">
            <GrantedProficienciesEditor proficiencies={ability.grantedProficiencies ?? []} onChange={(grantedProficiencies) => onChange({ ...ability, grantedProficiencies })} />
            <GrantedSpellsEditor variant="ability" grants={(ability.grantedSpells ?? []) as EditableSpellGrant[]} abilityHasUsage={hasUsage} onChange={(grantedSpells) => onChange({ ...ability, grantedSpells })} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ConditionSection({ title, description, condition, onToggle, onChange }: {
  title: string
  description: string
  condition?: CharacterConditionGrant
  onToggle: () => void
  onChange: (condition: CharacterConditionGrant) => void
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-textH">{title}</div>
          <p className="mt-1 text-[10px] text-textMuted">{description}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onToggle}>{condition ? "Remover" : "+ Condição"}</Button>
      </div>
      {condition ? <div className="mt-3"><ConditionGrantEditor condition={condition} onChange={onChange} /></div> : null}
    </section>
  )
}

function ConditionGrantEditor({ condition, onChange }: { condition: CharacterConditionGrant; onChange: (condition: CharacterConditionGrant) => void }) {
  const [tab, setTab] = useState<"basic" | "bonuses" | "grants">("basic")
  const spellCount = condition.grantedSpells?.length ?? 0
  const proficiencyCount = condition.grantedProficiencies?.length ?? 0
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <div className="grid grid-cols-3 gap-1 border-b border-border bg-bg-subtle p-2">
        <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>Geral</TabButton>
        <TabButton active={tab === "bonuses"} onClick={() => setTab("bonuses")}>Bônus</TabButton>
        <TabButton active={tab === "grants"} onClick={() => setTab("grants")} marked={spellCount + proficiencyCount > 0}>Concede</TabButton>
      </div>
      <div className="p-3">
        {tab === "basic" ? <div className="grid gap-3"><div className="grid gap-2 md:grid-cols-2"><label className="grid gap-1 text-xs text-textMuted">Nome<Input value={condition.name} onChange={(event) => onChange({ ...condition, name: event.target.value })} /></label><label className="grid gap-1 text-xs text-textMuted">Duração<Input value={condition.duration?.customLabel ?? ""} onChange={(event) => onChange({ ...condition, duration: { type: "custom", customLabel: event.target.value, tickOn: "manual", tickOwner: "affected", autoRemoveAtZero: false } })} /></label></div><label className="grid gap-1 text-xs text-textMuted">Descrição<Textarea value={condition.description ?? ""} onChange={(event) => onChange({ ...condition, description: event.target.value })} /></label></div> : null}
        {tab === "bonuses" ? <BonusesFields bonuses={condition.bonuses ?? {}} onChange={(bonuses) => onChange({ ...condition, bonuses })} /> : null}
        {tab === "grants" ? <div className="grid gap-3"><GrantedProficienciesEditor proficiencies={condition.grantedProficiencies ?? []} onChange={(grantedProficiencies) => onChange({ ...condition, grantedProficiencies })} /><GrantedSpellsEditor variant="ability" grants={(condition.grantedSpells ?? []) as EditableSpellGrant[]} abilityHasUsage={false} onChange={(grantedSpells) => onChange({ ...condition, grantedSpells })} /></div> : null}
      </div>
    </div>
  )
}

function TabButton({ active, marked, onClick, children }: { active: boolean; marked?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`relative rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${active ? "bg-bg-elevated text-textH shadow-sm" : "text-textMuted hover:text-textH"}`}>{children}{marked ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" /> : null}</button>
}

function SummaryPill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-border bg-bg-elevated px-2 py-0.5">{children}</span>
}

function createEmbeddedAbility(name: string): Ability {
  return {
    id: crypto.randomUUID(),
    name: name || "Mini-habilidade",
    description: "",
    kind: "active",
    category: "general",
    actionKind: "action",
    trigger: "always",
    effectDuration: "instant",
    effectPersistence: "untilEnd",
    bonuses: {},
    grantedSpells: [],
    grantedProficiencies: [],
  }
}

function createConditionGrant(name: string): CharacterConditionGrant {
  return {
    name: name || "Efeito",
    description: "",
    tags: ["Habilidade"],
    bonuses: {},
    grantedSpells: [],
    grantedProficiencies: [],
    duration: createOptionDuration(),
  }
}

function createOptionDuration(label?: string) {
  return { type: "custom" as const, customLabel: label?.trim() || "Até ser removida", tickOn: "manual" as const, tickOwner: "affected" as const, autoRemoveAtZero: false }
}

function formatOptionDuration(duration: { type: string; customLabel?: string }): string {
  if (duration.type === "permanent") return "Permanente"
  return duration.customLabel?.trim() || duration.type
}

function formatEmbeddedSummary(ability: Ability): string {
  const kind = ABILITY_KIND_OPTIONS.find((entry) => entry.value === (ability.kind ?? "active"))?.label ?? "Ativa"
  const action = (ability.kind ?? "active") === "active" ? ABILITY_ACTION_OPTIONS.find((entry) => entry.value === (ability.actionKind ?? "free"))?.label ?? "Livre" : "benefício"
  return `${kind} • ${action}`
}
