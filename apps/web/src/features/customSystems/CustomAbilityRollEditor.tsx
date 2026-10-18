import { Select } from "../../components/ui/Select"
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityRollDefinition,
  CustomAbilityTypeDefinition,
  CustomPredefinedAbilityDefinition,
} from "../../models/customSystems/CustomAbilityDefinition"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import { CustomRollBehaviorFields } from "./CustomRollBehaviorFields"

type AbilityRollMode = "inherit" | "none" | "specific"

export function CustomAbilityRollEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  if (!draft.abilityTypes.length) return null

  function replaceType(
    typeIndex: number,
    next: CustomAbilityTypeDefinition,
  ) {
    setDraft({
      ...draft,
      abilityTypes: draft.abilityTypes.map((entry, index) =>
        index === typeIndex ? next : entry,
      ),
    })
  }

  function patchTypeRoll(
    typeIndex: number,
    nextRoll: CustomAbilityRollDefinition | undefined,
  ) {
    const type = draft.abilityTypes[typeIndex]
    if (!type) return

    replaceType(typeIndex, {
      ...type,
      activation: cleanActivation({
        ...type.activation,
        roll: nextRoll,
        rollDisabled: undefined,
      }),
    })
  }

  function patchAbility(
    typeIndex: number,
    abilityIndex: number,
    updater: (
      ability: CustomPredefinedAbilityDefinition,
      type: CustomAbilityTypeDefinition,
    ) => CustomPredefinedAbilityDefinition,
  ) {
    const type = draft.abilityTypes[typeIndex]
    const ability = type?.predefinedAbilities?.[abilityIndex]
    if (!type || !ability) return

    const abilities = type.predefinedAbilities ?? []
    replaceType(typeIndex, {
      ...type,
      predefinedAbilities: abilities.map((entry, index) =>
        index === abilityIndex ? updater(entry, type) : entry,
      ),
    })
  }

  function setAbilityRollMode(
    typeIndex: number,
    abilityIndex: number,
    mode: AbilityRollMode,
  ) {
    patchAbility(typeIndex, abilityIndex, (ability, type) => {
      const current = ability.activation

      if (mode === "inherit") {
        const next = { ...(current ?? {}) }
        delete next.roll
        delete next.rollDisabled
        return {
          ...ability,
          activation: cleanActivation(next),
        }
      }

      if (mode === "none") {
        return {
          ...ability,
          activation: {
            ...(current ?? {}),
            roll: undefined,
            rollDisabled: true,
          },
        }
      }

      return {
        ...ability,
        activation: {
          ...(current ?? {}),
          rollDisabled: undefined,
          roll:
            current?.roll
            ?? type.activation?.roll
            ?? defaultRoll(),
        },
      }
    })
  }

  function patchAbilityRoll(
    typeIndex: number,
    abilityIndex: number,
    roll: CustomAbilityRollDefinition,
  ) {
    patchAbility(typeIndex, abilityIndex, (ability) => ({
      ...ability,
      activation: {
        ...(ability.activation ?? {}),
        rollDisabled: undefined,
        roll,
      },
    }))
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-bg p-4">
      <h3 className="font-semibold text-textH">
        Comportamento de rolagem das habilidades
      </h3>
      <p className="mt-1 text-xs leading-5 text-textMuted">
        O tipo define apenas o padrão. Cada habilidade do compêndio pode
        herdar esse padrão, não rolar nada ou possuir uma configuração própria
        de ataque, teste, resistência e dano.
      </p>

      <div className="mt-4 grid gap-4">
        {draft.abilityTypes.map((type, typeIndex) => {
          const defaultTypeRoll = type.activation?.roll

          return (
            <article
              key={type.id || `ability-type-${typeIndex}`}
              className="rounded-xl border border-border bg-bg-subtle p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-textH">
                    {type.name}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-textMuted">
                    {type.id}
                  </div>
                  <div className="mt-2 text-[11px] leading-4 text-textMuted">
                    Esta configuração é o padrão para habilidades que escolherem
                    “Herdar do tipo”.
                  </div>
                </div>

                <label className="grid min-w-[14rem] gap-1 text-xs text-text">
                  <span>Rolagem padrão do tipo</span>
                  <Select
                    className="input-base"
                    value={defaultTypeRoll ? "configured" : "none"}
                    onChange={(event) => {
                      if (event.target.value === "none") {
                        patchTypeRoll(typeIndex, undefined)
                        return
                      }
                      patchTypeRoll(
                        typeIndex,
                        defaultTypeRoll ?? defaultRoll(),
                      )
                    }}
                  >
                    <option value="none">Sem rolagem padrão</option>
                    <option value="configured">
                      Configurar padrão
                    </option>
                  </Select>
                </label>
              </div>

              {defaultTypeRoll ? (
                <div className="mt-4 rounded-lg border border-border bg-bg p-3">
                  <div className="mb-3 text-xs font-semibold text-textH">
                    Padrão do tipo
                  </div>
                  <CustomRollBehaviorFields
                    definition={draft}
                    abilityType={type}
                    roll={defaultTypeRoll}
                    onChange={(roll) =>
                      patchTypeRoll(typeIndex, roll)
                    }
                  />
                </div>
              ) : null}

              <section className="mt-4 border-t border-border pt-4">
                <div>
                  <h4 className="text-sm font-semibold text-textH">
                    Rolagem por habilidade
                  </h4>
                  <p className="mt-1 text-[11px] leading-4 text-textMuted">
                    Configure somente as exceções. Uma técnica de ataque pode
                    rolar ataque + dano, outra pode exigir resistência do alvo
                    e outra pode não rolar nada.
                  </p>
                </div>

                {(type.predefinedAbilities ?? []).length ? (
                  <div className="mt-3 grid gap-3">
                    {(type.predefinedAbilities ?? []).map(
                      (ability, abilityIndex) => {
                        const mode = getAbilityRollMode(ability)
                        const specificRoll = ability.activation?.roll

                        return (
                          <article
                            key={ability.id || `ability-${abilityIndex}`}
                            className="rounded-lg border border-border bg-bg p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-textH">
                                  {abilityTitle(type, ability)}
                                </div>
                                <div className="mt-1 truncate font-mono text-[10px] text-textMuted">
                                  {ability.id}
                                </div>
                              </div>

                              <label className="grid min-w-[15rem] gap-1 text-xs text-text">
                                <span>Rolagem desta habilidade</span>
                                <Select
                                  className="input-base"
                                  value={mode}
                                  onChange={(event) =>
                                    setAbilityRollMode(
                                      typeIndex,
                                      abilityIndex,
                                      event.target.value as AbilityRollMode,
                                    )
                                  }
                                >
                                  <option value="inherit">
                                    Herdar do tipo
                                  </option>
                                  <option value="none">
                                    Sem rolagem
                                  </option>
                                  <option value="specific">
                                    Configuração própria
                                  </option>
                                </Select>
                              </label>
                            </div>

                            {mode === "inherit" ? (
                              <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-textMuted">
                                {defaultTypeRoll
                                  ? `Herda: ${rollSummary(defaultTypeRoll)}.`
                                  : "O tipo não possui rolagem padrão; esta habilidade não rola nada."}
                              </div>
                            ) : null}

                            {mode === "none" ? (
                              <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-textMuted">
                                A rolagem padrão do tipo é ignorada para esta habilidade.
                              </div>
                            ) : null}

                            {mode === "specific" && specificRoll ? (
                              <div className="mt-4 border-t border-border pt-4">
                                <CustomRollBehaviorFields
                                  definition={draft}
                                  abilityType={{
                                    ...type,
                                    activation: {
                                      ...type.activation,
                                      roll: specificRoll,
                                    },
                                  }}
                                  roll={specificRoll}
                                  onChange={(roll) =>
                                    patchAbilityRoll(
                                      typeIndex,
                                      abilityIndex,
                                      roll,
                                    )
                                  }
                                />
                              </div>
                            ) : null}
                          </article>
                        )
                      },
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
                    Este tipo ainda não possui habilidades no compêndio.
                  </div>
                )}
              </section>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function cleanActivation(
  activation: CustomAbilityActivationDefinition,
): CustomAbilityActivationDefinition | undefined {
  const entries = Object.entries(activation).filter(
    ([, value]) => value !== undefined,
  )
  return entries.length
    ? Object.fromEntries(entries) as CustomAbilityActivationDefinition
    : undefined
}

function defaultRoll(): CustomAbilityRollDefinition {
  return {
    mode: "automatic",
    kind: "generic",
    dice: "1d6",
  }
}

function getAbilityRollMode(
  ability: CustomPredefinedAbilityDefinition,
): AbilityRollMode {
  if (ability.activation?.rollDisabled) return "none"
  if (ability.activation?.roll) return "specific"
  return "inherit"
}

function abilityTitle(
  type: CustomAbilityTypeDefinition,
  ability: CustomPredefinedAbilityDefinition,
): string {
  const value = ability.values[type.display.titleFieldId]
  return typeof value === "string" && value.trim()
    ? value
    : ability.id
}

function rollSummary(roll: CustomAbilityRollDefinition): string {
  switch (roll.kind ?? "generic") {
    case "attack":
      return "ataque"
    case "abilityCheck":
      return "teste de habilidade/perícia"
    case "savingThrow":
      return "teste de resistência do usuário"
    case "targetSave":
      return "resistência do alvo"
    case "damage":
      return "dano"
    default:
      return "rolagem genérica"
  }
}
