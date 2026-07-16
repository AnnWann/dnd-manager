import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Copy, Download, Save, Settings2, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCustomSystemsContext } from '../contexts/customSystemsContext'
import { AdvancedSystemEditors } from '../features/customSystems/AdvancedSystemEditors'
import { CustomAbilityLibraryEditor } from '../features/customSystems/CustomAbilityLibraryEditor'
import {
  CustomSystemFieldsEditor,
  CustomSystemGeneralEditor,
  CustomSystemResourcesEditor,
  validateCustomSystemDefinition,
} from '../features/customSystems/CustomSystemCoreEditors'
import { CustomSystemPlacementEditor } from '../features/customSystems/CustomSystemPlacementEditor'
import { CustomSystemRequirementsEditor } from '../features/customSystems/CustomSystemRequirementsEditor'
import { readLocalStorageJson, removeLocalStorage, writeLocalStorageJson } from '../lib/storage'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'

export type CustomSystemEditorTab = 'general' | 'fields' | 'resources' | 'requirements' | 'library' | 'advanced'

type LocalCustomSystemDraft = {
  schema: 'dndmm.custom-system-draft'
  version: 1
  systemId: string
  draft: CustomSystemDefinition
  baseDefinition: CustomSystemDefinition
  savedAt: number
}

const TABS: Array<{ id: CustomSystemEditorTab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'fields', label: 'Campos' },
  { id: 'resources', label: 'Recursos' },
  { id: 'requirements', label: 'Requisitos' },
  { id: 'library', label: 'Biblioteca de habilidades' },
  { id: 'advanced', label: 'Avançado' },
]

export function CustomSystemEditorView() {
  const { systemId = '', tab } = useParams<{ systemId: string; tab?: string }>()
  const navigate = useNavigate()
  const systems = useCustomSystemsContext()
  const definition = systems.definitions.find((entry) => entry.id === systemId)
  const activeTab = isEditorTab(tab) ? tab : 'general'
  const [draft, setDraft] = useState<CustomSystemDefinition | null>(null)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [restoredDraft, setRestoredDraft] = useState(false)

  useEffect(() => {
    if (!definition) return
    const cached = readDraft(systemId)
    const hasUnsavedCachedChanges = cached && !definitionsEqual(cached.draft, cached.baseDefinition)
    setDraft(structuredClone(hasUnsavedCachedChanges ? cached.draft : definition))
    setRestoredDraft(Boolean(hasUnsavedCachedChanges))
    setError('')
  }, [definition, systemId])

  useEffect(() => {
    if (tab === activeTab || !systemId) return
    navigate(editorPath(systemId, activeTab), { replace: true })
  }, [activeTab, navigate, systemId, tab])

  const dirty = useMemo(() => Boolean(draft && definition && !definitionsEqual(draft, definition)), [definition, draft])

  useEffect(() => {
    if (dirty) setSavedMessage('')
  }, [dirty])

  useEffect(() => {
    if (!draft || !definition || !systemId) return
    if (!dirty) {
      removeDraft(systemId)
      return
    }
    writeDraft(systemId, draft, definition)
  }, [definition, dirty, draft, systemId])

  if (!systems.canManage) {
    return <Message title="Sistemas personalizados">Apenas o mestre pode editar sistemas da campanha.</Message>
  }

  if (!definition || !draft) {
    if (systems.status.kind === 'loading') return <Message title="Carregando sistema">Aguarde enquanto a definição é carregada.</Message>
    return <section className="mx-auto max-w-3xl rounded-xl border border-border bg-bg p-6 text-center">
      <h1 className="text-xl font-semibold text-textH">Sistema não encontrado</h1>
      <p className="mt-2 text-sm text-text">A definição solicitada não existe ou ainda não foi sincronizada.</p>
      <div className="mt-4"><ActionButton onClick={() => navigate('/custom-systems')}><ArrowLeft className="h-4 w-4" /> Voltar para sistemas</ActionButton></div>
    </section>
  }

  function changeTab(nextTab: CustomSystemEditorTab) {
    navigate(editorPath(systemId, nextTab))
  }

  function goBack() {
    if (dirty && !window.confirm('Há alterações não salvas. Elas continuarão guardadas neste dispositivo. Voltar para a lista?')) return
    navigate('/custom-systems')
  }

  function saveSystem() {
    const validation = validateCustomSystemDefinition(draft)
    if (validation) {
      setError(validation)
      setSavedMessage('')
      return
    }

    const collision = systems.definitions.some((entry) => entry.id === draft.id && entry.id !== systemId)
    if (collision) {
      setError(`Já existe outro sistema com o ID “${draft.id}”.`)
      setSavedMessage('')
      return
    }

    systems.saveDefinition(draft, systemId)
    removeDraft(systemId)
    if (draft.id !== systemId) removeDraft(draft.id)
    setRestoredDraft(false)
    setError('')
    setSavedMessage('Sistema salvo localmente. A sincronização remota continuará em segundo plano.')
    if (draft.id !== systemId) navigate(editorPath(draft.id, activeTab), { replace: true })
  }

  function duplicateSystem() {
    if (dirty && !window.confirm('A duplicação usará a última versão salva e ignorará alterações ainda não salvas. Continuar?')) return
    const copy = systems.duplicateDefinition(systemId)
    if (copy) navigate(editorPath(copy.id, activeTab))
  }

  function removeSystem() {
    if (!window.confirm(`Remover o sistema “${draft.name}”? O estado já salvo nos personagens continuará preservado.`)) return
    removeDraft(systemId)
    systems.removeDefinition(systemId)
    navigate('/custom-systems', { replace: true })
  }

  return <div className="mx-auto w-full max-w-7xl">
    <section className="min-w-0 rounded-xl border border-border bg-bg shadow-theme-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={goBack} title="Voltar para sistemas" className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accentBorder bg-accentBg text-lg">{draft.icon || <Settings2 className="h-5 w-5 text-accent" />}</div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-textH">{draft.name}</h1>
              {dirty ? <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">Não salvo</span> : null}
              {restoredDraft && dirty ? <span className="shrink-0 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[11px] text-textH">Rascunho restaurado</span> : null}
            </div>
            <p className="mt-1 truncate text-xs text-text"><code>{systemId}</code> · v{draft.version}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => exportDefinition(draft)}><Download className="h-4 w-4" /> Exportar</ActionButton>
          <ActionButton onClick={duplicateSystem}><Copy className="h-4 w-4" /> Duplicar</ActionButton>
          <ActionButton danger onClick={removeSystem}><Trash2 className="h-4 w-4" /> Remover</ActionButton>
          <ActionButton primary onClick={saveSystem}><Save className="h-4 w-4" /> Salvar</ActionButton>
        </div>
      </header>

      <nav className="flex overflow-x-auto border-b border-border p-2" aria-label="Seções do sistema">
        {TABS.map((entry) => <button
          key={entry.id}
          type="button"
          onClick={() => changeTab(entry.id)}
          aria-current={activeTab === entry.id ? 'page' : undefined}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === entry.id ? 'bg-accentBg font-medium text-textH' : 'text-text hover:bg-bg-subtle hover:text-textH'}`}
        >{entry.label}</button>)}
      </nav>

      {error ? <div className="mx-4 mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      {savedMessage && !error ? <div className="mx-4 mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{savedMessage}</div> : null}

      <div className="p-4 sm:p-5">
        {activeTab === 'general' ? <>
          <CustomSystemGeneralEditor draft={draft} setDraft={setDraft} />
          <CustomSystemPlacementEditor draft={draft} setDraft={setDraft} definitions={systems.definitions} />
        </> : null}
        {activeTab === 'fields' ? <CustomSystemFieldsEditor draft={draft} setDraft={setDraft} /> : null}
        {activeTab === 'resources' ? <CustomSystemResourcesEditor draft={draft} setDraft={setDraft} /> : null}
        {activeTab === 'requirements' ? <CustomSystemRequirementsEditor draft={draft} setDraft={setDraft} /> : null}
        {activeTab === 'library' ? <CustomAbilityLibraryEditor draft={draft} setDraft={setDraft} /> : null}
        {activeTab === 'advanced' ? <AdvancedSystemEditors draft={draft} setDraft={setDraft} /> : null}
      </div>
    </section>
  </div>
}

function isEditorTab(value: string | undefined): value is CustomSystemEditorTab {
  return TABS.some((tab) => tab.id === value)
}

function editorPath(systemId: string, tab: CustomSystemEditorTab): string {
  return `/custom-systems/${encodeURIComponent(systemId)}/${tab}`
}

function draftStorageKey(systemId: string): string {
  return `dndmm.customSystemDraft.v1.${encodeURIComponent(systemId)}`
}

function readDraft(systemId: string): LocalCustomSystemDraft | undefined {
  const cached = readLocalStorageJson<LocalCustomSystemDraft>(draftStorageKey(systemId))
  if (cached?.schema !== 'dndmm.custom-system-draft' || cached.version !== 1 || cached.systemId !== systemId) return undefined
  return cached
}

function writeDraft(systemId: string, draft: CustomSystemDefinition, baseDefinition: CustomSystemDefinition): void {
  writeLocalStorageJson(draftStorageKey(systemId), {
    schema: 'dndmm.custom-system-draft',
    version: 1,
    systemId,
    draft,
    baseDefinition,
    savedAt: Date.now(),
  } satisfies LocalCustomSystemDraft)
}

function removeDraft(systemId: string): void {
  removeLocalStorage(draftStorageKey(systemId))
}

function definitionsEqual(left: CustomSystemDefinition, right: CustomSystemDefinition): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exportDefinition(definition: CustomSystemDefinition) {
  const filename = `${safeFileName(definition.name || definition.id)}.custom-system.json`
  const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function safeFileName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-system'
}

function ActionButton({ children, onClick, primary, danger }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${primary ? 'border-accent bg-accent text-accentText hover:bg-accentHover' : danger ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-border text-textH hover:bg-accentBg'}`}>{children}</button>
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-bg p-5"><h1 className="text-lg font-semibold text-textH">{title}</h1><p className="mt-2 text-sm text-text">{children}</p></section>
}
