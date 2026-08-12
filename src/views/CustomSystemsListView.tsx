import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Copy, Download, FileJson, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCustomSystemsContext } from '../contexts/customSystemsContext'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'

export function CustomSystemsListView() {
  const systems = useCustomSystemsContext()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return systems.definitions
    return systems.definitions.filter((definition) =>
      definition.name.toLocaleLowerCase('pt-BR').includes(term) ||
      definition.id.toLocaleLowerCase('pt-BR').includes(term) ||
      definition.description?.toLocaleLowerCase('pt-BR').includes(term) ||
      definition.tags?.some((tag) => tag.toLocaleLowerCase('pt-BR').includes(term)),
    )
  }, [search, systems.definitions])

  if (!systems.canManage) {
    return <Message title="Sistemas personalizados">Apenas o mestre pode gerenciar os sistemas da campanha.</Message>
  }

  function createSystem() {
    const created = systems.createDefinition()
    navigate(systemEditorPath(created.id, 'general'))
  }

  function editSystem(systemId: string) {
    navigate(systemEditorPath(systemId, 'general'))
  }

  function duplicateSystem(systemId: string) {
    const copy = systems.duplicateDefinition(systemId)
    if (copy) navigate(systemEditorPath(copy.id, 'general'))
  }

  function removeSystem(definition: CustomSystemDefinition) {
    if (!window.confirm(`Remover o sistema “${definition.name}”? O estado já salvo nos personagens continuará preservado.`)) return
    systems.removeDefinition(definition.id)
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    try {
      const imported: CustomSystemDefinition[] = []
      for (const file of files) {
        const parsed = JSON.parse(await file.text()) as unknown
        imported.push(...readImportedDefinitions(parsed))
      }
      if (!imported.length) throw new Error('Nenhum sistema válido foi encontrado nos arquivos selecionados.')

      const collisions = imported.filter((definition) => systems.definitions.some((current) => current.id === definition.id))
      if (collisions.length && !window.confirm(`${collisions.length} sistema(s) já existem e serão substituídos pelos dados importados. Continuar?`)) return

      systems.saveDefinitions(imported)
      setFeedback({ kind: 'success', message: `${imported.length} sistema(s) importado(s) com sucesso.` })
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível importar o JSON.' })
    }
  }

  return <div className="mx-auto grid w-full max-w-7xl gap-5">
    <header className="rounded-xl border border-border bg-bg p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><FileJson className="h-5 w-5 text-accent" /><h1 className="text-xl font-semibold text-textH">Sistemas personalizados</h1></div>
          <p className="mt-2 max-w-2xl text-sm text-text">Crie, organize, importe e exporte os sistemas personalizados sincronizados com esta campanha.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Importar JSON</ActionButton>
          <ActionButton disabled={!systems.definitions.length} onClick={() => exportAll(systems.definitions)}><Download className="h-4 w-4" /> Exportar todos</ActionButton>
          <ActionButton primary onClick={createSystem}><Plus className="h-4 w-4" /> Criar sistema</ActionButton>
          <input ref={inputRef} type="file" accept="application/json,.json" multiple className="hidden" onChange={(event) => void importJson(event)} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 sm:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-textMuted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, ID, descrição ou tag" className="min-w-0 flex-1 bg-transparent text-sm text-textH outline-none" />
        </label>
        <div className="flex items-center gap-2 text-xs text-text">
          <span>{formatStatus(systems.status)}</span>
          <button type="button" onClick={() => void systems.reload()} title="Recarregar sistemas" className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>
    </header>

    {feedback ? <div className={`rounded-lg border p-3 text-sm ${feedback.kind === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>{feedback.message}</div> : null}

    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-textH">Sistemas adicionados</h2>
        <span className="text-sm text-text">{filtered.length} de {systems.definitions.length}</span>
      </div>

      {filtered.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((definition) => <article key={definition.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accentBorder bg-accentBg text-xl text-textH">{definition.icon || '⚙'}</div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-textH">{definition.name}</h3>
              <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-text"><code className="truncate">{definition.id}</code><span className="shrink-0">v{definition.version}</span></div>
            </div>
          </div>

          <p className="mt-3 line-clamp-3 min-h-12 text-sm text-text">{definition.description?.trim() || 'Sem descrição.'}</p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-text">
            <Metric value={definition.fields.length} label="Campos" />
            <Metric value={definition.resources.length} label="Recursos" />
            <Metric value={definition.abilityTypes.reduce((total, type) => total + (type.predefinedAbilities?.length ?? 0), 0)} label="Habilidades" />
          </div>

          {definition.tags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{definition.tags.map((tag) => <span key={tag} className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-[11px] text-text">{tag}</span>)}</div> : null}

          <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
            <ActionButton primary onClick={() => editSystem(definition.id)}><Pencil className="h-4 w-4" /> Editar</ActionButton>
            <IconAction title="Exportar sistema" onClick={() => exportOne(definition)}><Download className="h-4 w-4" /></IconAction>
            <IconAction title="Duplicar sistema" onClick={() => duplicateSystem(definition.id)}><Copy className="h-4 w-4" /></IconAction>
            <IconAction danger title="Remover sistema" onClick={() => removeSystem(definition)}><Trash2 className="h-4 w-4" /></IconAction>
          </div>
        </article>)}
      </div> : <div className="rounded-xl border border-dashed border-border bg-bg p-10 text-center">
        <FileJson className="mx-auto h-10 w-10 text-textMuted" />
        <h3 className="mt-3 font-semibold text-textH">{systems.definitions.length ? 'Nenhum sistema encontrado' : 'Nenhum sistema criado'}</h3>
        <p className="mt-2 text-sm text-text">{systems.definitions.length ? 'Ajuste os termos da pesquisa.' : 'Crie um sistema novo ou importe um arquivo JSON.'}</p>
        {!systems.definitions.length ? <div className="mt-4"><ActionButton primary onClick={createSystem}><Plus className="h-4 w-4" /> Criar primeiro sistema</ActionButton></div> : null}
      </div>}
    </section>
  </div>
}

function readImportedDefinitions(value: unknown): CustomSystemDefinition[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.definitions)
      ? value.definitions
      : [value]

  return source.map(normalizeImportedDefinition).filter((entry): entry is CustomSystemDefinition => Boolean(entry))
}

function normalizeImportedDefinition(value: unknown): CustomSystemDefinition | undefined {
  if (!isRecord(value)) return undefined
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  if (!id) return undefined

  const automaticInstallation = normalizeAutomaticInstallation(value.automaticInstallation)
  const characterPlacement = isRecord(value.characterPlacement)
    ? value.characterPlacement as unknown as CustomSystemDefinition['characterPlacement']
    : automaticInstallation?.characterPlacement

  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id,
    description: typeof value.description === 'string' ? value.description : undefined,
    icon: typeof value.icon === 'string' ? value.icon : undefined,
    version: Number.isFinite(Number(value.version)) ? Math.max(1, Math.trunc(Number(value.version))) : 1,
    fields: Array.isArray(value.fields) ? value.fields as CustomSystemDefinition['fields'] : [],
    resources: Array.isArray(value.resources) ? value.resources as CustomSystemDefinition['resources'] : [],
    abilityTypes: Array.isArray(value.abilityTypes) ? value.abilityTypes as CustomSystemDefinition['abilityTypes'] : [],
    panels: Array.isArray(value.panels) ? value.panels as CustomSystemDefinition['panels'] : [],
    automations: Array.isArray(value.automations) ? value.automations as CustomSystemDefinition['automations'] : [],
    nativeStatOverrides: Array.isArray(value.nativeStatOverrides) ? value.nativeStatOverrides as CustomSystemDefinition['nativeStatOverrides'] : [],
    actions: Array.isArray(value.actions) ? value.actions as CustomSystemDefinition['actions'] : [],
    standardActionOverrides: Array.isArray(value.standardActionOverrides) ? value.standardActionOverrides as CustomSystemDefinition['standardActionOverrides'] : [],
    hiddenFromSheet: value.hiddenFromSheet === true,
    presentation: isRecord(value.presentation) ? value.presentation as unknown as CustomSystemDefinition['presentation'] : undefined,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    automaticInstallation,
    characterPlacement,
  }
}

function normalizeAutomaticInstallation(value: unknown): CustomSystemDefinition['automaticInstallation'] {
  if (!isRecord(value)) return undefined
  if (typeof value.enabled !== 'boolean') return undefined
  if (value.match !== 'all' && value.match !== 'any') return undefined

  return {
    enabled: value.enabled,
    match: value.match,
    requirements: Array.isArray(value.requirements)
      ? value.requirements as CustomSystemDefinition['automaticInstallation'] extends { requirements: infer T } ? T : never
      : [],
    characterPlacement: isRecord(value.characterPlacement)
      ? value.characterPlacement as unknown as NonNullable<CustomSystemDefinition['automaticInstallation']>['characterPlacement']
      : undefined,
  }
}

function exportOne(definition: CustomSystemDefinition) {
  downloadJson(`${safeFileName(definition.name || definition.id)}.custom-system.json`, definition)
}

function exportAll(definitions: CustomSystemDefinition[]) {
  downloadJson('custom-systems.json', {
    schema: 'dnd-manager.custom-systems',
    version: 1,
    exportedAt: new Date().toISOString(),
    definitions,
  })
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function systemEditorPath(systemId: string, tab: string): string {
  return `/custom-systems/${encodeURIComponent(systemId)}/${tab}`
}

function safeFileName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-system'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatStatus(status: ReturnType<typeof useCustomSystemsContext>['status']): string {
  if (status.kind === 'loading') return 'Carregando…'
  if (status.kind === 'saving') return 'Salvando…'
  if (status.kind === 'synced') return 'Sincronizado'
  if (status.kind === 'error') return status.message
  return 'Aguardando sincronização'
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-lg border border-border bg-bg-subtle px-2 py-2"><strong className="block text-sm text-textH">{value}</strong><span>{label}</span></div>
}

function ActionButton({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'border-accent bg-accent text-accentText hover:bg-accentHover' : 'border-border text-textH hover:bg-accentBg'}`}>{children}</button>
}

function IconAction({ children, onClick, title, danger }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return <button type="button" onClick={onClick} title={title} aria-label={title} className={`rounded-lg border p-2 ${danger ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-border text-textH hover:bg-accentBg'}`}>{children}</button>
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-bg p-5"><h1 className="text-lg font-semibold text-textH">{title}</h1><p className="mt-2 text-sm text-text">{children}</p></section>
}
