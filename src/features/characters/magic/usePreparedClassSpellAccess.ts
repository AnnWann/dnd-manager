import { useEffect, useMemo, useState } from "react"

import {
  queryAllOfficialSpellSummaries,
  type SpellCompendiumSummary,
} from "../../../api/spell-compendium"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { CharacterClassInterface } from "../../../models/sheet/Class"
import {
  isPreparedClass,
  maximumPreparedClassSpellLevel,
  preparedClassSpellSource,
  type PreparedClassSpellCatalogEntry,
} from "./preparedClassSpellAccess"

export type PreparedClassSpellAccess = {
  classEntry: CharacterClassInterface
  spell: Spell
  source: SpellSource
}

type PreparedClassCatalog = {
  classEntry: CharacterClassInterface
  spells: SpellCompendiumSummary[]
}

export type PreparedClassSpellAccessState = {
  entries: PreparedClassSpellAccess[]
  catalogEntries: PreparedClassSpellCatalogEntry[]
  accessibleKeys: ReadonlySet<string>
  loading: boolean
  ready: boolean
}

export function preparedClassSpellAccessKey(className: string, spellIndex: string): string {
  return `${className}:${spellIndex}`
}

export function usePreparedClassSpellAccess(
  character: CharacterTemplate,
): PreparedClassSpellAccessState {
  const { ensureOfficialSpells, getSpellByIndex } = useMagicContext()
  const preparedClasses = useMemo(
    () =>
      (character.get("sheet").classes ?? []).filter(
        (entry) => isPreparedClass(entry) && maximumPreparedClassSpellLevel(entry) > 0,
      ),
    [character],
  )
  const requestKey = preparedClasses
    .map((entry) => `${entry.className}:${entry.level}:${maximumPreparedClassSpellLevel(entry)}`)
    .sort()
    .join("|")
  const [catalogs, setCatalogs] = useState<PreparedClassCatalog[]>([])
  const [loadedKey, setLoadedKey] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!requestKey) {
      setCatalogs([])
      setLoadedKey("")
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void Promise.all(
      preparedClasses.map(async (classEntry): Promise<PreparedClassCatalog> => {
        const page = await queryAllOfficialSpellSummaries({
          className: classEntry.className,
          minLevel: 1,
          maxLevel: maximumPreparedClassSpellLevel(classEntry),
        })
        return { classEntry, spells: page.spells }
      }),
    )
      .then(async (nextCatalogs) => {
        if (cancelled) return
        setCatalogs(nextCatalogs)
        setLoadedKey(requestKey)
        await ensureOfficialSpells(
          Array.from(
            new Set(
              nextCatalogs.flatMap((catalog) => catalog.spells.map((spell) => spell.index)),
            ),
          ),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogs([])
          setLoadedKey(requestKey)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ensureOfficialSpells, requestKey])

  const catalogEntries = useMemo<PreparedClassSpellCatalogEntry[]>(
    () =>
      catalogs.flatMap(({ classEntry, spells }) =>
        spells.map((spell) => ({
          classEntry,
          spellIndex: spell.index,
        })),
      ),
    [catalogs],
  )

  const accessibleKeys = useMemo(
    () =>
      new Set(
        catalogEntries.map((entry) =>
          preparedClassSpellAccessKey(entry.classEntry.className, entry.spellIndex),
        ),
      ),
    [catalogEntries],
  )

  const entries = useMemo(
    () =>
      catalogs.flatMap(({ classEntry, spells }) => {
        const source = preparedClassSpellSource(classEntry)
        return spells.flatMap((summary) => {
          const spell = getSpellByIndex(summary.index)
          return spell ? [{ classEntry, spell, source }] : []
        })
      }),
    [catalogs, getSpellByIndex],
  )

  return {
    entries,
    catalogEntries,
    accessibleKeys,
    loading,
    ready: !requestKey || loadedKey === requestKey,
  }
}
