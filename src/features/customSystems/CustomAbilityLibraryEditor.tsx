import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type {
  CustomAbilityTypeDefinition,
  CustomPredefinedAbilityDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type { JsonValue } from '../../models/customSystems/CustomGenerals'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

export function CustomAbilityLibraryEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const [typeIndex, setTypeIndex] = useState(0)
  const [abilityIndex, setAbilityIndex] = useState(0)
  const type = draft.abilityTypes[typeIndex]
  const abilities = type?.predefinedAbilities ?? []
  const ability = abilities[abilityIndex]

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

  if (!draft.abilityTypes.length) {
    return <Empty>Crie primeiro um tipo de habilidade na aba Avançado.</Empty>
  }

  return <div className="grid gap-4 xl:grid-cols-[240px_280px_minmax(0,1fr)]">
    <aside className="rounded-xl border border-border p-3">
      <h3 className="font-medium text-textH">Tipos</h3>
      <p className="mt-1 text-xs text-text">Escolha a categoria da biblioteca.</p>
      <div className="mt-3 grid gap-2">
        {draft.abilityTypes.map((entry, index) => <button key={`type-${index}`} type="button" onClick={() => { setTypeIndex(index); setAbilityIndex(0) }} className={`rounded-lg border px-3 py-2 text-left text-sm ${index === typeIndex ? 'border-accent bg-accentBg text-textH' : 'border-border text-text'}`}>
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
  </div>
}

function PresetField({ field, value, onChange }: { field: CustomFieldDefinition; value: JsonValue | undefined; onChange: (value: JsonValue) => void }) {
  if (field.type === 'boolean') return <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /> <span className="text-sm text-textH">{field.name}</span></label>
  if (field.type === 'select') return <label className="grid gap-1"><span className="label">{field.name}</span><select className="input-base" value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)}><option value="">Selecione</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
