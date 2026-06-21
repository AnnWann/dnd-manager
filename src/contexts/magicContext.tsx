import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { Spell } from "../models/magic/spells/Spell"
import type { AppStateV1 } from "../lib/remoteState"
import { normalizeSpellText } from "../lib/textNormalization"
import spellData from "../data/spells.v1.json"
import metamagicData from "../data/metamagics.v1.json"
import type { Metamagic, MetamagicId } from "../models/magic/metamagic/Metamagic"

const officialSpells = (spellData.spells as unknown[]).map((rawSpell) => {
  const { source: _source, ...spell } = rawSpell as Record<string, unknown>
  return spell as unknown as Spell
})

const officialMetamagics = Object.values(
  metamagicData as Record<MetamagicId, Metamagic>,
)

type MagicContextValue = {
  spells: Spell[]
  spellByIndex: Map<string, Spell>
  getSpellByIndex: (spellIndex: string) => Spell | undefined
  getSpellsByIndexes: (spellIndexes: string[]) => Spell[]
  metamagics: Metamagic[]
  metamagicById: Map<string, Metamagic>
  getMetamagicById: (metamagicId: MetamagicId) => Metamagic | undefined
  getMetamagicsByIds: (metamagicIds: MetamagicId[]) => Metamagic[]
  saveSpell: (spell: Spell) => void
  deleteSpell: (spellIndex: string) => void
}

const MagicContext = createContext<MagicContextValue | null>(null)

type MagicProviderProps = {
  children: ReactNode
  spells: Spell[]
  setAppState: React.Dispatch<React.SetStateAction<AppStateV1>>
}

export function MagicProvider({ children, spells, setAppState }: MagicProviderProps) {
  const allSpells = useMemo(() => [...officialSpells, ...spells], [spells])
  const spellByIndex = useMemo(
    () => new Map(allSpells.map((spell) => [spell.index, spell])),
    [allSpells],
  )
  const metamagics = useMemo(() => officialMetamagics, [])
  const metamagicById = useMemo(
    () => new Map(metamagics.map((metamagic) => [metamagic.id, metamagic])),
    [metamagics],
  )

  function getSpellByIndex(spellIndex: string) {
    return spellByIndex.get(spellIndex)
  }

  function getSpellsByIndexes(spellIndexes: string[]) {
    return spellIndexes
      .map((spellIndex) => spellByIndex.get(spellIndex))
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

  function saveSpell(spell: Spell) {
    const normalizedSpell = normalizeSpellText(spell)

    setAppState((previous) => ({
      ...previous,
      spells: [
        ...(previous.spells ?? []).filter(
          (existing) => existing.index !== normalizedSpell.index,
        ),
        normalizedSpell,
      ],
    }))
  }

  function deleteSpell(spellIndex: string) {
    const normalizedIndex = spellIndex.trim()

    setAppState((previous) => ({
      ...previous,
      spells: (previous.spells ?? []).filter(
        (existing) => existing.index !== normalizedIndex,
      ),
    }))
  }

  return (
    <MagicContext.Provider
      value={{
        spells: allSpells,
        spellByIndex,
        getSpellByIndex,
        getSpellsByIndexes,
        metamagics,
        metamagicById,
        getMetamagicById,
        getMetamagicsByIds,
        saveSpell,
        deleteSpell,
      }}
    >
      {children}
    </MagicContext.Provider>
  )
}

export function useMagicContext() {
  const context = useContext(MagicContext)
  if (!context) {
    throw new Error("useMagicContext must be used inside MagicProvider")
  }
  return context
}
