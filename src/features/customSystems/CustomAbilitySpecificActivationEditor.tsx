import type { ReactNode } from 'react'

import type { AbilityActionKind, AbilityKind } from '../../models/abilities/Ability'
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomAbilityTypeDefinition,
  CustomPredefinedAbilityDefinition,
  CustomUsageResetKind,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import {
  AbilityConditionChangesEditor,
  ResourceAmountFormulaField,
} from './CustomAbilityEffectEditors'
import { FormulaVariablePicker } from './FormulaVariablePicker'

const NATIVE_RESOURCES = [
  ['hitPoints', 'Pontos de vida'],
  ['temporaryHitPoints', 'Pontos de vida temporários'],
  ['inspiration', 'Inspiração'],
  ['exhaustion', 'Exaustão'],
] as const
const ACTION_KINDS: Array<[AbilityActionKind | '', string]> = [
  ['', 'Herdar do tipo'], ['action', 'Ação'], ['bonusAction', 'Ação bônus'],
  ['reaction', 'Reação'], ['free', 'Ação livre'], ['legendaryAction', 'Ação lendária'],
  ['legendaryReaction', 'Reação lendária'], ['legendaryResistance', 'Resistência lendária'],
]
const ABILITY_KINDS: Array<[AbilityKind | '', string]> = [
  ['', 'Herdar do tipo'], ['active', 'Ativa'], ['passive', 'Passiva'], ['feature', 'Característica'],
]
const RESET_KINDS: Array<[CustomUsageResetKind, string]> = [
  ['turn', 'Início do turno'], ['combat', 'Fim do combate'], ['shortRest', 'Descanso curto'],
  ['longRest', 'Descanso longo'], ['manual', 'Manual'], ['never', 'Nunca'],
]

type Props = {
  definition: CustomSystemDefinition
  abilityType: CustomAbilityTypeDefinition
  ability: CustomPredefinedAbilityDefinition
  onChange: (ability: CustomPredefinedAbilityDefinition) => void
}

export function CustomAbilitySpecificActivationEditor({ definition, abilityType, ability, onChange }: Props) {
  const activation = ability.activation
  const usageMode = !activation?.usage ? 'inherit' : (activation.usage.mode ?? 'limited')
  const resourceMode = activation?.resourceChanges === undefined ? 'inherit' : 'specific'
  const conditionMode = activation?.conditionChanges === undefined ? 'inherit' : 'specific'

  const setActivation = (next: CustomAbilityActivationDefinition | undefined) =>
    onChange({ ...ability, activation: next })
  const patchActivation = (patch: Partial<CustomAbilityActivationDefinition>) =>
    setActivation({ ...(activation ?? {}), ...patch })

  function setUsageMode(mode: 'inherit' | 'unlimited' | 'limited') {
    const next = { ...(activation ?? {}) }
    if (mode === 'inherit') delete next.usage
    else if (mode === 'unlimited') next.usage = { mode: 'unlimited', reset: 'manual' }
    else next.usage = {
      mode: 'limited',
      reset: activation?.usage?.reset ?? 'manual',
      maximum: activation?.usage?.maximum,
      maximumFormula: activation?.usage?.maximumFormula,
    }
    setActivation(next)
  }

  function patchUsage(patch: Partial<NonNullable<CustomAbilityActivationDefinition['usage']>>) {
    patchActivation({
      usage: {
        mode: 'limited',
        reset: activation?.usage?.reset ?? 'manual',
        ...activation?.usage,
        ...patch,
      },
    })
  }

  function setResourceMode(mode: 'inherit' | 'specific') {
    const next = { ...(activation ?? {}) }
    if (mode === 'inherit') delete next.resourceChanges
    else next.resourceChanges = activation?.resourceChanges ?? []
    setActivation(next)
  }

  function setConditionMode(mode: 'inherit' | 'specific') {
    const next = { ...(activation ?? {}) }
    if (mode === 'inherit') delete next.conditionChanges
    else next.conditionChanges = activation?.conditionChanges ?? []
    setActivation(next)
  }

  const setResourceChanges = (resourceChanges: CustomAbilityResourceChangeDefinition[]) =>
    patchActivation({ resourceChanges })

  return (
    <section className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-textH">Ativação, usos e efeitos desta habilidade</h4>
          <p className="mt-1 text-xs leading-5 text-text">
            O tipo define o padrão. Ative uma configuração específica apenas para exceções desta entrada do compêndio.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-textH">
          <input
            type="checkbox"
            checked={activation !== undefined}
            onChange={(event) => setActivation(event.target.checked ? {} : undefined)}
          />
          Configuração específica
        </label>
      </div>

      {!activation ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-xs text-text">
          Herdando ativação, categoria de ação, usos, recursos e condições do tipo.
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Tipo geral"
              value={activation.kind ?? ''}
              options={ABILITY_KINDS}
              onChange={(kind) => patchActivation({ kind: (kind || undefined) as AbilityKind | undefined })}
            />
            <SelectField
              label="Ação"
              value={normalizeActionKind(activation.actionKind) ?? ''}
              options={ACTION_KINDS}
              onChange={(actionKind) => patchActivation({ actionKind: (actionKind || undefined) as AbilityActionKind | undefined })}
            />
          </div>

          <div className="rounded-lg border border-border bg-bg-subtle p-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Usos"
                value={usageMode}
                options={[['inherit', 'Herdar do tipo'], ['unlimited', 'Ilimitados'], ['limited', 'Limitados']]}
                onChange={(mode) => setUsageMode(mode as 'inherit' | 'unlimited' | 'limited')}
              />
              {usageMode === 'limited' ? <>
                <NumberField
                  label="Máximo fixo"
                  value={activation.usage?.maximum}
                  placeholder="Opcional"
                  onChange={(maximum) => patchUsage({ maximum })}
                />
                <SelectField
                  label="Recuperação"
                  value={activation.usage?.reset ?? 'manual'}
                  options={RESET_KINDS}
                  onChange={(reset) => patchUsage({ reset: reset as CustomUsageResetKind })}
                />
              </> : null}
            </div>
            {usageMode === 'limited' ? (
              <FormulaField
                definition={definition}
                abilityType={abilityType}
                label="Fórmula do máximo"
                value={activation.usage?.maximumFormula ?? ''}
                placeholder="Ex.: ability.nivel + character.proficiencyBonus"
                onChange={(maximumFormula) => patchUsage({ maximumFormula: maximumFormula || undefined })}
              />
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-bg-subtle p-3">
            <SelectField
              label="Alterações de recurso"
              value={resourceMode}
              options={[['inherit', 'Herdar do tipo'], ['specific', 'Configurar para esta habilidade']]}
              onChange={(mode) => setResourceMode(mode as 'inherit' | 'specific')}
            />
            {resourceMode === 'specific' ? (
              <div className="mt-3 grid gap-3">
                {(activation.resourceChanges ?? []).map((change, index) => (
                  <ResourceChangeRow
                    key={change.id}
                    definition={definition}
                    abilityType={abilityType}
                    change={change}
                    onChange={(next) => setResourceChanges(
                      (activation.resourceChanges ?? []).map((entry, current) => current === index ? next : entry),
                    )}
                    onRemove={() => setResourceChanges(
                      (activation.resourceChanges ?? []).filter((_, current) => current !== index),
                    )}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setResourceChanges([...(activation.resourceChanges ?? []), newResourceChange(definition)])}
                  className="justify-self-start rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"
                >
                  Adicionar alteração de recurso
                </button>
                {!(activation.resourceChanges ?? []).length ? (
                  <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-text">
                    Lista vazia: esta habilidade não altera recursos, mesmo que o tipo altere.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-bg-subtle p-3">
            <SelectField
              label="Condições / estados"
              value={conditionMode}
              options={[['inherit', 'Herdar do tipo'], ['specific', 'Configurar para esta habilidade']]}
              onChange={(mode) => setConditionMode(mode as 'inherit' | 'specific')}
            />
            {conditionMode === 'specific' ? (
              <div className="mt-3">
                <AbilityConditionChangesEditor
                  value={activation.conditionChanges ?? []}
                  onChange={(conditionChanges) => patchActivation({ conditionChanges })}
                  emptyLabel="Lista vazia: esta habilidade não altera condições, mesmo que o tipo altere."
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}

function ResourceChangeRow({ definition, abilityType, change, onChange, onRemove }: {
  definition: CustomSystemDefinition
  abilityType: CustomAbilityTypeDefinition
  change: CustomAbilityResourceChangeDefinition
  onChange: (change: CustomAbilityResourceChangeDefinition) => void
  onRemove: () => void
}) {
  const custom = change.target.source === 'customSystem'
  const targetValue = change.target.source === 'customSystem'
    ? change.target.resourceId
    : change.target.resource
  const resourceOptions: ReadonlyArray<readonly [string, string]> =
    change.target.source === 'customSystem'
      ? definition.resources.map((resource) => [resource.id, resource.name] as const)
      : NATIVE_RESOURCES

  return (
    <article className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <FieldCell><SelectField label="Operação" value={change.operation}
          options={[['spend', 'Gastar'], ['gain', 'Gerar'], ['set', 'Definir']]}
          onChange={(operation) => onChange({ ...change, operation: operation as CustomAbilityResourceChangeDefinition['operation'] })}
        /></FieldCell>
        <FieldCell><SelectField label="Origem" value={change.target.source}
          options={[['native', 'Ficha normal'], ['customSystem', 'Este sistema']]}
          onChange={(source) => onChange({
            ...change,
            target: source === 'native'
              ? { source: 'native', resource: 'hitPoints' }
              : { source: 'customSystem', systemId: definition.id, resourceId: definition.resources[0]?.id ?? '' },
          })}
        /></FieldCell>
        <FieldCell><SelectField label="Recurso" value={targetValue} options={resourceOptions}
          onChange={(resource) => onChange({
            ...change,
            target: custom
              ? { source: 'customSystem', systemId: definition.id, resourceId: resource }
              : { source: 'native', resource: resource as 'hitPoints' | 'temporaryHitPoints' | 'inspiration' | 'exhaustion' },
          })}
        /></FieldCell>
        <ResourceAmountFormulaField definition={definition} abilityType={abilityType} change={change} onChange={onChange} />
        <button type="button" onClick={onRemove}
          className="shrink-0 rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">
          Remover
        </button>
      </div>
    </article>
  )
}

function FormulaField({ definition, abilityType, label, value, onChange, placeholder }: {
  definition: CustomSystemDefinition
  abilityType: CustomAbilityTypeDefinition
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const error = value.trim() ? validateCustomFormula(value, definition, abilityType) : undefined
  return (
    <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg/30 p-3">
      <label className="grid min-w-0 gap-1"><span className="label">{label}</span>
        <input className="input-base min-w-0 w-full font-mono" value={value} placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)} />
      </label>
      <div className="mt-2">
        <FormulaVariablePicker variables={listCustomFormulaVariables(definition, abilityType)}
          onSelect={(path) => onChange(`${value}${value.trim() ? ' ' : ''}${path}`)} />
      </div>
      {value.trim() ? <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>
        {error ?? 'Fórmula válida.'}
      </div> : null}
    </div>
  )
}

function FieldCell({ children }: { children: ReactNode }) {
  return <div className="min-w-[11rem] flex-[1_1_11rem]">{children}</div>
}

function SelectField({ label, value, options, onChange }: {
  label: string
  value: string
  options: ReadonlyArray<readonly [string, string]>
  onChange: (value: string) => void
}) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span>
    <select className="input-base min-w-0 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([id, name]) => <option key={id || 'inherit'} value={id}>{name}</option>)}
    </select>
  </label>
}

function NumberField({ label, value, onChange, placeholder }: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
}) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span>
    <input type="number" min={0} className="input-base min-w-0 w-full" value={value ?? ''} placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value.trim()
        onChange(raw ? Math.max(0, Number(raw) || 0) : undefined)
      }} />
  </label>
}

function newResourceChange(definition: CustomSystemDefinition): CustomAbilityResourceChangeDefinition {
  return definition.resources.length
    ? { id: crypto.randomUUID(), target: { source: 'customSystem', systemId: definition.id, resourceId: definition.resources[0].id }, operation: 'spend', amount: 1 }
    : { id: crypto.randomUUID(), target: { source: 'native', resource: 'hitPoints' }, operation: 'spend', amount: 1 }
}

function normalizeActionKind(value: unknown): AbilityActionKind | undefined {
  if (value === 'freeAction') return 'free'
  return ACTION_KINDS.some(([kind]) => kind && kind === value) ? value as AbilityActionKind : undefined
}
