import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type { CustomFieldDefinition } from '../../../models/customSystems/CustomFieldDefinition'
import type { JsonValue } from '../../../models/customSystems/CustomGenerals'
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from '../../../models/customSystems/CustomSystemDefinition'
import {
  adjustCustomResource,
  createCharacterCustomSystemState,
  createCustomAbility,
  removeCustomAbility,
  resetCustomFieldValue,
  resetCustomResource,
  setCustomAbilityUsage,
  setCustomFieldValue,
  setCustomResourceCurrent,
  updateCustomAbilityField,
  type CustomSystemActor,
} from '../../../lib/customSystems'
import { useCustomSystemDefinitions } from '../../../lib/customSystems/CustomSystemRegistry'

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  actor: CustomSystemActor
}

export function CustomSystemsTab({ character, updateCharacter, actor }: Props) {
  const definitions = useCustomSystemDefinitions()
  const states = character.get('sheet').customSystems ?? []
  const [selectedSystemId, setSelectedSystemId] = useState(
    states[0]?.systemId ?? definitions[0]?.id ?? '',
  )

  const selectedState = states.find((state) => state.systemId === selectedSystemId)
  const selectedDefinition = definitions.find(
    (definition) => definition.id === selectedSystemId,
  )

  function replaceState(nextState: CharacterCustomSystemState): void {
    updateCharacter(character.get('id'), (current) => {
      const sheet = current.get('sheet')
      const currentStates = sheet.customSystems ?? []
      const exists = currentStates.some(
        (state) => state.systemId === nextState.systemId,
      )
      const customSystems = exists
        ? currentStates.map((state) =>
            state.systemId === nextState.systemId ? nextState : state,
          )
        : [...currentStates, nextState]

      return current.withSheet('customSystems', customSystems)
    })
  }

  function installSystem(definition: CustomSystemDefinition): void {
    const existing = states.find((state) => state.systemId === definition.id)
    if (!existing) replaceState(createCharacterCustomSystemState(definition))
    setSelectedSystemId(definition.id)
  }

  const availableDefinitions = definitions.filter(
    (definition) => !states.some((state) => state.systemId === definition.id),
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-bg p-3">
        <div className="mb-3 text-sm font-semibold text-textH">Sistemas</div>
        <div className="grid gap-2">
          {states.map((state) => {
            const definition = definitions.find(
              (entry) => entry.id === state.systemId,
            )
            return (
              <button
                key={state.systemId}
                type="button"
                className={[
                  'rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selectedSystemId === state.systemId
                    ? 'bg-accentBg font-medium text-textH'
                    : 'text-text hover:bg-[color:var(--social-bg)]',
                ].join(' ')}
                onClick={() => setSelectedSystemId(state.systemId)}
              >
                {definition?.name ?? state.systemId}
              </button>
            )
          })}
        </div>

        {actor === 'master' && availableDefinitions.length > 0 ? (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text">
              Disponíveis
            </div>
            <div className="grid gap-2">
              {availableDefinitions.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-text hover:bg-[color:var(--social-bg)]"
                  onClick={() => installSystem(definition)}
                >
                  <Plus className="h-4 w-4" />
                  {definition.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <main className="min-w-0">
        {selectedState && selectedDefinition ? (
          <CustomSystemEditor
            definition={selectedDefinition}
            state={selectedState}
            actor={actor}
            onChange={replaceState}
          />
        ) : selectedState ? (
          <MissingDefinition state={selectedState} />
        ) : (
          <EmptySystems hasDefinitions={definitions.length > 0} />
        )}
      </main>
    </div>
  )
}

function CustomSystemEditor({
  definition,
  state,
  actor,
  onChange,
}: {
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  actor: CustomSystemActor
  onChange: (state: CharacterCustomSystemState) => void
}) {
  const [error, setError] = useState('')

  function run(operation: () => CharacterCustomSystemState): void {
    try {
      setError('')
      onChange(operation())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar a alteração.')
    }
  }

  return (
    <section className="grid gap-4">
      <header className="rounded-xl border border-border bg-bg p-4">
        <div className="flex items-start gap-3">
          {definition.icon ? (
            <div className="text-2xl" aria-hidden="true">{definition.icon}</div>
          ) : null}
          <div>
            <h2 className="text-lg font-semibold text-textH">{definition.name}</h2>
            {definition.description ? (
              <p className="mt-1 text-sm text-text">{definition.description}</p>
            ) : null}
            <div className="mt-2 text-xs text-text">Versão {definition.version}</div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {definition.resources.length > 0 ? (
        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-textH">Recursos</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {definition.resources.map((resource) => {
              const resourceState = state.resources[resource.id]
              if (!resourceState) return null
              const maximum = resourceState.maximum ?? resource.maximum
              const canEdit = resource.allowManualAdjustment !== false

              return (
                <div key={resource.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-textH">{resource.name}</div>
                      {resource.description ? (
                        <div className="mt-1 text-xs text-text">{resource.description}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      title="Restaurar valor inicial"
                      className="rounded-lg p-1.5 text-text hover:bg-[color:var(--social-bg)]"
                      disabled={!canEdit}
                      onClick={() =>
                        run(() =>
                          resetCustomResource(
                            definition,
                            state,
                            resource.id,
                            actor,
                          ),
                        )
                      }
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-lg border border-border text-lg text-textH disabled:opacity-40"
                      disabled={!canEdit}
                      onClick={() =>
                        run(() =>
                          adjustCustomResource(
                            definition,
                            state,
                            resource.id,
                            -1,
                            actor,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-center text-textH"
                      value={resourceState.current}
                      min={resource.minimum}
                      max={maximum}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        if (!Number.isFinite(value)) return
                        run(() =>
                          setCustomResourceCurrent(
                            definition,
                            state,
                            resource.id,
                            value,
                            actor,
                          ),
                        )
                      }}
                    />
                    <button
                      type="button"
                      className="h-9 w-9 rounded-lg border border-border text-lg text-textH disabled:opacity-40"
                      disabled={!canEdit}
                      onClick={() =>
                        run(() =>
                          adjustCustomResource(
                            definition,
                            state,
                            resource.id,
                            1,
                            actor,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  {maximum !== undefined ? (
                    <div className="mt-2 text-center text-xs text-text">
                      Máximo: {maximum}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {definition.fields.length > 0 ? (
        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-textH">Campos</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {definition.fields.map((field) => (
              <FieldEditor
                key={field.id}
                field={field}
                value={state.fields[field.id]}
                disabled={field.type === 'formula'}
                onReset={() =>
                  run(() =>
                    resetCustomFieldValue(
                      definition,
                      state,
                      field.id,
                      actor,
                    ),
                  )
                }
                onChange={(value) =>
                  run(() =>
                    setCustomFieldValue(
                      definition,
                      state,
                      field.id,
                      value,
                      actor,
                    ),
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {definition.abilityTypes.map((abilityType) => (
        <AbilityTypeSection
          key={abilityType.id}
          definition={definition}
          state={state}
          abilityTypeId={abilityType.id}
          actor={actor}
          onRun={run}
        />
      ))}
    </section>
  )
}

function AbilityTypeSection({
  definition,
  state,
  abilityTypeId,
  actor,
  onRun,
}: {
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  abilityTypeId: string
  actor: CustomSystemActor
  onRun: (operation: () => CharacterCustomSystemState) => void
}) {
  const abilityType = definition.abilityTypes.find((entry) => entry.id === abilityTypeId)
  const abilities = state.abilities.filter(
    (ability) => ability.abilityTypeId === abilityTypeId,
  )
  if (!abilityType) return null

  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-textH">{abilityType.name}</h3>
          {abilityType.description ? (
            <p className="mt-1 text-xs text-text">{abilityType.description}</p>
          ) : null}
        </div>
        {actor !== 'automation' ? (
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-textH hover:bg-[color:var(--social-bg)]"
            onClick={() =>
              onRun(() =>
                createCustomAbility(
                  definition,
                  state,
                  abilityType.id,
                  crypto.randomUUID(),
                  actor,
                ),
              )
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        {abilities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text">
            Nenhuma habilidade cadastrada.
          </div>
        ) : (
          abilities.map((ability) => (
            <AbilityEditor
              key={ability.id}
              definition={definition}
              ability={ability}
              state={state}
              actor={actor}
              onRun={onRun}
            />
          ))
        )}
      </div>
    </section>
  )
}

function AbilityEditor({
  definition,
  ability,
  state,
  actor,
  onRun,
}: {
  definition: CustomSystemDefinition
  ability: CustomAbilityInstance
  state: CharacterCustomSystemState
  actor: CustomSystemActor
  onRun: (operation: () => CharacterCustomSystemState) => void
}) {
  const abilityType = definition.abilityTypes.find(
    (entry) => entry.id === ability.abilityTypeId,
  )
  if (!abilityType) return null

  const titleValue = ability.values[abilityType.display.titleFieldId]
  const title = typeof titleValue === 'string' && titleValue.trim()
    ? titleValue
    : abilityType.name

  return (
    <article className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-textH">{title}</div>
        <button
          type="button"
          title="Remover habilidade"
          className="rounded-lg p-1.5 text-text hover:bg-red-500/10 hover:text-red-300"
          onClick={() =>
            onRun(() =>
              removeCustomAbility(
                definition,
                state,
                ability.id,
                actor,
              ),
            )
          }
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {abilityType.fields.map((field) => (
          <FieldEditor
            key={field.id}
            field={field}
            value={ability.values[field.id]}
            disabled={field.type === 'formula'}
            onChange={(value) =>
              onRun(() =>
                updateCustomAbilityField(
                  definition,
                  state,
                  ability.id,
                  field.id,
                  value,
                  actor,
                ),
              )
            }
          />
        ))}
      </div>

      {ability.usage ? (
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
          <label className="text-xs text-text">Usos consumidos</label>
          <input
            type="number"
            min={0}
            max={ability.usage.maximum}
            className="w-24 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-textH"
            value={ability.usage.used}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isFinite(value)) return
              onRun(() =>
                setCustomAbilityUsage(
                  definition,
                  state,
                  ability.id,
                  value,
                  actor,
                ),
              )
            }}
          />
          {ability.usage.maximum !== undefined ? (
            <span className="text-xs text-text">de {ability.usage.maximum}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function FieldEditor({
  field,
  value,
  disabled,
  onChange,
  onReset,
}: {
  field: CustomFieldDefinition
  value: JsonValue | undefined
  disabled?: boolean
  onChange: (value: JsonValue) => void
  onReset?: () => void
}) {
  const label = (
    <div className="mb-1 flex items-center justify-between gap-2">
      <label className="text-xs font-medium text-textH">{field.name}</label>
      {onReset && field.type !== 'formula' ? (
        <button
          type="button"
          title="Restaurar valor padrão"
          className="rounded p-1 text-text hover:bg-[color:var(--social-bg)]"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )

  const commonClass =
    'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-textH disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div>
      {label}
      {field.type === 'number' ? (
        <input
          type="number"
          className={commonClass}
          value={typeof value === 'number' ? value : ''}
          min={field.minimum}
          max={field.maximum}
          step={field.step}
          disabled={disabled}
          onChange={(event) => {
            const number = Number(event.target.value)
            if (Number.isFinite(number)) onChange(number)
          }}
        />
      ) : field.type === 'boolean' ? (
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          {value === true ? 'Ativo' : 'Inativo'}
        </label>
      ) : field.type === 'select' ? (
        <select
          className={commonClass}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'multiSelect' ? (
        <select
          multiple
          className={`${commonClass} min-h-28`}
          value={Array.isArray(value) ? value.map(String) : []}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              Array.from(event.target.selectedOptions).map(
                (option) => option.value,
              ),
            )
          }
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'richText' ? (
        <textarea
          className={`${commonClass} min-h-28 resize-y`}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === 'dice' ? (
        <select
          className={commonClass}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione</option>
          {(field.allowedDice ?? ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']).map(
            (die) => (
              <option key={die} value={die}>{die}</option>
            ),
          )}
        </select>
      ) : field.type === 'reference' ? (
        <input
          type="text"
          className={commonClass}
          value={typeof value === 'string' ? value : ''}
          placeholder={`Referência: ${field.target}`}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === 'formula' ? (
        <div className="rounded-lg border border-border bg-[color:var(--social-bg)] px-3 py-2 text-sm text-text">
          {displayJsonValue(value) || field.formula}
        </div>
      ) : (
        <input
          type="text"
          className={commonClass}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.description ? (
        <div className="mt-1 text-xs text-text">{field.description}</div>
      ) : null}
    </div>
  )
}

function MissingDefinition({ state }: { state: CharacterCustomSystemState }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="font-semibold text-textH">Definição indisponível</div>
      <p className="mt-1 text-sm text-text">
        O estado de <strong>{state.systemId}</strong> foi preservado, mas a definição do sistema não está registrada neste cliente.
      </p>
    </div>
  )
}

function EmptySystems({ hasDefinitions }: { hasDefinitions: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-bg p-8 text-center">
      <div className="font-semibold text-textH">Nenhum sistema personalizado</div>
      <p className="mt-2 text-sm text-text">
        {hasDefinitions
          ? 'O mestre pode instalar um dos sistemas disponíveis para este personagem.'
          : 'Nenhuma definição de sistema foi registrada no aplicativo.'}
      </p>
    </div>
  )
}

function displayJsonValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
