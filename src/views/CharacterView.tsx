import { useMemo, useRef, useState, type TouchEvent } from "react"
import { CharacterAbilitiesTab } from "../features/characters/abilities/characterAbilities"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheetTab } from "../features/characters/characterSheet/characterSheet"
import { CharacterEquipmentTab } from "../features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../features/characters/inventory/characterInventory"
import {
  CHARACTER_TABS,
  CharacterViewTabs,
  type CharacterTab,
} from "../features/characters/characterViewTabs"
import { CharacterMagicTab } from "../features/characters/magic/characterMagicModule"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { CharacterProficienciesTab } from "../features/characters/proficiencies/characterProficiencies"
import { CharacterRaceTab } from "../features/characters/race/characterRaceV2"
import { CharacterProfileTab } from "../features/characters/profile/characterProfileV2"
import { CharacterRestControls } from "../features/characters/rest/characterRestControlsV2"
import { CharacterCreationWizard } from "../features/characters/creation/characterCreationWizardV5"
import { ensureCharacterBackgroundFromHistory } from "../features/characters/creation/inferCharacterBackground"
import type { Player } from "../models/player/Player"

const TAB_SWIPE_MIN_DISTANCE = 88
const TAB_SWIPE_MAX_DURATION_MS = 850
const TAB_SWIPE_HORIZONTAL_DOMINANCE = 1.8

type SwipeState = {
  startX: number
  startY: number
  startedAt: number
  cancelled: boolean
}

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
  const swipeRef = useRef<SwipeState | null>(null)

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

  function setAdjacentTab(direction: "previous" | "next") {
    const activeIndex = CHARACTER_TABS.findIndex(
      (tab) => tab.key === activeTab,
    )
    if (activeIndex < 0) return

    const nextIndex = direction === "next"
      ? activeIndex + 1
      : activeIndex - 1
    const nextTab = CHARACTER_TABS[nextIndex]?.key

    if (nextTab) setActiveTab(nextTab)
  }

  function handleSwipeStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1) {
      swipeRef.current = null
      return
    }

    if (shouldIgnoreTabSwipe(event.target)) {
      swipeRef.current = null
      return
    }

    const touch = event.touches[0]
    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startedAt: Date.now(),
      cancelled: false,
    }
  }

  function handleSwipeMove(event: TouchEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    if (!swipe || event.touches.length !== 1) return

    const touch = event.touches[0]
    const deltaX = touch.clientX - swipe.startX
    const deltaY = touch.clientY - swipe.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absY > 28 && absY > absX) {
      swipe.cancelled = true
    }
  }

  function handleSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    swipeRef.current = null

    if (!swipe || swipe.cancelled) return

    const touch = event.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - swipe.startX
    const deltaY = touch.clientY - swipe.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const duration = Date.now() - swipe.startedAt
    const isDeliberateHorizontalSwipe =
      absX >= TAB_SWIPE_MIN_DISTANCE &&
      absX >= absY * TAB_SWIPE_HORIZONTAL_DOMINANCE &&
      duration <= TAB_SWIPE_MAX_DURATION_MS

    if (!isDeliberateHorizontalSwipe) return

    setAdjacentTab(deltaX < 0 ? "next" : "previous")
  }

  const creationWizard = (
    <CharacterCreationWizard
      open={creationOpen}
      defaultOwner={defaultOwner}
      owners={wizardOwners}
      canAssignOwners={canAssignOwners}
      createOwner={createOwner}
      onClose={() => setCreationOpen(false)}
      onCreate={(character) => {
        setCreationOpen(false)
        const preparedCharacter =
          ensureCharacterBackgroundFromHistory(character)
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
        <CharacterViewTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      <div
        className="min-w-0 touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={() => {
          swipeRef.current = null
        }}
      >
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

function shouldIgnoreTabSwipe(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false

  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
        "[role='button']",
        "[role='dialog']",
        "[data-no-tab-swipe]",
      ].join(","),
    ),
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
