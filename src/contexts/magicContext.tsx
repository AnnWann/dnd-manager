import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Spell } from "../models/magic/spells/Spell"
import type { AppStateV1 } from "../lib/remoteState"
import { normalizeSpellText } from "../lib/textNormalization"
import { getAllOfficialSpells } from "../api/spell-compendium"
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
  const [officialSpellsLoading, setOfficialSpellsLoading] = useState(true)
  const [officialSpellsError, setOfficialSpellsError] = useState("")

  useEffect(() => {
    let active = true
    setOfficialSpellsLoading(true)
    setOfficialSpellsError("")

    void getAllOfficialSpells()
      .then((loaded) => {
        if (!active) return
        setOfficialSpells(loaded)
      })
      .catch(() => {
        if (!active) return
        setOfficialSpellsError("Não foi possível carregar o compêndio oficial de magias.")
      })
      .finally(() => {
        if (active) setOfficialSpellsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const normalizedSavedSpells = useMemo(
    () => spells.map(normalizeSpellText),
    [spells],
  )

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

  const allSpells = useMemo(
    () => Array.from(spellByIndex.values()),
    [spellByIndex],
  )
  const metamagics = useMemo(() => officialMetamagics, [])
  const metamagicById = useMemo(
    () => new Map(metamagics.map((metamagic) => [metamagic.id, metamagic])),
    [metamagics],
  )

  function getSpellByIndex(spellIndex: string) {
    return spellByIndex.get(spellIndex.trim())
  }

  function getSpellsByIndexes(spellIndexes: string[]) {
    return spellIndexes
      .map((spellIndex) => spellByIndex.get(spellIndex.trim()))
      .filter((spell): spell is Spell => Boolean(spell))
  }

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
      setAppState((previous) => ({
        ...previous,
        spells: nextSpells,
      }))
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
      normalizedSavedSpells.filter(
        (existing) => existing.index !== normalizedIndex,
      ),
    )
  }

  return (
    <MagicContext.Provider
      value={{
        spells: allSpells,
        savedSpells: normalizedSavedSpells,
        spellByIndex,
        getSpellByIndex,
        getSpellsByIndexes,
        officialSpellsLoading,
        officialSpellsError,
        metamagics,
        metamagicById,
        getMetamagicById,
        getMetamagicsByIds,
        saveSpell,
        saveSpells,
        deleteSpell,
      }}
    >
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
  if (!context) {
    throw new Error("useMagicContext must be used inside MagicProvider")
  }
  return context
}
