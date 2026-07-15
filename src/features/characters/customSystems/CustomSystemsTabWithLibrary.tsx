import { useMemo, useState } from 'react'
import { BookOpen, Plus, Search, X } from 'lucide-react'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type { CustomPredefinedAbilityDefinition } from '../../../models/customSystems/CustomAbilityDefinition'
import type { CharacterCustomSystemState, CustomAbilityInstance, CustomSystemDefinition } from '../../../models/customSystems/CustomSystemDefinition'
import { addCustomAbility, type CustomSystemActor } from '../../../lib/customSystems'
import { useCustomSystemDefinitions } from '../../../lib/customSystems/CustomSystemRegistry'
import { CustomSystemsTab } from './CustomSystemsTab'

const PREDEFINED_MARKER = '__predefinedAbilityId'

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void
  actor: CustomSystemActor
}

export function CustomSystemsTabWithLibrary(props: Props) {
  const [open, setOpen] = useState(false)
  return <div className="grid gap-4">
    <div className="flex justify-end">
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accentBg px-3 py-2 text-sm font-medium text-textH">
        <BookOpen className="h-4 w-4" /> Adicionar da biblioteca
      </button>
    </div>
    <CustomSystemsTab {...props} />
    {open ? <AbilityLibraryModal {...props} onClose={() => setOpen(false)} /> : null}
  </div>
}

function AbilityLibraryModal({ character, updateCharacter, actor, onClose }: Props & { onClose: () => void }) {
  const definitions = useCustomSystemDefinitions()
  const states = character.get('sheet').customSystems ?? []
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const entries = useMemo(() => definitions.flatMap((definition) => {
    const state = states.find((entry) => entry.systemId === definition.id)
    if (!state) return []
    return definition.abilityTypes.flatMap((type) => (type.predefinedAbilities ?? []).map((preset) => ({ definition, state, type, preset })))
  }), [definitions, states])

  const typeOptions = useMemo(() => Array.from(new Map(entries.map((entry) => [`${entry.definition.id}:${entry.type.id}`, { id: `${entry.definition.id}:${entry.type.id}`, label: `${entry.type.name} — ${entry.definition.name}` }])).values()), [entries])
  const filtered = entries.filter((entry) => {
    const title = presetTitle(entry.type.display.titleFieldId, entry.preset)
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !term || title.toLocaleLowerCase('pt-BR').includes(term) || entry.type.name.toLocaleLowerCase('pt-BR').includes(term) || entry.preset.description?.toLocaleLowerCase('pt-BR').includes(term)
    const matchesType = !typeFilter || typeFilter === `${entry.definition.id}:${entry.type.id}`
    return matchesSearch && matchesType
  })

  function learn(definition: CustomSystemDefinition, state: CharacterCustomSystemState, typeId: string, preset: CustomPredefinedAbilityDefinition) {
    if (hasPreset(state, typeId, preset.id)) return
    const ability: CustomAbilityInstance = {
      id: crypto.randomUUID(),
      abilityTypeId: typeId,
      predefinedAbilityId: preset.id,
      values: { ...preset.values, [PREDEFINED_MARKER]: preset.id },
      enabled: true,
      usage: definition.abilityTypes.find((entry) => entry.id === typeId)?.activation?.usage
        ? { used: 0, maximum: definition.abilityTypes.find((entry) => entry.id === typeId)?.activation?.usage?.maximum }
        : undefined,
    }
    const next = addCustomAbility(definition, state, ability, actor)
    updateCharacter(character.get('id'), (current) => {
      const currentStates = current.get('sheet').customSystems ?? []
      return current.withSheet('customSystems', currentStates.map((entry) => entry.systemId === next.systemId ? next : entry))
    })
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div><h2 className="font-semibold text-textH">Biblioteca de habilidades</h2><p className="mt-1 text-xs text-text">Escolha habilidades disponibilizadas pelo mestre para este personagem.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-text hover:bg-accentBg" aria-label="Fechar"><X className="h-5 w-5" /></button>
      </header>
      <div className="grid gap-3 border-b border-border p-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"><Search className="h-4 w-4 text-text" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar habilidade" className="min-w-0 flex-1 bg-transparent text-sm text-textH outline-none" autoFocus /></label>
        <select className="input-base" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos os tipos</option>{typeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(({ definition, state, type, preset }) => {
            const learned = hasPreset(state, type.id, preset.id)
            return <article key={`${definition.id}:${type.id}:${preset.id}`} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-medium text-textH">{presetTitle(type.display.titleFieldId, preset)}</div><div className="mt-1 text-xs text-text">{type.name} · {definition.name}</div></div>
                {type.icon ? <span className="text-xl" aria-hidden="true">{type.icon}</span> : null}
              </div>
              {preset.description ? <p className="mt-3 text-sm text-text">{preset.description}</p> : null}
              <button type="button" disabled={learned} onClick={() => learn(definition, state, type.id, preset)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm font-medium text-textH disabled:border-border disabled:opacity-60">
                {learned ? 'Já adicionada' : <><Plus className="h-4 w-4" /> Adicionar ao personagem</>}
              </button>
            </article>
          })}
        </div>
        {!filtered.length ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text">Nenhuma habilidade disponível com esses filtros.</div> : null}
      </div>
    </section>
  </div>
}

function hasPreset(state: CharacterCustomSystemState, typeId: string, presetId: string): boolean {
  return state.abilities.some((ability) => ability.abilityTypeId === typeId && (ability.predefinedAbilityId === presetId || ability.values[PREDEFINED_MARKER] === presetId))
}
function presetTitle(titleFieldId: string, preset: CustomPredefinedAbilityDefinition): string { const value = preset.values[titleFieldId]; return typeof value === 'string' && value.trim() ? value : preset.id }
