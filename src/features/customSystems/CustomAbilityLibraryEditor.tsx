import { useMemo, useState } from 'react'
import { ClipboardCopy, FileJson, Plus, Trash2, Upload, X } from 'lucide-react'
import { Select } from '../../components/ui/Select'
import type {
  CustomAbilityTypeDefinition,
  CustomPredefinedAbilityDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type { JsonValue } from '../../models/customSystems/CustomGenerals'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

type ImportMode = 'append' | 'replace'

type AbilityLibraryJson = {
  schema: 'dnd-manager.custom-ability-library'
  version: 1
  abilityTypeId: string
  fields: Array<{
    id: string
    name: string
    type: string
    required?: boolean
    allowedValues?: string[]
  }>
  abilities: CustomPredefinedAbilityDefinition[]
}

export function CustomAbilityLibraryEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const [typeIndex, setTypeIndex] = useState(0)
  const [abilityIndex, setAbilityIndex] = useState(0)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('append')
  const [jsonFeedback, setJsonFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const type = draft.abilityTypes[typeIndex]
  const abilities = type?.predefinedAbilities ?? []
  const ability = abilities[abilityIndex]

  const templateJson = useMemo(
    () => type ? JSON.stringify(createLibraryTemplate(type), null, 2) : '',
    [type],
  )

  function replaceType(next: CustomAbilityTypeDefinition) {
    setDraft({
      ...draft,
      abilityTypes: draft.abilityTypes.map((entry, index) => index === typeIndex ? next : entry),
    })
  }

  function addAbility() {
    if (!type) return
    const next: CustomPredefinedAbilityDefinition = {
      id: uniqueId('habilidade', abilities.map((entry) => entry.id)),
      values: Object.fromEntries(
        type.fields
          .filter((field) => field.type !== 'formula' && field.defaultValue !== undefined)
          .map((field) => [field.id, field.defaultValue as JsonValue]),
      ),
    }
    replaceType({ ...type, predefinedAbilities: [...abilities, next] })
    setAbilityIndex(abilities.length)
  }

  function replaceAbility(next: CustomPredefinedAbilityDefinition) {
    if (!type) return
    replaceType({
      ...type,
      predefinedAbilities: abilities.map((entry, index) => index === abilityIndex ? next : entry),
    })
  }

  function removeAbility() {
    if (!type) return
    replaceType({
      ...type,
      predefinedAbilities: abilities.filter((_, index) => index !== abilityIndex),
    })
    setAbilityIndex(Math.max(0, abilityIndex - 1))
  }

  async function copyTemplate() {
    if (!templateJson) return
    try {
      await navigator.clipboard.writeText(templateJson)
      setJsonFeedback({ kind: 'success', message: 'Modelo JSON copiado. Ele já inclui os IDs e tipos dos campos deste tipo de habilidade.' })
    } catch {
      setJsonText(templateJson)
      setJsonOpen(true)
      setJsonFeedback({ kind: 'error', message: 'O navegador não permitiu copiar automaticamente. O modelo foi aberto para cópia manual.' })
    }
  }

  function openImporter() {
    setJsonText('')
    setJsonFeedback(null)
    setImportMode('append')
    setJsonOpen(true)
  }

  function importAbilities() {
    if (!type) return
    try {
      const parsed = JSON.parse(jsonText) as unknown
      const imported = readImportedAbilities(parsed, type)
      if (!imported.length) throw new Error('Nenhuma habilidade válida foi encontrada no JSON.')

      const duplicateIds = imported.filter((entry, index) =>
        imported.findIndex((other) => other.id === entry.id) !== index,
      )
      if (duplicateIds.length) {
        throw new Error(`O JSON possui IDs repetidos: ${Array.from(new Set(duplicateIds.map((entry) => entry.id))).join(', ')}.`)
      }

      let nextAbilities: CustomPredefinedAbilityDefinition[]
      if (importMode === 'replace') {
        nextAbilities = imported
      } else {
        const importedIds = new Set(imported.map((entry) => entry.id))
        const collisions = abilities.filter((entry) => importedIds.has(entry.id))
        if (collisions.length && !window.confirm(`${collisions.length} habilidade(s) já existem e serão substituídas pelos dados importados. Continuar?`)) return
        nextAbilities = [
          ...abilities.filter((entry) => !importedIds.has(entry.id)),
          ...imported,
        ]
      }

      replaceType({ ...type, predefinedAbilities: nextAbilities })
      setAbilityIndex(Math.max(0, nextAbilities.length - imported.length))
      setJsonFeedback({ kind: 'success', message: `${imported.length} habilidade(s) importada(s) com sucesso.` })
      setJsonText('')
    } catch (error) {
      setJsonFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível importar o JSON.' })
    }
  }

  return <section>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-textH">Biblioteca de habilidades</h3>
        <p className="mt-1 text-sm text-text">Cadastre habilidades prontas que o jogador poderá adicionar ao personagem.</p>
      </div>
      {type ? <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyTemplate()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">
          <ClipboardCopy className="h-4 w-4" /> Copiar modelo JSON
        </button>
        <button type="button" onClick={openImporter} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">
          <Upload className="h-4 w-4" /> Importar habilidades
        </button>
      </div> : null}
    </div>

    {jsonFeedback && !jsonOpen ? <Feedback feedback={jsonFeedback} /> : null}

    {!draft.abilityTypes.length ? <Empty>Crie primeiro um tipo de habilidade na aba Avançado.</Empty> : <div className="grid gap-4 xl:grid-cols-[240px_280px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border p-3">
        <h3 className="font-medium text-textH">Tipos</h3>
        <p className="mt-1 text-xs text-text">Escolha a categoria da biblioteca.</p>
        <div className="mt-3 grid gap-2">
          {draft.abilityTypes.map((entry, index) => <button key={`type-${index}`} type="button" onClick={() => { setTypeIndex(index); setAbilityIndex(0); setJsonFeedback(null) }} className={`rounded-lg border px-3 py-2 text-left text-sm ${index === typeIndex ? 'border-accent bg-accentBg text-textH' : 'border-border text-text'}`}>
            {entry.name}
            <span className="mt-1 block text-[11px]">{entry.predefinedAbilities?.length ?? 0} habilidade(s)</span>
          </button>)}
        </div>
      </aside>

      <aside className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div><h3 className="font-medium text-textH">Biblioteca</h3><p className="mt-1 text-xs text-text">Habilidades disponíveis aos jogadores.</p></div>
          <button type="button" onClick={addAbility} className="rounded-lg border border-accent p-2 text-accent" title="Adicionar habilidade"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 grid gap-2">
          {abilities.map((entry, index) => <button key={`preset-${index}`} type="button" onClick={() => setAbilityIndex(index)} className={`rounded-lg border px-3 py-2 text-left ${index === abilityIndex ? 'border-accent bg-accentBg' : 'border-border'}`}>
            <div className="text-sm font-medium text-textH">{presetTitle(type, entry)}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-text">{entry.id}</div>
          </button>)}
          {!abilities.length ? <Empty>Adicione a primeira habilidade deste tipo.</Empty> : null}
        </div>
      </aside>

      <main className="min-w-0 rounded-xl border border-border p-4">
        {type && ability ? <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold text-textH">Editar habilidade</h3><p className="mt-1 text-xs text-text">Estes valores serão copiados quando o jogador adicionar a habilidade.</p></div>
            <button type="button" onClick={removeAbility} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300"><Trash2 className="h-4 w-4" /> Remover</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="ID estável" value={ability.id} onChange={(id) => replaceAbility({ ...ability, id: slugify(id) })} />
            <Input label="Observação do mestre" value={ability.description ?? ''} onChange={(description) => replaceAbility({ ...ability, description: description || undefined })} />
          </div>
          <section className="rounded-lg border border-border p-3">
            <h4 className="text-sm font-medium text-textH">Dados da habilidade</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {type.fields.filter((field) => field.type !== 'formula').map((field) => <PresetField key={field.id} field={field} value={ability.values[field.id]} onChange={(value) => replaceAbility({ ...ability, values: { ...ability.values, [field.id]: value } })} />)}
            </div>
            {!type.fields.some((field) => field.type !== 'formula') ? <p className="mt-3 text-sm text-text">Este tipo ainda não possui campos editáveis.</p> : null}
          </section>
          <label className="flex items-center gap-2 text-sm text-textH"><input type="checkbox" checked={Boolean(type.allowCustomCreation)} onChange={(event) => replaceType({ ...type, allowCustomCreation: event.target.checked })} /> Permitir que o jogador crie habilidades fora da biblioteca</label>
        </div> : <Empty>Selecione ou adicione uma habilidade.</Empty>}
      </main>
    </div>}

    {jsonOpen && type ? <JsonImportModal
      type={type}
      jsonText={jsonText}
      setJsonText={setJsonText}
      importMode={importMode}
      setImportMode={setImportMode}
      feedback={jsonFeedback}
      templateJson={templateJson}
      onImport={importAbilities}
      onClose={() => setJsonOpen(false)}
    /> : null}
  </section>
}

function JsonImportModal({
  type,
  jsonText,
  setJsonText,
  importMode,
  setImportMode,
  feedback,
  templateJson,
  onImport,
  onClose,
}: {
  type: CustomAbilityTypeDefinition
  jsonText: string
  setJsonText: (value: string) => void
  importMode: ImportMode
  setImportMode: (value: ImportMode) => void
  feedback: { kind: 'success' | 'error'; message: string } | null
  templateJson: string
  onImport: () => void
  onClose: () => void
}) {
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent"><FileJson className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-textH">Importar habilidades — {type.name}</h2>
            <p className="mt-1 text-xs text-text">Cole o JSON gerado por uma IA ou transformado a partir de outra fonte.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg" aria-label="Fechar"><X className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="grid gap-3">
            <div>
              <h3 className="text-sm font-medium text-textH">JSON para importar</h3>
              <p className="mt-1 text-xs text-text">Aceita o modelo completo ou apenas um array em <code>abilities</code>.</p>
            </div>
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              className="min-h-[420px] w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs text-textH outline-none focus:border-accent"
              spellCheck={false}
              placeholder={templateJson}
            />
          </section>

          <section className="grid content-start gap-3">
            <div>
              <h3 className="text-sm font-medium text-textH">Estrutura esperada</h3>
              <p className="mt-1 text-xs text-text">Copie este modelo e peça para uma IA preencher ou converter dados para ele.</p>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-bg p-3 text-xs text-text">{templateJson}</pre>
            <button type="button" onClick={() => setJsonText(templateJson)} className="rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">Usar modelo no editor</button>
          </section>
        </div>

        <fieldset className="mt-4 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium text-textH">Como aplicar</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${importMode === 'append' ? 'border-accent bg-accentBg' : 'border-border'}`}>
              <input type="radio" name="ability-import-mode" checked={importMode === 'append'} onChange={() => setImportMode('append')} />
              <span><strong className="block text-sm text-textH">Adicionar e atualizar</strong><span className="mt-1 block text-xs text-text">Mantém habilidades atuais. IDs iguais são substituídos.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${importMode === 'replace' ? 'border-accent bg-accentBg' : 'border-border'}`}>
              <input type="radio" name="ability-import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
              <span><strong className="block text-sm text-textH">Substituir biblioteca</strong><span className="mt-1 block text-xs text-text">Remove todas as habilidades atuais deste tipo.</span></span>
            </label>
          </div>
        </fieldset>

        {feedback ? <div className="mt-4"><Feedback feedback={feedback} /></div> : null}
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-textH hover:bg-accentBg">Fechar</button>
        <button type="button" onClick={onImport} disabled={!jsonText.trim()} className="rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-medium text-accentText disabled:cursor-not-allowed disabled:opacity-50">Importar habilidades</button>
      </footer>
    </section>
  </div>
}

function createLibraryTemplate(type: CustomAbilityTypeDefinition): AbilityLibraryJson {
  const editableFields = type.fields.filter((field) => field.type !== 'formula')
  const exampleValues: Record<string, JsonValue> = {}

  for (const field of editableFields) {
    if (field.defaultValue !== undefined) {
      exampleValues[field.id] = field.defaultValue as JsonValue
      continue
    }
    if (field.type === 'number') exampleValues[field.id] = 0
    else if (field.type === 'boolean') exampleValues[field.id] = false
    else if (field.type === 'multiSelect') exampleValues[field.id] = []
    else if (field.type === 'select') exampleValues[field.id] = field.options[0]?.value ?? ''
    else if (field.type === 'dice') exampleValues[field.id] = field.allowedDice?.[0] ?? 'd6'
    else exampleValues[field.id] = ''
  }

  return {
    schema: 'dnd-manager.custom-ability-library',
    version: 1,
    abilityTypeId: type.id,
    fields: editableFields.map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      required: field.required || undefined,
      allowedValues: field.type === 'select' || field.type === 'multiSelect'
        ? field.options.map((option) => option.value)
        : field.type === 'dice'
          ? field.allowedDice
          : undefined,
    })),
    abilities: [{
      id: 'exemplo-de-habilidade',
      description: 'Observação opcional para o mestre.',
      values: exampleValues,
    }],
  }
}

function readImportedAbilities(value: unknown, type: CustomAbilityTypeDefinition): CustomPredefinedAbilityDefinition[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.abilities)
      ? value.abilities
      : [value]

  if (isRecord(value) && typeof value.abilityTypeId === 'string' && value.abilityTypeId !== type.id) {
    throw new Error(`Este JSON foi criado para o tipo “${value.abilityTypeId}”, mas o tipo selecionado é “${type.id}”.`)
  }

  const imported = source.map((entry, index) => normalizeImportedAbility(entry, type, index))
  return imported
}

function normalizeImportedAbility(value: unknown, type: CustomAbilityTypeDefinition, index: number): CustomPredefinedAbilityDefinition {
  if (!isRecord(value)) throw new Error(`A habilidade ${index + 1} não é um objeto JSON.`)
  const rawId = typeof value.id === 'string' ? value.id.trim() : ''
  const id = slugify(rawId)
  if (!id) throw new Error(`A habilidade ${index + 1} precisa de um campo “id” válido.`)
  if (!isRecord(value.values)) throw new Error(`A habilidade “${id}” precisa de um objeto “values”.`)

  const allowedFields = new Map(type.fields.filter((field) => field.type !== 'formula').map((field) => [field.id, field]))
  const values: Record<string, JsonValue> = {}

  for (const [fieldId, rawValue] of Object.entries(value.values)) {
    const field = allowedFields.get(fieldId)
    if (!field) continue
    values[fieldId] = validateImportedFieldValue(field, rawValue, id)
  }

  for (const field of allowedFields.values()) {
    if (field.required && values[field.id] === undefined && field.defaultValue === undefined) {
      throw new Error(`A habilidade “${id}” não informou o campo obrigatório “${field.id}”.`)
    }
    if (values[field.id] === undefined && field.defaultValue !== undefined) {
      values[field.id] = field.defaultValue as JsonValue
    }
  }

  return {
    id,
    description: typeof value.description === 'string' && value.description.trim() ? value.description.trim() : undefined,
    values,
  }
}

function validateImportedFieldValue(field: CustomFieldDefinition, value: unknown, abilityId: string): JsonValue {
  const error = () => new Error(`Valor inválido para “${field.id}” na habilidade “${abilityId}”. Esperado: ${field.type}.`)

  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw error()
    return value
  }
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') throw error()
    return value
  }
  if (field.type === 'select') {
    if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) throw error()
    return value
  }
  if (field.type === 'multiSelect') {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !field.options.some((option) => option.value === entry))) throw error()
    return value as string[]
  }
  if (field.type === 'dice') {
    if (typeof value !== 'string' || (field.allowedDice?.length && !field.allowedDice.includes(value as never))) throw error()
    return value
  }
  if (field.type === 'text' || field.type === 'richText' || field.type === 'reference') {
    if (typeof value !== 'string') throw error()
    return value
  }
  throw error()
}

function Feedback({ feedback }: { feedback: { kind: 'success' | 'error'; message: string } }) {
  return <div className={`rounded-lg border p-3 text-sm ${feedback.kind === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>{feedback.message}</div>
}

function PresetField({ field, value, onChange }: { field: CustomFieldDefinition; value: JsonValue | undefined; onChange: (value: JsonValue) => void }) {
  if (field.type === 'boolean') return <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /> <span className="text-sm text-textH">{field.name}</span></label>
  if (field.type === 'select') return <label className="grid gap-1"><span className="label">{field.name}</span><Select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)}><option value="">Selecione</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
  if (field.type === 'multiSelect') {
    const selected = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
    return <fieldset className="rounded-lg border border-border p-3"><legend className="px-1 text-xs text-text">{field.name}</legend>{field.options.map((option) => <label key={option.value} className="mr-3 inline-flex items-center gap-1 text-sm text-textH"><input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((entry) => entry !== option.value))} /> {option.label}</label>)}</fieldset>
  }
  if (field.type === 'number') return <Input label={field.name} type="number" value={typeof value === 'number' ? String(value) : ''} onChange={(next) => onChange(Number(next) || 0)} />
  return <Input label={field.name} value={typeof value === 'string' ? value : ''} onChange={onChange} />
}

function presetTitle(type: CustomAbilityTypeDefinition | undefined, ability: CustomPredefinedAbilityDefinition): string {
  if (!type) return ability.id
  const value = ability.values[type.display.titleFieldId]
  return typeof value === 'string' && value.trim() ? value : ability.id
}
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1"><span className="label">{label}</span><input className="input-base" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Empty({ children }: { children: string }) { return <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text">{children}</div> }
function slugify(value: string): string { return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') }
function uniqueId(base: string, used: string[]): string { if (!used.includes(base)) return base; let index = 2; while (used.includes(`${base}-${index}`)) index += 1; return `${base}-${index}` }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
