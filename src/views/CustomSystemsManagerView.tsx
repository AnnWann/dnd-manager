import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus, RefreshCw, Save, Settings2, Trash2 } from 'lucide-react'
import { useCustomSystemsContext } from '../contexts/customSystemsContext'
import { useSyncContext } from '../contexts/syncContext'
import type { CustomFieldDefinition } from '../models/customSystems/CustomFieldDefinition'
import type { CustomResourceDefinition } from '../models/customSystems/CustomResourceDefinition'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'

export function CustomSystemsManagerView() {
  const { userRole } = useSyncContext()
  const {
    definitions,
    status,
    createDefinition,
    saveDefinition,
    removeDefinition,
    duplicateDefinition,
    reload,
  } = useCustomSystemsContext()
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<CustomSystemDefinition | null>(null)
  const [error, setError] = useState('')

  const selected = useMemo(
    () => definitions.find((definition) => definition.id === selectedId),
    [definitions, selectedId],
  )

  useEffect(() => {
    if (selected) {
      setDraft(structuredClone(selected))
      setError('')
      return
    }
    const first = definitions[0]
    if (first) setSelectedId(first.id)
    else setDraft(null)
  }, [definitions, selected])

  if (userRole !== 'master') {
    return (
      <section className="mx-auto max-w-2xl rounded-xl border border-border bg-bg p-5">
        <h1 className="text-lg font-semibold text-textH">Sistemas personalizados</h1>
        <p className="mt-2 text-sm text-text">
          Apenas o mestre pode criar ou alterar sistemas da campanha.
        </p>
      </section>
    )
  }

  function handleCreate() {
    const created = createDefinition()
    setSelectedId(created.id)
    setDraft(structuredClone(created))
  }

  function handleSave() {
    if (!draft) return
    const validation = validateDefinition(draft, definitions)
    if (validation) {
      setError(validation)
      return
    }
    saveDefinition(draft)
    setError('')
  }

  function handleDelete() {
    if (!draft) return
    const confirmed = window.confirm(`Remover o sistema “${draft.name}”? O estado já salvo nos personagens será preservado, mas ficará sem definição até o sistema ser recriado.`)
    if (!confirmed) return
    removeDefinition(draft.id)
    setSelectedId('')
    setDraft(null)
  }

  function handleDuplicate() {
    if (!draft) return
    const duplicated = duplicateDefinition(draft.id)
    if (!duplicated) return
    setSelectedId(duplicated.id)
    setDraft(structuredClone(duplicated))
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-bg p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-semibold text-textH">Sistemas personalizados</h1>
            <p className="text-xs text-text">Definições sincronizadas da campanha</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-accent p-2 text-accentText"
            onClick={handleCreate}
            title="Criar sistema"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          {definitions.length === 0 ? (
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg border border-dashed border-border p-4 text-sm text-text hover:bg-accentBg"
            >
              Criar o primeiro sistema
            </button>
          ) : definitions.map((definition) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => setSelectedId(definition.id)}
              className={[
                'rounded-lg border px-3 py-2 text-left transition-colors',
                selectedId === definition.id
                  ? 'border-accent bg-accentBg'
                  : 'border-border hover:bg-[color:var(--social-bg)]',
              ].join(' ')}
            >
              <div className="truncate text-sm font-medium text-textH">{definition.name}</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-text">
                <span className="truncate">{definition.id}</span>
                <span>v{definition.version}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-text">
          <span>{formatStatus(status)}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg border border-border p-2 hover:bg-accentBg"
            title="Recarregar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      <main className="min-w-0">
        {!draft ? (
          <div className="rounded-xl border border-border bg-bg p-8 text-center text-sm text-text">
            Selecione ou crie um sistema.
          </div>
        ) : (
          <SystemEditor
            draft={draft}
            setDraft={setDraft}
            error={error}
            onSave={handleSave}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        )}
      </main>
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
    <section className="rounded-xl border border-border bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-accent" />
            <h2 className="truncate text-lg font-semibold text-textH">{draft.name}</h2>
          </div>
          <p className="mt-1 text-xs text-text">Alterações são salvas na campanha ao confirmar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDuplicate} className="button-secondary">
            <Copy className="h-4 w-4" /> Duplicar
          </button>
          <button type="button" onClick={onDelete} className="button-danger">
            <Trash2 className="h-4 w-4" /> Remover
          </button>
          <button type="button" onClick={onSave} className="button-primary">
            <Save className="h-4 w-4" /> Salvar
          </button>
        </div>
      </header>

      <nav className="flex overflow-x-auto border-b border-border p-2">
        {([
          ['general', 'Geral'],
          ['fields', 'Campos'],
          ['resources', 'Recursos'],
          ['advanced', 'Avançado'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={[
              'rounded-lg px-3 py-2 text-sm',
              section === key ? 'bg-accentBg font-medium text-textH' : 'text-text hover:bg-accentBg',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </nav>

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
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput label="Nome" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
      <LabeledInput label="ID estável" value={draft.id} onChange={(id) => setDraft({ ...draft, id: slugify(id) })} />
      <LabeledInput label="Versão" type="number" value={String(draft.version)} onChange={(value) => setDraft({ ...draft, version: Math.max(1, Math.trunc(Number(value) || 1)) })} />
      <LabeledInput label="Ícone" value={draft.icon ?? ''} onChange={(icon) => setDraft({ ...draft, icon: icon || undefined })} placeholder="Nome ou URL do ícone" />
      <label className="grid gap-1 md:col-span-2">
        <span className="text-xs font-medium text-textH">Descrição</span>
        <textarea className="input-base min-h-28 resize-y" value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </label>
      <LabeledInput
        label="Tags"
        value={(draft.tags ?? []).join(', ')}
        onChange={(value) => setDraft({ ...draft, tags: value.split(',').map((entry) => entry.trim()).filter(Boolean) })}
        placeholder="marcial, campanha, opcional"
      />
    </div>
  )
}

function FieldsEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  function addField() {
    const field: CustomFieldDefinition = {
      id: `field-${crypto.randomUUID()}`,
      name: 'Novo campo',
      type: 'text',
      required: false,
      editPermission: 'ownerAndMaster',
    }
    setDraft({ ...draft, fields: [...draft.fields, field] })
  }

  return (
    <DefinitionCollection
      title="Campos do sistema"
      description="Valores gerais armazenados uma vez por personagem."
      onAdd={addField}
      empty="Nenhum campo criado."
    >
      {draft.fields.map((field, index) => (
        <FieldDefinitionEditor
          key={field.id}
          field={field}
          onChange={(next) => setDraft({ ...draft, fields: draft.fields.map((entry, entryIndex) => entryIndex === index ? next : entry) })}
          onRemove={() => setDraft({ ...draft, fields: draft.fields.filter((_, entryIndex) => entryIndex !== index) })}
        />
      ))}
    </DefinitionCollection>
  )
}

function FieldDefinitionEditor({ field, onChange, onRemove }: {
  field: CustomFieldDefinition
  onChange: (field: CustomFieldDefinition) => void
  onRemove: () => void
}) {
  const base = field as CustomFieldDefinition & Record<string, unknown>
  return (
    <article className="rounded-lg border border-border p-3">
      <div className="grid gap-3 md:grid-cols-4">
        <LabeledInput label="Nome" value={field.name} onChange={(name) => onChange({ ...field, name })} />
        <LabeledInput label="ID" value={field.id} onChange={(id) => onChange({ ...field, id: slugify(id) })} />
        <label className="grid gap-1">
          <span className="text-xs font-medium text-textH">Tipo</span>
          <select className="input-base" value={field.type} onChange={(event) => onChange(convertFieldType(field, event.target.value as CustomFieldDefinition['type']))}>
            {['text', 'richText', 'number', 'boolean', 'select', 'multiSelect', 'dice', 'reference', 'formula'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-textH">Permissão</span>
          <select className="input-base" value={field.editPermission ?? 'ownerAndMaster'} onChange={(event) => onChange({ ...field, editPermission: event.target.value as CustomFieldDefinition['editPermission'] })}>
            <option value="ownerAndMaster">Dono e mestre</option>
            <option value="owner">Apenas dono</option>
            <option value="masterOnly">Apenas mestre</option>
            <option value="automaticOnly">Automático</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <LabeledInput label="Descrição" value={field.description ?? ''} onChange={(description) => onChange({ ...field, description: description || undefined })} />
        {field.type === 'number' ? <>
          <LabeledInput label="Mínimo" type="number" value={String(base.minimum ?? '')} onChange={(value) => onChange({ ...field, minimum: optionalNumber(value) })} />
          <LabeledInput label="Máximo" type="number" value={String(base.maximum ?? '')} onChange={(value) => onChange({ ...field, maximum: optionalNumber(value) })} />
        </> : null}
        {(field.type === 'select' || field.type === 'multiSelect') ? (
          <LabeledInput label="Opções" value={field.options.map((option) => option.value).join(', ')} onChange={(value) => onChange({ ...field, options: value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => ({ value: entry, label: entry })) })} />
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-text">
          <input type="checkbox" checked={Boolean(field.required)} onChange={(event) => onChange({ ...field, required: event.target.checked })} /> Obrigatório
        </label>
        <button type="button" onClick={onRemove} className="button-danger"><Trash2 className="h-4 w-4" /> Remover campo</button>
      </div>
    </article>
  )
}

function ResourcesEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  function addResource() {
    const resource: CustomResourceDefinition = {
      id: `resource-${crypto.randomUUID()}`,
      name: 'Novo recurso',
      type: 'number',
      minimum: 0,
      initialValue: 0,
      allowManualAdjustment: true,
      editPermission: 'ownerAndMaster',
    }
    setDraft({ ...draft, resources: [...draft.resources, resource] })
  }

  return (
    <DefinitionCollection title="Recursos" description="Contadores e reservas alterados durante o jogo." onAdd={addResource} empty="Nenhum recurso criado.">
      {draft.resources.map((resource, index) => (
        <article key={resource.id} className="rounded-lg border border-border p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <LabeledInput label="Nome" value={resource.name} onChange={(name) => replaceResource({ ...resource, name })} />
            <LabeledInput label="ID" value={resource.id} onChange={(id) => replaceResource({ ...resource, id: slugify(id) })} />
            <label className="grid gap-1"><span className="text-xs font-medium text-textH">Tipo</span><select className="input-base" value={resource.type} onChange={(event) => replaceResource({ ...resource, type: event.target.value as CustomResourceDefinition['type'] })}>{['number', 'checkboxes', 'dicePool', 'charges'].map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="grid gap-1"><span className="text-xs font-medium text-textH">Permissão</span><select className="input-base" value={resource.editPermission ?? 'ownerAndMaster'} onChange={(event) => replaceResource({ ...resource, editPermission: event.target.value as CustomResourceDefinition['editPermission'] })}><option value="ownerAndMaster">Dono e mestre</option><option value="owner">Apenas dono</option><option value="masterOnly">Apenas mestre</option><option value="automaticOnly">Automático</option></select></label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <LabeledInput label="Mínimo" type="number" value={String(resource.minimum ?? '')} onChange={(value) => replaceResource({ ...resource, minimum: optionalNumber(value) })} />
            <LabeledInput label="Máximo" type="number" value={String(resource.maximum ?? '')} onChange={(value) => replaceResource({ ...resource, maximum: optionalNumber(value) })} />
            <LabeledInput label="Fórmula do máximo" value={resource.maximumFormula ?? ''} onChange={(maximumFormula) => replaceResource({ ...resource, maximumFormula: maximumFormula || undefined })} />
            <LabeledInput label="Valor inicial" type="number" value={String(resource.initialValue ?? '')} onChange={(value) => replaceResource({ ...resource, initialValue: optionalNumber(value) })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-text">
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(resource.allowManualAdjustment)} onChange={(event) => replaceResource({ ...resource, allowManualAdjustment: event.target.checked })} /> Ajuste manual</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(resource.allowTemporaryValue)} onChange={(event) => replaceResource({ ...resource, allowTemporaryValue: event.target.checked })} /> Valor temporário</label>
            </div>
            <button type="button" onClick={() => setDraft({ ...draft, resources: draft.resources.filter((_, entryIndex) => entryIndex !== index) })} className="button-danger"><Trash2 className="h-4 w-4" /> Remover recurso</button>
          </div>
          {function replaceResource(next: CustomResourceDefinition) {
            setDraft({ ...draft, resources: draft.resources.map((entry, entryIndex) => entryIndex === index ? next : entry) })
          }}
        </article>
      ))}
    </DefinitionCollection>
  )
}

function AdvancedEditor({ draft, setDraft }: Pick<EditorProps, 'draft' | 'setDraft'>) {
  const [text, setText] = useState(() => JSON.stringify({ abilityTypes: draft.abilityTypes, panels: draft.panels, automations: draft.automations }, null, 2))
  const [error, setError] = useState('')

  useEffect(() => {
    setText(JSON.stringify({ abilityTypes: draft.abilityTypes, panels: draft.panels, automations: draft.automations }, null, 2))
    setError('')
  }, [draft.id])

  function apply() {
    try {
      const parsed = JSON.parse(text) as Partial<CustomSystemDefinition>
      if (!Array.isArray(parsed.abilityTypes) || !Array.isArray(parsed.panels) || !Array.isArray(parsed.automations)) {
        throw new Error('O JSON deve conter abilityTypes, panels e automations como arrays.')
      }
      setDraft({ ...draft, abilityTypes: parsed.abilityTypes, panels: parsed.panels, automations: parsed.automations })
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'JSON inválido.')
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text">Editor avançado para tipos de habilidade, painéis e automações. A interface visual dedicada para esses itens pode ser adicionada depois sem alterar o formato salvo.</p>
      <textarea className="input-base min-h-[520px] w-full font-mono text-xs" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <button type="button" onClick={apply} className="button-primary mt-3"><Save className="h-4 w-4" /> Aplicar JSON ao rascunho</button>
    </div>
  )
}

function DefinitionCollection({ title, description, onAdd, empty, children }: { title: string; description: string; onAdd: () => void; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <div><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-medium text-textH">{title}</h3><p className="text-xs text-text">{description}</p></div><button type="button" onClick={onAdd} className="button-primary"><Plus className="h-4 w-4" /> Adicionar</button></div><div className="grid gap-3">{hasChildren ? children : <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text">{empty}</div>}</div></div>
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="grid gap-1"><span className="text-xs font-medium text-textH">{label}</span><input className="input-base" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function convertFieldType(field: CustomFieldDefinition, type: CustomFieldDefinition['type']): CustomFieldDefinition {
  const base = { id: field.id, name: field.name, description: field.description, required: field.required, editPermission: field.editPermission }
  switch (type) {
    case 'number': return { ...base, type: 'number' }
    case 'boolean': return { ...base, type: 'boolean' }
    case 'select': return { ...base, type: 'select', options: [] }
    case 'multiSelect': return { ...base, type: 'multiSelect', options: [] }
    case 'dice': return { ...base, type: 'dice' }
    case 'reference': return { ...base, type: 'reference', target: 'character' }
    case 'formula': return { ...base, type: 'formula', formula: '', resultType: 'number', editPermission: 'automaticOnly' }
    case 'richText': return { ...base, type: 'richText' }
    default: return { ...base, type: 'text' }
  }
}

function validateDefinition(draft: CustomSystemDefinition, definitions: CustomSystemDefinition[]): string {
  if (!draft.id.trim()) return 'O sistema precisa de um ID.'
  if (!draft.name.trim()) return 'O sistema precisa de um nome.'
  if (definitions.some((entry) => entry.id === draft.id && entry !== definitions.find((candidate) => candidate.id === draft.id))) return 'Já existe um sistema com esse ID.'
  const ids = [...draft.fields.map((entry) => entry.id), ...draft.resources.map((entry) => entry.id)]
  if (ids.some((id) => !id.trim())) return 'Campos e recursos precisam de IDs.'
  if (ids.length !== new Set(ids).size) return 'IDs de campos e recursos não podem se repetir.'
  return ''
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatStatus(status: ReturnType<typeof useCustomSystemsContext>['status']): string {
  if (status.kind === 'loading') return 'Carregando…'
  if (status.kind === 'saving') return 'Salvando…'
  if (status.kind === 'synced') return 'Sincronizado'
  if (status.kind === 'error') return status.message
  return 'Aguardando sincronização'
}
