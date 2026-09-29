import { Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"

import { Select } from "../../components/ui/Select"
import {
  validateCustomFormula,
  listCustomFormulaVariables,
} from "../../lib/customSystems"
import {
  validateCustomAbilityDiceSource,
} from "../../lib/customSystems/CustomAbilityRoll"
import type {
  CustomAbilityDamageRollDefinition,
  CustomAbilityRollDefinition,
  CustomAbilityRollKind,
  CustomAbilityTypeDefinition,
} from "../../models/customSystems/CustomAbilityDefinition"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { Attribute } from "../../models/sheet/Attribute"
import type { Skill } from "../../models/sheet/Skills"
import { FormulaVariablePicker } from "./FormulaVariablePicker"

const ATTRIBUTES: ReadonlyArray<readonly [Attribute, string]> = [
  ["str", "Força"],
  ["dex", "Destreza"],
  ["con", "Constituição"],
  ["int", "Inteligência"],
  ["wis", "Sabedoria"],
  ["cha", "Carisma"],
]

const SKILLS: ReadonlyArray<readonly [Skill, string]> = [
  ["acrobatics", "Acrobacia"],
  ["animalHandling", "Adestrar Animais"],
  ["arcana", "Arcanismo"],
  ["athletics", "Atletismo"],
  ["deception", "Enganação"],
  ["history", "História"],
  ["insight", "Intuição"],
  ["intimidation", "Intimidação"],
  ["investigation", "Investigação"],
  ["medicine", "Medicina"],
  ["nature", "Natureza"],
  ["perception", "Percepção"],
  ["performance", "Atuação"],
  ["persuasion", "Persuasão"],
  ["religion", "Religião"],
  ["sleightOfHand", "Prestidigitação"],
  ["stealth", "Furtividade"],
  ["survival", "Sobrevivência"],
]

const ROLL_KINDS: ReadonlyArray<readonly [CustomAbilityRollKind, string]> = [
  ["generic", "Rolagem genérica"],
  ["attack", "Ataque"],
  ["abilityCheck", "Teste de habilidade/perícia"],
  ["savingThrow", "Teste de resistência do usuário"],
  ["targetSave", "Teste de resistência do alvo (CD)"],
  ["damage", "Somente dano"],
]

export function CustomRollBehaviorFields({
  definition,
  abilityType,
  roll,
  onChange,
}: {
  definition: CustomSystemDefinition
  abilityType?: CustomAbilityTypeDefinition
  roll: CustomAbilityRollDefinition
  onChange: (roll: CustomAbilityRollDefinition) => void
}) {
  const kind = roll.kind ?? "generic"
  const formulaAbilityType: CustomAbilityTypeDefinition =
    abilityType ?? {
      id: "__system-action-roll",
      name: "Rolagem da ação",
      fields: [],
      display: { titleFieldId: "" },
      activation: { roll },
    }
  const variables = listCustomFormulaVariables(
    definition,
    formulaAbilityType,
  )
  const diceVariables = variables.filter((entry) => entry.valueType === "dice")
  const needsD20 =
    kind === "attack"
    || kind === "abilityCheck"
    || kind === "savingThrow"
  const primaryDiceError =
    kind === "generic"
      ? validateCustomAbilityDiceSource(roll.dice, definition, abilityType)
      : undefined
  const modifierError = roll.modifierFormula?.trim()
    ? validateCustomFormula(
        roll.modifierFormula,
        definition,
        formulaAbilityType,
      )
    : undefined
  const dcError = roll.dcFormula?.trim()
    ? validateCustomFormula(
        roll.dcFormula,
        definition,
        formulaAbilityType,
      )
    : undefined

  function patch(patchValue: Partial<CustomAbilityRollDefinition>) {
    onChange({ ...roll, ...patchValue })
  }

  function setKind(nextKind: CustomAbilityRollKind) {
    const next: CustomAbilityRollDefinition = {
      ...roll,
      kind: nextKind,
    }

    if (nextKind === "generic") {
      next.dice = roll.dice?.trim() ? roll.dice : "1d6"
    }
    if (
      nextKind === "attack"
      || nextKind === "abilityCheck"
      || nextKind === "savingThrow"
    ) {
      next.dice = undefined
      next.d20Mode = roll.d20Mode ?? "normal"
      next.attribute =
        roll.attribute
        ?? (nextKind === "savingThrow" ? "con" : "str")
    }
    if (nextKind === "attack") {
      next.proficient = roll.proficient !== false
    }
    if (nextKind === "targetSave") {
      next.dice = undefined
      next.saveAttribute = roll.saveAttribute ?? roll.attribute ?? "str"
      next.onSave = roll.onSave ?? "none"
    }
    if (nextKind === "damage") {
      next.dice = undefined
      next.damage =
        roll.damage?.length
          ? roll.damage
          : [newDamageComponent()]
    }

    onChange(next)
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Comportamento">
          <Select
            className="input-base"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as CustomAbilityRollKind)
            }
          >
            {ROLL_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Quem resolve os dados">
          <Select
            className="input-base"
            value={roll.mode}
            onChange={(event) =>
              patch({
                mode: event.target.value as CustomAbilityRollDefinition["mode"],
              })
            }
          >
            <option value="automatic">Sistema / dados digitais</option>
            <option value="manual">Jogador / dados físicos</option>
          </Select>
        </Field>

        <Field label="Rótulo da rolagem">
          <input
            className="input-base"
            value={roll.label ?? ""}
            placeholder="Ex.: Ataque da técnica"
            onChange={(event) =>
              patch({ label: event.target.value || undefined })
            }
          />
        </Field>
      </div>

      {needsD20 ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Modo do d20">
            <Select
              className="input-base"
              value={roll.d20Mode ?? "normal"}
              onChange={(event) =>
                patch({
                  d20Mode:
                    event.target.value as NonNullable<
                      CustomAbilityRollDefinition["d20Mode"]
                    >,
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="advantage">Vantagem</option>
              <option value="disadvantage">Desvantagem</option>
            </Select>
          </Field>

          {kind === "abilityCheck" ? (
            <Field label="Origem do teste">
              <Select
                className="input-base"
                value={roll.skill ? "skill" : "attribute"}
                onChange={(event) =>
                  event.target.value === "skill"
                    ? patch({
                        skill: roll.skill ?? "athletics",
                        attribute: undefined,
                      })
                    : patch({
                        skill: undefined,
                        attribute: roll.attribute ?? "str",
                      })
                }
              >
                <option value="attribute">Atributo</option>
                <option value="skill">Perícia</option>
              </Select>
            </Field>
          ) : null}

          {kind === "abilityCheck" && roll.skill ? (
            <Field label="Perícia">
              <Select
                className="input-base"
                value={roll.skill}
                onChange={(event) =>
                  patch({ skill: event.target.value as Skill })
                }
              >
                {SKILLS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field
              label={
                kind === "attack"
                  ? "Atributo do ataque"
                  : kind === "savingThrow"
                    ? "Atributo da resistência"
                    : "Atributo do teste"
              }
            >
              <Select
                className="input-base"
                value={roll.attribute ?? (kind === "savingThrow" ? "con" : "str")}
                onChange={(event) =>
                  patch({ attribute: event.target.value as Attribute })
                }
              >
                {ATTRIBUTES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {kind === "attack" ? (
            <label className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textH">
              <input
                type="checkbox"
                checked={roll.proficient !== false}
                onChange={(event) =>
                  patch({ proficient: event.target.checked })
                }
              />
              Somar bônus de proficiência
            </label>
          ) : null}
        </div>
      ) : null}

      {kind === "generic" ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field label={roll.mode === "manual" ? "Dados / instrução" : "Dados"}>
            <input
              className="input-base font-mono"
              value={roll.dice ?? ""}
              placeholder="1d6"
              onChange={(event) =>
                patch({ dice: event.target.value || undefined })
              }
            />
          </Field>
          {diceVariables.length ? (
            <FormulaVariablePicker
              variables={diceVariables}
              buttonLabel="Selecionar variável de dado"
              onSelect={(path) => patch({ dice: path })}
            />
          ) : null}
          {primaryDiceError ? (
            <div className="text-xs text-red-300 md:col-span-2">
              {primaryDiceError}
            </div>
          ) : null}
        </div>
      ) : null}

      {kind === "targetSave" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Resistência do alvo">
            <Select
              className="input-base"
              value={roll.saveAttribute ?? roll.attribute ?? "str"}
              onChange={(event) =>
                patch({ saveAttribute: event.target.value as Attribute })
              }
            >
              {ATTRIBUTES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Em sucesso">
            <Select
              className="input-base"
              value={roll.onSave ?? "none"}
              onChange={(event) =>
                patch({
                  onSave:
                    event.target.value as NonNullable<
                      CustomAbilityRollDefinition["onSave"]
                    >,
                })
              }
            >
              <option value="none">Sem efeito / sem dano</option>
              <option value="half">Metade do dano</option>
              <option value="full">Dano completo</option>
            </Select>
          </Field>
          <div className="rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-5 text-textMuted">
            Se a fórmula de CD ficar vazia, o sistema usa{" "}
            <strong>8 + proficiência + modificador do atributo</strong> e aplica
            bônus de CD de habilidade da ficha.
          </div>
        </div>
      ) : null}

      {kind !== "damage" ? (
        <FormulaField
          label={
            kind === "targetSave"
              ? "Fórmula da CD (opcional)"
              : "Bônus adicional da rolagem (opcional)"
          }
          value={
            kind === "targetSave"
              ? roll.dcFormula ?? ""
              : roll.modifierFormula ?? ""
          }
          placeholder={
            kind === "targetSave"
              ? "8 + character.proficiencyBonus + character.attributeModifier.str"
              : "character.proficiencyBonus"
          }
          variables={variables}
          error={kind === "targetSave" ? dcError : modifierError}
          onChange={(value) =>
            kind === "targetSave"
              ? patch({ dcFormula: value || undefined })
              : patch({ modifierFormula: value || undefined })
          }
        />
      ) : null}

      <DamageEditor
        definition={definition}
        abilityType={formulaAbilityType}
        roll={roll}
        required={kind === "damage"}
        onChange={(damage) => patch({ damage })}
      />

      <div className="rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-5 text-textMuted">
        {roll.mode === "automatic"
          ? "Os dados são resolvidos quando o botão é usado. Ataques, testes e salvaguardas usam d20; componentes de dano são rolados separadamente."
          : "O jogador informa o resultado obtido com dados físicos. Em d20, informe o valor mantido; para dano, informe cada componente."}
        {kind === "attack"
          ? " Em um 20 natural, componentes de dano marcados para crítico dobram apenas os dados."
          : ""}
      </div>
    </div>
  )
}

function DamageEditor({
  definition,
  abilityType,
  roll,
  required,
  onChange,
}: {
  definition: CustomSystemDefinition
  abilityType?: CustomAbilityTypeDefinition
  roll: CustomAbilityRollDefinition
  required: boolean
  onChange: (damage: CustomAbilityDamageRollDefinition[] | undefined) => void
}) {
  const components = roll.damage ?? []
  const variables = listCustomFormulaVariables(definition, abilityType)
  const diceVariables = variables.filter((entry) => entry.valueType === "dice")

  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-textH">
            {required ? "Dano da rolagem" : "Dano associado (opcional)"}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-textMuted">
            Um ataque pode rolar dano junto. Uma resistência do alvo pode usar
            estes componentes para informar dano completo ou metade.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"
          onClick={() =>
            onChange([...components, newDamageComponent()])
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar dano
        </button>
      </div>

      {components.length ? (
        <div className="mt-3 grid gap-3">
          {components.map((component, index) => {
            const diceError = validateCustomAbilityDiceSource(
              component.dice,
              definition,
              abilityType,
            )
            const formulaError = component.modifierFormula?.trim()
              ? validateCustomFormula(
                  component.modifierFormula,
                  definition,
                  abilityType,
                )
              : undefined

            function patchComponent(
              patchValue: Partial<CustomAbilityDamageRollDefinition>,
            ) {
              onChange(
                components.map((entry, current) =>
                  current === index
                    ? { ...entry, ...patchValue }
                    : entry,
                ),
              )
            }

            return (
              <div
                key={component.id}
                className="rounded-lg border border-border bg-bg p-3"
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Rótulo">
                    <input
                      className="input-base"
                      value={component.label ?? ""}
                      placeholder="Dano"
                      onChange={(event) =>
                        patchComponent({
                          label: event.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                  <Field label="Dados">
                    <input
                      className="input-base font-mono"
                      value={component.dice}
                      placeholder="2d6"
                      onChange={(event) =>
                        patchComponent({ dice: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Tipo de dano">
                    <input
                      className="input-base"
                      value={component.damageType ?? ""}
                      placeholder="cortante, fogo..."
                      onChange={(event) =>
                        patchComponent({
                          damageType: event.target.value || undefined,
                        })
                      }
                    />
                  </Field>
                  <div className="flex items-end gap-2">
                    <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-xs text-textH">
                      <input
                        type="checkbox"
                        checked={component.critical !== false}
                        onChange={(event) =>
                          patchComponent({ critical: event.target.checked })
                        }
                      />
                      Dobra no crítico
                    </label>
                    <button
                      type="button"
                      title="Remover dano"
                      className="rounded-lg border border-border p-2 text-textMuted hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => {
                        const next = components.filter(
                          (_, current) => current !== index,
                        )
                        onChange(next.length ? next : undefined)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {diceVariables.length ? (
                  <div className="mt-2">
                    <FormulaVariablePicker
                      variables={diceVariables}
                      buttonLabel="Usar variável como dado"
                      onSelect={(path) =>
                        patchComponent({ dice: path })
                      }
                    />
                  </div>
                ) : null}

                <div className="mt-3">
                  <FormulaField
                    label="Modificador de dano (opcional)"
                    value={component.modifierFormula ?? ""}
                    placeholder="character.attributeModifier.str"
                    variables={variables}
                    error={formulaError}
                    onChange={(modifierFormula) =>
                      patchComponent({
                        modifierFormula: modifierFormula || undefined,
                      })
                    }
                  />
                </div>

                {diceError ? (
                  <div className="mt-2 text-xs text-red-300">
                    {diceError}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
          {required
            ? "Adicione pelo menos um componente de dano."
            : "Nenhum dano configurado."}
        </div>
      )}
    </section>
  )
}

function FormulaField({
  label,
  value,
  placeholder,
  variables,
  error,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  variables: ReturnType<typeof listCustomFormulaVariables>
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field label={label}>
          <input
            className="input-base font-mono"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
        <FormulaVariablePicker
          variables={variables}
          onSelect={(path) =>
            onChange(`${value}${value.trim() ? " + " : ""}${path}`)
          }
        />
      </div>
      {error ? (
        <div className="text-xs text-red-300">{error}</div>
      ) : null}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1 text-xs text-text">
      <span>{label}</span>
      {children}
    </label>
  )
}

function newDamageComponent(): CustomAbilityDamageRollDefinition {
  return {
    id: crypto.randomUUID(),
    label: "Dano",
    dice: "1d6",
    critical: true,
  }
}
