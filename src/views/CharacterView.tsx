import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react"
import { ArrowLeft, Settings2 } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { CharacterAbilitiesTab } from "../features/characters/abilities/characterAbilities"
import { CustomClassConfigurationTab } from "../features/characters/classes/CustomClassConfigurationTab"
import { CharacterSelector } from "../features/characters/characterSelector"
import { CharacterSheetTab } from "../features/characters/characterSheet/characterSheet"
import { CharacterEquipmentTab } from "../features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../features/characters/inventory/characterInventory"
import {
  CHARACTER_TABS,
  CharacterViewTabs,
  type CharacterTab,
  type CharacterViewTabDefinition,
} from "../features/characters/characterViewTabs"
import { CharacterMagicTab } from "../features/characters/magic/characterMagicModule"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { CharacterProficienciesTab } from "../features/characters/proficiencies/characterProficiencies"
import { CharacterRaceTab } from "../features/characters/race/characterRaceV2"
import { CharacterProfileTab } from "../features/characters/profile/characterProfileV2"
import { CharacterRestControls } from "../features/characters/rest/characterRestControlsV2"
import { CharacterSettingsModal } from "../features/characters/settings/CharacterSettingsModal"
import {
  CustomSystemsRuntime,
  CustomSystemsTabWithLibrary,
  isActiveSystemState,
} from "../features/characters/customSystems/CustomSystemsTabWithLibrary"
import { getCustomSystemPlacement } from "../features/customSystems/CustomSystemPlacementEditor"
import { useCustomSystemDefinitions } from "../lib/customSystems/CustomSystemRegistry"
import type { CustomSystemActor } from "../lib/customSystems"
import { hasCustomClass } from "../models/characters/customClassConfig"
import type {
  CustomSystemDefinition,
  CustomSystemExistingCharacterTab,
} from "../models/customSystems/CustomSystemDefinition"
import type { Player } from "../models/player/Player"

const TAB_SWIPE_MIN_DISTANCE = 88
const TAB_SWIPE_PREVIEW_DISTANCE = 28
const TAB_SWIPE_MAX_PREVIEW_OFFSET = 96
const TAB_SWIPE_MAX_DURATION_MS = 850
const TAB_SWIPE_HORIZONTAL_DOMINANCE = 1.8
const TAB_SWIPE_PREVIEW_DOMINANCE = 1.35
const CONTENT_ANCHOR = "__standard-content__"
const CUSTOM_CLASS_CONFIG_TAB = "customClassConfig"

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
  const customSystemDefinitions = useCustomSystemDefinitions()
  const { characterId, tab } = useParams<{
    characterId?: string
    tab?: string
  }>()
  const navigate = useNavigate()

  const routeCharacter = characterId
    ? characters.find((character) => character.get("id") === characterId)
    : undefined

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeDragging, setSwipeDragging] = useState(false)
  const [tabPanelMinHeight, setTabPanelMinHeight] = useState(0)
  const swipeRef = useRef<SwipeState | null>(null)
  const tabContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!routeCharacter) return
    setSelectedCharacterId(routeCharacter.get("id"))
  }, [routeCharacter, setSelectedCharacterId])

  const owners = useMemo(
    () => playerKeys.map((key) => getOwner(key)),
    [getOwner, playerKeys],
  )

  const defaultOwner = useMemo(() => {
    const normalizedUserKey = userKey.trim()
    if (normalizedUserKey) return getOwner(normalizedUserKey)

    return (
      routeCharacter?.get("owner") ??
      activeCharacter?.get("owner") ??
      owners[0] ??
      createOwner("Jogador local")
    )
  }, [activeCharacter, createOwner, getOwner, owners, routeCharacter, userKey])

  const wizardOwners = useMemo(
    () => uniqueOwners([defaultOwner, ...owners]),
    [defaultOwner, owners],
  )

  const activeCustomSystemDefinitions = useMemo(() => {
    if (!routeCharacter) return []
    const states = routeCharacter.get("sheet").customSystems ?? []
    const activeIds = new Set(
      states.filter(isActiveSystemState).map((state) => state.systemId),
    )
    return customSystemDefinitions.filter((definition) =>
      activeIds.has(definition.id) && !definition.hiddenFromSheet,
    )
  }, [customSystemDefinitions, routeCharacter])

  const hiddenStandardTabs = useMemo(
    () => new Set(routeCharacter?.get("sheet").hiddenCharacterTabs ?? []),
    [routeCharacter],
  )

  const visibleStandardTabs = useMemo(
    () =>
      CHARACTER_TABS.filter(
        (entry) =>
          entry.key === "sheet" || !hiddenStandardTabs.has(entry.key),
      ),
    [hiddenStandardTabs],
  )

  const characterTabs = useMemo<CharacterViewTabDefinition[]>(() => {
    const ordered = orderCharacterTabs(
      visibleStandardTabs,
      activeCustomSystemDefinitions,
    )

    if (!routeCharacter || !hasCustomClass(routeCharacter)) return ordered

    const configTab: CharacterViewTabDefinition = {
      key: CUSTOM_CLASS_CONFIG_TAB,
      label: "Configuração da classe",
      icon: Settings2,
    }
    const proficienciesIndex = ordered.findIndex((entry) => entry.key === "proficiencies")
    const insertionIndex = proficienciesIndex >= 0 ? proficienciesIndex + 1 : ordered.length
    const next = [...ordered]
    next.splice(insertionIndex, 0, configTab)
    return next
  }, [activeCustomSystemDefinitions, routeCharacter, visibleStandardTabs])

  const activeTab = normalizeCharacterViewTab(tab, characterTabs)

  useEffect(() => {
    if (!routeCharacter || !characterId) return
    if (tab === activeTab) return
    navigate(characterPath(characterId, activeTab), { replace: true })
  }, [activeTab, characterId, navigate, routeCharacter, tab])

  useLayoutEffect(() => {
    lockTabPanelHeight()
  }, [activeTab])

  function setActiveTab(nextTab: string, replace = false) {
    if (!characterId) return
    navigate(characterPath(characterId, nextTab), { replace })
  }

  function setAdjacentTab(direction: "previous" | "next") {
    const activeIndex = characterTabs.findIndex(
      (entry) => entry.key === activeTab,
    )
    if (activeIndex < 0) return

    const nextIndex = direction === "next" ? activeIndex + 1 : activeIndex - 1
    const nextTab = characterTabs[nextIndex]?.key
    if (!nextTab) return

    lockTabPanelHeight()
    setActiveTab(nextTab)
  }

  function lockTabPanelHeight() {
    const content = tabContentRef.current
    if (!content) return

    const nextHeight = Math.ceil(
      Math.max(content.scrollHeight, content.offsetHeight),
    )
    if (nextHeight > 0) {
      setTabPanelMinHeight(nextHeight)
    }
  }

  function resetSwipePreview() {
    setSwipeDragging(false)
    setSwipeOffset(0)
  }

  function handleSwipeStart(event: TouchEvent<HTMLDivElement>) {
    resetSwipePreview()
    lockTabPanelHeight()

    if (event.touches.length !== 1 || shouldIgnoreTabSwipe(event.target)) {
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

    if (
      absX < TAB_SWIPE_PREVIEW_DISTANCE ||
      absX < absY * TAB_SWIPE_PREVIEW_DOMINANCE
    ) {
      resetSwipePreview()
      return
    }

    setSwipeDragging(true)
    setSwipeOffset(
      getSwipePreviewOffset(deltaX, activeTab, characterTabs),
    )
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
    const deliberate =
      absX >= TAB_SWIPE_MIN_DISTANCE &&
      absX >= absY * TAB_SWIPE_HORIZONTAL_DOMINANCE &&
      duration <= TAB_SWIPE_MAX_DURATION_MS

    resetSwipePreview()
    if (deliberate) setAdjacentTab(deltaX < 0 ? "next" : "previous")
  }

  if (!characterId) {
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
              onClick={() => navigate("/character/create")}
            >
              Criar personagem
            </button>
          </div>
        </>
      )
    }

    return (
      <>
        <CharacterSelector
          characters={characters}
          activeCharacter={activeCharacter}
          addCharacter={() => navigate("/character/create")}
          importCharacter={(raw) => {
            const imported = importCharacter(raw)
            navigate(characterPath(imported.get("id"), "sheet"))
            return imported
          }}
          setActiveCharacterId={(id) => {
            setSelectedCharacterId(id)
            navigate(characterPath(id, "sheet"))
          }}
          deleteActiveCharacter={() =>
            deleteCharacter(activeCharacter.get("id"))
          }
          disableDelete={characters.length <= 1}
          showOwnerBadge={canAssignOwners}
        />
      </>
    )
  }

  if (!routeCharacter) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-border bg-bg p-6 text-center">
        <h1 className="text-lg font-semibold text-textH">
          Personagem não encontrado
        </h1>
        <p className="mt-2 text-sm text-text">
          Esta ficha não existe ou não está visível para este jogador.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg"
          onClick={() => navigate("/character")}
        >
          <ArrowLeft className="h-4 w-4" /> Selecionar personagem
        </button>
      </section>
    )
  }

  const actor: CustomSystemActor = canAssignOwners ? "master" : "owner"
  const activeStaticTab = isCharacterTab(activeTab) ? activeTab : undefined
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

  const swipeProgress = Math.min(
    1,
    Math.abs(swipeOffset) / TAB_SWIPE_MAX_PREVIEW_OFFSET,
  )
  const tabPanelStyle: CSSProperties = {
    minHeight: tabPanelMinHeight > 0 ? `${tabPanelMinHeight}px` : undefined,
  }
  const tabContentStyle: CSSProperties = {
    opacity: 1 - swipeProgress * 0.18,
    transform: swipeOffset === 0
      ? undefined
      : `translate3d(${swipeOffset}px, 0, 0) scale(${1 - swipeProgress * 0.015})`,
    transition: swipeDragging
      ? "none"
      : "transform 160ms ease-out, opacity 160ms ease-out",
  }

  const placedBefore = embedded.before.length ? (
    <CustomSystemsTabWithLibrary
      character={routeCharacter}
      updateCharacter={updateCharacter}
      actor={actor}
      systemIds={embedded.before}
    />
  ) : null

  const placedAfter = embedded.after.length ? (
    <CustomSystemsTabWithLibrary
      character={routeCharacter}
      updateCharacter={updateCharacter}
      actor={actor}
      systemIds={embedded.after}
    />
  ) : null

  return (
    <div className="flex flex-col gap-4">
      <CustomSystemsRuntime
        character={routeCharacter}
        updateCharacter={updateCharacter}
      />

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
        <button
          type="button"
          onClick={() => navigate("/character")}
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

      <CharacterRestControls
        character={routeCharacter}
        partyInventory={partyInventory}
        updateCharacter={updateCharacter}
        completeLongRest={completeLongRest}
      />

      <div className="sticky top-0 z-20 bg-[color:var(--surface-app)] py-2">
        <CharacterViewTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={characterTabs}
        />
      </div>

      <div
        className="min-w-0 overflow-hidden touch-pan-y"
        style={tabPanelStyle}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={() => {
          swipeRef.current = null
          resetSwipePreview()
        }}
      >
        <div
          ref={tabContentRef}
          className="grid min-w-0 gap-4"
          style={tabContentStyle}
        >
          {placedBefore}

          {activeTab === "sheet" ? (
            <CharacterSheetTab
              character={routeCharacter}
              updateCharacter={updateCharacter}
              canAssignOwners={canAssignOwners}
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

          {activeTab === CUSTOM_CLASS_CONFIG_TAB ? (
            <CustomClassConfigurationTab
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

          {placedAfter}

          {customTabSystemId ? (
            <CustomSystemsTabWithLibrary
              character={routeCharacter}
              updateCharacter={updateCharacter}
              actor={actor}
              systemIds={[customTabSystemId]}
            />
          ) : null}
        </div>
      </div>

      <CharacterSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        character={routeCharacter}
        updateCharacter={updateCharacter}
        canAssignOwners={canAssignOwners}
        canEditCharacterType={canEditCharacterType}
        playerKeys={playerKeys}
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
  const pending = definitions
    .filter((definition) => getCustomSystemPlacement(definition).mode === "newTab")
    .filter((definition) => !result.some((tab) => tab.key === definition.id))

  const unresolved = [...pending]
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

      const reference = placement.reference ?? {
        type: "standardTab" as const,
        tab: placement.relativeToTab ?? "sheet",
      }
      let anchorKey =
        reference.type === "system" ? reference.systemId : reference.tab

      if (!result.some((entry) => entry.key === anchorKey)) {
        if (reference.type === "standardTab" && anchorKey !== "sheet") {
          anchorKey = "sheet"
        } else {
          continue
        }
      }

      const anchorIndex = result.findIndex((entry) => entry.key === anchorKey)
      const insertionIndex =
        placement.position === "before" ? anchorIndex : anchorIndex + 1

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

function characterPath(characterId: string, tab: string): string {
  return `/character/${encodeURIComponent(characterId)}/${encodeURIComponent(tab)}`
}

function getSwipePreviewOffset(
  deltaX: number,
  activeTab: string,
  tabs: CharacterViewTabDefinition[],
): number {
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab)
  const isAtFirstTab = activeIndex <= 0
  const isAtLastTab = activeIndex >= tabs.length - 1
  const blockedByEdge = deltaX > 0 ? isAtFirstTab : isAtLastTab
  const resistance = blockedByEdge ? 0.22 : 0.72
  const direction = Math.sign(deltaX) || 1
  const resisted = Math.min(
    Math.abs(deltaX) * resistance,
    TAB_SWIPE_MAX_PREVIEW_OFFSET,
  )
  return direction * resisted
}

function normalizeCharacterViewTab(
  value: string | undefined,
  tabs: CharacterViewTabDefinition[],
): string {
  if (value && tabs.some((tab) => tab.key === value)) return value
  return tabs[0]?.key ?? "sheet"
}

function isCharacterTab(value: string): value is CharacterTab {
  return CHARACTER_TABS.some((tab) => tab.key === value)
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
