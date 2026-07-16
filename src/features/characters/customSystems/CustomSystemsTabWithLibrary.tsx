import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Eye, EyeOff, Plus, Search, Settings2, Trash2, X } from 'lucide-react'
import { Select } from '../../../components/ui/Select'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type { CustomPredefinedAbilityDefinition } from '../../../models/customSystems/CustomAbilityDefinition'
import type { CharacterCustomSystemState, CustomAbilityInstance, CustomSystemDefinition } from '../../../models/customSystems/CustomSystemDefinition'
import {
  addCustomAbility,
  createAutomaticallyInstalledCustomSystemState,
  createCharacterCustomSystemState,
  setCustomSystemEnabled,
  shouldAutomaticallyInstallCustomSystem,
  type CustomSystemActor,
} from '../../../lib/customSystems'
import { useCustomSystemDefinitions } from '../../../lib/customSystems/CustomSystemRegistry'
import { CustomSystemsTab } from './CustomSystemsTab'

const PREDEFINED_MARKER = '__predefinedAbilityId'
const SUPPRESSED_SYSTEM_MARKER = '__customSystemSuppressed'

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void
  actor: CustomSystemActor
}

type PlacementProps = Props & {
  systemIds?: string[]
}

export function CustomSystemsRuntime({ character, updateCharacter }: Pick<Props, 'character' | 'updateCharacter'>) {
  const definitions = useCustomSystemDefinitions()
  const states = (character.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]

  const automaticDefinitions = useMemo(
    () => definitions.filter((definition) =>
      !states.some((state) => state.systemId === definition.id) &&
      shouldAutomaticallyInstallCustomSystem(definition, character),
    ),
    [character, definitions, states],
  )

  useMemo(() => automaticDefinitions, [automaticDefinitions])

  if (automaticDefinitions.length) {
    queueMicrotask(() => {
      updateCharacter(character.get('id'), (current) => {
        const currentStates = (current.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
        const existingIds = new Set(currentStates.map((state) => state.systemId))
        const additions = automaticDefinitions
          .filter((definition) => !existingIds.has(definition.id))
          .map(createAutomaticallyInstalledCustomSystemState)
        if (!additions.length) return current
        return current.withSheet('customSystems', [...currentStates, ...additions])
      })
    })
  }

  return null
}

export function CustomSystemsTabWithLibrary({
  character,
  updateCharacter,
  actor,
  systemIds,
}: PlacementProps) {
  const definitions = useCustomSystemDefinitions()
  const states = (character.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
  const [open, setOpen] = useState(false)
  const allowedIds = useMemo(() => systemIds ? new Set(systemIds) : undefined, [systemIds])
  const activeStates = states.filter((state) =>
    isActiveSystemState(state) && (!allowedIds || allowedIds.has(state.systemId)),
  )

  if (!activeStates.length) return null

  const installedDefinitions = definitions.filter((definition) =>
    activeStates.some((state) => state.systemId === definition.id),
  )
  const hasLibraryEntries = installedDefinitions.some((definition) =>
    definition.abilityTypes.some((type) => (type.predefinedAbilities?.length ?? 0) > 0),
  )

  return <div className="grid gap-4">
    {hasLibraryEntries ? <div className="flex justify-end">
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accentBg px-3 py-2 text-sm font-medium text-textH">
        <BookOpen className="h-4 w-4" /> Adicionar da biblioteca
      </button>
    </div> : null}

    {activeStates.map((state) => {
      const visibleCharacter = character.withSheet('customSystems', [state])
      return <div
        key={state.systemId}
        className="[&>div]:!grid-cols-1 [&>div>aside]:hidden"
      >
        <CustomSystemsTab
          character={visibleCharacter}
          updateCharacter={updateCharacter}
          actor={actor}
        />
      </div>
    })}

    {open ? <AbilityLibraryModal character={character} updateCharacter={updateCharacter} actor={actor} systemIds={systemIds} onClose={() => setOpen(false)} /> : null}
  </div>
}

export function CustomSystemsManagementModal({
  character,
  updateCharacter,
  actor,
  open,
  onClose,
}: Props & { open: boolean; onClose: () => void }) {
  const definitions = useCustomSystemDefinitions()
  const states = (character.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
  if (!open || actor !== 'master') return null

  const active = states.filter(isActiveSystemState)
  const disabled = states.filter((state) => state.enabled === false && !isSuppressedSystemState(state))
  const suppressed = states.filter(isSuppressedSystemState)
  const available = definitions.filter((definition) =>
    !states.some((state) => state.systemId === definition.id && !isSuppressedSystemState(state)),
  )

  function updateStates(updater: (current: CharacterCustomSystemState[]) => CharacterCustomSystemState[]) {
    updateCharacter(character.get('id'), (current) => {
      const currentStates = (current.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
      return current.withSheet('customSystems', updater(currentStates))
    })
  }

  function disable(systemId: string) {
    updateStates((current) => current.map((state) => state.systemId === systemId ? setCustomSystemEnabled(state, false) : state))
  }

  function enable(systemId: string) {
    updateStates((current) => current.map((state) => state.systemId === systemId ? setCustomSystemEnabled(state, true) : state))
  }

  function remove(state: CharacterCustomSystemState) {
    const definition = definitions.find((entry) => entry.id === state.systemId)
    const name = definition?.name ?? state.systemId
    if (!window.confirm(`Remover “${name}” desta ficha? Campos, recursos e habilidades desse sistema serão apagados.`)) return
    const marker = createSuppressedSystemState(state)
    updateStates((current) => current.map((entry) => entry.systemId === state.systemId ? marker : entry))
  }

  function install(definition: CustomSystemDefinition) {
    const next: CharacterCustomSystemState = {
      ...createCharacterCustomSystemState(definition),
      installationSource: 'master',
    }
    updateStates((current) => {
      const exists = current.some((state) => state.systemId === definition.id)
      return exists
        ? current.map((state) => state.systemId === definition.id ? next : state)
        : [...current, next]
    })
  }

  return <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
    role="dialog"
    aria-modal="true"
    aria-labelledby="custom-systems-management-title"
    onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}
  >
    <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent"><Settings2 className="h-5 w-5" /></div>
          <div>
            <h2 id="custom-systems-management-title" className="font-semibold text-textH">Sistemas da ficha</h2>
            <p className="mt-1 text-xs text-text">Adicione, esconda, reative ou remova sistemas deste personagem.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-text hover:bg-accentBg" aria-label="Fechar"><X className="h-5 w-5" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          {active.map((state) => <SystemManagementRow key={state.systemId} name={definitionName(definitions, state.systemId)} status="Visível na ficha">
            <SmallAction onClick={() => disable(state.systemId)}><EyeOff className="h-4 w-4" /> Esconder</SmallAction>
            <SmallAction danger onClick={() => remove(state)}><Trash2 className="h-4 w-4" /> Remover</SmallAction>
          </SystemManagementRow>)}

          {disabled.map((state) => <SystemManagementRow key={state.systemId} name={definitionName(definitions, state.systemId)} status="Escondido, com dados preservados">
            <SmallAction onClick={() => enable(state.systemId)}><Eye className="h-4 w-4" /> Mostrar</SmallAction>
            <SmallAction danger onClick={() => remove(state)}><Trash2 className="h-4 w-4" /> Remover</SmallAction>
          </SystemManagementRow>)}

          {available.map((definition) => {
            const wasRemoved = suppressed.some((state) => state.systemId === definition.id)
            return <SystemManagementRow key={definition.id} name={definition.name} status={wasRemoved ? 'Removido desta ficha' : 'Disponível para adicionar'}>
              <SmallAction onClick={() => install(definition)}><Plus className="h-4 w-4" /> {wasRemoved ? 'Reinstalar' : 'Adicionar'}</SmallAction>
            </SystemManagementRow>
          })}

          {!active.length && !disabled.length && !available.length ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text">Nenhum sistema disponível.</div> : null}
        </div>
      </div>
    </section>
  </div>
}

function AbilityLibraryModal({ character, updateCharacter, actor, systemIds, onClose }: PlacementProps & { onClose: () => void }) {
  const definitions = useCustomSystemDefinitions()
  const states = (character.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
  const allowedIds = useMemo(() => systemIds ? new Set(systemIds) : undefined, [systemIds])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const entries = useMemo(() => definitions.flatMap((definition) => {
    if (allowedIds && !allowedIds.has(definition.id)) return []
    const state = states.find((entry) => entry.systemId === definition.id && isActiveSystemState(entry))
    if (!state) return []
    return definition.abilityTypes.flatMap((type) => (type.predefinedAbilities ?? []).map((preset) => ({ definition, state, type, preset })))
  }), [allowedIds, definitions, states])

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
    const abilityType = definition.abilityTypes.find((entry) => entry.id === typeId)
    const ability: CustomAbilityInstance = {
      id: crypto.randomUUID(),
      abilityTypeId: typeId,
      predefinedAbilityId: preset.id,
      values: { ...preset.values, [PREDEFINED_MARKER]: preset.id },
      enabled: true,
      usage: abilityType?.activation?.usage
        ? { used: 0, maximum: abilityType.activation.usage.maximum }
        : undefined,
    }
    const next = addCustomAbility(definition, state, ability, actor)
    updateCharacter(character.get('id'), (current) => {
      const currentStates = (current.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
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
        <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrar por tipo de habilidade">
          <option value="">Todos os tipos</option>
          {typeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </Select>
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

function SystemManagementRow({ name, status, children }: { name: string; status: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
    <div><div className="font-medium text-textH">{name}</div><div className="mt-1 text-xs text-text">{status}</div></div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
}

function SmallAction({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${danger ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-border text-textH hover:bg-accentBg'}`}>{children}</button>
}

function createSuppressedSystemState(state: CharacterCustomSystemState): CharacterCustomSystemState {
  return {
    systemId: state.systemId,
    systemVersion: state.systemVersion,
    enabled: false,
    fields: { [SUPPRESSED_SYSTEM_MARKER]: true },
    resources: {},
    abilities: [],
    installationSource: state.installationSource,
  }
}

export function isSuppressedSystemState(state: CharacterCustomSystemState): boolean {
  return state.fields[SUPPRESSED_SYSTEM_MARKER] === true
}

export function isActiveSystemState(state: CharacterCustomSystemState): boolean {
  return state.enabled !== false && !isSuppressedSystemState(state)
}

function definitionName(definitions: CustomSystemDefinition[], systemId: string): string {
  return definitions.find((definition) => definition.id === systemId)?.name ?? systemId
}

function hasPreset(state: CharacterCustomSystemState, typeId: string, presetId: string): boolean {
  return state.abilities.some((ability) => ability.abilityTypeId === typeId && (ability.predefinedAbilityId === presetId || ability.values[PREDEFINED_MARKER] === presetId))
}

function presetTitle(titleFieldId: string, preset: CustomPredefinedAbilityDefinition): string {
  const value = preset.values[titleFieldId]
  return typeof value === 'string' && value.trim() ? value : preset.id
}
