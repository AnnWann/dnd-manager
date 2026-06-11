import { useState } from "react"
import { CharacterAbilities } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheet } from "../features/characters/characterSheet/characterSheet"
import { CharacterEquipment } from "../features/characters/equipment/EquipmentModule"
import { CharacterInventory } from "../features/characters/inventory/characterInventory"
import { CharacterViewTabs, type CharacterTab } from "../features/characters/characterViewTabs"
import { CharacterSpellsModule } from "../features/characters/spells/characterSpellsModule"
import { useCharacterContext } from "../contexts/characterContext"

export function CharacterView() {
  const {
    visibleCharacters: characters,
    activeCharacter,
    setSelectedCharacterId,
    addCharacter,
    deleteCharacter,
    updateCharacter,
    canAssignOwners,
    canEditCharacterType,
    knownPlayerKeys: playerKeys,
    getOwner,
    createOwner,
  } = useCharacterContext()

  const [activeTab, setActiveTab] = useState<CharacterTab>("sheet")

  if (!activeCharacter) {
    return <div className="text-sm text-text">Nenhum personagem visível.</div>
  }

  const deleteActiveCharacter = () => {
    deleteCharacter(activeCharacter.get("id"))
  }

  return (
    <div className="flex flex-col gap-6">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setSelectedCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={characters.length <= 1}
        showOwnerBadge={canAssignOwners}
      />

      <CharacterViewTabs activeTab={activeTab} setActiveTab={setActiveTab} />

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

      {activeTab === "spellsList" && (
        <CharacterSpellsModule
          character={activeCharacter}
          updateCharacter={updateCharacter}
        />
      )}
    </div>
  )
}