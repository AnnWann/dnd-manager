import { Select } from '../../components/ui/Select'
import { validateCustomAbilityDiceExpression } from '../../lib/customSystems/CustomAbilityRoll'
import type { CustomAbilityRollDefinition } from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

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
      <h3 className="font-semibold text-textH">Rolagens ao usar habilidades</h3>
      <p className="mt-1 text-xs leading-5 text-textMuted">
        A habilidade pode rolar automaticamente no servidor ou pedir que o jogador informe uma rolagem feita manualmente.
        O resultado fica disponível nas fórmulas dos efeitos como <code>roll.value</code>.
      </p>

      <div className="mt-4 grid gap-3">
        {draft.abilityTypes.map((type, index) => {
          const roll = type.activation?.roll
          const mode = roll?.mode ?? 'none'
          const diceError = roll?.dice?.trim()
            ? validateCustomAbilityDiceExpression(roll.dice)
            : mode === 'automatic'
              ? 'Informe os dados da rolagem automática.'
              : undefined

          function patchRoll(next: CustomAbilityRollDefinition | undefined) {
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
            <article key={type.id || `ability-type-${index}`} className="rounded-lg border border-border bg-bg-subtle p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-textH">{type.name}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-textMuted">{type.id}</div>
                </div>
                <label className="grid min-w-[13rem] gap-1">
                  <span className="label">Rolagem</span>
                  <Select
                    value={mode}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === 'none') {
                        patchRoll(undefined)
                        return
                      }
                      patchRoll({
                        mode: value as CustomAbilityRollDefinition['mode'],
                        dice: roll?.dice,
                        label: roll?.label,
                      })
                    }}
                  >
                    <option value="none">Sem rolagem</option>
                    <option value="automatic">Automática</option>
                    <option value="manual">Manual antes de usar</option>
                  </Select>
                </label>
              </div>

              {mode !== 'none' ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="label">Rótulo</span>
                    <input
                      className="input-base"
                      value={roll?.label ?? ''}
                      placeholder="Ex.: Recuperar Fôlego"
                      onChange={(event) => patchRoll({
                        mode: mode as CustomAbilityRollDefinition['mode'],
                        dice: roll?.dice,
                        label: event.target.value || undefined,
                      })}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Dados {mode === 'manual' ? '(opcional, como instrução)' : ''}</span>
                    <input
                      className="input-base font-mono"
                      value={roll?.dice ?? ''}
                      placeholder="1d6"
                      onChange={(event) => patchRoll({
                        mode: mode as CustomAbilityRollDefinition['mode'],
                        dice: event.target.value || undefined,
                        label: roll?.label,
                      })}
                    />
                  </label>
                  <div className="md:col-span-2 text-xs leading-5 text-textMuted">
                    {mode === 'automatic'
                      ? 'O resultado é gerado pelo servidor no momento da ativação e não pode ser escolhido pelo cliente.'
                      : 'Ao clicar em Usar, o jogador informa o resultado obtido antes da habilidade ser enviada ao servidor.'}
                  </div>
                  {diceError ? (
                    <div className="md:col-span-2 text-xs text-red-300">{diceError}</div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
