import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Select as SharedSelect } from '../../../components/ui/Select'
import { FormulaVariablePicker } from '../../customSystems/FormulaVariablePicker'
import type { CustomFormulaVariable } from '../../../lib/customSystems/CustomFormulaEngineWithCharacter'
import { listCustomFormulaVariables, validateCustomFormula } from '../../../lib/customSystems/CustomFormulaEngineWithCharacter'
import { formulaOverrideKey, getCustomSystemFormulaOverride, setCustomSystemFormulaOverride } from '../../../lib/customSystems/CustomSystemFormulaOverrides'

import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type { CustomAbilityTypeDefinition } from '../../../models/customSystems/CustomAbilityDefinition'
import type {
  CharacterCustomSystemState,
  CustomAbilityAcquisitionExceptionState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from '../../../models/customSystems/CustomSystemDefinition'
import {
  countCustomAbilities,
  getCustomAbilityAcquisitionException,
  getCustomAbilityAcquisitionExceptionPresets,
  getCustomAbilityLimit,
  setCustomAbilityAcquisitionException,
} from '../../../lib/customSystems'

type Props = {
  character: CharacterTemplate
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
  onChange: (state: CharacterCustomSystemState) => void
  onClose: () => void
}

export function CustomSystemAcquisitionExceptionsModal({
  character,
  definition,
  state,
  onChange,
  onClose,
}: Props) {
  const configurableTypes = definition.abilityTypes.filter((type) =>
    usesLearned(type) || usesPrepared(type),
  )
  const formulaTargets = [
    ...definition.fields.filter((field) => field.type === 'formula').map((field) => ({
      key: formulaOverrideKey('field', field.id),
      label: field.name,
      description: 'Campo calculado',
      original: field.formula,
      abilityType: undefined as CustomAbilityTypeDefinition | undefined,
    })),
    ...definition.resources.filter((resource) => Boolean(resource.maximumFormula)).map((resource) => ({
      key: formulaOverrideKey('resourceMaximum', resource.id),
      label: resource.name,
      description: 'Máximo do recurso',
      original: resource.maximumFormula ?? '',
      abilityType: undefined as CustomAbilityTypeDefinition | undefined,
    })),
    ...definition.abilityTypes.flatMap((type) =>
      type.fields.filter((field) => field.type === 'formula').map((field) => ({
        key: formulaOverrideKey('abilityField', type.id, field.id),
        label: `${type.name} — ${field.name}`,
        description: 'Campo calculado de habilidade',
        original: field.formula,
        abilityType: type as CustomAbilityTypeDefinition | undefined,
      })),
    ),
  ]

  function updateException(
    typeId: string,
    updater: (
      current: CustomAbilityAcquisitionExceptionState,
    ) => CustomAbilityAcquisitionExceptionState,
  ) {
    const current = getCustomAbilityAcquisitionException(state, typeId)
    onChange(
      setCustomAbilityAcquisitionException(
        state,
        typeId,
        updater(current),
      ),
    )
  }

  function applyPreset(type: CustomAbilityTypeDefinition, presetId: string) {
    if (!presetId) {
      updateException(type.id, (current) => ({ ...current, presetId: undefined }))
      return
    }

    const preset = getCustomAbilityAcquisitionExceptionPresets(definition, type)
      .find((entry) => entry.id === presetId)
    if (!preset) return

    updateException(type.id, (current) => ({
      ...current,
      presetId: preset.id,
      learnedLimitFormulaOverride: preset.learnedLimitFormulaOverride,
      preparedLimitFormulaOverride: preset.preparedLimitFormulaOverride,
      extraLearnedSlots: preset.extraLearnedSlots,
      extraPreparedSlots: preset.extraPreparedSlots,
    }))
  }

  function toggleAlways(
    typeId: string,
    abilityId: string,
    kind: 'learned' | 'prepared',
    checked: boolean,
  ) {
    updateException(typeId, (current) => {
      const learned = new Set(current.alwaysLearnedAbilityIds ?? [])
      const prepared = new Set(current.alwaysPreparedAbilityIds ?? [])

      if (kind === 'prepared') {
        if (checked) {
          prepared.add(abilityId)
          learned.delete(abilityId)
        } else {
          prepared.delete(abilityId)
        }
      } else if (checked) {
        learned.add(abilityId)
      } else {
        learned.delete(abilityId)
        prepared.delete(abilityId)
      }

      return {
        ...current,
        alwaysLearnedAbilityIds: Array.from(learned),
        alwaysPreparedAbilityIds: Array.from(prepared),
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-[11000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/70 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Exceções de ${definition.name}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]">
        <header className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-textH">
              Exceções — {definition.name}
            </h2>
            <p className="mt-1 text-sm text-text">
              Personalize fórmulas de campos e recursos, limites e habilidades isentas para este personagem.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg"
            aria-label="Fechar exceções"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4">
            {configurableTypes.map((type) => {
              const exception = getCustomAbilityAcquisitionException(state, type.id)
              const presets = getCustomAbilityAcquisitionExceptionPresets(definition, type)
              const selectedPreset = presets.find((preset) => preset.id === exception.presetId)
              const abilities = state.abilities.filter(
                (ability) => ability.abilityTypeId === type.id,
              )
              const learnedLimit = usesLearned(type)
                ? getCustomAbilityLimit(
                    definition,
                    state,
                    type,
                    'learned',
                    character,
                  )
                : undefined
              const preparedLimit = usesPrepared(type)
                ? getCustomAbilityLimit(
                    definition,
                    state,
                    type,
                    'prepared',
                    character,
                  )
                : undefined

              return (
                <section
                  key={type.id}
                  className="rounded-xl border border-border bg-bg p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-textH">{type.name}</h3>
                      {type.description ? (
                        <p className="mt-1 text-xs text-text">{type.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-text">
                      {usesLearned(type) ? (
                        <span className="rounded-full border border-border px-2 py-1">
                          Aprendidas: {countCustomAbilities(state, type.id, 'learned')}
                          {learnedLimit === undefined ? '' : ` / ${learnedLimit}`}
                        </span>
                      ) : null}
                      {usesPrepared(type) ? (
                        <span className="rounded-full border border-border px-2 py-1">
                          Preparadas: {countCustomAbilities(state, type.id, 'prepared')}
                          {preparedLimit === undefined ? '' : ` / ${preparedLimit}`}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {presets.length ? (
                    <div className="mt-4 rounded-lg border border-accentBorder bg-accentBg/40 p-3">
                      <label className="block text-xs text-text">
                        Exceção esperada
                        <SharedSelect
                          value={exception.presetId ?? ''}
                          onChange={(event) => applyPreset(type, event.target.value)}
                          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH"
                        >
                          <option value="">Personalizada / sem preset</option>
                          {presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.name}</option>
                          ))}
                        </SharedSelect>
                      </label>
                      {selectedPreset?.description ? (
                        <p className="mt-2 text-xs leading-5 text-textMuted">{selectedPreset.description}</p>
                      ) : null}
                      {selectedPreset?.alwaysLearnedSelectionCount || selectedPreset?.alwaysPreparedSelectionCount ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text">
                          {selectedPreset.alwaysLearnedSelectionCount ? (
                            <span className="rounded-full border border-border bg-bg px-2 py-1">
                              Sempre aprendidas: {countSelectedAlwaysLearned(exception)} / {selectedPreset.alwaysLearnedSelectionCount}
                            </span>
                          ) : null}
                          {selectedPreset.alwaysPreparedSelectionCount ? (
                            <span className="rounded-full border border-border bg-bg px-2 py-1">
                              Sempre preparadas: {exception.alwaysPreparedAbilityIds?.length ?? 0} / {selectedPreset.alwaysPreparedSelectionCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {usesLearned(type) ? (
                      <LimitExceptionEditor
                        label="Aprendidas"
                        originalFormula={
                          type.acquisition?.learnedLimitFormula
                          ?? (type.acquisition?.learnedLimit !== undefined
                            ? String(type.acquisition.learnedLimit)
                            : '')
                        }
                        formula={exception.learnedLimitFormulaOverride ?? ''}
                        extraSlots={exception.extraLearnedSlots ?? 0}
                        onFormulaChange={(value) =>
                          updateException(type.id, (current) => ({
                            ...current,
                            presetId: undefined,
                            learnedLimitFormulaOverride: value,
                          }))
                        }
                        onExtraSlotsChange={(value) =>
                          updateException(type.id, (current) => ({
                            ...current,
                            presetId: undefined,
                            extraLearnedSlots: value,
                          }))
                        }
                      />
                    ) : null}

                    {usesPrepared(type) ? (
                      <LimitExceptionEditor
                        label="Preparadas"
                        originalFormula={
                          type.acquisition?.preparedLimitFormula
                          ?? (type.acquisition?.preparedLimit !== undefined
                            ? String(type.acquisition.preparedLimit)
                            : '')
                        }
                        formula={exception.preparedLimitFormulaOverride ?? ''}
                        extraSlots={exception.extraPreparedSlots ?? 0}
                        onFormulaChange={(value) =>
                          updateException(type.id, (current) => ({
                            ...current,
                            presetId: undefined,
                            preparedLimitFormulaOverride: value,
                          }))
                        }
                        onExtraSlotsChange={(value) =>
                          updateException(type.id, (current) => ({
                            ...current,
                            presetId: undefined,
                            extraPreparedSlots: value,
                          }))
                        }
                      />
                    ) : null}
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-textMuted">
                      Habilidades isentas do limite
                    </div>
                    {!abilities.length ? (
                      <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text">
                        Nenhuma habilidade desse tipo está cadastrada neste personagem.
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {abilities.map((ability) => (
                          <AbilityExceptionRow
                            key={ability.id}
                            type={type}
                            ability={ability}
                            learned={Boolean(
                              exception.alwaysLearnedAbilityIds?.includes(ability.id)
                              || exception.alwaysPreparedAbilityIds?.includes(ability.id),
                            )}
                            prepared={Boolean(
                              exception.alwaysPreparedAbilityIds?.includes(ability.id),
                            )}
                            showLearned={usesLearned(type)}
                            showPrepared={usesPrepared(type)}
                            onLearnedChange={(checked) =>
                              toggleAlways(type.id, ability.id, 'learned', checked)
                            }
                            onPreparedChange={(checked) =>
                              toggleAlways(type.id, ability.id, 'prepared', checked)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )
            })}

            {!configurableTypes.length && !formulaTargets.length ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text">
                Este sistema não possui fórmulas nem limites configuráveis.
              </div>
            ) : null}

            {formulaTargets.length ? (
              <details className="rounded-xl border border-border bg-bg p-4" open={!configurableTypes.length}>
                <summary className="cursor-pointer text-sm font-semibold text-textH">
                  Campos e recursos — fórmulas personalizadas ({Object.keys(state.formulaOverrides ?? {}).length} alteradas)
                </summary>
                <p className="mt-2 text-xs text-textMuted">
                  Altere apenas o cálculo deste personagem. Deixe vazio para utilizar a fórmula original do sistema.
                  A alteração é aplicada após sair do campo, se a fórmula for válida.
                </p>
                <div className="mt-4 grid gap-3">
                  {formulaTargets.map((entry) => (
                    <FormulaOverrideEditor
                      key={entry.key}
                      label={entry.label}
                      description={entry.description}
                      original={entry.original}
                      value={getCustomSystemFormulaOverride(state, entry.key) ?? ''}
                      definition={definition}
                      abilityType={entry.abilityType}
                      character={character}
                      onChange={(formula) => onChange(setCustomSystemFormulaOverride(definition, state, entry.key, formula))}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}

function FormulaOverrideEditor({
  label, description, original, value, definition, abilityType, character, onChange,
}: {
  label: string
  description: string
  original: string
  value: string
  definition: CustomSystemDefinition
  abilityType?: CustomAbilityTypeDefinition
  character: CharacterTemplate
  onChange: (formula: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  useEffect(() => {
    setDraft(value)
    setError('')
  }, [value])
  const variables: CustomFormulaVariable[] = listCustomFormulaVariables(definition, abilityType)
  // Character-aware variables include values from other installed systems.
  void character

  function save() {
    if (!draft.trim()) {
      setError('')
      onChange('')
      return
    }
    const issue = validateCustomFormula(draft, definition, abilityType)
    if (issue) {
      setError(issue)
      return
    }
    setError('')
    onChange(draft.trim())
  }

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-textH">{label}</div>
          <div className="text-xs text-textMuted">{description}</div>
        </div>
        {value ? (
          <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs text-text hover:bg-accentBg"
            onClick={() => { setDraft(''); setError(''); onChange('') }}>
            Restaurar padrão
          </button>
        ) : null}
      </div>
      <label className="mt-2 block text-xs text-text">
        Fórmula para este personagem
        <input
          type="text"
          value={draft}
          placeholder={original}
          onChange={(event) => { setDraft(event.target.value); setError('') }}
          onBlur={save}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
          aria-invalid={Boolean(error)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH outline-none"
        />
      </label>
      {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-all text-[11px] text-textMuted">Padrão: {original}</span>
        <FormulaVariablePicker
          variables={variables}
          buttonLabel="Inserir variável"
          onSelect={(path) => { setDraft((current) => current ? `${current} ${path}` : path); setError('') }}
        />
      </div>
    </div>
  )
}

function LimitExceptionEditor({
  label,
  originalFormula,
  formula,
  extraSlots,
  onFormulaChange,
  onExtraSlotsChange,
}: {
  label: string
  originalFormula: string
  formula: string
  extraSlots: number
  onFormulaChange: (value: string) => void
  onExtraSlotsChange: (value: number) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="text-sm font-medium text-textH">{label}</div>
      <label className="mt-3 block text-xs text-text">
        Fórmula de limite para este personagem
        <input
          type="text"
          value={formula}
          placeholder={originalFormula || 'Usar limite do sistema'}
          onChange={(event) => onFormulaChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH outline-none"
        />
      </label>
      <label className="mt-3 block text-xs text-text">
        Espaços adicionais
        <input
          type="number"
          min={0}
          step={1}
          value={extraSlots}
          onChange={(event) =>
            onExtraSlotsChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))
          }
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH outline-none"
        />
      </label>
      <p className="mt-2 text-[11px] text-textMuted">
        Deixe a fórmula vazia para usar a regra original do sistema.
      </p>
    </div>
  )
}

function AbilityExceptionRow({
  type,
  ability,
  learned,
  prepared,
  showLearned,
  showPrepared,
  onLearnedChange,
  onPreparedChange,
}: {
  type: CustomAbilityTypeDefinition
  ability: CustomAbilityInstance
  learned: boolean
  prepared: boolean
  showLearned: boolean
  showPrepared: boolean
  onLearnedChange: (checked: boolean) => void
  onPreparedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-textH">
          {abilityName(type, ability)}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-text">
        {showLearned ? (
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={learned}
              onChange={(event) => onLearnedChange(event.target.checked)}
            />
            Sempre aprendida
          </label>
        ) : null}
        {showPrepared ? (
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={prepared}
              onChange={(event) => onPreparedChange(event.target.checked)}
            />
            Sempre preparada
          </label>
        ) : null}
      </div>
    </div>
  )
}

function countSelectedAlwaysLearned(
  exception: CustomAbilityAcquisitionExceptionState,
): number {
  return new Set([
    ...(exception.alwaysLearnedAbilityIds ?? []),
    ...(exception.alwaysPreparedAbilityIds ?? []),
  ]).size
}

function abilityName(
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
): string {
  const value = ability.values[type.display.titleFieldId]
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  const preset = type.predefinedAbilities?.find(
    (entry) => entry.id === ability.predefinedAbilityId,
  )
  const presetValue = preset?.values[type.display.titleFieldId]
  if (typeof presetValue === 'string' && presetValue.trim()) return presetValue

  return ability.predefinedAbilityId ?? ability.id
}

function usesLearned(type: CustomAbilityTypeDefinition): boolean {
  return type.acquisition?.mode === 'learned'
    || type.acquisition?.mode === 'learnedAndPrepared'
}

function usesPrepared(type: CustomAbilityTypeDefinition): boolean {
  return type.acquisition?.mode === 'prepared'
    || type.acquisition?.mode === 'learnedAndPrepared'
}
