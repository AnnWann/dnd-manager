import { useState } from "react"
import { CharacterAbilities } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheet } from "../features/characters/characterSheet/characterSheet"
import type { CharacterTemplate } from "../models/characters/CharacterTemplate"
import type { Player } from "../models/player/Player"
import { EquipmentModule } from "../features/characters/equipment/EquipmentModule"
import { CharacterInventory } from "../features/characters/inventory/PersonalInventory"

type CharacterTab = "sheet" | "abilities" | "equipment" | "inventory"

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

      <div className="flex gap-2 rounded-lg border border-border bg-bg p-1">
        <button
          type="button"
          onClick={() => setActiveTab("sheet")}
          className={
            activeTab === "sheet"
              ? "flex-1 rounded-md bg-accentBg px-3 py-2 text-xs font-medium text-textH"
              : "flex-1 rounded-md px-3 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
          }
        >
          Ficha
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("abilities")}
          className={
            activeTab === "abilities"
              ? "flex-1 rounded-md bg-accentBg px-3 py-2 text-xs font-medium text-textH"
              : "flex-1 rounded-md px-3 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
          }
        >
          Habilidades
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("equipment")}
          className={
            activeTab === "equipment"
              ? "flex-1 rounded-md bg-accentBg px-3 py-2 text-xs font-medium text-textH"
              : "flex-1 rounded-md px-3 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
          }
        >
          Equipamento
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={
            activeTab === "inventory"
              ? "flex-1 rounded-md bg-accentBg px-3 py-2 text-xs font-medium text-textH"
              : "flex-1 rounded-md px-3 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
          }
        >
          Inventário
        </button>
      </div>

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
        <EquipmentModule
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