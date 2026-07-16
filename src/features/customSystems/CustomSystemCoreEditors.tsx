import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Select as UiSelect } from '../../components/ui/Select'
import { FormulaVariablePicker } from './FormulaVariablePicker'
import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import type { CustomFieldDefinition, CustomSelectOption } from '../../models/customSystems/CustomFieldDefinition'
import type { CustomResourceDefinition } from '../../models/customSystems/CustomResourceDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

type EditorProps = {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}

const FIELD_TYPES: Array<{ value: CustomFieldDefinition['type']; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'richText', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'select', label: 'Seleção' },
  { value: 'multiSelect', label: 'Seleção múltipla' },
  { value: 'dice', label: 'Dado' },
  { value: 'reference', label: 'Referência' },
  { value: 'formula', label: 'Fórmula' },
]

const PERMISSIONS: Array<{ value: NonNullable<CustomFieldDefinition['editPermission']>; label: string }> = [
  { value: 'ownerAndMaster', label: 'Dono e mestre' },
  { value: 'owner', label: 'Apenas dono' },
  { value: 'masterOnly', label: 'Apenas mestre' },
  { value: 'automaticOnly', label: 'Somente automático' },
]

const RESOURCE_TYPES: Array<{ value: CustomResourceDefinition['type']; label: string }> = [
  { value: 'number', label: 'Número' },
  { value: 'checkboxes', label: 'Caixas' },
  { value: 'dicePool', label: 'Conjunto de dados' },
  { value: 'charges', label: 'Cargas' },
]

export function CustomSystemGeneralEditor({ draft, setDraft }: EditorProps) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Input label="Nome" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
    <Input label="ID estável" value={draft.id} onChange={(id) => setDraft({ ...draft, id: slugifyCustomSystemId(id) })} />
    <Input label="Versão" type="number" value={String(draft.version)} onChange={(value) => setDraft({ ...draft, version: Math.max(1, Math.trunc(Number(value) || 1)) })} />
    <Input label="Ícone" value={draft.icon ?? ''} onChange={(icon) => setDraft({ ...draft, icon: icon || undefined })} />
    <label className="grid gap-1 md:col-span-2">
      <span className="label">Descrição</span>
      <textarea className="input-base min-h-28" value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
    </label>
    <Input label="Tags" value={(draft.tags ?? []).join(', ')} onChange={(value) => setDraft({ ...draft, tags: value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
  </div>
}

export function CustomSystemFieldsEditor({ draft, setDraft }: EditorProps) {
  return <Collection
    title="Campos"
    onAdd={() => setDraft({ ...draft, fields: [...draft.fields, newField()] })}
    empty="Nenhum campo criado."
  >
    {draft.fields.map((field, index) => <FieldRow
      key={`field-row-${index}`}
      definition={draft}
      field={field}
      onChange={(next) => setDraft({ ...draft, fields: draft.fields.map((entry, current) => current === index ? next : entry) })}
      onRemove={() => setDraft({ ...draft, fields: draft.fields.filter((_, current) => current !== index) })}
    />)}
  </Collection>
}

function FieldRow({ definition, field, onChange, onRemove }: {
  definition: CustomSystemDefinition
  field: CustomFieldDefinition
  onChange: (field: CustomFieldDefinition) => void
  onRemove: () => void
}) {
  return <article className="rounded-lg border border-border p-3">
    <div className="grid gap-3 md:grid-cols-4">
      <Input label="Nome" value={field.name} onChange={(name) => onChange({ ...field, name })} />
      <Input label="ID" value={field.id} onChange={(id) => onChange({ ...field, id: slugifyCustomSystemId(id) })} />
      <SelectField label="Tipo" value={field.type} options={FIELD_TYPES} onChange={(type) => onChange(convertFieldType(field, type as CustomFieldDefinition['type']))} />
      <SelectField label="Permissão" value={field.editPermission ?? 'ownerAndMaster'} options={PERMISSIONS} onChange={(value) => onChange({ ...field, editPermission: value as CustomFieldDefinition['editPermission'] })} />
    </div>

    {(field.type === 'select' || field.type === 'multiSelect')
      ? <OptionListEditor options={field.options} onChange={(options) => onChange({ ...field, options })} />
      : null}

    {field.type === 'formula'
      ? <FormulaEditor
          definition={definition}
          formula={field.formula}
          resultType={field.resultType}
          onChange={(formula, resultType) => onChange({ ...field, formula, resultType })}
        />
      : null}

    <div className="mt-3 flex justify-end">
      <Button danger onClick={onRemove}><Trash2 className="h-4 w-4" /> Remover</Button>
    </div>
  </article>
}

function OptionListEditor({ options, onChange }: {
  options: CustomSelectOption[]
  onChange: (options: CustomSelectOption[]) => void
}) {
  const [advanced, setAdvanced] = useState(false)

  function addOption() {
    const label = `Opção ${options.length + 1}`
    onChange([...options, { label, value: uniqueOptionValue(slugifyCustomSystemId(label), options) }])
  }

  function updateLabel(index: number, label: string) {
    const current = options[index]
    const followsGeneratedValue = !current.value || current.value === slugifyCustomSystemId(current.label) || /^option-\d+$/.test(current.value)
    onChange(options.map((option, currentIndex) => currentIndex === index
      ? {
          ...option,
          label,
          value: followsGeneratedValue
            ? uniqueOptionValue(slugifyCustomSystemId(label), options, index)
            : current.value,
        }
      : option))
  }

  return <section className="mt-3 rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-medium text-textH">Opções</h4>
        <p className="mt-1 text-xs text-text">Adicione os nomes que poderão ser escolhidos na ficha.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAdvanced(!advanced)} className="rounded-lg border border-border px-3 py-2 text-xs text-text hover:bg-accentBg">
          {advanced ? 'Ocultar opções avançadas' : 'Opções avançadas'}
        </button>
        <Button primary onClick={addOption}><Plus className="h-4 w-4" /> Adicionar opção</Button>
      </div>
    </div>

    <div className="mt-3 grid gap-2">
      {options.map((option, index) => <div key={`option-row-${index}`} className={`grid gap-2 rounded-lg border border-border p-2 ${advanced ? 'md:grid-cols-[1fr_1fr_auto]' : 'md:grid-cols-[1fr_auto]'}`}>
        <Input label={`Opção ${index + 1}`} value={option.label} onChange={(label) => updateLabel(index, label)} />
        {advanced ? <Input label="Identificador interno" value={option.value} onChange={(value) => onChange(options.map((entry, current) => current === index ? { ...entry, value: slugifyCustomSystemId(value) } : entry))} /> : null}
        <div className="flex items-end"><IconButton title="Remover opção" onClick={() => onChange(options.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></IconButton></div>
      </div>)}
      {!options.length ? <Empty>Nenhuma opção adicionada.</Empty> : null}
    </div>
  </section>
}

function FormulaEditor({ definition, formula, resultType, onChange }: {
  definition: CustomSystemDefinition
  formula: string
  resultType: 'number' | 'text' | 'boolean'
  onChange: (formula: string, resultType: 'number' | 'text' | 'boolean') => void
}) {
  const variables = listCustomFormulaVariables(definition)
  const error = formula.trim() ? validateCustomFormula(formula, definition) : 'Informe uma expressão.'
  return <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg/30 p-3">
    <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
      <SelectField
        label="Tipo do resultado"
        value={resultType}
        options={[
          { value: 'number', label: 'Número' },
          { value: 'text', label: 'Texto' },
          { value: 'boolean', label: 'Sim/Não' },
        ]}
        onChange={(value) => onChange(formula, value as typeof resultType)}
      />
      <Input label="Expressão" value={formula} onChange={(value) => onChange(value, resultType)} />
    </div>
    <div className="mt-3"><FormulaVariablePicker variables={variables} onSelect={(path) => onChange(`${formula}${formula.trim() ? ' ' : ''}${path}`, resultType)} /></div>
    <div className="mt-3 text-xs text-text">Funções: <code>min</code>, <code>max</code>, <code>round</code>, <code>floor</code>, <code>ceil</code>, <code>abs</code>, <code>clamp</code> e <code>if</code>.</div>
    <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? 'Fórmula válida.'}</div>
  </div>
}

export function CustomSystemResourcesEditor({ draft, setDraft }: EditorProps) {
  return <Collection
    title="Recursos"
    onAdd={() => setDraft({ ...draft, resources: [...draft.resources, newResource()] })}
    empty="Nenhum recurso criado."
  >
    {draft.resources.map((resource, index) => <ResourceRow
      key={`resource-row-${index}`}
      definition={draft}
      resource={resource}
      onChange={(next) => setDraft({ ...draft, resources: draft.resources.map((entry, current) => current === index ? next : entry) })}
      onRemove={() => setDraft({ ...draft, resources: draft.resources.filter((_, current) => current !== index) })}
    />)}
  </Collection>
}

function ResourceRow({ definition, resource, onChange, onRemove }: {
  definition: CustomSystemDefinition
  resource: CustomResourceDefinition
  onChange: (resource: CustomResourceDefinition) => void
  onRemove: () => void
}) {
  const formula = resource.maximumFormula ?? ''
  const variables = listCustomFormulaVariables(definition)
  const formulaError = formula ? validateCustomFormula(formula, definition) : undefined

  return <article className="rounded-lg border border-border p-3">
    <div className="grid gap-3 md:grid-cols-4">
      <Input label="Nome" value={resource.name} onChange={(name) => onChange({ ...resource, name })} />
      <Input label="ID" value={resource.id} onChange={(id) => onChange({ ...resource, id: slugifyCustomSystemId(id) })} />
      <SelectField label="Tipo" value={resource.type} options={RESOURCE_TYPES} onChange={(value) => onChange({ ...resource, type: value as CustomResourceDefinition['type'] })} />
      <SelectField label="Permissão" value={resource.editPermission ?? 'ownerAndMaster'} options={PERMISSIONS} onChange={(value) => onChange({ ...resource, editPermission: value as CustomResourceDefinition['editPermission'] })} />
      <Input label="Mínimo" type="number" value={String(resource.minimum ?? '')} onChange={(value) => onChange({ ...resource, minimum: optionalNumber(value) })} />
      <Input label="Máximo fixo" type="number" value={String(resource.maximum ?? '')} onChange={(value) => onChange({ ...resource, maximum: optionalNumber(value) })} />
      <Input label="Valor inicial" type="number" value={String(resource.initialValue ?? '')} onChange={(value) => onChange({ ...resource, initialValue: optionalNumber(value) })} />
    </div>

    <div className="mt-3 rounded-lg border border-border p-3">
      <Input label="Fórmula do máximo" value={formula} onChange={(value) => onChange({ ...resource, maximumFormula: value || undefined })} />
      <div className="mt-2"><FormulaVariablePicker variables={variables} onSelect={(path) => onChange({ ...resource, maximumFormula: `${formula}${formula.trim() ? ' ' : ''}${path}` })} /></div>
      {formula ? <div className={`mt-2 text-xs ${formulaError ? 'text-red-300' : 'text-emerald-300'}`}>{formulaError ?? 'Fórmula válida.'}</div> : null}
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-text">
        <Check label="Ajuste manual" checked={Boolean(resource.allowManualAdjustment)} onChange={(checked) => onChange({ ...resource, allowManualAdjustment: checked })} />
        <Check label="Temporário" checked={Boolean(resource.allowTemporaryValue)} onChange={(checked) => onChange({ ...resource, allowTemporaryValue: checked })} />
      </div>
      <Button danger onClick={onRemove}><Trash2 className="h-4 w-4" /> Remover</Button>
    </div>
  </article>
}

export function validateCustomSystemDefinition(definition: CustomSystemDefinition): string {
  if (!definition.id.trim()) return 'O sistema precisa de um ID.'
  if (!definition.name.trim()) return 'O sistema precisa de um nome.'

  const ids = [...definition.fields.map((entry) => entry.id), ...definition.resources.map((entry) => entry.id)]
  if (ids.some((id) => !id.trim())) return 'Campos e recursos precisam de IDs.'
  if (ids.length !== new Set(ids).size) return 'IDs de campos e recursos não podem se repetir.'

  for (const field of definition.fields) {
    if (field.type === 'select' || field.type === 'multiSelect') {
      if (field.options.some((option) => !option.label.trim() || !option.value.trim())) return `Todas as opções de “${field.name}” precisam de nome.`
      const values = field.options.map((option) => option.value)
      if (values.length !== new Set(values).size) return `Os identificadores das opções de “${field.name}” não podem se repetir.`
    }
    if (field.type === 'formula') {
      const formulaError = validateCustomFormula(field.formula, definition)
      if (formulaError) return `Fórmula de “${field.name}”: ${formulaError}`
    }
  }

  for (const type of definition.abilityTypes) {
    const presets = type.predefinedAbilities ?? []
    const presetIds = presets.map((preset) => preset.id)
    if (presetIds.some((id) => !id.trim())) return `As habilidades da biblioteca de “${type.name}” precisam de ID.`
    if (presetIds.length !== new Set(presetIds).size) return `Os IDs da biblioteca de “${type.name}” não podem se repetir.`
  }

  for (const resource of definition.resources) {
    if (!resource.maximumFormula) continue
    const formulaError = validateCustomFormula(resource.maximumFormula, definition)
    if (formulaError) return `Máximo de “${resource.name}”: ${formulaError}`
  }

  return ''
}

export function slugifyCustomSystemId(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

function Collection({ title, onAdd, empty, children }: { title: string; onAdd: () => void; empty: string; children: ReactNode }) {
  const count = Array.isArray(children) ? children.length : 1
  return <div>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-medium text-textH">{title}</h3><Button primary onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar</Button></div>
    <div className="grid gap-3">{count ? children : <Empty>{empty}</Empty>}</div>
  </div>
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="grid gap-1"><span className="label">{label}</span><input className="input-base" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function SelectField({ label, value, options, onChange }: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return <label className="grid gap-1"><span className="label">{label}</span><UiSelect value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</UiSelect></label>
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>
}

function Button({ children, onClick, primary, danger }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${primary ? 'border-accent bg-accent text-accentText' : danger ? 'border-red-500/40 text-red-300' : 'border-border text-textH'}`}>{children}</button>
}

function IconButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return <button type="button" onClick={onClick} title={title} className="rounded-lg border border-border p-2 hover:bg-accentBg">{children}</button>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text">{children}</div>
}

function newField(): CustomFieldDefinition {
  return { id: `field-${crypto.randomUUID()}`, name: 'Novo campo', type: 'text', editPermission: 'ownerAndMaster' }
}

function newResource(): CustomResourceDefinition {
  return { id: `resource-${crypto.randomUUID()}`, name: 'Novo recurso', type: 'number', minimum: 0, initialValue: 0, allowManualAdjustment: true, editPermission: 'ownerAndMaster' }
}

function convertFieldType(field: CustomFieldDefinition, type: CustomFieldDefinition['type']): CustomFieldDefinition {
  const base = { id: field.id, name: field.name, description: field.description, required: field.required, editPermission: field.editPermission }
  if (type === 'number' || type === 'boolean') return { ...base, type }
  if (type === 'select' || type === 'multiSelect') return { ...base, type, options: [] }
  if (type === 'dice') return { ...base, type }
  if (type === 'reference') return { ...base, type, target: 'character' }
  if (type === 'formula') return { ...base, type, formula: '', resultType: 'number', editPermission: 'automaticOnly' }
  return { ...base, type }
}

function uniqueOptionValue(base: string, options: CustomSelectOption[], ignoredIndex = -1): string {
  const normalized = base || 'opcao'
  const used = new Set(options.filter((_, index) => index !== ignoredIndex).map((option) => option.value))
  if (!used.has(normalized)) return normalized
  let suffix = 2
  while (used.has(`${normalized}-${suffix}`)) suffix += 1
  return `${normalized}-${suffix}`
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
