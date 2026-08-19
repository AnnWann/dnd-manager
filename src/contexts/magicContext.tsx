import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Spell } from "../models/magic/spells/Spell"
import type { AppStateV1 } from "../lib/remoteState"
import { normalizeSpellText } from "../lib/textNormalization"
import { getOfficialSpellsByIndexes } from "../api/spell-compendium"
import metamagicData from "../data/metamagics.v1.json"
import type {
  Metamagic,
  MetamagicId,
} from "../models/magic/metamagic/Metamagic"

const officialMetamagics = Object.values(
  metamagicData as Record<MetamagicId, Metamagic>,
)

type MagicContextValue = {
  spells: Spell[]
  savedSpells: Spell[]
  spellByIndex: Map<string, Spell>
  getSpellByIndex: (spellIndex: string) => Spell | undefined
  getSpellsByIndexes: (spellIndexes: string[]) => Spell[]
  ensureOfficialSpells: (spellIndexes: readonly string[]) => Promise<void>
  officialSpellsLoading: boolean
  officialSpellsError: string
  metamagics: Metamagic[]
  metamagicById: Map<string, Metamagic>
  getMetamagicById: (metamagicId: MetamagicId) => Metamagic | undefined
  getMetamagicsByIds: (metamagicIds: MetamagicId[]) => Metamagic[]
  saveSpell: (spell: Spell) => void
  saveSpells: (spells: Spell[]) => void
  deleteSpell: (spellIndex: string) => void
}

const MagicContext = createContext<MagicContextValue | null>(null)

type MagicProviderProps = {
  children: ReactNode
  spells: Spell[]
  setAppState?: React.Dispatch<React.SetStateAction<AppStateV1>>
  onSpellsChange?: (spells: Spell[]) => void
  onSaveSpell?: (spell: Spell) => void
  onDeleteSpell?: (spellIndex: string) => void
}

export function MagicProvider({
  children,
  spells,
  setAppState,
  onSpellsChange,
  onSaveSpell,
  onDeleteSpell,
}: MagicProviderProps) {
  const [officialSpells, setOfficialSpells] = useState<Spell[]>([])
  const [officialSpellsLoading, setOfficialSpellsLoading] = useState(false)
  const [officialSpellsError, setOfficialSpellsError] = useState("")
  const pendingLoadsRef = useRef(0)

  const normalizedSavedSpells = useMemo(
    () => spells.map(normalizeSpellText),
    [spells],
  )

  const mergeOfficialSpells = useCallback((incoming: readonly Spell[]) => {
    if (!incoming.length) return
    setOfficialSpells((current) => {
      const byIndex = new Map(current.map((spell) => [spell.index, spell]))
      let changed = false
      for (const spell of incoming) {
        if (byIndex.get(spell.index) === spell) continue
        byIndex.set(spell.index, spell)
        changed = true
      }
      return changed ? Array.from(byIndex.values()) : current
    })
  }, [])

  const beginOfficialLoad = useCallback(() => {
    pendingLoadsRef.current += 1
    setOfficialSpellsLoading(true)
    setOfficialSpellsError("")
  }, [])

  const finishOfficialLoad = useCallback(() => {
    pendingLoadsRef.current = Math.max(0, pendingLoadsRef.current - 1)
    if (pendingLoadsRef.current === 0) setOfficialSpellsLoading(false)
  }, [])

  const ensureOfficialSpells = useCallback(async (
    spellIndexes: readonly string[],
  ) => {
    const savedIndexes = new Set(
      normalizedSavedSpells.map((spell) => spell.index.trim()).filter(Boolean),
    )
    const loadedIndexes = new Set(
      officialSpells.map((spell) => spell.index.trim()).filter(Boolean),
    )
    const missing = Array.from(
      new Set(spellIndexes.map((index) => index.trim()).filter(Boolean)),
    ).filter((index) => !savedIndexes.has(index) && !loadedIndexes.has(index))

    if (!missing.length) return

    beginOfficialLoad()
    try {
      mergeOfficialSpells(await getOfficialSpellsByIndexes(missing))
    } catch {
      setOfficialSpellsError("Não foi possível carregar algumas magias oficiais.")
    } finally {
      finishOfficialLoad()
    }
  }, [
    beginOfficialLoad,
    finishOfficialLoad,
    mergeOfficialSpells,
    normalizedSavedSpells,
    officialSpells,
  ])

  const spellByIndex = useMemo(() => {
    const map = new Map<string, Spell>()
    for (const spell of officialSpells) {
      const index = spell.index?.trim()
      if (index) map.set(index, spell)
    }
    for (const spell of normalizedSavedSpells) {
      const index = spell.index?.trim()
      if (index) map.set(index, spell)
    }
    return map
  }, [normalizedSavedSpells, officialSpells])

  const allSpells = useMemo(() => Array.from(spellByIndex.values()), [spellByIndex])
  const metamagics = useMemo(() => officialMetamagics, [])
  const metamagicById = useMemo(
    () => new Map(metamagics.map((metamagic) => [metamagic.id, metamagic])),
    [metamagics],
  )

  const getSpellByIndex = useCallback(
    (spellIndex: string) => spellByIndex.get(spellIndex.trim()),
    [spellByIndex],
  )

  const getSpellsByIndexes = useCallback(
    (spellIndexes: string[]) =>
      spellIndexes
        .map((spellIndex) => spellByIndex.get(spellIndex.trim()))
        .filter((spell): spell is Spell => Boolean(spell)),
    [spellByIndex],
  )

  function getMetamagicById(metamagicId: MetamagicId) {
    return metamagicById.get(metamagicId)
  }

  function getMetamagicsByIds(metamagicIds: MetamagicId[]) {
    return metamagicIds
      .map((metamagicId) => metamagicById.get(metamagicId))
      .filter((metamagic): metamagic is Metamagic => Boolean(metamagic))
  }

  function commitSavedSpells(nextSpells: Spell[]) {
    if (setAppState) {
      setAppState((previous) => ({ ...previous, spells: nextSpells }))
    }
    onSpellsChange?.(nextSpells)
  }

  function saveSpells(incoming: Spell[]) {
    const normalizedIncoming = incoming.map(normalizeSpellText)
    if (!normalizedIncoming.length) return
    if (onSaveSpell) {
      for (const spell of normalizedIncoming) onSaveSpell(spell)
      return
    }
    if (setAppState) {
      setAppState((previous) => ({
        ...previous,
        spells: mergeSpells(previous.spells ?? [], normalizedIncoming),
      }))
      return
    }
    commitSavedSpells(mergeSpells(normalizedSavedSpells, normalizedIncoming))
  }

  function saveSpell(spell: Spell) {
    saveSpells([spell])
  }

  function deleteSpell(spellIndex: string) {
    const normalizedIndex = spellIndex.trim()
    if (onDeleteSpell) {
      onDeleteSpell(normalizedIndex)
      return
    }
    commitSavedSpells(
      normalizedSavedSpells.filter((existing) => existing.index !== normalizedIndex),
    )
  }

  return (
    <MagicContext.Provider value={{
      spells: allSpells,
      savedSpells: normalizedSavedSpells,
      spellByIndex,
      getSpellByIndex,
      getSpellsByIndexes,
      ensureOfficialSpells,
      officialSpellsLoading,
      officialSpellsError,
      metamagics,
      metamagicById,
      getMetamagicById,
      getMetamagicsByIds,
      saveSpell,
      saveSpells,
      deleteSpell,
    }}>
      {children}
    </MagicContext.Provider>
  )
}

function mergeSpells(existing: Spell[], incoming: Spell[]): Spell[] {
  const byIndex = new Map(existing.map((spell) => [spell.index, spell]))
  for (const spell of incoming) byIndex.set(spell.index, spell)
  return Array.from(byIndex.values())
}

export function useMagicContext() {
  const context = useContext(MagicContext)
  if (!context) throw new Error("useMagicContext must be used inside MagicProvider")
  return context
}
