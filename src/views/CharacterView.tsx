import type { Attribute, Character } from '../models/types'
import { CharacterSelector } from '../features/characters/characterSelector'
import { CharacterSheet } from '../features/characters/characterSheet/characterSheet'
import { CharacterAbilities } from '../features/characters/CharacterAbilities'


export function CharacterView(props: {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  abilityShort: (ability: Attribute) => string
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void

  // Classes
  addClassToActive: (classIndex: string) => void

  // Calc
  effectiveCalcClassId: string
  setCalcClassId: (id: string) => void
  disableCalcClassSelect: boolean
  activeCharacterTotalLevel: number
  atk: number
  dc: number
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
}) {
  const {
    characters,
    activeCharacter,
    setActiveCharacterId,
    addCharacter,
    deleteActiveCharacter,
    disableDelete,
    abilityShort,
    updateCharacter,
    addClassToActive,
    canAssignOwners,
    canEditCharacterType,
    playerKeys,
  } = props

  return (

    <div className="flex flex-col gap-6">

      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setActiveCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={disableDelete}
        showOwnerBadge={canAssignOwners}
      />
       
      <CharacterSheet
        character={activeCharacter}
        abilityShort={abilityShort}
        updateCharacter={updateCharacter}
        addClassToActive={addClassToActive}
        canAssignOwners={canAssignOwners}
        canEditCharacterType={canEditCharacterType}
        playerKeys={playerKeys}
      />

      <CharacterAbilities
        character={activeCharacter}
        updateCharacter={updateCharacter}
      />

    </div>

    
  )
}
