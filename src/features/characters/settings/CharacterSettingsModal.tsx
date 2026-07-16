import { Eye, EyeOff, Settings2, X } from 'lucide-react'
import type { Player } from '../../../models/player/Player'
import type { CharacterTemplate } from '../../../models/characters/CharacterTemplate'
import {
  CHARACTER_TABS,
  type CharacterTab,
} from '../characterViewTabs'
import { SelectCharacterOwner } from '../characterSheet/character_info/components/selectCharacterOwner'
import { SelectCharacterType } from '../characterSheet/character_info/components/selectCharacterType'
import { SelectCharacterUniqueness } from '../characterSheet/character_info/components/selectCharacterUniqueness'
import { SelectCharacterVisibility } from '../characterSheet/character_info/components/selectCharacterVisibility'
import { CustomSystemsManagementPanel } from '../customSystems/CustomSystemsTabWithLibrary'

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
  if (!open || !canAssignOwners) return null

  const hiddenTabs = new Set(character.get('sheet').hiddenCharacterTabs ?? [])

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

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/65 p-2 pt-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Configurações de ${character.get('name')}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl gap-5 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)] sm:p-5">
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

        <CustomSystemsManagementPanel
          character={character}
          updateCharacter={updateCharacter}
          actor="master"
        />
      </section>
    </div>
  )
}
