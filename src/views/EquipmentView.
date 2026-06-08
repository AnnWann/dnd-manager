import { CharacterSelector } from '../features/characters/characterSelector'
import { EquipmentModule } from '../features/characters/equipment/EquipmentModule'
import type { CharacterTemplate } from '../models/characters/CharacterTemplate'

type Props = {
  characters: CharacterTemplate[]
  activeCharacter: CharacterTemplate
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
  updateCharacter: (characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate) => void
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
    <div className="mx-auto w-full max-w-5xl gap-4">
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
        character={activeCharacter}
        updateCharacter={updateCharacter}
      />
    </div>
  )
}
