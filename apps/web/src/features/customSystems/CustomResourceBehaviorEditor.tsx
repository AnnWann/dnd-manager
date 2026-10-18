import { Plus, Trash2 } from 'lucide-react'
import { Select } from '../../components/ui/Select'
import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import type { CustomNumericOperation, CustomSystemEventType } from '../../models/customSystems/CustomAutomationDefinition'
import type { CustomSystemEditPermission } from '../../models/customSystems/CustomGenerals'
import type {
  CustomResourceDefinition,
  CustomResourceMaximumMode,
  CustomResourceRecoveryRule,
} from '../../models/customSystems/CustomResourceDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import { FormulaVariablePicker } from './FormulaVariablePicker'

const MAXIMUM_MODES: Array<[CustomResourceMaximumMode, string]> = [
  ['fixed', 'Fixo para todos'],
  ['formula', 'Calculado por fórmula'],
  ['manual', 'Definido por personagem'],
  ['formulaWithOverride', 'Fórmula com ajuste por personagem'],
]

const PERMISSIONS: Array<[CustomSystemEditPermission, string]> = [
  ['ownerAndMaster', 'Dono e mestre'],
  ['owner', 'Apenas dono'],
  ['masterOnly', 'Apenas mestre'],
  ['automaticOnly', 'Somente automações'],
]

const EVENTS: Array<[CustomSystemEventType, string]> = [
  ['shortRestCompleted', 'Descanso curto'],
  ['longRestCompleted', 'Descanso longo'],
  ['combatStarted', 'Início do combate'],
  ['combatEnded', 'Fim do combate'],
  ['turnStarted', 'Início do turno'],
  ['turnEnded', 'Fim do turno'],
  ['manual', 'Somente manual'],
]

const OPERATIONS: Array<[CustomNumericOperation, string]> = [
  ['resetToMaximum', 'Recuperar até o máximo'],
  ['add', 'Adicionar'],
  ['subtract', 'Subtrair'],
  ['set', 'Definir valor'],
  ['multiply', 'Multiplicar'],
]

type Props = {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}

export function CustomResourceBehaviorEditor({ draft, setDraft }: Props) {
  if (!draft.resources.length) return null

  function updateResource(index: number, next: CustomResourceDefinition) {
    setDraft({
      ...draft,
      resources: draft.resources.map((resource, current) => current === index ? next : resource),
    })
  }

  return <section className="mt-5 grid gap-4 border-t border-border pt-5">
    <header>
      <h3 className="text-lg font-semibold text-textH">Comportamento dos recursos</h3>
      <p className="mt-1 text-sm text-text">Defina como o máximo é calculado e o que acontece em descansos e outros eventos.</p>
    </header>

    {draft.resources.map((resource, index) => <ResourceBehavior
      key={resource.id || `resource-behavior-${index}`}
      definition={draft}
      resource={resource}
      onChange={(next) => updateResource(index, next)}
    />)}
  </section>
}

function ResourceBehavior({ definition, resource, onChange }: {
  definition: CustomSystemDefinition
  resource: CustomResourceDefinition
  onChange: (resource: CustomResourceDefinition) => void
}) {
  const variables = listCustomFormulaVariables(definition)
  const mode = resolveMaximumMode(resource)
  const rules = resource.recoveryRules ?? []

  function setMode(nextMode: CustomResourceMaximumMode) {
    onChange({
      ...resource,
      maximumMode: nextMode,
      maximumFormula: nextMode === 'formula' || nextMode === 'formulaWithOverride' ? resource.maximumFormula : undefined,
      maximumEditPermission: nextMode === 'manual' || nextMode === 'formulaWithOverride'
        ? resource.maximumEditPermission ?? 'masterOnly'
        : undefined,
    })
  }

  return <article className="rounded-xl border border-border bg-bg p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="font-semibold text-textH">{resource.name || 'Recurso sem nome'}</h4>
        <p className="mt-1 font-mono text-xs text-text">{resource.id || 'sem-id'}</p>
      </div>
      <span className="rounded-full border border-border px-2 py-1 text-xs text-text">{maximumModeLabel(mode)}</span>
    </div>

    <div className="mt-4 rounded-lg border border-border p-3">
      <h5 className="font-medium text-textH">Máximo</h5>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SelectField label="Comportamento" value={mode} options={MAXIMUM_MODES} onChange={(value) => setMode(value as CustomResourceMaximumMode)} />
        {(mode === 'fixed' || mode === 'manual') ? <NumberField label={mode === 'manual' ? 'Máximo inicial' : 'Máximo fixo'} value={resource.maximum} onChange={(maximum) => onChange({ ...resource, maximum })} /> : null}
        {(mode === 'manual' || mode === 'formulaWithOverride') ? <SelectField label="Quem pode alterar o máximo" value={resource.maximumEditPermission ?? 'masterOnly'} options={PERMISSIONS} onChange={(value) => onChange({ ...resource, maximumEditPermission: value as CustomSystemEditPermission })} /> : null}
      </div>

      {(mode === 'formula' || mode === 'formulaWithOverride') ? <FormulaField
        label="Fórmula do máximo"
        value={resource.maximumFormula ?? ''}
        definition={definition}
        variables={variables}
        onChange={(maximumFormula) => onChange({ ...resource, maximumFormula: maximumFormula || undefined })}
      /> : null}

      <p className="mt-3 text-xs text-text">
        {mode === 'fixed' ? 'O mesmo máximo é usado por todos os personagens.' : null}
        {mode === 'formula' ? 'O máximo é recalculado automaticamente e não pode ser sobrescrito.' : null}
        {mode === 'manual' ? 'Cada personagem mantém seu próprio máximo editável.' : null}
        {mode === 'formulaWithOverride' ? 'A fórmula fornece o valor inicial, mas cada personagem pode receber uma sobrescrita.' : null}
      </p>
    </div>

    <div className="mt-4 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="font-medium text-textH">Recuperação automática</h5>
          <p className="mt-1 text-xs text-text">Uma regra pode recuperar tudo, adicionar uma quantidade ou aplicar uma fórmula.</p>
        </div>
        <button type="button" onClick={() => onChange({ ...resource, recoveryRules: [...rules, newRule()] })} className="inline-flex items-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm text-accent hover:bg-accentBg">
          <Plus className="h-4 w-4" /> Adicionar regra
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {rules.map((rule, index) => <RecoveryRuleRow
          key={rule.id ?? `recovery-${index}`}
          rule={rule}
          definition={definition}
          onChange={(next) => onChange({ ...resource, recoveryRules: rules.map((entry, current) => current === index ? next : entry) })}
          onRemove={() => onChange({ ...resource, recoveryRules: rules.filter((_, current) => current !== index) })}
        />)}
        {!rules.length ? <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text">Este recurso não se recupera automaticamente.</div> : null}
      </div>
    </div>
  </article>
}

function RecoveryRuleRow({ rule, definition, onChange, onRemove }: {
  rule: CustomResourceRecoveryRule
  definition: CustomSystemDefinition
  onChange: (rule: CustomResourceRecoveryRule) => void
  onRemove: () => void
}) {
  const needsValue = rule.operation !== 'resetToMaximum'
  return <article className="rounded-lg border border-border p-3">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SelectField label="Quando" value={rule.event} options={EVENTS} onChange={(event) => onChange({ ...rule, event: event as CustomSystemEventType })} />
      <SelectField label="Alvo" value={rule.target ?? 'current'} options={[["current", "Valor atual"], ["temporary", "Valor temporário"]]} onChange={(target) => onChange({ ...rule, target: target as 'current' | 'temporary' })} />
      <SelectField label="Operação" value={rule.operation} options={OPERATIONS} onChange={(operation) => onChange({ ...rule, operation: operation as CustomNumericOperation })} />
      {needsValue ? <NumberField label="Quantidade fixa" value={rule.value} onChange={(value) => onChange({ ...rule, value })} /> : <div />}
    </div>

    {needsValue ? <FormulaField label="Fórmula opcional" value={rule.formula ?? ''} definition={definition} variables={listCustomFormulaVariables(definition)} onChange={(formula) => onChange({ ...rule, formula: formula || undefined })} /> : null}

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-4 text-sm text-textH">
        <Check label="Regra ativa" checked={rule.enabled !== false} onChange={(enabled) => onChange({ ...rule, enabled })} />
        <Check label="Escalar em descanso parcial" checked={rule.scaleWithRestFraction !== false} onChange={(scaleWithRestFraction) => onChange({ ...rule, scaleWithRestFraction })} />
      </div>
      <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Remover</button>
    </div>
  </article>
}

function FormulaField({ label, value, definition, variables, onChange }: {
  label: string
  value: string
  definition: CustomSystemDefinition
  variables: ReturnType<typeof listCustomFormulaVariables>
  onChange: (value: string) => void
}) {
  const error = value.trim() ? validateCustomFormula(value, definition) : undefined
  return <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg/20 p-3">
    <label className="grid gap-1"><span className="label">{label}</span><input className="input-base" value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <div className="mt-2"><FormulaVariablePicker variables={variables} onSelect={(path) => onChange(`${value}${value.trim() ? ' ' : ''}${path}`)} /></div>
    {value ? <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? 'Fórmula válida.'}</div> : null}
  </div>
}

function newRule(): CustomResourceRecoveryRule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    event: 'longRestCompleted',
    target: 'current',
    operation: 'resetToMaximum',
    scaleWithRestFraction: true,
  }
}

function resolveMaximumMode(resource: CustomResourceDefinition): CustomResourceMaximumMode {
  if (resource.maximumMode) return resource.maximumMode
  return resource.maximumFormula ? 'formula' : 'fixed'
}

function maximumModeLabel(mode: CustomResourceMaximumMode) {
  return MAXIMUM_MODES.find(([value]) => value === mode)?.[1] ?? mode
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><Select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</Select></label>
}

function NumberField({ label, value, onChange }: { label: string; value?: number; onChange: (value: number | undefined) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base" type="number" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))} /></label>
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>
}
