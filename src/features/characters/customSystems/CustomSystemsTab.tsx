import { useState, type ReactNode } from 'react'
import { Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type { CustomAbilityTypeDefinition } from '../../../models/customSystems/CustomAbilityDefinition'
import type { CustomFieldDefinition } from '../../../models/customSystems/CustomFieldDefinition'
import type { JsonValue } from '../../../models/customSystems/CustomGenerals'
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from '../../../models/customSystems/CustomSystemDefinition'
import {
  activateCustomAbility,
  adjustCustomResource,
  countCustomAbilities,
  createCharacterCustomSystemState,
  createCustomAbility,
  getCustomAbilityAvailability,
  getCustomAbilityLimit,
  isPresentationItemVisible,
  listCustomSystemPresentationItems,
  removeCustomAbility,
  resetCustomFieldValue,
  resetCustomResource,
  setCustomAbilityLearned,
  setCustomAbilityPrepared,
  setCustomAbilityUsage,
  setCustomFieldValue,
  setCustomResourceCurrent,
  updateCustomAbilityField,
  type CustomSystemActor,
} from '../../../lib/customSystems'
import { useCustomSystemDefinitions } from '../../../lib/customSystems/CustomSystemRegistry'
import { CustomSystemIcon } from '../../customSystems/CustomSystemIcon'

const PREDEFINED_MARKER = '__predefinedAbilityId'

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

  function replaceState(nextState: CharacterCustomSystemState) {
    updateCharacter(character.get('id'), (current) => {
      const currentStates = current.get('sheet').customSystems ?? []
      const exists = currentStates.some(
        (state) => state.systemId === nextState.systemId,
      )
      const nextStates = exists
        ? currentStates.map((state) =>
            state.systemId === nextState.systemId ? nextState : state,
          )
        : [...currentStates, nextState]

      return current.withSheet('customSystems', nextStates)
    })
  }

  function useAbility(systemId: string, abilityId: string) {
    // The updater receives the real, complete character from CharacterContext.
    // This matters when this tab is rendered with only one system visible.
    updateCharacter(character.get('id'), (current) =>
      activateCustomAbility(current, definitions, systemId, abilityId),
    )
  }

  function installSystem(definition: CustomSystemDefinition) {
    if (!states.some((state) => state.systemId === definition.id)) {
      replaceState(createCharacterCustomSystemState(definition))
    }
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
                onClick={() => setSelectedSystemId(state.systemId)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedSystemId === state.systemId
                    ? 'bg-accentBg font-medium text-textH'
                    : 'text-text hover:bg-[color:var(--social-bg)]'
                }`}
              >
                {definition?.name ?? state.systemId}
              </button>
            )
          })}
        </div>

        {actor === 'master' && availableDefinitions.length ? (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text">
              Disponíveis
            </div>
            <div className="grid gap-2">
              {availableDefinitions.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  onClick={() => installSystem(definition)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-text hover:bg-[color:var(--social-bg)]"
                >
                  <Plus className="h-4 w-4" /> {definition.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <main className="min-w-0">
        {selectedState && selectedDefinition ? (
          <CustomSystemEditor
            character={character}
            definition={selectedDefinition}
            state={selectedState}
            actor={actor}
            onChange={replaceState}
            onUseAbility={(abilityId) =>
              useAbility(selectedDefinition.id, abilityId)
            }
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
  character,
  definition,
  state,
  actor,
  onChange,
  onUseAbility,
}: {
  character: CharacterTemplate
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  actor: CustomSystemActor
  onChange: (state: CharacterCustomSystemState) => void
  onUseAbility: (abilityId: string) => void
}) {
  const [error, setError] = useState('')
  const role = actor === 'master' ? 'master' : 'player'
  const items = listCustomSystemPresentationItems(definition).filter((item) =>
    isPresentationItemVisible(item, role),
  )

  function run(operation: () => CharacterCustomSystemState) {
    try {
      setError('')
      onChange(operation())
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível salvar a alteração.'))
    }
  }

  function useAbility(abilityId: string) {
    try {
      setError('')
      onUseAbility(abilityId)
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível usar esta habilidade.'))
    }
  }

  return (
    <section className="grid gap-4">
      <header className="rounded-xl border border-border bg-bg p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accentBorder bg-accentBg text-accent">
            <CustomSystemIcon icon={definition.icon} className="h-5 w-5" />
          </div>
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

      {items.map((item) => {
        if (item.kind === 'resource') {
          const resource = definition.resources.find((entry) => entry.id === item.id)
          const resourceState = state.resources[item.id]
          if (!resource || !resourceState) return null
          return (
            <ResourceSection
              key={item.key}
              definition={definition}
              state={state}
              actor={actor}
              resourceId={item.id}
              onRun={run}
            />
          )
        }

        if (item.kind === 'field') {
          const field = definition.fields.find((entry) => entry.id === item.id)
          if (!field) return null
          const masterOnly =
            field.editPermission === 'masterOnly' && actor !== 'master'

          return (
            <section key={item.key} className="rounded-xl border border-border bg-bg p-4">
              <FieldEditor
                field={field}
                value={state.fields[field.id]}
                disabled={field.type === 'formula' || masterOnly}
                onReset={() =>
                  run(() =>
                    resetCustomFieldValue(definition, state, field.id, actor),
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
            </section>
          )
        }

        return (
          <AbilityTypeSection
            key={item.key}
            character={character}
            definition={definition}
            state={state}
            abilityTypeId={item.id}
            actor={actor}
            onRun={run}
            onUseAbility={useAbility}
          />
        )
      })}

      {!items.length ? (
        <div className="rounded-xl border border-dashed border-border bg-bg p-8 text-center text-sm text-text">
          Nenhum item está visível para esta função.
        </div>
      ) : null}
    </section>
  )
}

function ResourceSection({
  definition,
  state,
  actor,
  resourceId,
  onRun,
}: {
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  actor: CustomSystemActor
  resourceId: string
  onRun: (operation: () => CharacterCustomSystemState) => void
}) {
  const resource = definition.resources.find((entry) => entry.id === resourceId)
  const resourceState = state.resources[resourceId]
  if (!resource || !resourceState) return null

  const maximum = resourceState.maximum ?? resource.maximum
  const canEdit =
    resource.allowManualAdjustment !== false &&
    !(resource.editPermission === 'masterOnly' && actor !== 'master')

  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-textH">{resource.name}</h3>
          {resource.description ? (
            <p className="mt-1 text-xs text-text">{resource.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          title="Restaurar valor inicial"
          disabled={!canEdit}
          onClick={() =>
            onRun(() => resetCustomResource(definition, state, resource.id, actor))
          }
          className="rounded-lg p-1.5 text-text hover:bg-[color:var(--social-bg)] disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() =>
            onRun(() => adjustCustomResource(definition, state, resource.id, -1, actor))
          }
          className="h-9 w-9 rounded-lg border border-border text-lg text-textH disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          value={resourceState.current}
          min={resource.minimum}
          max={maximum}
          disabled={!canEdit}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (Number.isFinite(value)) {
              onRun(() =>
                setCustomResourceCurrent(
                  definition,
                  state,
                  resource.id,
                  value,
                  actor,
                ),
              )
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-center text-textH"
        />
        <button
          type="button"
          disabled={!canEdit}
          onClick={() =>
            onRun(() => adjustCustomResource(definition, state, resource.id, 1, actor))
          }
          className="h-9 w-9 rounded-lg border border-border text-lg text-textH disabled:opacity-40"
        >
          +
        </button>
      </div>
      {maximum !== undefined ? (
        <div className="mt-2 text-center text-xs text-text">Máximo: {maximum}</div>
      ) : null}
    </section>
  )
}

function AbilityTypeSection({
  character,
  definition,
  state,
  abilityTypeId,
  actor,
  onRun,
  onUseAbility,
}: {
  character: CharacterTemplate
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  abilityTypeId: string
  actor: CustomSystemActor
  onRun: (operation: () => CharacterCustomSystemState) => void
  onUseAbility: (abilityId: string) => void
}) {
  const abilityType = definition.abilityTypes.find(
    (entry) => entry.id === abilityTypeId,
  )
  const abilities = state.abilities.filter(
    (ability) => ability.abilityTypeId === abilityTypeId,
  )
  if (!abilityType) return null

  const learnedLimit = getCustomAbilityLimit(
    definition,
    state,
    abilityType,
    'learned',
    character,
  )
  const preparedLimit = getCustomAbilityLimit(
    definition,
    state,
    abilityType,
    'prepared',
    character,
  )
  const learnedCount = countCustomAbilities(state, abilityType.id, 'learned')
  const preparedCount = countCustomAbilities(state, abilityType.id, 'prepared')

  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-textH">{abilityType.name}</h3>
          {abilityType.description ? (
            <p className="mt-1 text-xs leading-5 text-text">{abilityType.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {usesLearned(abilityType) ? (
              <LimitBadge label="Aprendidas" current={learnedCount} maximum={learnedLimit} />
            ) : null}
            {usesPrepared(abilityType) ? (
              <LimitBadge label="Preparadas" current={preparedCount} maximum={preparedLimit} />
            ) : null}
          </div>
        </div>

        {actor !== 'automation' ? (
          <button
            type="button"
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-textH hover:bg-[color:var(--social-bg)]"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        {!abilities.length ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text">
            Nenhuma habilidade cadastrada.
          </div>
        ) : (
          abilities.map((ability) => (
            <AbilityEditor
              key={ability.id}
              character={character}
              definition={definition}
              abilityType={abilityType}
              ability={ability}
              state={state}
              actor={actor}
              learnedCount={learnedCount}
              learnedLimit={learnedLimit}
              preparedCount={preparedCount}
              preparedLimit={preparedLimit}
              onRun={onRun}
              onUse={() => onUseAbility(ability.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

function AbilityEditor({
  character,
  definition,
  abilityType,
  ability,
  state,
  actor,
  learnedCount,
  learnedLimit,
  preparedCount,
  preparedLimit,
  onRun,
  onUse,
}: {
  character: CharacterTemplate
  definition: CustomSystemDefinition
  abilityType: CustomAbilityTypeDefinition
  ability: CustomAbilityInstance
  state: CharacterCustomSystemState
  actor: CustomSystemActor
  learnedCount: number
  learnedLimit: number | undefined
  preparedCount: number
  preparedLimit: number | undefined
  onRun: (operation: () => CharacterCustomSystemState) => void
  onUse: () => void
}) {
  const [editing, setEditing] = useState(false)
  const preset = abilityType.predefinedAbilities?.find(
    (entry) => entry.id === ability.predefinedAbilityId,
  )
  const effectiveType = preset?.acquisition
    ? {
        ...abilityType,
        acquisition: { ...abilityType.acquisition, ...preset.acquisition },
      }
    : abilityType
  const availability = getCustomAbilityAvailability(effectiveType, ability)
  const libraryAbility = isLibraryAbility(ability)
  const canEdit = actor !== 'automation' && !libraryAbility
  const display = getAbilityDisplay(abilityType, ability)
  const remaining =
    ability.usage?.maximum === undefined
      ? undefined
      : Math.max(0, ability.usage.maximum - ability.usage.used)
  const learnedLimitReached =
    learnedLimit !== undefined && learnedCount >= learnedLimit
  const preparedLimitReached =
    preparedLimit !== undefined && preparedCount >= preparedLimit
  const canLearn = availability.learned || !learnedLimitReached
  const canPrepare =
    availability.prepared ||
    (availability.learned && !preparedLimitReached)
  const canUse = availability.canUse && remaining !== 0

  return (
    <article className="rounded-2xl border border-border bg-bg p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-3">
            {abilityType.icon ? (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accentBorder bg-accentBg text-xl"
                aria-hidden="true"
              >
                {abilityType.icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h4 className="break-words text-base font-semibold leading-snug text-textH">
                {display.title}
              </h4>
              {display.subtitles.length ? (
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-textMuted">
                  {display.subtitles.map((subtitle, index) => (
                    <span key={`${subtitle}-${index}`}>{subtitle}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {libraryAbility ? <MetaBadge>Biblioteca</MetaBadge> : null}
            {usesLearned(effectiveType) ? (
              <MetaBadge>{availability.learned ? 'Aprendida' : 'Não aprendida'}</MetaBadge>
            ) : null}
            {usesPrepared(effectiveType) ? (
              <MetaBadge accent={availability.prepared}>
                {availability.prepared ? 'Preparada' : 'Não preparada'}
              </MetaBadge>
            ) : null}
            {remaining !== undefined ? (
              <MetaBadge>{remaining}/{ability.usage?.maximum} usos</MetaBadge>
            ) : null}
            {display.badges.map((badge, index) => (
              <MetaBadge key={`${badge}-${index}`}>{badge}</MetaBadge>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 border-t border-border pt-3 sm:w-auto sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
          {actor !== 'automation' ? (
            <button
              type="button"
              disabled={!canUse}
              title={
                !availability.canUse
                  ? 'A habilidade precisa estar aprendida e preparada para ser usada.'
                  : remaining === 0
                    ? 'A habilidade não possui usos restantes.'
                    : 'Usar habilidade'
              }
              onClick={onUse}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent bg-accentBg px-3 py-2 text-xs font-semibold text-textH hover:bg-bg disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:opacity-45 sm:flex-none"
            >
              <Play className="h-3.5 w-3.5" /> Usar
            </button>
          ) : null}

          {usesLearned(effectiveType) ? (
            <button
              type="button"
              disabled={!canLearn}
              onClick={() =>
                onRun(() =>
                  setCustomAbilityLearned(
                    definition,
                    state,
                    ability.id,
                    !availability.learned,
                    character,
                  ),
                )
              }
              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-textH hover:bg-accentBg disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {availability.learned ? 'Desaprender' : 'Aprender'}
            </button>
          ) : null}

          {usesPrepared(effectiveType) ? (
            <button
              type="button"
              disabled={!canPrepare}
              onClick={() =>
                onRun(() =>
                  setCustomAbilityPrepared(
                    definition,
                    state,
                    ability.id,
                    !availability.prepared,
                    character,
                  ),
                )
              }
              className="flex-1 rounded-lg border border-accentBorder px-3 py-2 text-xs font-medium text-textH hover:bg-accentBg disabled:cursor-not-allowed disabled:border-border disabled:opacity-50 sm:flex-none"
            >
              {availability.prepared ? 'Despreparar' : 'Preparar'}
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing((current) => !current)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-textH hover:bg-accentBg sm:flex-none"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editing ? 'Concluir' : 'Editar'}
            </button>
          ) : null}

          {actor !== 'automation' ? (
            <button
              type="button"
              onClick={() =>
                onRun(() => removeCustomAbility(definition, state, ability.id, actor))
              }
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 sm:flex-none"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          ) : null}
        </div>
      </div>

      {display.description ? (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-text">
          {display.description}
        </p>
      ) : preset?.description ? (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-text">
          {preset.description}
        </p>
      ) : null}

      {display.details.length ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {display.details.map((detail) => (
            <div
              key={detail.id}
              className="rounded-xl border border-border bg-bg-subtle px-3 py-2"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-textMuted">
                {detail.label}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-textH">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {editing && canEdit ? (
        <div className="mt-4 rounded-xl border border-accentBorder bg-bg-subtle p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-textMuted">
            Editar habilidade personalizada
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {abilityType.fields.map((field) => (
              <FieldEditor
                key={field.id}
                field={field}
                value={ability.values[field.id]}
                disabled={
                  field.type === 'formula' ||
                  (field.editPermission === 'masterOnly' && actor !== 'master')
                }
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
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <label className="text-xs text-text">Usos consumidos</label>
              <input
                type="number"
                min={0}
                max={ability.usage.maximum}
                value={ability.usage.used}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isFinite(value)) {
                    onRun(() =>
                      setCustomAbilityUsage(
                        definition,
                        state,
                        ability.id,
                        value,
                        actor,
                      ),
                    )
                  }
                }}
                className="w-24 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH"
              />
              {ability.usage.maximum !== undefined ? (
                <span className="text-xs text-text">de {ability.usage.maximum}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function LimitBadge({
  label,
  current,
  maximum,
}: {
  label: string
  current: number
  maximum: number | undefined
}) {
  const reached = maximum !== undefined && current >= maximum
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs ${
        reached
          ? 'border-accentBorder bg-accentBg text-accent'
          : 'border-border text-text'
      }`}
    >
      {label}: {current}{maximum === undefined ? '' : `/${maximum}`}
    </span>
  )
}

function MetaBadge({
  children,
  accent = false,
}: {
  children: ReactNode
  accent?: boolean
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] ${
        accent
          ? 'border-accentBorder bg-accentBg font-medium text-accent'
          : 'border-border bg-bg-subtle text-textMuted'
      }`}
    >
      {children}
    </span>
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
  const commonClass =
    'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-textH disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-textH">{field.name}</label>
        {onReset && field.type !== 'formula' ? (
          <button
            type="button"
            title="Restaurar valor padrão"
            onClick={onReset}
            className="rounded p-1 text-text hover:bg-[color:var(--social-bg)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

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
            <option key={option.value} value={option.value}>{option.label}</option>
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
              Array.from(event.target.selectedOptions).map((option) => option.value),
            )
          }
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
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
            (die) => <option key={die} value={die}>{die}</option>,
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

function getAbilityDisplay(
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
) {
  const reservedIds = new Set(
    [
      type.display.titleFieldId,
      type.display.descriptionFieldId,
      ...(type.display.subtitleFieldIds ?? []),
      ...(type.display.badgeFieldIds ?? []),
    ].filter((value): value is string => Boolean(value)),
  )
  const title =
    displayJsonValue(ability.values[type.display.titleFieldId]) || type.name
  const subtitles = (type.display.subtitleFieldIds ?? [])
    .map((fieldId) => displayJsonValue(ability.values[fieldId]))
    .filter(Boolean)
  const badges = (type.display.badgeFieldIds ?? [])
    .map((fieldId) => displayJsonValue(ability.values[fieldId]))
    .filter(Boolean)
  const description = type.display.descriptionFieldId
    ? displayJsonValue(ability.values[type.display.descriptionFieldId])
    : ''
  const details = type.fields.flatMap((field) => {
    if (reservedIds.has(field.id)) return []
    const value = formatFieldValue(field, ability.values[field.id])
    return value ? [{ id: field.id, label: field.name, value }] : []
  })

  return { title, subtitles, badges, description, details }
}

function formatFieldValue(
  field: CustomFieldDefinition,
  value: JsonValue | undefined,
): string {
  if (field.type === 'select' && typeof value === 'string') {
    return field.options.find((option) => option.value === value)?.label ?? value
  }

  if (field.type === 'multiSelect' && Array.isArray(value)) {
    return value
      .map((entry) => {
        const stringValue = String(entry)
        return field.options.find((option) => option.value === stringValue)?.label ?? stringValue
      })
      .join(', ')
  }

  if (field.type === 'boolean' && typeof value === 'boolean') {
    return value ? 'Sim' : 'Não'
  }

  return displayJsonValue(value)
}

function isLibraryAbility(ability: CustomAbilityInstance): boolean {
  const marker = ability.values[PREDEFINED_MARKER]
  return Boolean(
    ability.predefinedAbilityId ||
      (typeof marker === 'string' && marker.trim()),
  )
}

function usesLearned(type: { acquisition?: { mode?: string } }): boolean {
  return (
    type.acquisition?.mode === 'learned' ||
    type.acquisition?.mode === 'learnedAndPrepared'
  )
}

function usesPrepared(type: { acquisition?: { mode?: string } }): boolean {
  return (
    type.acquisition?.mode === 'prepared' ||
    type.acquisition?.mode === 'learnedAndPrepared'
  )
}

function displayJsonValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(displayJsonValue).filter(Boolean).join(', ')
  return JSON.stringify(value)
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback
}
