import { Eye, EyeOff, Plus, Settings2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Player } from '../../../models/player/Player'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../../models/customSystems/CustomSystemDefinition'
import {
  createCharacterCustomSystemState,
  setCustomSystemEnabled,
} from '../../../lib/customSystems'
import { useCustomSystemDefinitions } from '../../../lib/customSystems/CustomSystemRegistry'
import {
  CHARACTER_TABS,
  type CharacterTab,
} from '../characterViewTabs'
import { SelectCharacterOwner } from '../characterSheet/character_info/components/selectCharacterOwner'
import { SelectCharacterType } from '../characterSheet/character_info/components/selectCharacterType'
import { SelectCharacterUniqueness } from '../characterSheet/character_info/components/selectCharacterUniqueness'
import { SelectCharacterVisibility } from '../characterSheet/character_info/components/selectCharacterVisibility'
import {
  isActiveSystemState,
  isSuppressedSystemState,
} from '../customSystems/CustomSystemsTabWithLibrary'
import { CustomSystemAcquisitionExceptionsModal } from './CustomSystemAcquisitionExceptionsModal'

const SUPPRESSED_SYSTEM_MARKER = '__customSystemSuppressed'

const HIDEABLE_TABS = CHARACTER_TABS.filter(
  (tab) => tab.key !== 'sheet',
) as Array<(typeof CHARACTER_TABS)[number] & { key: Exclude<CharacterTab, 'sheet'> }>

type Props = {
  open: boolean
  onClose: () => void
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

export function CharacterSettingsModal({
  open,
  onClose,
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner,
}: Props) {
  const definitions = useCustomSystemDefinitions()
  const [exceptionSystemId, setExceptionSystemId] = useState('')

  if (!open || !canAssignOwners) return null

  const hiddenTabs = new Set(character.get('sheet').hiddenCharacterTabs ?? [])
  const states = (character.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
  const activeSystems = states.filter(isActiveSystemState)
  const hiddenSystems = states.filter(
    (state) => state.enabled === false && !isSuppressedSystemState(state),
  )
  const removedSystems = states.filter(isSuppressedSystemState)
  const availableSystems = definitions.filter(
    (definition) =>
      !states.some(
        (state) =>
          state.systemId === definition.id && !isSuppressedSystemState(state),
      ),
  )
  const exceptionState = states.find(
    (state) => state.systemId === exceptionSystemId && isActiveSystemState(state),
  )
  const exceptionDefinition = definitions.find(
    (definition) => definition.id === exceptionSystemId,
  )

  function setTabVisible(tab: CharacterTab, visible: boolean) {
    updateCharacter(character.get('id'), (current) => {
      const currentHidden = new Set(
        current.get('sheet').hiddenCharacterTabs ?? [],
      )

      if (visible) currentHidden.delete(tab)
      else currentHidden.add(tab)

      return current.withSheet(
        'hiddenCharacterTabs',
        Array.from(currentHidden),
      )
    })
  }

  function updateSystemStates(
    updater: (
      current: CharacterCustomSystemState[],
    ) => CharacterCustomSystemState[],
  ) {
    updateCharacter(character.get('id'), (current) => {
      const currentStates = (current.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
      return current.withSheet('customSystems', updater(currentStates))
    })
  }

  function replaceSystemState(nextState: CharacterCustomSystemState) {
    updateSystemStates((current) =>
      current.map((state) =>
        state.systemId === nextState.systemId ? nextState : state,
      ),
    )
  }

  function hideSystem(systemId: string) {
    updateSystemStates((current) =>
      current.map((state) =>
        state.systemId === systemId
          ? setCustomSystemEnabled(state, false)
          : state,
      ),
    )
  }

  function showSystem(systemId: string) {
    updateSystemStates((current) =>
      current.map((state) =>
        state.systemId === systemId
          ? setCustomSystemEnabled(state, true)
          : state,
      ),
    )
  }

  function removeSystem(state: CharacterCustomSystemState) {
    const name = systemName(definitions, state.systemId)
    if (
      !window.confirm(
        `Remover “${name}” desta ficha? Campos, recursos e habilidades desse sistema serão apagados.`,
      )
    ) {
      return
    }

    const marker = createSuppressedSystemState(state)
    updateSystemStates((current) =>
      current.map((entry) =>
        entry.systemId === state.systemId ? marker : entry,
      ),
    )
  }

  function installSystem(definition: CustomSystemDefinition) {
    const next: CharacterCustomSystemState = {
      ...createCharacterCustomSystemState(definition),
      installationSource: 'master',
    }

    updateSystemStates((current) => {
      const exists = current.some(
        (state) => state.systemId === definition.id,
      )
      return exists
        ? current.map((state) =>
            state.systemId === definition.id ? next : state,
          )
        : [...current, next]
    })
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Configurações de ${character.get('name')}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl gap-5 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)] sm:p-5">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
              <Settings2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-textH">
                Configurações de {character.get('name') || 'personagem'}
              </h2>
              <p className="mt-1 text-sm text-text">
                Controle acesso, abas visíveis e sistemas desta ficha.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg"
            aria-label="Fechar configurações"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="font-semibold text-textH">Configuração do personagem</h3>
          <p className="mt-1 text-xs text-text">
            Defina o tipo, a visibilidade, o jogador atribuído e a unicidade.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectCharacterType
              character={character}
              updateCharacter={updateCharacter}
              canEditCharacterType={canEditCharacterType}
            />
            <SelectCharacterVisibility
              character={character}
              updateCharacter={updateCharacter}
            />
            <SelectCharacterOwner
              character={character}
              updateCharacter={updateCharacter}
              playerKeys={playerKeys}
              getOwner={getOwner}
              createOwner={createOwner}
            />
            <SelectCharacterUniqueness
              character={character}
              updateCharacter={updateCharacter}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="font-semibold text-textH">Abas padrão</h3>
          <p className="mt-1 text-xs text-text">
            A aba Ficha permanece sempre visível. As demais podem ser ocultadas
            individualmente para este personagem.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {HIDEABLE_TABS.map((tab) => {
              const visible = !hiddenTabs.has(tab.key)
              const Icon = tab.icon

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTabVisible(tab.key, !visible)}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                    visible
                      ? 'border-accentBorder bg-accentBg'
                      : 'border-border bg-bg-subtle hover:bg-bg'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-accent" />
                    <span className="truncate text-sm font-medium text-textH">
                      {tab.label}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-text">
                    {visible ? (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Visível
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Oculta
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="font-semibold text-textH">Sistemas da ficha</h3>
          <p className="mt-1 text-xs text-text">
            Adicione, esconda, reative ou remova sistemas deste personagem.
          </p>

          <div className="mt-4 grid gap-3">
            {activeSystems.map((state) => {
              const definition = definitions.find((entry) => entry.id === state.systemId)
              return (
                <SystemRow
                  key={state.systemId}
                  name={systemName(definitions, state.systemId)}
                  status="Visível na ficha"
                >
                  {definition && hasConfigurableAbilityAcquisition(definition) ? (
                    <SmallAction onClick={() => setExceptionSystemId(state.systemId)}>
                      <Settings2 className="h-4 w-4" /> Exceções
                    </SmallAction>
                  ) : null}
                  <SmallAction onClick={() => hideSystem(state.systemId)}>
                    <EyeOff className="h-4 w-4" /> Esconder
                  </SmallAction>
                  <SmallAction danger onClick={() => removeSystem(state)}>
                    <Trash2 className="h-4 w-4" /> Remover
                  </SmallAction>
                </SystemRow>
              )
            })}

            {hiddenSystems.map((state) => (
              <SystemRow
                key={state.systemId}
                name={systemName(definitions, state.systemId)}
                status="Escondido, com dados preservados"
              >
                <SmallAction onClick={() => showSystem(state.systemId)}>
                  <Eye className="h-4 w-4" /> Mostrar
                </SmallAction>
                <SmallAction danger onClick={() => removeSystem(state)}>
                  <Trash2 className="h-4 w-4" /> Remover
                </SmallAction>
              </SystemRow>
            ))}

            {availableSystems.map((definition) => {
              const wasRemoved = removedSystems.some(
                (state) => state.systemId === definition.id,
              )
              return (
                <SystemRow
                  key={definition.id}
                  name={definition.name}
                  status={
                    wasRemoved
                      ? 'Removido desta ficha'
                      : 'Disponível para adicionar'
                  }
                >
                  <SmallAction onClick={() => installSystem(definition)}>
                    <Plus className="h-4 w-4" />
                    {wasRemoved ? 'Reinstalar' : 'Adicionar'}
                  </SmallAction>
                </SystemRow>
              )
            })}

            {!activeSystems.length &&
            !hiddenSystems.length &&
            !availableSystems.length ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text">
                Nenhum sistema disponível.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      {exceptionState && exceptionDefinition ? (
        <CustomSystemAcquisitionExceptionsModal
          character={character}
          definition={exceptionDefinition}
          state={exceptionState}
          onChange={replaceSystemState}
          onClose={() => setExceptionSystemId('')}
        />
      ) : null}
    </div>
  )
}

function SystemRow({
  name,
  status,
  children,
}: {
  name: string
  status: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <div className="font-medium text-textH">{name}</div>
        <div className="mt-1 text-xs text-text">{status}</div>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function SmallAction({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
        danger
          ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
          : 'border-border text-textH hover:bg-accentBg'
      }`}
    >
      {children}
    </button>
  )
}

function createSuppressedSystemState(
  state: CharacterCustomSystemState,
): CharacterCustomSystemState {
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

function systemName(
  definitions: CustomSystemDefinition[],
  systemId: string,
): string {
  return definitions.find((definition) => definition.id === systemId)?.name ?? systemId
}

function hasConfigurableAbilityAcquisition(definition: CustomSystemDefinition): boolean {
  return definition.abilityTypes.some((type) => {
    const mode = type.acquisition?.mode
    return mode === 'learned'
      || mode === 'prepared'
      || mode === 'learnedAndPrepared'
  })
}
