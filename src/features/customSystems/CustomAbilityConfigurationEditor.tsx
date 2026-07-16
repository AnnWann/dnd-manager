import { Plus, Trash2 } from 'lucide-react'
import { Select } from '../../components/ui/Select'
import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import type {
  CustomAbilityAcquisitionDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomAbilityTypeDefinition,
  CustomUsageResetKind,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import { FormulaVariablePicker } from './FormulaVariablePicker'

const NATIVE_RESOURCES = [
  { value: 'hitPoints', label: 'Pontos de vida' },
  { value: 'temporaryHitPoints', label: 'Pontos de vida temporários' },
  { value: 'inspiration', label: 'Inspiração' },
  { value: 'exhaustion', label: 'Exaustão' },
] as const

export function CustomAbilityConfigurationEditor({
  draft,
  setDraft,
  definitions,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
  definitions: CustomSystemDefinition[]
}) {
  if (!draft.abilityTypes.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text">
        Crie primeiro um tipo de habilidade em Avançado → Tipos de habilidade.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <header>
        <h2 className="text-lg font-semibold text-textH">Regras das habilidades</h2>
        <p className="mt-1 text-sm text-text">
          Configure aprendizado, preparo, usos e alterações de recursos para cada tipo de habilidade.
        </p>
      </header>

      {draft.abilityTypes.map((type, index) => (
        <AbilityTypeRules
          key={type.id || `ability-type-${index}`}
          type={type}
          definitions={definitions}
          currentSystem={draft}
          onChange={(next) =>
            setDraft({
              ...draft,
              abilityTypes: draft.abilityTypes.map((entry, current) => current === index ? next : entry),
            })
          }
        />
      ))}
    </div>
  )
}

function AbilityTypeRules({
  type,
  definitions,
  currentSystem,
  onChange,
}: {
  type: CustomAbilityTypeDefinition
  definitions: CustomSystemDefinition[]
  currentSystem: CustomSystemDefinition
  onChange: (type: CustomAbilityTypeDefinition) => void
}) {
  const acquisition = normalizeAcquisition(type.acquisition)
  const activation = type.activation ?? {}
  const usage = activation.usage ?? { mode: 'unlimited' as const, reset: 'manual' as const }
  const changes = activation.resourceChanges ?? []

  function setAcquisition(patch: Partial<CustomAbilityAcquisitionDefinition>) {
    onChange({ ...type, acquisition: { ...acquisition, ...patch } })
  }

  function setUsage(patch: Partial<typeof usage>) {
    onChange({
      ...type,
      activation: {
        ...activation,
        usage: { ...usage, ...patch },
      },
    })
  }

  function setChanges(next: CustomAbilityResourceChangeDefinition[]) {
    onChange({
      ...type,
      activation: { ...activation, resourceChanges: next },
    })
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-textH">{type.name}</h3>
          <p className="mt-1 font-mono text-xs text-text">{type.id}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-xs text-text">
          {acquisitionLabel(acquisition.mode)}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <Subsection title="Aquisição e preparo" description="Defina como a habilidade entra na ficha e se precisa ser preparada para uso.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Modelo"
              value={acquisition.mode}
              onChange={(value) => setAcquisition({ mode: value as CustomAbilityAcquisitionDefinition['mode'] })}
              options={[
                ['granted', 'Concedida automaticamente'],
                ['learned', 'Aprendida'],
                ['prepared', 'Preparada diretamente'],
                ['learnedAndPrepared', 'Aprendida e preparada'],
              ]}
            />

            {usesLearnedState(acquisition.mode) ? <>
              <NumberField label="Limite aprendido" value={acquisition.learnedLimit} onChange={(learnedLimit) => setAcquisition({ learnedLimit })} placeholder="Sem limite" />
              <FormulaField
                label="Fórmula do limite aprendido"
                definition={currentSystem}
                value={acquisition.learnedLimitFormula ?? ''}
                onChange={(learnedLimitFormula) => setAcquisition({ learnedLimitFormula: learnedLimitFormula || undefined })}
                placeholder="Ex.: character.level + 2"
              />
            </> : null}

            {usesPreparedState(acquisition.mode) ? <>
              <NumberField label="Limite preparado" value={acquisition.preparedLimit} onChange={(preparedLimit) => setAcquisition({ preparedLimit })} placeholder="Sem limite" />
              <FormulaField
                label="Fórmula do limite preparado"
                definition={currentSystem}
                value={acquisition.preparedLimitFormula ?? ''}
                onChange={(preparedLimitFormula) => setAcquisition({ preparedLimitFormula: preparedLimitFormula || undefined })}
                placeholder="Ex.: character.proficiencyBonus"
              />
              <SelectField
                label="Alterar preparo"
                value={acquisition.preparationReset ?? 'manual'}
                onChange={(preparationReset) => setAcquisition({ preparationReset: preparationReset as 'manual' | 'shortRest' | 'longRest' })}
                options={[
                  ['manual', 'A qualquer momento'],
                  ['shortRest', 'Durante descanso curto'],
                  ['longRest', 'Durante descanso longo'],
                ]}
              />
            </> : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-textH">
            {usesLearnedState(acquisition.mode) ? (
              <Check label="Novas habilidades começam aprendidas" checked={acquisition.defaultLearned !== false} onChange={(defaultLearned) => setAcquisition({ defaultLearned })} />
            ) : null}
            {usesPreparedState(acquisition.mode) ? (
              <Check label="Novas habilidades começam preparadas" checked={Boolean(acquisition.defaultPrepared)} onChange={(defaultPrepared) => setAcquisition({ defaultPrepared })} />
            ) : null}
          </div>
        </Subsection>

        <Subsection title="Usos" description="Escolha entre habilidades infinitas ou uma quantidade limitada de utilizações.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Quantidade de usos"
              value={usage.mode ?? (usage.maximum !== undefined || usage.maximumFormula ? 'limited' : 'unlimited')}
              onChange={(mode) => setUsage({ mode: mode as 'unlimited' | 'limited' })}
              options={[
                ['unlimited', 'Usos infinitos'],
                ['limited', 'Usos limitados'],
              ]}
            />
            {(usage.mode ?? (usage.maximum !== undefined ? 'limited' : 'unlimited')) === 'limited' ? <>
              <NumberField label="Máximo fixo" value={usage.maximum} onChange={(maximum) => setUsage({ maximum })} placeholder="Opcional" />
              <FormulaField
                label="Fórmula do máximo"
                definition={currentSystem}
                value={usage.maximumFormula ?? ''}
                onChange={(maximumFormula) => setUsage({ maximumFormula: maximumFormula || undefined })}
                placeholder="Ex.: character.proficiencyBonus"
              />
              <SelectField
                label="Recuperação"
                value={usage.reset}
                onChange={(reset) => setUsage({ reset: reset as CustomUsageResetKind })}
                options={[
                  ['turn', 'Início do turno'],
                  ['combat', 'Fim do combate'],
                  ['shortRest', 'Descanso curto'],
                  ['longRest', 'Descanso longo'],
                  ['manual', 'Manual'],
                  ['never', 'Nunca'],
                ]}
              />
            </> : null}
          </div>
        </Subsection>

        <Subsection title="Recursos consumidos ou gerados" description="Cada uso pode gastar, gerar ou definir um recurso nativo ou de qualquer sistema instalado.">
          <div className="grid gap-3">
            {changes.map((change, index) => (
              <ResourceChangeRow
                key={change.id}
                change={change}
                definitions={definitions}
                currentSystem={currentSystem}
                onChange={(next) => setChanges(changes.map((entry, current) => current === index ? next : entry))}
                onRemove={() => setChanges(changes.filter((_, current) => current !== index))}
              />
            ))}
            {!changes.length ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text">
                Esta habilidade não altera recursos.
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setChanges([...changes, newResourceChange(currentSystem)])}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm text-accent hover:bg-accentBg"
          >
            <Plus className="h-4 w-4" /> Adicionar alteração de recurso
          </button>
        </Subsection>
      </div>
    </section>
  )
}

function ResourceChangeRow({
  change,
  definitions,
  currentSystem,
  onChange,
  onRemove,
}: {
  change: CustomAbilityResourceChangeDefinition
  definitions: CustomSystemDefinition[]
  currentSystem: CustomSystemDefinition
  onChange: (change: CustomAbilityResourceChangeDefinition) => void
  onRemove: () => void
}) {
  const customTarget = change.target.source === 'customSystem' ? change.target : undefined
  const selectedSystemId = customTarget?.systemId ?? currentSystem.id
  const selectedSystem = definitions.find((entry) => entry.id === selectedSystemId) ?? (currentSystem.id === selectedSystemId ? currentSystem : undefined)

  return (
    <article className="rounded-lg border border-border p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SelectField
          label="Operação"
          value={change.operation}
          onChange={(operation) => onChange({ ...change, operation: operation as CustomAbilityResourceChangeDefinition['operation'] })}
          options={[
            ['spend', 'Gastar'],
            ['gain', 'Gerar'],
            ['set', 'Definir valor'],
          ]}
        />
        <SelectField
          label="Origem"
          value={change.target.source}
          onChange={(source) => onChange({
            ...change,
            target: source === 'native'
              ? { source: 'native', resource: 'hitPoints' }
              : { source: 'customSystem', systemId: currentSystem.id, resourceId: currentSystem.resources[0]?.id ?? '' },
          })}
          options={[
            ['native', 'Recurso nativo'],
            ['customSystem', 'Sistema personalizado'],
          ]}
        />

        {change.target.source === 'native' ? (
          <SelectField
            label="Recurso"
            value={change.target.resource}
            onChange={(resource) => onChange({ ...change, target: { source: 'native', resource: resource as typeof change.target.resource } })}
            options={NATIVE_RESOURCES.map((entry) => [entry.value, entry.label])}
          />
        ) : <>
          <SelectField
            label="Sistema"
            value={selectedSystemId}
            onChange={(systemId) => {
              const system = definitions.find((entry) => entry.id === systemId) ?? (currentSystem.id === systemId ? currentSystem : undefined)
              onChange({ ...change, target: { source: 'customSystem', systemId, resourceId: system?.resources[0]?.id ?? '' } })
            }}
            options={uniqueSystems(currentSystem, definitions).map((entry) => [entry.id, entry.name])}
          />
          <SelectField
            label="Recurso"
            value={customTarget?.resourceId ?? ''}
            onChange={(resourceId) => onChange({ ...change, target: { source: 'customSystem', systemId: selectedSystemId, resourceId } })}
            options={(selectedSystem?.resources ?? []).map((entry) => [entry.id, entry.name])}
          />
        </>}

        <NumberField label="Quantidade" value={change.amount} onChange={(amount) => onChange({ ...change, amount })} placeholder="1" />
      </div>
      <div className="mt-3">
        <FormulaField
          label="Fórmula opcional"
          definition={currentSystem}
          value={change.formula ?? ''}
          onChange={(formula) => onChange({ ...change, formula: formula || undefined })}
          placeholder="Substitui a quantidade fixa"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" /> Remover
        </button>
      </div>
    </article>
  )
}

function FormulaField({
  label,
  definition,
  value,
  onChange,
  placeholder,
}: {
  label: string
  definition: CustomSystemDefinition
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const variables = listCustomFormulaVariables(definition)
  const error = value.trim() ? validateCustomFormula(value, definition) : undefined

  return <div className="rounded-lg border border-accentBorder bg-accentBg/30 p-3">
    <label className="grid min-w-0 gap-1">
      <span className="label">{label}</span>
      <input
        className="input-base font-mono"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <FormulaVariablePicker
        variables={variables}
        onSelect={(path) => onChange(`${value}${value.trim() ? ' ' : ''}${path}`)}
      />
      <span className="text-xs text-text">Funções: <code>min</code>, <code>max</code>, <code>round</code>, <code>floor</code>, <code>ceil</code>, <code>abs</code>, <code>clamp</code> e <code>if</code>.</span>
    </div>
    {value.trim() ? <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? 'Fórmula válida.'}</div> : null}
  </div>
}

function normalizeAcquisition(value?: CustomAbilityAcquisitionDefinition): CustomAbilityAcquisitionDefinition {
  return value ?? {
    mode: 'learned',
    defaultLearned: true,
    defaultPrepared: false,
    preparationReset: 'manual',
  }
}

function usesLearnedState(mode: CustomAbilityAcquisitionDefinition['mode']) {
  return mode === 'learned' || mode === 'learnedAndPrepared'
}

function usesPreparedState(mode: CustomAbilityAcquisitionDefinition['mode']) {
  return mode === 'prepared' || mode === 'learnedAndPrepared'
}

function acquisitionLabel(mode: CustomAbilityAcquisitionDefinition['mode']) {
  if (mode === 'granted') return 'Concedida'
  if (mode === 'prepared') return 'Preparada'
  if (mode === 'learnedAndPrepared') return 'Aprendida e preparada'
  return 'Aprendida'
}

function newResourceChange(system: CustomSystemDefinition): CustomAbilityResourceChangeDefinition {
  return {
    id: crypto.randomUUID(),
    operation: 'spend',
    target: system.resources.length
      ? { source: 'customSystem', systemId: system.id, resourceId: system.resources[0].id }
      : { source: 'native', resource: 'hitPoints' },
    amount: 1,
  }
}

function uniqueSystems(current: CustomSystemDefinition, definitions: CustomSystemDefinition[]) {
  return Array.from(new Map([current, ...definitions].map((entry) => [entry.id, entry])).values())
}

function Subsection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border p-3"><h4 className="font-medium text-textH">{title}</h4>{description ? <p className="mt-1 text-xs text-text">{description}</p> : null}<div className="mt-3">{children}</div></section>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><Select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</Select></label>
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value?: number; onChange: (value: number | undefined) => void; placeholder?: string }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base" type="number" min={0} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0))} /></label>
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>
}
