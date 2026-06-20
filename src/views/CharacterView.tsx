import { useState } from "react"
import { CharacterAbilities } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheet } from "../features/characters/characterSheet/characterSheet"
import { CharacterEquipment } from "../features/characters/equipment/characterEquipment"
import { CharacterInventory } from "../features/characters/inventory/characterInventory"
import { CharacterViewTabs, type CharacterTab } from "../features/characters/characterViewTabs"
import { CharacterMagic } from "../features/characters/magic/characterMagicModule"
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
    return (
      <div className="mx-auto w-full max-w-xl rounded-xl border border-accentBorder bg-bg p-4">
        <div className="text-sm font-semibold text-textH">
          Nenhum personagem visível
        </div>

        <div className="mt-1 text-xs text-text">
          Você ainda não tem um personagem associado a este jogador.
        </div>

        <button
          type="button"
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accentText"
          onClick={addCharacter}
        >
          Criar personagem
        </button>
      </div>
    )
  }

  const deleteActiveCharacter = () => {
    deleteCharacter(activeCharacter.get("id"))
  }

  return (
    <div className="flex flex-col gap-4">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setSelectedCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={characters.length <= 1}
        showOwnerBadge={canAssignOwners}
      />

      <div className="sticky top-0 z-20 bg-[color:var(--surface-app)] py-2">
        <CharacterViewTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      <div className="min-w-0">
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
        <CharacterMagic
          character={activeCharacter}
          updateCharacter={updateCharacter}
        />
      )}
    </div>
  </div>
  )
}