import { ArrowLeft, Settings2, TrendingUp } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { UserCharacterAbilitiesTab } from "../../features/characters/abilities/userCharacterAbilities"
import {
  CustomSystemsTabWithLibrary,
  isActiveSystemState,
} from "../../features/characters/customSystems/CustomSystemsTabWithLibrary"
import { CharacterEquipmentTab } from "../../features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../../features/characters/inventory/characterInventory"
import { CharacterMagicTab } from "../../features/characters/magic/characterMagicModule"
import { CharacterProficienciesTab } from "../../features/characters/proficiencies/characterProficiencies"
import { CharacterProfileTab } from "../../features/characters/profile/characterProfileV2"
import { CharacterRaceTab } from "../../features/characters/race/characterRaceV2"
import { UserCharacterSheet } from "../../features/characters/characterSheet/userCharacterSheet"
import {
  CHARACTER_TABS,
  CharacterViewTabs,
  type CharacterViewTabDefinition,
} from "../../features/characters/characterViewTabs"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { getCustomSystemPlacement } from "../../features/customSystems/CustomSystemPlacementEditor"
import { useCustomSystemDefinitions } from "../../lib/customSystems/CustomSystemRegistry"
import type {
  CustomSystemDefinition,
  CustomSystemExistingCharacterTab,
} from "../../models/customSystems/CustomSystemDefinition"

const CONTENT_ANCHOR = "__standard-content__"

/**
 * User-context character view.
 *
 * This is intentionally separate from CharacterView: the session view is a
 * gameplay surface, while this screen presents and edits the durable character
 * definition. Gameplay-only controls should not be added here.
 */
export function UserCharacterView() {
  const {
    characters,
    updateCharacter,
    isEditing = false,
  } = useCharacterWorkspace()
  const customSystemDefinitions = useCustomSystemDefinitions()
  const { characterId, tab } = useParams<{
    characterId?: string
    tab?: string
  }>()
  const navigate = useNavigate()

  const character = characterId
    ? characters.find((entry) => entry.get("id") === characterId)
    : undefined

  const activeCustomSystemDefinitions = useMemo(() => {
    if (!character) return []
    const states = character.get("sheet").customSystems ?? []
    const activeIds = new Set(
      states.filter(isActiveSystemState).map((state) => state.systemId),
    )
    return customSystemDefinitions.filter(
      (definition) => activeIds.has(definition.id) && !definition.hiddenFromSheet,
    )
  }, [character, customSystemDefinitions])

  const hiddenStandardTabs = useMemo(
    () => new Set(character?.get("sheet").hiddenCharacterTabs ?? []),
    [character],
  )

  const visibleStandardTabs = useMemo(
    () =>
      CHARACTER_TABS.filter(
        (entry) => entry.key === "sheet" || !hiddenStandardTabs.has(entry.key),
      ),
    [hiddenStandardTabs],
  )

  const characterTabs = useMemo<CharacterViewTabDefinition[]>(
    () => orderCharacterTabs(visibleStandardTabs, activeCustomSystemDefinitions),
    [activeCustomSystemDefinitions, visibleStandardTabs],
  )

  const activeTab = normalizeCharacterViewTab(tab, characterTabs)

  useEffect(() => {
    if (!character || !characterId || tab === activeTab) return
    navigate(userCharacterPath(characterId, activeTab), { replace: true })
  }, [activeTab, character, characterId, navigate, tab])

  if (!characterId || !character) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-border bg-bg p-6 text-center">
        <h1 className="text-lg font-semibold text-textH">
          Personagem não encontrado
        </h1>
        <p className="mt-2 text-sm text-text">
          Esta ficha não existe ou não pertence ao usuário atual.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg"
          onClick={() => navigate("/user/characters")}
        >
          <ArrowLeft className="h-4 w-4" /> Personagens
        </button>
      </section>
    )
  }

  const activeStaticTab = toCustomSystemExistingTab(activeTab)
  const customTabSystemId = activeCustomSystemDefinitions.some(
    (definition) =>
      definition.id === activeTab &&
      getCustomSystemPlacement(definition).mode === "newTab",
  )
    ? activeTab
    : undefined

  const embedded = activeStaticTab
    ? orderEmbeddedSystems(activeCustomSystemDefinitions, activeStaticTab)
    : { before: [], after: [] }

  const placedBefore = embedded.before.length ? (
    <CustomSystemsTabWithLibrary
      character={character}
      updateCharacter={updateCharacter}
      actor="owner"
      systemIds={embedded.before}
    />
  ) : null

  const placedAfter = embedded.after.length ? (
    <CustomSystemsTabWithLibrary
      character={character}
      updateCharacter={updateCharacter}
      actor="owner"
      systemIds={embedded.after}
    />
  ) : null

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
        <button
          type="button"
          onClick={() => navigate("/user/characters")}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-textH hover:bg-accentBg"
        >
          <ArrowLeft className="h-4 w-4" /> Personagens
        </button>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="truncate font-semibold text-textH">
            {character.get("name")}
          </div>
          <div className="truncate text-xs text-textMuted">
            Ficha do personagem
          </div>
        </div>

        {isEditing ? (
          <button
            type="button"
            onClick={() =>
              navigate(
                `/user/characters/${encodeURIComponent(character.get("id"))}/level-up`,
              )
            }
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm font-medium text-textH hover:bg-bg-subtle"
          >
            <TrendingUp className="h-4 w-4" />
            Subir de nível
          </button>
        ) : null}
      </header>

      <div className="sticky top-0 z-20 bg-[color:var(--surface-app)] py-2">
        <CharacterViewTabs
          activeTab={activeTab}
          setActiveTab={(nextTab) =>
            navigate(userCharacterPath(characterId, nextTab))
          }
          tabs={characterTabs}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {placedBefore}

        {activeStaticTab === "sheet" ? (
          <UserCharacterSheet
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "abilities" ? (
          <UserCharacterAbilitiesTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "spellsList" ? (
          <CharacterMagicTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "equipment" ? (
          <CharacterEquipmentTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "inventory" ? (
          <CharacterInventoryTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "race" ? (
          <CharacterRaceTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "profile" ? (
          <CharacterProfileTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {activeStaticTab === "proficiencies" ? (
          <CharacterProficienciesTab
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        {customTabSystemId ? (
          <CustomSystemsTabWithLibrary
            character={character}
            updateCharacter={updateCharacter}
            actor="owner"
            systemIds={[customTabSystemId]}
          />
        ) : null}

        {placedAfter}
      </div>
    </div>
  )
}

function userCharacterPath(characterId: string, tab: string): string {
  return `/user/characters/${encodeURIComponent(characterId)}/${encodeURIComponent(tab)}`
}

function orderCharacterTabs(
  standardTabs: CharacterViewTabDefinition[],
  definitions: CustomSystemDefinition[],
): CharacterViewTabDefinition[] {
  const result = [...standardTabs]
  const unresolved = definitions.filter(
    (definition) => getCustomSystemPlacement(definition).mode === "newTab",
  )
  let madeProgress = true

  while (unresolved.length && madeProgress) {
    madeProgress = false

    for (let index = unresolved.length - 1; index >= 0; index -= 1) {
      const definition = unresolved[index]
      const placement = getCustomSystemPlacement(definition)
      if (placement.mode !== "newTab") {
        unresolved.splice(index, 1)
        continue
      }

      const reference = placement.reference
      const referenceKey = reference
        ? reference.type === "system"
          ? reference.systemId
          : fromCustomSystemTab(reference.tab)
        : undefined

      let insertionIndex = result.length
      if (referenceKey) {
        const anchorIndex = result.findIndex((entry) => entry.key === referenceKey)
        if (anchorIndex < 0) continue
        insertionIndex = placement.position === "before" ? anchorIndex : anchorIndex + 1
      }

      result.splice(insertionIndex, 0, {
        key: definition.id,
        label: placement.tabLabel || definition.name,
        icon: Settings2,
      })
      unresolved.splice(index, 1)
      madeProgress = true
    }
  }

  for (const definition of unresolved.reverse()) {
    const placement = getCustomSystemPlacement(definition)
    result.push({
      key: definition.id,
      label:
        placement.mode === "newTab"
          ? placement.tabLabel || definition.name
          : definition.name,
      icon: Settings2,
    })
  }

  return result
}

function orderEmbeddedSystems(
  definitions: CustomSystemDefinition[],
  targetTab: CustomSystemExistingCharacterTab,
): { before: string[]; after: string[] } {
  const candidates = definitions.filter((definition) => {
    const placement = getCustomSystemPlacement(definition)
    return placement.mode === "existingTab" && placement.targetTab === targetTab
  })

  const sequence = [CONTENT_ANCHOR]
  const unresolved = [...candidates]
  let madeProgress = true

  while (unresolved.length && madeProgress) {
    madeProgress = false

    for (let index = unresolved.length - 1; index >= 0; index -= 1) {
      const definition = unresolved[index]
      const placement = getCustomSystemPlacement(definition)
      if (placement.mode !== "existingTab") {
        unresolved.splice(index, 1)
        continue
      }

      const reference = placement.reference ?? { type: "content" as const }
      const anchor =
        reference.type === "system" ? reference.systemId : CONTENT_ANCHOR
      const anchorIndex = sequence.indexOf(anchor)
      if (anchorIndex < 0) continue

      sequence.splice(
        placement.position === "before" ? anchorIndex : anchorIndex + 1,
        0,
        definition.id,
      )
      unresolved.splice(index, 1)
      madeProgress = true
    }
  }

  for (const definition of unresolved.reverse()) {
    const placement = getCustomSystemPlacement(definition)
    const contentIndex = sequence.indexOf(CONTENT_ANCHOR)
    sequence.splice(
      placement.mode === "existingTab" && placement.position === "before"
        ? contentIndex
        : contentIndex + 1,
      0,
      definition.id,
    )
  }

  const contentIndex = sequence.indexOf(CONTENT_ANCHOR)
  return {
    before: sequence.slice(0, contentIndex),
    after: sequence.slice(contentIndex + 1),
  }
}

function normalizeCharacterViewTab(
  value: string | undefined,
  tabs: CharacterViewTabDefinition[],
): string {
  if (value && tabs.some((entry) => entry.key === value)) return value
  return tabs[0]?.key ?? "sheet"
}

function toCustomSystemExistingTab(
  tab: string,
): CustomSystemExistingCharacterTab | undefined {
  if (tab === "spells-list") return "spellsList"
  if (
    tab === "sheet" ||
    tab === "abilities" ||
    tab === "equipment" ||
    tab === "inventory" ||
    tab === "race" ||
    tab === "profile" ||
    tab === "proficiencies"
  ) {
    return tab
  }
  return undefined
}

function fromCustomSystemTab(tab: CustomSystemExistingCharacterTab): string {
  return tab === "spellsList" ? "spells-list" : tab
}
