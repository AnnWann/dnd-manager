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
import { getActivationOptionAbility } from "../../../models/abilities/abilityActivation"
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

export function AbilityAdvancedEffectsEditor({
  ability,
  onChange,
}: {
  ability: Ability
  onChange: (ability: Ability) => void
}) {
  const usage = ability.usage
  const condition = ability.conditionOnUse
  const options = ability.activationOptions ?? []

  function setCondition(next: CharacterConditionGrant | undefined) {
    onChange({ ...ability, conditionOnUse: next })
  }

  function updateOption(id: string, patch: Partial<AbilityActivationOption>) {
    onChange({
      ...ability,
      activationOptions: options.map((option) =>
        option.id === id ? { ...option, ...patch } : option,
      ),
    })
  }

  function updateOptionAbility(option: AbilityActivationOption, next: Ability) {
    updateOption(option.id, {
      name: next.name || option.name,
      description: next.description,
      ability: next,
      condition: undefined,
    })
  }

  return (
    <div className="grid gap-4">
      {usage ? (
        <section className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="text-xs font-semibold text-textH">Recurso compartilhado</div>
          <p className="mt-1 text-[10px] leading-4 text-textMuted">
            Habilidades com o mesmo identificador usam o mesmo contador. Gastar ou restaurar uma delas atualiza todas.
          </p>
          <label className="mt-3 flex items-center gap-2 text-xs text-textH">
            <input
              type="checkbox"
              checked={Boolean(usage.sharedResourceId)}
              onChange={(event) =>
                onChange({
                  ...ability,
                  usage: {
                    ...usage,
                    sharedResourceId: event.target.checked ? crypto.randomUUID() : undefined,
                    sharedResourceName: event.target.checked ? ability.name || "Recurso compartilhado" : undefined,
                  },
                })
              }
            />
            Compartilhar este contador com outras habilidades
          </label>
          {usage.sharedResourceId ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-textMuted">
                Nome do recurso
                <Input
                  value={usage.sharedResourceName ?? ""}
                  placeholder="Ex.: Formas lunares"
                  onChange={(event) => onChange({
                    ...ability,
                    usage: { ...usage, sharedResourceName: event.target.value },
                  })}
                />
              </label>
              <label className="grid gap-1 text-xs text-textMuted">
                Identificador compartilhado
                <Input
                  value={usage.sharedResourceId}
                  placeholder="Use o mesmo valor nas habilidades relacionadas"
                  onChange={(event) => onChange({
                    ...ability,
                    usage: { ...usage, sharedResourceId: event.target.value },
                  })}
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-bg-subtle p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-textH">Condição ao usar</div>
            <p className="mt-1 text-[10px] leading-4 text-textMuted">
              A condição pode conceder bônus, magias e proficiências enquanto estiver ativa.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCondition(condition ? undefined : createConditionGrant(ability.name))}
          >
            {condition ? "Remover" : "+ Condição"}
          </Button>
        </div>
        {condition ? (
          <div className="mt-3">
            <ConditionGrantEditor
              condition={condition}
              onChange={setCondition}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-bg-subtle p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-textH">Opções de ativação</div>
            <p className="mt-1 text-[10px] leading-4 text-textMuted">
              Cada opção é uma mini-habilidade completa. Ela pode ter tipo, ação, gatilho, duração, contador próprio, bônus, proficiências, magias e uma condição adicional.
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
                    ability: createEmbeddedAbility(name),
                  },
                ],
              })
            }}
          >
            + Mini-habilidade
          </Button>
        </div>

        {options.length ? (
          <div className="mt-3 grid gap-3">
            {options.map((option) => {
              const embedded = getActivationOptionAbility(option) ?? createEmbeddedAbility(option.name)
              return (
                <details
                  key={option.id}
                  className="rounded-xl border border-border bg-bg"
                  open={options.length === 1}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-textH">
                        {embedded.name || option.name || "Mini-habilidade"}
                      </div>
                      <div className="mt-1 text-[10px] text-textMuted">
                        {formatEmbeddedSummary(embedded)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.preventDefault()
                        onChange({
                          ...ability,
                          activationOptions: options.filter((entry) => entry.id !== option.id),
                        })
                      }}
                    >
                      Remover
                    </Button>
                  </summary>

                  <div className="border-t border-border p-3">
                    <MiniAbilityEditor
                      ability={embedded}
                      onChange={(next) => updateOptionAbility(option, next)}
                    />
                  </div>
                </details>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-textMuted">
            Sem opções. A habilidade é usada diretamente.
          </p>
        )}
      </section>
    </div>
  )
}

function MiniAbilityEditor({
  ability,
  onChange,
}: {
  ability: Ability
  onChange: (ability: Ability) => void
}) {
  const duration = ability.effectDuration ?? (ability.kind === "active" ? "instant" : "lasting")
  const persistence = ability.effectPersistence ?? "untilEnd"
  const hasUsage = Boolean(ability.usage)
  const condition = ability.conditionOnUse

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs text-textMuted">
          Nome
          <Input
            value={ability.name}
            onChange={(event) => onChange({ ...ability, name: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs text-textMuted">
          Categoria
          <Select
            value={ability.category ?? "general"}
            onChange={(event) => onChange({
              ...ability,
              category: event.target.value as AbilityCategory,
            })}
          >
            <option value="general">Habilidade</option>
            <option value="invocation">Evocação</option>
            <option value="feat">Talento</option>
            <option value="channelDivinity">Canalizar Divindade</option>
            <option value="martialArts">Artes marciais</option>
          </Select>
        </label>
      </div>

      <label className="grid gap-1 text-xs text-textMuted">
        Descrição
        <Textarea
          className="min-h-20"
          value={ability.description ?? ""}
          onChange={(event) => onChange({ ...ability, description: event.target.value })}
        />
      </label>

      <div className="grid gap-2 md:grid-cols-3">
        <label className="grid gap-1 text-xs text-textMuted">
          Tipo
          <Select
            value={ability.kind ?? "active"}
            onChange={(event) => {
              const kind = event.target.value as AbilityKind
              onChange({
                ...ability,
                kind,
                effectDuration: kind === "active" ? "instant" : kind === "feature" ? undefined : "lasting",
              })
            }}
          >
            {ABILITY_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1 text-xs text-textMuted">
          Ação
          <Select
            value={ability.actionKind ?? "free"}
            disabled={(ability.kind ?? "active") !== "active"}
            onChange={(event) => onChange({
              ...ability,
              actionKind: event.target.value as AbilityActionKind,
            })}
          >
            {ABILITY_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1 text-xs text-textMuted">
          Gatilho
          <Select
            value={ability.trigger ?? "always"}
            onChange={(event) => onChange({
              ...ability,
              trigger: event.target.value as Trigger,
            })}
          >
            {ABILITY_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs text-textMuted">
          Duração do efeito
          <Select
            value={duration}
            onChange={(event) => onChange({
              ...ability,
              effectDuration: event.target.value as AbilityEffectDuration,
            })}
          >
            <option value="instant">Instantânea</option>
            <option value="lasting">Duradoura</option>
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-textMuted">
          Após o término
          <Select
            value={persistence}
            onChange={(event) => onChange({
              ...ability,
              effectPersistence: event.target.value as AbilityEffectPersistence,
            })}
          >
            <option value="untilEnd">Remover benefícios</option>
            <option value="permanent">Manter benefícios</option>
          </Select>
        </label>
      </div>

      {duration === "lasting" ? (
        <label className="grid gap-1 text-xs text-textMuted">
          Duração descrita
          <Input
            value={ability.effectDurationText ?? ""}
            placeholder="Ex.: até o próximo descanso longo"
            onChange={(event) => onChange({ ...ability, effectDurationText: event.target.value })}
          />
        </label>
      ) : null}

      <section className="rounded-xl border border-border bg-bg-subtle p-3">
        <label className="flex items-center gap-2 text-xs font-medium text-textH">
          <input
            type="checkbox"
            checked={hasUsage}
            onChange={(event) => onChange({
              ...ability,
              usage: event.target.checked
                ? { max: 1, used: 0, reset: "longRest" }
                : undefined,
            })}
          />
          Esta opção possui contador próprio
        </label>
        {ability.usage ? (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <label className="grid gap-1 text-xs text-textMuted">
              Máximo
              <Input
                type="number"
                min={1}
                value={ability.usage.max}
                onChange={(event) => onChange({
                  ...ability,
                  usage: {
                    ...ability.usage!,
                    max: Math.max(1, Number(event.target.value) || 1),
                  },
                })}
              />
            </label>
            <label className="grid gap-1 text-xs text-textMuted">
              Usado
              <Input
                type="number"
                min={0}
                value={ability.usage.used}
                onChange={(event) => onChange({
                  ...ability,
                  usage: {
                    ...ability.usage!,
                    used: Math.max(0, Number(event.target.value) || 0),
                  },
                })}
              />
            </label>
            <label className="grid gap-1 text-xs text-textMuted">
              Recupera
              <Select
                value={ability.usage.reset}
                onChange={(event) => onChange({
                  ...ability,
                  usage: {
                    ...ability.usage!,
                    reset: event.target.value as AbilityUsageResetKind,
                  },
                })}
              >
                {USAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          </div>
        ) : null}
      </section>

      <BonusesFields
        bonuses={ability.bonuses ?? {}}
        onChange={(bonuses) => onChange({ ...ability, bonuses })}
      />

      <GrantedProficienciesEditor
        proficiencies={ability.grantedProficiencies ?? []}
        onChange={(grantedProficiencies) => onChange({ ...ability, grantedProficiencies })}
      />

      <GrantedSpellsEditor
        variant="ability"
        grants={(ability.grantedSpells ?? []) as EditableSpellGrant[]}
        abilityHasUsage={hasUsage}
        onChange={(grantedSpells) => onChange({ ...ability, grantedSpells })}
      />

      <section className="rounded-xl border border-border bg-bg-subtle p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-textH">Condição adicional</div>
            <div className="mt-1 text-[10px] text-textMuted">
              Além dos benefícios da própria mini-habilidade, aplique uma condição configurada separadamente.
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onChange({
              ...ability,
              conditionOnUse: condition ? undefined : createConditionGrant(ability.name),
            })}
          >
            {condition ? "Remover" : "+ Condição"}
          </Button>
        </div>
        {condition ? (
          <div className="mt-3">
            <ConditionGrantEditor
              condition={condition}
              onChange={(conditionOnUse) => onChange({ ...ability, conditionOnUse })}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function ConditionGrantEditor({
  condition,
  onChange,
}: {
  condition: CharacterConditionGrant
  onChange: (condition: CharacterConditionGrant) => void
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs text-textMuted">
          Nome da condição
          <Input
            value={condition.name}
            onChange={(event) => onChange({ ...condition, name: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs text-textMuted">
          Duração
          <Input
            value={condition.duration?.customLabel ?? ""}
            placeholder="Ex.: 1 minuto, até descanso longo, até ser removida"
            onChange={(event) => onChange({
              ...condition,
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
        Descrição
        <Textarea
          className="min-h-16"
          value={condition.description ?? ""}
          onChange={(event) => onChange({ ...condition, description: event.target.value })}
        />
      </label>

      <BonusesFields
        bonuses={condition.bonuses ?? {}}
        onChange={(bonuses) => onChange({ ...condition, bonuses })}
      />
      <GrantedProficienciesEditor
        proficiencies={condition.grantedProficiencies ?? []}
        onChange={(grantedProficiencies) => onChange({ ...condition, grantedProficiencies })}
      />
      <GrantedSpellsEditor
        variant="ability"
        grants={(condition.grantedSpells ?? []) as EditableSpellGrant[]}
        abilityHasUsage={false}
        onChange={(grantedSpells) => onChange({ ...condition, grantedSpells })}
      />
    </div>
  )
}

function createEmbeddedAbility(name: string): Ability {
  return {
    id: crypto.randomUUID(),
    name: name || "Mini-habilidade",
    description: "",
    kind: "active",
    category: "general",
    actionKind: "free",
    trigger: "always",
    effectDuration: "lasting",
    effectDurationText: "Até ser removida",
    effectPersistence: "untilEnd",
    bonuses: {},
    grantedSpells: [],
    grantedProficiencies: [],
    benefitsActive: false,
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
    duration: {
      type: "custom",
      customLabel: "Até ser removida",
      tickOn: "manual",
      tickOwner: "affected",
      autoRemoveAtZero: false,
    },
  }
}

function formatEmbeddedSummary(ability: Ability): string {
  const kind = ABILITY_KIND_OPTIONS.find((entry) => entry.value === (ability.kind ?? "active"))?.label ?? "Ativa"
  const action = ABILITY_ACTION_OPTIONS.find((entry) => entry.value === (ability.actionKind ?? "free"))?.label ?? "Livre"
  const duration = (ability.effectDuration ?? (ability.kind === "active" ? "instant" : "lasting")) === "lasting"
    ? ability.effectDurationText?.trim() || "Duradoura"
    : "Instantânea"
  const uses = ability.usage ? ` • ${Math.max(0, ability.usage.max - ability.usage.used)}/${ability.usage.max} usos` : ""
  return `${kind} • ${action} • ${duration}${uses}`
}
