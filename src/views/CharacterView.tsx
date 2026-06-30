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
const TAB_SWIPE_PREVIEW_DISTANCE = 28
const TAB_SWIPE_MAX_PREVIEW_OFFSET = 96
const TAB_SWIPE_MAX_DURATION_MS = 850
const TAB_SWIPE_HORIZONTAL_DOMINANCE = 1.8
const TAB_SWIPE_PREVIEW_DOMINANCE = 1.35

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
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeDragging, setSwipeDragging] = useState(false)
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

  function resetSwipePreview() {
    setSwipeDragging(false)
    setSwipeOffset(0)
  }

  function handleSwipeStart(event: TouchEvent<HTMLDivElement>) {
    resetSwipePreview()

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
      resetSwipePreview()
      return
    }

    const shouldShowPreview =
      absX >= TAB_SWIPE_PREVIEW_DISTANCE &&
      absX >= absY * TAB_SWIPE_PREVIEW_DOMINANCE

    if (!shouldShowPreview) {
      resetSwipePreview()
      return
    }

    setSwipeDragging(true)
    setSwipeOffset(getSwipePreviewOffset(deltaX, activeTab))
  }

  function handleSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    swipeRef.current = null

    if (!swipe || swipe.cancelled) {
      resetSwipePreview()
      return
    }

    const touch = event.changedTouches[0]
    if (!touch) {
      resetSwipePreview()
      return
    }

    const deltaX = touch.clientX - swipe.startX
    const deltaY = touch.clientY - swipe.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const duration = Date.now() - swipe.startedAt
    const isDeliberateHorizontalSwipe =
      absX >= TAB_SWIPE_MIN_DISTANCE &&
      absX >= absY * TAB_SWIPE_HORIZONTAL_DOMINANCE &&
      duration <= TAB_SWIPE_MAX_DURATION_MS

    resetSwipePreview()

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

  const swipeProgress = Math.min(
    1,
    Math.abs(swipeOffset) / TAB_SWIPE_MAX_PREVIEW_OFFSET,
  )
  const tabContentStyle = {
    opacity: 1 - swipeProgress * 0.18,
    transform: `translate3d(${swipeOffset}px, 0, 0) scale(${1 - swipeProgress * 0.015})`,
    transition: swipeDragging
      ? "none"
      : "transform 160ms ease-out, opacity 160ms ease-out",
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
        className="min-w-0 overflow-hidden touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={() => {
          swipeRef.current = null
          resetSwipePreview()
        }}
      >
        <div className="min-w-0 will-change-transform" style={tabContentStyle}>
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
      </div>

      {creationWizard}
    </div>
  )
}

function getSwipePreviewOffset(deltaX: number, activeTab: CharacterTab): number {
  const activeIndex = CHARACTER_TABS.findIndex((tab) => tab.key === activeTab)
  const isAtFirstTab = activeIndex <= 0
  const isAtLastTab = activeIndex >= CHARACTER_TABS.length - 1
  const blockedByEdge = deltaX > 0 ? isAtFirstTab : isAtLastTab
  const resistance = blockedByEdge ? 0.22 : 0.72
  const direction = Math.sign(deltaX) || 1
  const resisted = Math.min(
    Math.abs(deltaX) * resistance,
    TAB_SWIPE_MAX_PREVIEW_OFFSET,
  )

  return direction * resisted
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
