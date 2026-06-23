import { useMemo, useState } from "react"
import { CharacterAbilitiesTab } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheetTab } from "../features/characters/characterSheet/characterSheet"
import { CharacterEquipmentTab } from "../features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../features/characters/inventory/characterInventory"
import { CharacterViewTabs, type CharacterTab } from "../features/characters/characterViewTabs"
import { CharacterMagicTab } from "../features/characters/magic/characterMagicModule"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { CharacterProficienciesTab } from "../features/characters/proficiencies/characterProficiencies"
import { CharacterRaceTab } from "../features/characters/race/characterRaceV2"
import { CharacterProfileTab } from "../features/characters/profile/characterProfileV2"
import { CharacterRestControls } from "../features/characters/rest/characterRestControls"
import { CharacterCreationWizard } from "../features/characters/creation/characterCreationWizardV5"
import { ensureCharacterBackgroundFromHistory } from "../features/characters/creation/inferCharacterBackground"
import type { Player } from "../models/player/Player"

export function CharacterView() {
  const {
    visibleCharacters: characters,
    activeCharacter,
    partyInventory,
    setSelectedCharacterId,
    importCharacter,
    deleteCharacter,
    updateCharacter,
    completeLongRest,
    canAssignOwners,
    canEditCharacterType,
    knownPlayerKeys: playerKeys,
    getOwner,
    createOwner,
  } = useCharacterContext()
  const { userKey } = useSyncContext()

  const [activeTab, setActiveTab] = useState<CharacterTab>("sheet")
  const [creationOpen, setCreationOpen] = useState(false)

  const owners = useMemo(
    () => playerKeys.map((key) => getOwner(key)),
    [getOwner, playerKeys],
  )

  const defaultOwner = useMemo(() => {
    const normalizedUserKey = userKey.trim()

    if (normalizedUserKey) {
      return getOwner(normalizedUserKey)
    }

    return (
      activeCharacter?.get("owner") ??
      owners[0] ??
      createOwner("Jogador local")
    )
  }, [activeCharacter, createOwner, getOwner, owners, userKey])

  const wizardOwners = useMemo(
    () => uniqueOwners([defaultOwner, ...owners]),
    [defaultOwner, owners],
  )

  const creationWizard = (
    <CharacterCreationWizard
      open={creationOpen}
      defaultOwner={defaultOwner}
      owners={wizardOwners}
      canAssignOwners={canAssignOwners}
      createOwner={createOwner}
      onClose={() => setCreationOpen(false)}
      onCreate={(character) => {
        const preparedCharacter = ensureCharacterBackgroundFromHistory(character)
        importCharacter(preparedCharacter.toJSON())
        setActiveTab("profile")
      }}
    />
  )

  if (!activeCharacter) {
    return (
      <>
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
            onClick={() => setCreationOpen(true)}
          >
            Criar personagem
          </button>
        </div>
        {creationWizard}
      </>
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
        addCharacter={() => setCreationOpen(true)}
        importCharacter={importCharacter}
        setActiveCharacterId={setSelectedCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={characters.length <= 1}
        showOwnerBadge={canAssignOwners}
      />

      <CharacterRestControls
        character={activeCharacter}
        partyInventory={partyInventory}
        updateCharacter={updateCharacter}
        completeLongRest={completeLongRest}
      />

      <div className="sticky top-0 z-20 bg-[color:var(--surface-app)] py-2">
        <CharacterViewTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <div className="min-w-0">
        {activeTab === "sheet" && (
          <CharacterSheetTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
            canAssignOwners={canAssignOwners}
            canEditCharacterType={canEditCharacterType}
            playerKeys={playerKeys}
            getOwner={getOwner}
            createOwner={createOwner}
          />
        )}

        {activeTab === "race" && (
          <CharacterRaceTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
          />
        )}

        {activeTab === "profile" && (
          <CharacterProfileTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
          />
        )}

        {activeTab === "abilities" && (
          <CharacterAbilitiesTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
          />
        )}

        {activeTab === "equipment" && (
          <CharacterEquipmentTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
          />
        )}

        {activeTab === "inventory" && (
          <CharacterInventoryTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
            canEditInventory={canEditCharacterType}
          />
        )}

        {activeTab === "spellsList" && (
          <CharacterMagicTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
          />
        )}

        {activeTab === "proficiencies" && (
          <CharacterProficienciesTab
            character={activeCharacter}
            updateCharacter={updateCharacter}
          />
        )}
      </div>

      {creationWizard}
    </div>
  )
}

function uniqueOwners(owners: Player[]): Player[] {
  const seen = new Set<string>()

  return owners.filter((owner) => {
    const key = owner.id.trim() || owner.name.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
