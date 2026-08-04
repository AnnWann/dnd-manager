import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Settings2 } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import { CharacterAbilitiesTab } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterEquipmentTab } from "../features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../features/characters/inventory/characterInventory"
import { CharacterMagicTab } from "../features/characters/magic/characterMagicModule"
import { CharacterProfileTab } from "../features/characters/profile/characterProfileV2"
import { CharacterProficienciesTab } from "../features/characters/proficiencies/characterProficiencies"
import { CharacterRaceTab } from "../features/characters/race/characterRaceV2"
import { CharacterRestControls } from "../features/characters/rest/characterRestControlsV2"
import { CharacterSettingsModal } from "../features/characters/settings/CharacterSettingsModal"
import { CharacterSheetTab } from "../features/characters/characterSheet/characterSheet"
import {
  CHARACTER_TABS,
  CharacterViewTabs,
  type CharacterTab,
  type CharacterViewTabDefinition,
} from "../features/characters/characterViewTabs"
import {
  CustomSystemsRuntime,
  CustomSystemsTabWithLibrary,
  isActiveSystemState,
} from "../features/characters/customSystems/CustomSystemsTabWithLibrary"
import { useCharacterWorkspace } from "../features/characters/workspace/CharacterWorkspaceContext"
import { getCustomSystemPlacement } from "../features/customSystems/CustomSystemPlacementEditor"
import { useCustomSystemDefinitions } from "../lib/customSystems/CustomSystemRegistry"
import type { CustomSystemActor } from "../lib/customSystems"
import type { CustomSystemDefinition } from "../models/customSystems/CustomSystemDefinition"

export function CharacterView() {
  const {
    mode,
    characters,
    activeCharacter,
    partyInventory,
    setSelectedCharacterId,
    importCharacter,
    deleteCharacter,
    updateCharacter,
    completeLongRest,
    canAssignOwners,
    canEditCharacterType,
    knownPlayerKeys,
    getOwner,
    createOwner,
  } = useCharacterWorkspace()

  const customSystemDefinitions = useCustomSystemDefinitions()
  const { characterId, tab } = useParams<{
    characterId?: string
    tab?: string
  }>()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const routeCharacter = characterId
    ? characters.find((character) => character.get("id") === characterId)
    : undefined

  useEffect(() => {
    if (routeCharacter) {
      setSelectedCharacterId(routeCharacter.get("id"))
    }
  }, [routeCharacter, setSelectedCharacterId])

  const activeCustomSystemDefinitions = useMemo(() => {
    if (!routeCharacter) return []

    const states = routeCharacter.get("sheet").customSystems ?? []
    const activeIds = new Set(
      states.filter(isActiveSystemState).map((state) => state.systemId),
    )

    return customSystemDefinitions.filter((definition) =>
      activeIds.has(definition.id),
    )
  }, [customSystemDefinitions, routeCharacter])

  const hiddenStandardTabs = useMemo(
    () => new Set(routeCharacter?.get("sheet").hiddenCharacterTabs ?? []),
    [routeCharacter],
  )

  const characterTabs = useMemo<CharacterViewTabDefinition[]>(
    () =>
      orderCharacterTabs(
        CHARACTER_TABS.filter(
          (entry) =>
            entry.key === "sheet" || !hiddenStandardTabs.has(entry.key),
        ),
        activeCustomSystemDefinitions,
      ),
    [activeCustomSystemDefinitions, hiddenStandardTabs],
  )

  const activeTab = normalizeCharacterViewTab(tab, characterTabs)

  useEffect(() => {
    if (!routeCharacter || !characterId || tab === activeTab) return

    navigate(characterPath(mode, characterId, activeTab), {
      replace: true,
    })
  }, [activeTab, characterId, mode, navigate, routeCharacter, tab])

  if (!characterId) {
    if (!activeCharacter) {
      return (
        <div className="mx-auto w-full max-w-xl rounded-xl border border-accentBorder bg-bg p-4">
          <div className="text-sm font-semibold text-textH">
            Nenhum personagem visível
          </div>
          <div className="mt-1 text-xs text-text">
            Nenhum personagem está disponível neste contexto.
          </div>
          {mode === "campaign" ? (
            <button
              type="button"
              className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accentText"
              onClick={() => navigate("/character/create")}
            >
              Criar personagem
            </button>
          ) : null}
        </div>
      )
    }

    if (mode === "user") {
      navigate(
        characterPath(mode, activeCharacter.get("id"), "sheet"),
        { replace: true },
      )
      return null
    }

    return (
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={() => navigate("/character/create")}
        importCharacter={(raw) => {
          if (!importCharacter) {
            throw new Error("Importação indisponível neste contexto.")
          }

          const imported = importCharacter(raw)
          navigate(characterPath(mode, imported.get("id"), "sheet"))
          return imported
        }}
        setActiveCharacterId={(id) => {
          setSelectedCharacterId(id)
          navigate(characterPath(mode, id, "sheet"))
        }}
        deleteActiveCharacter={() =>
          deleteCharacter(activeCharacter.get("id"))
        }
        disableDelete={characters.length <= 1}
        showOwnerBadge={canAssignOwners}
      />
    )
  }

  if (!routeCharacter) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-border bg-bg p-6 text-center">
        <h1 className="text-lg font-semibold text-textH">
          Personagem não encontrado
        </h1>
        <p className="mt-2 text-sm text-text">
          Esta ficha não existe ou não está visível para este usuário.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg"
          onClick={() => navigate(selectorPath(mode))}
        >
          <ArrowLeft className="h-4 w-4" /> Selecionar personagem
        </button>
      </section>
    )
  }

  const actor: CustomSystemActor = canAssignOwners ? "master" : "owner"
  const customTabSystemId = activeCustomSystemDefinitions.some(
    (definition) =>
      definition.id === activeTab &&
      getCustomSystemPlacement(definition).mode === "newTab",
  )
    ? activeTab
    : undefined

  function setActiveTab(nextTab: string, replace = false) {
    navigate(characterPath(mode, routeCharacter!.get("id"), nextTab), {
      replace,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <CustomSystemsRuntime
        character={routeCharacter}
        updateCharacter={updateCharacter}
      />

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
        <button
          type="button"
          onClick={() => navigate(selectorPath(mode))}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-textH hover:bg-accentBg"
        >
          <ArrowLeft className="h-4 w-4" /> Selecionar personagem
        </button>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="truncate font-semibold text-textH">
            {routeCharacter.get("name")}
          </div>
          <div className="truncate text-xs text-text">
            {routeCharacter.get("id")}
          </div>
        </div>

        {canAssignOwners ? (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Configurações do personagem"
            aria-label="Configurações do personagem"
            className="rounded-lg border border-border p-2.5 text-textH hover:bg-accentBg"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        ) : null}
      </header>

      {mode === "campaign" ? (
        <CharacterRestControls
          character={routeCharacter}
          partyInventory={partyInventory}
          updateCharacter={updateCharacter}
          completeLongRest={completeLongRest}
        />
      ) : null}

      <div className="sticky top-0 z-20 bg-[color:var(--surface-app)] py-2">
        <CharacterViewTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={characterTabs}
        />
      </div>

      <div className="grid min-w-0 gap-4">
        {activeTab === "sheet" ? (
          <CharacterSheetTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
            canAssignOwners={canAssignOwners}
            showConditions={mode === "campaign"}
          />
        ) : null}

        {activeTab === "race" ? (
          <CharacterRaceTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeTab === "profile" ? (
          <CharacterProfileTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeTab === "abilities" ? (
          <CharacterAbilitiesTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeTab === "equipment" ? (
          <CharacterEquipmentTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeTab === "inventory" ? (
          <CharacterInventoryTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
            canEditInventory={canEditCharacterType}
          />
        ) : null}

        {activeTab === "spellsList" ? (
          <CharacterMagicTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeTab === "proficiencies" ? (
          <CharacterProficienciesTab
            character={routeCharacter}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {customTabSystemId ? (
          <CustomSystemsTabWithLibrary
            character={routeCharacter}
            updateCharacter={updateCharacter}
            actor={actor}
            systemIds={[customTabSystemId]}
          />
        ) : null}
      </div>

      <CharacterSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        character={routeCharacter}
        updateCharacter={updateCharacter}
        canAssignOwners={canAssignOwners}
        canEditCharacterType={canEditCharacterType}
        playerKeys={knownPlayerKeys}
        getOwner={getOwner}
        createOwner={createOwner}
      />
    </div>
  )
}

function orderCharacterTabs(
  standardTabs: Array<CharacterViewTabDefinition & { key: CharacterTab }>,
  definitions: CustomSystemDefinition[],
): CharacterViewTabDefinition[] {
  const result: CharacterViewTabDefinition[] = [...standardTabs]

  for (const definition of definitions) {
    const placement = getCustomSystemPlacement(definition)
    if (placement.mode !== "newTab") continue
    if (result.some((entry) => entry.key === definition.id)) continue

    result.push({
      key: definition.id,
      label: placement.tabLabel || definition.name,
      icon: Settings2,
    })
  }

  return result
}

function characterPath(
  mode: "campaign" | "user",
  characterId: string,
  tab: string,
): string {
  const encodedId = encodeURIComponent(characterId)
  const encodedTab = encodeURIComponent(tab)

  return mode === "user"
    ? `/user/characters/${encodedId}/${encodedTab}`
    : `/character/${encodedId}/${encodedTab}`
}

function selectorPath(mode: "campaign" | "user"): string {
  return mode === "user" ? "/user/characters" : "/character"
}

function normalizeCharacterViewTab(
  value: string | undefined,
  tabs: CharacterViewTabDefinition[],
): string {
  if (value && tabs.some((entry) => entry.key === value)) return value
  return tabs[0]?.key ?? "sheet"
}
