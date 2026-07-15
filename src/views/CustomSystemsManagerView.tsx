import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Copy, Plus, RefreshCw, Save, Settings2, Trash2 } from 'lucide-react'
import { useCustomSystemsContext } from '../contexts/customSystemsContext'
import { useSyncContext } from '../contexts/syncContext'
import type { CustomFieldDefinition } from '../models/customSystems/CustomFieldDefinition'
import type { CustomResourceDefinition } from '../models/customSystems/CustomResourceDefinition'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'

export function CustomSystemsManagerView() {
  const { userRole } = useSyncContext()
  const context = useCustomSystemsContext()
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<CustomSystemDefinition | null>(null)
  const [error, setError] = useState('')

  const selected = useMemo(
    () => context.definitions.find((definition) => definition.id === selectedId),
    [context.definitions, selectedId],
  )

  useEffect(() => {
    if (selected) {
      setDraft(structuredClone(selected))
      setError('')
    } else if (context.definitions[0]) {
      setSelectedId(context.definitions[0].id)
    } else {
      setDraft(null)
    }
  }, [context.definitions, selected])

  if (userRole !== 'master') {
    return <Notice title="Sistemas personalizados">Apenas o mestre pode criar ou alterar sistemas da campanha.</Notice>
  }

  function createSystem() {
    const created = context.createDefinition()
    setSelectedId(created.id)
    setDraft(structuredClone(created))
  }

  function saveSystem() {
    if (!draft) return
    const message = validateDefinition(draft)
    if (message) return setError(message)
    context.saveDefinition(draft)
    setError('')
  }

  function deleteSystem() {
    if (!draft) return
    if (!window.confirm(`Remover o sistema “${draft.name}”? O estado dos personagens será preservado sem a definição.`)) return
    context.removeDefinition(draft.id)
    setSelectedId('')
  }

  function duplicateSystem() {
    if (!draft) return
    const copy = context.duplicateDefinition(draft.id)
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
            <p className="text-xs text-text">Definições da campanha</p>
          </div>
          <button type="button" onClick={createSystem} className="rounded-lg bg-accent p-2 text-accentText" title="Criar sistema">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          {context.definitions.map((definition) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => setSelectedId(definition.id)}
              className={[
                'rounded-lg border px-3 py-2 text-left',
                selectedId === definition.id ? 'border-accent bg-accentBg' : 'border-border hover:bg-accentBg',
              ].join(' ')}
            >
              <div className="truncate text-sm font-medium text-textH">{definition.name}</div>
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-text">
                <span className="truncate">{definition.id}</span><span>v{definition.version}</span>
              </div>
            </button>
          ))}
          {context.definitions.length === 0 ? (
            <button type="button" onClick={createSystem} className="rounded-lg border border-dashed border-border p-5 text-sm text-text">
              Criar o primeiro sistema
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-text">
          <span>{formatStatus(context.status)}</span>
          <button type="button" onClick={() => void context.reload()} className="rounded-lg border border-border p-2" title="Recarregar">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      {!draft ? (
        <Notice title="Nenhum sistema selecionado">Selecione ou crie um sistema.</Notice>
      ) : (
        <SystemEditor
          draft={draft}
          setDraft={setDraft}
          error={error}
          onSave={saveSystem}
          onDelete={deleteSystem}
          onDuplicate={duplicateSystem}
        />
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
  const [section, setSection] = useState<'general' | 'fields' | 'resources' | 'advanced'>('general')

  return (
    <section className="min-w-0 rounded-xl border border-border bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-2">
          <Settings2 className="h-5 w-5 text-accent" />
          <div><h2 className="truncate text-lg font-semibold text-textH">{draft.name}</h2><p className="text-xs text-text">Edite o rascunho e confirme para sincronizar.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onDuplicate}><Copy className="h-4 w-4" /> Duplicar</ActionButton>
          <ActionButton onClick={onDelete} danger><Trash2 className="h-4 w-4" /> Remover</ActionButton>
          <ActionButton onClick={onSave} primary><Save className="h-4 w-4" /> Salvar</ActionButton>
        </div>
      </header>

      <div className="flex overflow-x-auto border-b border-border p-2">
        {([['general', 'Geral'], ['fields', 'Campos'], ['resources', 'Recursos'], ['advanced', 'Avançado']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setSection(key)} className={`rounded-lg px-3 py-2 text-sm ${section === key ? 'bg-accentBg font-medium text-textH' : 'text-text'}`}>{label}</button>
        ))}
      </div>

      {error ? <div className="m-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      <div className="p-4">
        {section === 'general' ? <GeneralEditor draft={draft} setDraft={setDraft} /> : null}
        {section === 'fields' ? <FieldsEditor draft={draft} setDraft={setDraft} /> : null}
        {section === 'resources' ? <ResourcesEditor draft={draft} setDraft={setDraft} /> : null}
        {section === 'advanced' ? <AdvancedEditor draft={draft} setDraft={setDraft} /> : null}
      </div>
    </section>
  )
}

function GeneralEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Input label="Nome" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
    <Input label="ID estável" value={draft.id} onChange={(id) => setDraft({ ...draft, id: slugify(id) })} />
    <Input label="Versão" type="number" value={String(draft.version)} onChange={(value) => setDraft({ ...draft, version: Math.max(1, Math.trunc(Number(value) || 1)) })} />
    <Input label="Ícone" value={draft.icon ?? ''} onChange={(icon) => setDraft({ ...draft, icon: icon || undefined })} />
    <label className="grid gap-1 md:col-span-2"><span className="text-xs font-medium text-textH">Descrição</span><textarea className="input-base min-h-28" value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <Input label="Tags" value={(draft.tags ?? []).join(', ')} onChange={(value) => setDraft({ ...draft, tags: value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
  </div>
}

function FieldsEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  function addField() {
    setDraft({ ...draft, fields: [...draft.fields, { id: `field-${crypto.randomUUID()}`, name: 'Novo campo', type: 'text', editPermission: 'ownerAndMaster' }] })
  }
  return <Collection title="Campos" onAdd={addField} empty="Nenhum campo criado.">
    {draft.fields.map((field, index) => (
      <article key={`${field.id}-${index}`} className="rounded-lg border border-border p-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="Nome" value={field.name} onChange={(name) => replace({ ...field, name })} />
          <Input label="ID" value={field.id} onChange={(id) => replace({ ...field, id: slugify(id) })} />
          <Select label="Tipo" value={field.type} options={['text','richText','number','boolean','select','multiSelect','dice','reference','formula']} onChange={(type) => replace(convertFieldType(field, type as CustomFieldDefinition['type']))} />
          <Select label="Permissão" value={field.editPermission ?? 'ownerAndMaster'} options={['ownerAndMaster','owner','masterOnly','automaticOnly']} onChange={(permission) => replace({ ...field, editPermission: permission as CustomFieldDefinition['editPermission'] })} />
        </div>
        {(field.type === 'select' || field.type === 'multiSelect') ? <div className="mt-3"><Input label="Opções separadas por vírgula" value={field.options.map((option) => option.value).join(', ')} onChange={(value) => replace({ ...field, options: value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => ({ value: entry, label: entry })) })} /></div> : null}
        <div className="mt-3 flex justify-end"><ActionButton danger onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /> Remover</ActionButton></div>
        {null}
        {function replace(next: CustomFieldDefinition) { setDraft({ ...draft, fields: draft.fields.map((entry, i) => i === index ? next : entry) }) }}
      </article>
    ))}
  </Collection>
}

function ResourcesEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  function addResource() {
    setDraft({ ...draft, resources: [...draft.resources, { id: `resource-${crypto.randomUUID()}`, name: 'Novo recurso', type: 'number', minimum: 0, initialValue: 0, allowManualAdjustment: true, editPermission: 'ownerAndMaster' }] })
  }
  return <Collection title="Recursos" onAdd={addResource} empty="Nenhum recurso criado.">
    {draft.resources.map((resource, index) => (
      <ResourceRow key={`${resource.id}-${index}`} resource={resource} onChange={(next) => setDraft({ ...draft, resources: draft.resources.map((entry, i) => i === index ? next : entry) })} onRemove={() => setDraft({ ...draft, resources: draft.resources.filter((_, i) => i !== index) })} />
    ))}
  </Collection>
}

function ResourceRow({ resource, onChange, onRemove }: { resource: CustomResourceDefinition; onChange: (resource: CustomResourceDefinition) => void; onRemove: () => void }) {
  return <article className="rounded-lg border border-border p-3">
    <div className="grid gap-3 md:grid-cols-4">
      <Input label="Nome" value={resource.name} onChange={(name) => onChange({ ...resource, name })} />
      <Input label="ID" value={resource.id} onChange={(id) => onChange({ ...resource, id: slugify(id) })} />
      <Select label="Tipo" value={resource.type} options={['number','checkboxes','dicePool','charges']} onChange={(type) => onChange({ ...resource, type: type as CustomResourceDefinition['type'] })} />
      <Select label="Permissão" value={resource.editPermission ?? 'ownerAndMaster'} options={['ownerAndMaster','owner','masterOnly','automaticOnly']} onChange={(permission) => onChange({ ...resource, editPermission: permission as CustomResourceDefinition['editPermission'] })} />
      <Input label="Mínimo" type="number" value={String(resource.minimum ?? '')} onChange={(value) => onChange({ ...resource, minimum: optionalNumber(value) })} />
      <Input label="Máximo" type="number" value={String(resource.maximum ?? '')} onChange={(value) => onChange({ ...resource, maximum: optionalNumber(value) })} />
      <Input label="Fórmula do máximo" value={resource.maximumFormula ?? ''} onChange={(value) => onChange({ ...resource, maximumFormula: value || undefined })} />
      <Input label="Valor inicial" type="number" value={String(resource.initialValue ?? '')} onChange={(value) => onChange({ ...resource, initialValue: optionalNumber(value) })} />
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-4 text-xs text-text"><Check label="Ajuste manual" checked={Boolean(resource.allowManualAdjustment)} onChange={(checked) => onChange({ ...resource, allowManualAdjustment: checked })} /><Check label="Temporário" checked={Boolean(resource.allowTemporaryValue)} onChange={(checked) => onChange({ ...resource, allowTemporaryValue: checked })} /></div>
      <ActionButton danger onClick={onRemove}><Trash2 className="h-4 w-4" /> Remover</ActionButton>
    </div>
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
  return <div><p className="mb-3 text-sm text-text">Editor avançado de habilidades, painéis e automações.</p><textarea className="input-base min-h-[520px] w-full font-mono text-xs" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />{error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}<div className="mt-3"><ActionButton primary onClick={apply}><Save className="h-4 w-4" /> Aplicar JSON</ActionButton></div></div>
}

function Collection({ title, onAdd, empty, children }: { title: string; onAdd: () => void; empty: string; children: ReactNode }) {
  const count = Array.isArray(children) ? children.length : 1
  return <div><div className="mb-3 flex items-center justify-between"><h3 className="font-medium text-textH">{title}</h3><ActionButton primary onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar</ActionButton></div><div className="grid gap-3">{count ? children : <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text">{empty}</div>}</div></div>
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1"><span className="text-xs font-medium text-textH">{label}</span><input className="input-base" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="grid gap-1"><span className="text-xs font-medium text-textH">{label}</span><select className="input-base" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label> }
function ActionButton({ children, onClick, primary, danger }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${primary ? 'border-accent bg-accent text-accentText' : danger ? 'border-red-500/40 text-red-300' : 'border-border text-textH'}`}>{children}</button> }
function Notice({ title, children }: { title: string; children: ReactNode }) { return <section className="mx-auto max-w-2xl rounded-xl border border-border bg-bg p-5"><h1 className="text-lg font-semibold text-textH">{title}</h1><p className="mt-2 text-sm text-text">{children}</p></section> }

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
  return ''
}
function slugify(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') }
function optionalNumber(value: string): number | undefined { if (!value.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined }
function formatStatus(status: ReturnType<typeof useCustomSystemsContext>['status']): string { if (status.kind === 'loading') return 'Carregando…'; if (status.kind === 'saving') return 'Salvando…'; if (status.kind === 'synced') return 'Sincronizado'; if (status.kind === 'error') return status.message; return 'Aguardando sincronização' }
