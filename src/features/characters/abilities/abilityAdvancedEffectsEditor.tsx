import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import type { Ability, AbilityActivationOption } from "../../../models/abilities/Ability"
import type { CharacterConditionGrant } from "../../../models/characters/CharacterCondition"
import { BonusesFields } from "../inventory/equipmentBonusFields"
import { GrantedSpellsEditor, type EditableSpellGrant } from "../magic/grantedSpellsEditor"
import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"

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
            <div className="text-xs font-semibold text-textH">Efeitos opcionais</div>
            <p className="mt-1 text-[10px] leading-4 text-textMuted">
              Ao usar a habilidade, o sistema abre um modal para escolher uma destas opções. Cada opção pode aplicar sua própria condição e benefícios.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onChange({
              ...ability,
              activationOptions: [
                ...options,
                {
                  id: crypto.randomUUID(),
                  name: `Opção ${options.length + 1}`,
                  condition: createConditionGrant(`Opção ${options.length + 1}`),
                },
              ],
            })}
          >
            + Opção
          </Button>
        </div>

        {options.length ? (
          <div className="mt-3 grid gap-3">
            {options.map((option) => (
              <div key={option.id} className="rounded-xl border border-border bg-bg p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="grid gap-2">
                    <label className="grid gap-1 text-xs text-textMuted">
                      Nome da opção
                      <Input
                        value={option.name}
                        onChange={(event) => updateOption(option.id, { name: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-textMuted">
                      Descrição da escolha
                      <Textarea
                        className="min-h-16"
                        value={option.description ?? ""}
                        onChange={(event) => updateOption(option.id, { description: event.target.value })}
                      />
                    </label>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({
                      ...ability,
                      activationOptions: options.filter((entry) => entry.id !== option.id),
                    })}
                  >
                    Remover
                  </Button>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <ConditionGrantEditor
                    condition={option.condition ?? createConditionGrant(option.name)}
                    onChange={(next) => updateOption(option.id, { condition: next })}
                  />
                </div>
              </div>
            ))}
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
