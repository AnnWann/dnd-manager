import { Select } from "../../components/ui/Select"
import type { CustomAbilityRollDefinition } from "../../models/customSystems/CustomAbilityDefinition"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import { CustomRollBehaviorFields } from "./CustomRollBehaviorFields"

export function CustomAbilityRollEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  if (!draft.abilityTypes.length) return null

  return (
    <section className="mt-4 rounded-xl border border-border bg-bg p-4">
      <h3 className="font-semibold text-textH">
        Comportamento de rolagem das habilidades
      </h3>
      <p className="mt-1 text-xs leading-5 text-textMuted">
        Defina se o uso faz um ataque, teste, resistência, CD para o alvo,
        dano ou uma rolagem livre. Habilidades específicas podem sobrescrever
        este padrão.
      </p>

      <div className="mt-4 grid gap-3">
        {draft.abilityTypes.map((type, index) => {
          const roll = type.activation?.roll

          function patchRoll(
            next: CustomAbilityRollDefinition | undefined,
          ) {
            setDraft({
              ...draft,
              abilityTypes: draft.abilityTypes.map((entry, current) =>
                current === index
                  ? {
                      ...entry,
                      activation: {
                        ...entry.activation,
                        roll: next,
                      },
                    }
                  : entry,
              ),
            })
          }

          return (
            <article
              key={type.id || `ability-type-${index}`}
              className="rounded-lg border border-border bg-bg-subtle p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-textH">
                    {type.name}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-textMuted">
                    {type.id}
                  </div>
                </div>

                <label className="grid min-w-[14rem] gap-1 text-xs text-text">
                  <span>Rolagem ao usar</span>
                  <Select
                    className="input-base"
                    value={roll ? "configured" : "none"}
                    onChange={(event) => {
                      if (event.target.value === "none") {
                        patchRoll(undefined)
                        return
                      }
                      patchRoll(
                        roll ?? {
                          mode: "automatic",
                          kind: "generic",
                          dice: "1d6",
                        },
                      )
                    }}
                  >
                    <option value="none">Sem rolagem</option>
                    <option value="configured">
                      Configurar comportamento
                    </option>
                  </Select>
                </label>
              </div>

              {roll ? (
                <div className="mt-4">
                  <CustomRollBehaviorFields
                    definition={draft}
                    abilityType={type}
                    roll={roll}
                    onChange={patchRoll}
                  />
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
