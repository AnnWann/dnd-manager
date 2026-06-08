import { useState } from "react"
import { CharacterAbilities } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheet } from "../features/characters/characterSheet/characterSheet"
import type { CharacterTemplate } from "../models/characters/CharacterTemplate"
import type { Player } from "../models/player/Player"
import { CharacterEquipment } from "../features/characters/equipment/EquipmentModule"
import { CharacterInventory } from "../features/characters/inventory/characterInventory"
import { CharacterViewTabs, type CharacterTab } from "../features/characters/characterViewTabs"

type Props = {
  characters: CharacterTemplate[]
  activeCharacter: CharacterTemplate
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
}

export function CharacterView({
  characters,
  activeCharacter,
  setActiveCharacterId,
  addCharacter,
  deleteActiveCharacter,
  disableDelete,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner,
}: Props) {
  const [activeTab, setActiveTab] = useState<CharacterTab>("sheet")

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

      <CharacterViewTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === "sheet" && (
        <CharacterSheet
          character={activeCharacter}
          updateCharacter={updateCharacter}
          canAssignOwners={canAssignOwners}
          canEditCharacterType={canEditCharacterType}
          playerKeys={playerKeys}
          getOwner={getOwner}
          createOwner={createOwner}
        />
      )}

      {activeTab === "abilities" && (
        <CharacterAbilities
          character={activeCharacter}
          updateCharacter={updateCharacter}
        />
      )}

      {activeTab === "equipment" && (
        <CharacterEquipment
          character={activeCharacter}
          updateCharacter={updateCharacter}
        />
      )}
      
      {activeTab === "inventory" && (
        <CharacterInventory
          character={activeCharacter}
          updateCharacter={updateCharacter}
          canEditInventory={canEditCharacterType}
        />
      )}
    </div>
  )
}