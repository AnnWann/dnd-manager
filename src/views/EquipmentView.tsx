import { CharacterSelector } from '../features/characters/characterSelector'
import { EquipmentModule } from '../features/equipment/EquipmentModule'
import type { Character } from '../features/models/types'

type Props = {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function EquipmentView({
  characters,
  activeCharacter,
  setActiveCharacterId,
  addCharacter,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
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

      <EquipmentModule
        activeCharacter={activeCharacter}
        updateCharacter={updateCharacter}
      />
    </div>
  )
}
