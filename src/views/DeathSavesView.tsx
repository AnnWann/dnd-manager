import type { Character } from '../features/models/types'
import { CharacterSelector } from '../features/characters/characterSelector'
import { DeathSavesPanel } from '../features/deathSaves/DeathSavesPanel'

type Props = {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
  canEditDeathSaves: boolean
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function DeathSavesView({
  characters,
  activeCharacter,
  setActiveCharacterId,
  addCharacter,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
  canEditDeathSaves,
  updateCharacter,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setActiveCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={disableDelete}
        showOwnerBadge={showOwnerBadge}
      />

      <DeathSavesPanel character={activeCharacter} canEdit={canEditDeathSaves} onChange={updateCharacter} />
    </div>
  )
}