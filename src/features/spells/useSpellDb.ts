import { useCallback, useEffect, useState } from 'react'
import type { DndApiRef, DndSpell } from '../../models/types'
import { loadSpellDb, spellDbToList } from '../../lib/spellDb'
import { isHomebrewIndex } from '../../lib/homebrew'

export function useSpellDb(args: { spellCache: Record<string, DndSpell> | undefined }) {
  const { spellCache } = args

  const [spellList, setSpellList] = useState<DndApiRef[] | null>(null)
  const [spellListError, setSpellListError] = useState<string | null>(null)

  const [spellDetails, setSpellDetails] = useState<Record<string, DndSpell | undefined>>({})
  const [spellDetailsError, setSpellDetailsError] = useState<Record<string, string | undefined>>({})

  const ensureSpellDetailsLoaded = useCallback(async (): Promise<void> => {
    // No-op: spell details are preloaded from /spells.v1.json (single request at startup).
  }, [])

  const getSpellDetailsLocal = useCallback(
    async (index: string, signal?: AbortSignal): Promise<DndSpell> => {
      if (signal?.aborted) throw new Error('Aborted')
      if (isHomebrewIndex(index)) throw new Error('Homebrew spell has no official details')

      const spell = spellDetails[index] ?? spellCache?.[index]
      if (spell) return spell

      throw new Error(
        'Detalhes da magia não carregados. Gere /public/spells.v1.json com `npm run spells:fetch` e recarregue a página.',
      )
    },
    [spellCache, spellDetails],
  )

  useEffect(() => {
    let alive = true
    loadSpellDb()
      .then((payload) => {
        if (!alive) return
        const spells = payload.spells ?? {}
        // Merge in any previously-synced cache entries as a fallback, without fetching.
        const merged = { ...(spellCache ?? {}), ...spells }
        setSpellDetails(merged)
        setSpellDetailsError({})
        setSpellList(spellDbToList(merged))
        setSpellListError(null)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setSpellListError(
          err instanceof Error
            ? err.message
            : 'Failed to load local spell DB (/spells.v1.json). Run: npm run spells:fetch',
        )
        setSpellList(null)
      })

    return () => {
      alive = false
    }
    // Intentionally run once; spellCache is only a fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    spellList,
    spellListError,
    spellDetails,
    setSpellDetails,
    spellDetailsError,
    setSpellDetailsError,
    ensureSpellDetailsLoaded,
    getSpellDetailsLocal,
  }
}
