import { useCallback, useState } from 'react'
import type { SpellTranslation } from '../models/types'
import type { AppStateV1 } from '../../lib/remoteState'
import { translateTexts } from './translateApi'

export type TranslateStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; spellIndex: string }
  | { kind: 'error'; spellIndex: string; message: string }

export function useTranslateOfficial(args: {
  activeCharacterId: string
  setAppState: React.Dispatch<React.SetStateAction<AppStateV1>>
}) {
  const { activeCharacterId, setAppState } = args

  const [translateStatus, setTranslateStatus] = useState<TranslateStatus>({ kind: 'idle' })

  const translateOfficialToPt = useCallback(
    async (tArgs: { spellIndex: string; desc: string[]; higher: string[]; material?: string }): Promise<void> => {
      setTranslateStatus({ kind: 'loading', spellIndex: tArgs.spellIndex })
      try {
        const material = tArgs.material?.trim() || ''
        const translated = await translateTexts({
          texts: [...tArgs.desc, ...tArgs.higher, ...(material ? [material] : [])],
        })
        const descCount = tArgs.desc.length
        const higherCount = tArgs.higher.length
        const officialDescPt = translated.slice(0, descCount)
        const officialHigherLevelPt = translated.slice(descCount, descCount + higherCount)
        const materialPt = material ? (translated[descCount + higherCount] ?? '').trim() : undefined

        setAppState((prev) => {
          const prevTranslations = prev.spellTranslations ?? {}
          const prevT = prevTranslations[tArgs.spellIndex]
          const merged: SpellTranslation = {
            namePt: prevT?.namePt,
            descPt: officialDescPt.length ? officialDescPt : undefined,
            higherPt: officialHigherLevelPt.length ? officialHigherLevelPt : undefined,
            materialPt: materialPt || prevT?.materialPt,
          }
          const translationsChanged = JSON.stringify(prevT ?? {}) !== JSON.stringify(merged)
          const nextTranslations = translationsChanged
            ? { ...prevTranslations, [tArgs.spellIndex]: merged }
            : prevTranslations

          const nextCharacters = prev.characters.map((c) => {
            if (c.id !== activeCharacterId) return c
            return {
              ...c,
              spells: c.spells.map((s) =>
                s.spellIndex === tArgs.spellIndex
                  ? {
                      ...s,
                      officialDescPt,
                      officialHigherLevelPt: officialHigherLevelPt.length ? officialHigherLevelPt : undefined,
                    }
                  : s,
              ),
            }
          })

          return {
            ...prev,
            characters: nextCharacters,
            spellTranslations: translationsChanged ? nextTranslations : prev.spellTranslations,
          }
        })

        setTranslateStatus({ kind: 'idle' })
      } catch (err: unknown) {
        setTranslateStatus({
          kind: 'error',
          spellIndex: tArgs.spellIndex,
          message: err instanceof Error ? err.message : 'Falha ao traduzir.',
        })
      }
    },
    [activeCharacterId, setAppState],
  )

  return {
    translateStatus,
    translateOfficialToPt,
  }
}
