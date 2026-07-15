import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Copy, Plus, RefreshCw, Save, Settings2, Trash2 } from 'lucide-react'
import { useCustomSystemsContext } from '../contexts/customSystemsContext'
import { useSyncContext } from '../contexts/syncContext'
import { FormulaVariablePicker } from '../features/customSystems/FormulaVariablePicker'
import {
  listCustomFormulaVariables,
  validateCustomFormula,
} from '../lib/customSystems'
import type {
  CustomFieldDefinition,
  CustomSelectOption,
} from '../models/customSystems/CustomFieldDefinition'
import type { CustomResourceDefinition } from '../models/customSystems/CustomResourceDefinition'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'

export function CustomSystemsManagerView() {
  const { userRole } = useSyncContext()
  const systems = useCustomSystemsContext()
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<CustomSystemDefinition | null>(null)
  const [error, setError] = useState('')

  const selected = useMemo(
    () => systems.definitions.find((definition) => definition.id === selectedId),
    [selectedId, systems.definitions],
  )

  useEffect(() => {
    if (selected) {
      setDraft(structuredClone(selected))
      setError('')
    } else if (systems.definitions[0]) {
      setSelectedId(systems.definitions[0].id)
    } else {
      setDraft(null)
    }
  }, [selected, systems.definitions])

  if (userRole !== 'master') {
    return <Message title="Sistemas personalizados">Apenas o mestre pode gerenciar os sistemas da campanha.</Message>
  }

  function createSystem() {
    const created = systems.createDefinition()
    setSelectedId(created.id)
    setDraft(structuredClone(created))
  }

  function saveSystem() {
    if (!draft) return
    const validation = validateDefinition(draft)
    if (validation) return setError(validation)
    systems.saveDefinition(draft)
    setSelectedId(draft.id)
    setError('')
  }

  function deleteSystem() {
    if (!draft) return
    if (!window.confirm(`Remover o sistema “${draft.name}”? O estado dos personagens continuará preservado.`)) return
    systems.removeDefinition(selectedId || draft.id)
    setSelectedId('')
  }

  function duplicateSystem() {
    if (!draft) return
    const copy = systems.duplicateDefinition(selectedId || draft.id)
    if (!copy) return
    setSelectedId(copy.id)
    setDraft(structuredClone(copy))
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-bg p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-semibold text-textH">Sistemas personalizados</h1>
            <p className="text-xs text-text">Definições sincronizadas</p>
          </div>
          <IconButton title="Criar sistema" onClick={createSystem}><Plus className="h-4 w-4" /></IconButton>
        </div>
        <div className="mt-3 grid gap-2">
          {systems.definitions.map((definition) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => setSelectedId(definition.id)}
              className={`rounded-lg border px-3 py-2 text-left ${selectedId === definition.id ? 'border-accent bg-accentBg' : 'border-border hover:bg-accentBg'}`}
            >
              <div className="truncate text-sm font-medium text-textH">{definition.name}</div>
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-text"><span className="truncate">{definition.id}</span><span>v{definition.version}</span></div>
            </button>
          ))}
          {!systems.definitions.length ? <button type="button" onClick={createSystem} className="rounded-lg border border-dashed border-border p-5 text-sm text-text">Criar o primeiro sistema</button> : null}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-text">
          <span>{formatStatus(systems.status)}</span>
          <IconButton title="Recarregar" onClick={() => void systems.reload()}><RefreshCw className="h-3.5 w-3.5" /></IconButton>
        </div>
      </aside>

      {!draft ? <Message title="Nenhum sistema selecionado">Selecione ou crie um sistema.</Message> : (
        <SystemEditor draft={draft} setDraft={setDraft} error={error} onSave={saveSystem} onDelete={deleteSystem} onDuplicate={duplicateSystem} />
      )}
    </div>
  )
}

type EditorProps = {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
  error: string
  onSave: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function SystemEditor({ draft, setDraft, error, onSave, onDelete, onDuplicate }: EditorProps) {
  const [tab, setTab] = useState<'general' | 'fields' | 'resources' | 'advanced'>('general')
  return <section className="min-w-0 rounded-xl border border-border bg-bg">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-accent" /><div><h2 className="text-lg font-semibold text-textH">{draft.name}</h2><p className="text-xs text-text">Edite o rascunho e salve para sincronizar.</p></div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={onDuplicate}><Copy className="h-4 w-4" /> Duplicar</Button><Button danger onClick={onDelete}><Trash2 className="h-4 w-4" /> Remover</Button><Button primary onClick={onSave}><Save className="h-4 w-4" /> Salvar</Button></div>
    </header>
    <nav className="flex overflow-x-auto border-b border-border p-2">
      {([['general','Geral'],['fields','Campos'],['resources','Recursos'],['advanced','Avançado']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-sm ${tab === key ? 'bg-accentBg font-medium text-textH' : 'text-text'}`}>{label}</button>)}
    </nav>
    {error ? <div className="m-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
    <div className="p-4">
      {tab === 'general' ? <GeneralEditor draft={draft} setDraft={setDraft} /> : null}
      {tab === 'fields' ? <FieldsEditor draft={draft} setDraft={setDraft} /> : null}
      {tab === 'resources' ? <ResourcesEditor draft={draft} setDraft={setDraft} /> : null}
      {tab === 'advanced' ? <AdvancedEditor draft={draft} setDraft={setDraft} /> : null}
    </div>
  </section>
}

function GeneralEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Input label="Nome" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
    <Input label="ID estável" value={draft.id} onChange={(id) => setDraft({ ...draft, id: slugify(id) })} />
    <Input label="Versão" type="number" value={String(draft.version)} onChange={(value) => setDraft({ ...draft, version: Math.max(1, Math.trunc(Number(value) || 1)) })} />
    <Input label="Ícone" value={draft.icon ?? ''} onChange={(icon) => setDraft({ ...draft, icon: icon || undefined })} />
    <label className="grid gap-1 md:col-span-2"><span className="label">Descrição</span><textarea className="input-base min-h-28" value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <Input label="Tags" value={(draft.tags ?? []).join(', ')} onChange={(value) => setDraft({ ...draft, tags: value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
  </div>
}

function FieldsEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  return <Collection title="Campos" onAdd={() => setDraft({ ...draft, fields: [...draft.fields, newField()] })} empty="Nenhum campo criado.">
    {draft.fields.map((field, index) => <FieldRow key={`field-row-${index}`} definition={draft} field={field} onChange={(next) => setDraft({ ...draft, fields: draft.fields.map((entry, i) => i === index ? next : entry) })} onRemove={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })} />)}
  </Collection>
}

function FieldRow({ definition, field, onChange, onRemove }: { definition: CustomSystemDefinition; field: CustomFieldDefinition; onChange: (field: CustomFieldDefinition) => void; onRemove: () => void }) {
  return <article className="rounded-lg border border-border p-3">
    <div className="grid gap-3 md:grid-cols-4">
      <Input label="Nome" value={field.name} onChange={(name) => onChange({ ...field, name })} />
      <Input label="ID" value={field.id} onChange={(id) => onChange({ ...field, id: slugify(id) })} />
      <Select label="Tipo" value={field.type} options={['text','richText','number','boolean','select','multiSelect','dice','reference','formula']} onChange={(type) => onChange(convertFieldType(field, type as CustomFieldDefinition['type']))} />
      <Select label="Permissão" value={field.editPermission ?? 'ownerAndMaster'} options={['ownerAndMaster','owner','masterOnly','automaticOnly']} onChange={(value) => onChange({ ...field, editPermission: value as CustomFieldDefinition['editPermission'] })} />
    </div>
    {(field.type === 'select' || field.type === 'multiSelect') ? <OptionListEditor options={field.options} onChange={(options) => onChange({ ...field, options })} /> : null}
    {field.type === 'formula' ? <FormulaEditor definition={definition} formula={field.formula} resultType={field.resultType} onChange={(formula, resultType) => onChange({ ...field, formula, resultType })} /> : null}
    <div className="mt-3 flex justify-end"><Button danger onClick={onRemove}><Trash2 className="h-4 w-4" /> Remover</Button></div>
  </article>
}

function OptionListEditor({ options, onChange }: { options: CustomSelectOption[]; onChange: (options: CustomSelectOption[]) => void }) {
  const [advanced, setAdvanced] = useState(false)

  function addOption() {
    const index = options.length + 1
    const label = `Opção ${index}`
    onChange([...options, { label, value: uniqueOptionValue(slugify(label), options) }])
  }

  function updateLabel(index: number, label: string) {
    const current = options[index]
    const shouldFollowLabel = !current.value || current.value === slugify(current.label) || /^option-\d+$/.test(current.value)
    const value = shouldFollowLabel
      ? uniqueOptionValue(slugify(label), options, index)
      : current.value
    onChange(options.map((option, optionIndex) => optionIndex === index ? { ...option, label, value } : option))
  }

  function updateValue(index: number, value: string) {
    onChange(options.map((option, optionIndex) => optionIndex === index ? { ...option, value: slugify(value) } : option))
  }

  function removeOption(index: number) {
    onChange(options.filter((_, optionIndex) => optionIndex !== index))
  }

  return <section className="mt-3 rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-medium text-textH">Opções</h4>
        <p className="mt-1 text-xs text-text">Adicione os nomes que poderão ser escolhidos na ficha.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAdvanced((value) => !value)} className="rounded-lg border border-border px-3 py-2 text-xs text-text hover:bg-accentBg">
          {advanced ? 'Ocultar opções avançadas' : 'Opções avançadas'}
        </button>
        <Button primary onClick={addOption}><Plus className="h-4 w-4" /> Adicionar opção</Button>
      </div>
    </div>
    <div className="mt-3 grid gap-2">
      {options.map((option, index) => (
        <div key={`option-row-${index}`} className={`grid gap-2 rounded-lg border border-border p-2 ${advanced ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : 'md:grid-cols-[minmax(0,1fr)_auto]'}`}>
          <Input label={`Opção ${index + 1}`} value={option.label} onChange={(label) => updateLabel(index, label)} />
          {advanced ? <Input label="Identificador interno" value={option.value} onChange={(value) => updateValue(index, value)} /> : null}
          <div className="flex items-end">
            <IconButton title="Remover opção" onClick={() => removeOption(index)}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
        </div>
      ))}
      {options.length === 0 ? <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text">Nenhuma opção adicionada.</div> : null}
    </div>
  </section>
}

function FormulaEditor({ definition, formula, resultType, onChange }: { definition: CustomSystemDefinition; formula: string; resultType: 'number' | 'text' | 'boolean'; onChange: (formula: string, resultType: 'number' | 'text' | 'boolean') => void }) {
  const variables = listCustomFormulaVariables(definition)
  const error = formula.trim() ? validateCustomFormula(formula, definition) : 'Informe uma expressão.'
  const append = (path: string) => onChange(`${formula}${formula.trim() ? ' ' : ''}${path}`, resultType)

  return <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg/30 p-3">
    <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
      <Select label="Tipo do resultado" value={resultType} options={['number','text','boolean']} onChange={(value) => onChange(formula, value as 'number' | 'text' | 'boolean')} />
      <Input label="Expressão" value={formula} onChange={(value) => onChange(value, resultType)} />
    </div>
    <div className="mt-3"><FormulaVariablePicker variables={variables} onSelect={append} /></div>
    <div className="mt-3 text-xs text-text">Funções: <code>min</code>, <code>max</code>, <code>round</code>, <code>floor</code>, <code>ceil</code>, <code>abs</code>, <code>clamp</code> e <code>if</code>.</div>
    <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? 'Fórmula válida.'}</div>
    <div className="mt-2 rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text">Exemplo: <code>character.class.fighter.level + character.attributeModifier.con</code></div>
  </div>
}

function ResourcesEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  return <Collection title="Recursos" onAdd={() => setDraft({ ...draft, resources: [...draft.resources, newResource()] })} empty="Nenhum recurso criado.">
    {draft.resources.map((resource, index) => <ResourceRow key={`resource-row-${index}`} definition={draft} resource={resource} onChange={(next) => setDraft({ ...draft, resources: draft.resources.map((entry, i) => i === index ? next : entry) })} onRemove={() => setDraft({ ...draft, resources: draft.resources.filter((_, i) => i !== index) })} />)}
  </Collection>
}

function ResourceRow({ definition, resource, onChange, onRemove }: { definition: CustomSystemDefinition; resource: CustomResourceDefinition; onChange: (resource: CustomResourceDefinition) => void; onRemove: () => void }) {
  const formula = resource.maximumFormula ?? ''
  const variables = listCustomFormulaVariables(definition)
  return <article className="rounded-lg border border-border p-3">
    <div className="grid gap-3 md:grid-cols-4">
      <Input label="Nome" value={resource.name} onChange={(name) => onChange({ ...resource, name })} />
      <Input label="ID" value={resource.id} onChange={(id) => onChange({ ...resource, id: slugify(id) })} />
      <Select label="Tipo" value={resource.type} options={['number','checkboxes','dicePool','charges']} onChange={(value) => onChange({ ...resource, type: value as CustomResourceDefinition['type'] })} />
      <Select label="Permissão" value={resource.editPermission ?? 'ownerAndMaster'} options={['ownerAndMaster','owner','masterOnly','automaticOnly']} onChange={(value) => onChange({ ...resource, editPermission: value as CustomResourceDefinition['editPermission'] })} />
      <Input label="Mínimo" type="number" value={String(resource.minimum ?? '')} onChange={(value) => onChange({ ...resource, minimum: optionalNumber(value) })} />
      <Input label="Máximo fixo" type="number" value={String(resource.maximum ?? '')} onChange={(value) => onChange({ ...resource, maximum: optionalNumber(value) })} />
      <Input label="Valor inicial" type="number" value={String(resource.initialValue ?? '')} onChange={(value) => onChange({ ...resource, initialValue: optionalNumber(value) })} />
    </div>
    <div className="mt-3 rounded-lg border border-border p-3">
      <Input label="Fórmula do máximo" value={formula} onChange={(value) => onChange({ ...resource, maximumFormula: value || undefined })} />
      <div className="mt-2"><FormulaVariablePicker variables={variables} onSelect={(path) => onChange({ ...resource, maximumFormula: `${formula}${formula.trim() ? ' ' : ''}${path}` })} /></div>
      {formula ? <div className={`mt-2 text-xs ${validateCustomFormula(formula, definition) ? 'text-red-300' : 'text-emerald-300'}`}>{validateCustomFormula(formula, definition) ?? 'Fórmula válida.'}</div> : null}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-4 text-xs text-text"><Check label="Ajuste manual" checked={Boolean(resource.allowManualAdjustment)} onChange={(checked) => onChange({ ...resource, allowManualAdjustment: checked })} /><Check label="Temporário" checked={Boolean(resource.allowTemporaryValue)} onChange={(checked) => onChange({ ...resource, allowTemporaryValue: checked })} /></div><Button danger onClick={onRemove}><Trash2 className="h-4 w-4" /> Remover</Button></div>
  </article>
}

function AdvancedEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => setText(JSON.stringify({ abilityTypes: draft.abilityTypes, panels: draft.panels, automations: draft.automations }, null, 2)), [draft.id])
  function apply() {
    try {
      const parsed = JSON.parse(text) as Partial<CustomSystemDefinition>
      if (!Array.isArray(parsed.abilityTypes) || !Array.isArray(parsed.panels) || !Array.isArray(parsed.automations)) throw new Error('abilityTypes, panels e automations devem ser arrays.')
      setDraft({ ...draft, abilityTypes: parsed.abilityTypes, panels: parsed.panels, automations: parsed.automations })
      setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'JSON inválido.') }
  }
  return <div><p className="mb-3 text-sm text-text">Editor avançado de tipos de habilidade, painéis e automações.</p><textarea className="input-base min-h-[520px] w-full font-mono text-xs" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />{error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}<div className="mt-3"><Button primary onClick={apply}><Save className="h-4 w-4" /> Aplicar JSON</Button></div></div>
}

function Collection({ title, onAdd, empty, children }: { title: string; onAdd: () => void; empty: string; children: ReactNode }) {
  const count = Array.isArray(children) ? children.length : 1
  return <div><div className="mb-3 flex items-center justify-between"><h3 className="font-medium text-textH">{title}</h3><Button primary onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar</Button></div><div className="grid gap-3">{count ? children : <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text">{empty}</div>}</div></div>
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1"><span className="label">{label}</span><input className="input-base" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="grid gap-1"><span className="label">{label}</span><select className="input-base" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label> }
function Button({ children, onClick, primary, danger }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${primary ? 'border-accent bg-accent text-accentText' : danger ? 'border-red-500/40 text-red-300' : 'border-border text-textH'}`}>{children}</button> }
function IconButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) { return <button type="button" onClick={onClick} title={title} className="rounded-lg border border-border p-2 hover:bg-accentBg">{children}</button> }
function Message({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border border-border bg-bg p-5"><h1 className="text-lg font-semibold text-textH">{title}</h1><p className="mt-2 text-sm text-text">{children}</p></section> }

function newField(): CustomFieldDefinition { return { id: `field-${crypto.randomUUID()}`, name: 'Novo campo', type: 'text', editPermission: 'ownerAndMaster' } }
function newResource(): CustomResourceDefinition { return { id: `resource-${crypto.randomUUID()}`, name: 'Novo recurso', type: 'number', minimum: 0, initialValue: 0, allowManualAdjustment: true, editPermission: 'ownerAndMaster' } }
function convertFieldType(field: CustomFieldDefinition, type: CustomFieldDefinition['type']): CustomFieldDefinition {
  const base = { id: field.id, name: field.name, description: field.description, required: field.required, editPermission: field.editPermission }
  if (type === 'number') return { ...base, type: 'number' }
  if (type === 'boolean') return { ...base, type: 'boolean' }
  if (type === 'select' || type === 'multiSelect') return { ...base, type, options: [] }
  if (type === 'dice') return { ...base, type: 'dice' }
  if (type === 'reference') return { ...base, type: 'reference', target: 'character' }
  if (type === 'formula') return { ...base, type: 'formula', formula: '', resultType: 'number', editPermission: 'automaticOnly' }
  return { ...base, type }
}
function validateDefinition(definition: CustomSystemDefinition): string {
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
    if (field.type !== 'formula') continue
    const formulaError = validateCustomFormula(field.formula, definition)
    if (formulaError) return `Fórmula de “${field.name}”: ${formulaError}`
  }
  for (const resource of definition.resources) {
    if (!resource.maximumFormula) continue
    const formulaError = validateCustomFormula(resource.maximumFormula, definition)
    if (formulaError) return `Máximo de “${resource.name}”: ${formulaError}`
  }
  return ''
}
function uniqueOptionValue(base: string, options: CustomSelectOption[], ignoredIndex = -1): string {
  const normalized = base || 'opcao'
  const used = new Set(options.filter((_, index) => index !== ignoredIndex).map((option) => option.value))
  if (!used.has(normalized)) return normalized
  let suffix = 2
  while (used.has(`${normalized}-${suffix}`)) suffix += 1
  return `${normalized}-${suffix}`
}
function slugify(value: string): string { return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') }
function optionalNumber(value: string): number | undefined { if (!value.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined }
function formatStatus(status: ReturnType<typeof useCustomSystemsContext>['status']): string { if (status.kind === 'loading') return 'Carregando…'; if (status.kind === 'saving') return 'Salvando…'; if (status.kind === 'synced') return 'Sincronizado'; if (status.kind === 'error') return status.message; return 'Aguardando sincronização' }