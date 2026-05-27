import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Attribute,
  AddedSpell,
  Character,
  CharacterClass,
  DndApiRef,
  DndSpell,
  MagicCircleLevel,
  HomebrewSpell,
  HomebrewSpellMechanic,
  SpellEffect,
  SpellCastTimeKind,
  SpellTranslation,
} from './types'

import { newCharacter } from './lib/character'
import { preparedLimitForClass } from './lib/prepared'
import { spellListClassIndex } from './lib/spellAccess'
import { homebrewToDndSpell, isHomebrewIndex } from './lib/homebrew'
import { castTimeKindFromText } from './lib/castTime'
import {
  CLASS_OPTIONS,
  schoolLabel,
} from './lib/spellLabels'
import { useRemoteAppState } from './lib/remoteState'
import { Button } from './components/ui/Button'
import { Card, CardContent, CardHeader } from './components/ui/Card'
import { useI18n } from './i18n/I18nContext'
import { SyncView } from './views/SyncView'
import { CharacterView } from './views/CharacterView'
import { SpellsView } from './views/SpellsView'

import { useSwipeViews } from './hooks/useSwipeViews'
import { useSpellDb } from './features/spells/useSpellDb'
import { useCastingCalc } from './features/characters/useCastingCalc'
import { translateTexts } from './features/spells/translateApi'
import { clampInt, clampStep, formatPtNumber } from './lib/numberFormat'
import { effectsEqual } from './lib/spellEffects'
import { InitiativeView } from './views/InitiativeView'
import { normalizeCharacter } from './lib/normaliseCharacter'

function App() {
  const { abilityShort } = useI18n()

  const swipe = useSwipeViews({ viewCount: 4, initialIndex: 1 })
  type ViewsCount = 0 | 1 | 2 | 3
  const viewIndex = swipe.viewIndex as ViewsCount

  const {
    syncKey,
    setSyncKey,
    canSync,
    state: appState,
    setState: setAppState,
    status: syncStatus,
    pullFromServer,
  } = useRemoteAppState()

  const characters = appState.characters
  const activeCharacterId = appState.activeCharacterId
  const spellCache = appState.spellCache ?? {}
  const effectPresets = appState.effectPresets ?? {}
  const homebrewLibrary = appState.homebrewLibrary ?? {}
  const spellTranslations = appState.spellTranslations ?? {}

  const activeCharacter = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0],
    [activeCharacterId, characters],
  )

  useEffect(() => {
    if (characters.length === 0) {
      const c = newCharacter('Meu personagem')
      setAppState({
        version: 1,
        characters: [c],
        activeCharacterId: c.id,
        spellCache: {},
        effectPresets: {},
        homebrewLibrary: {},
        spellTranslations: {},
      })
      return
    }
    if (!activeCharacter && characters[0]) {
      setAppState((s) => ({ ...s, activeCharacterId: characters[0].id }))
    }
  }, [activeCharacter, characters, setAppState])

  const spellDb = useSpellDb({ spellCache })
  const { spellList, spellListError, spellDetails, spellDetailsError } = spellDb
  const ensureSpellDetailsLoaded = spellDb.ensureSpellDetailsLoaded
  const getSpellDetailsLocal = spellDb.getSpellDetailsLocal

  useEffect(() => {
    // Bootstrap: if characters already contain homebrew spells, ensure they are also
    // present in the shared homebrew library for reuse across characters/devices.
    // Also backfill effect presets from existing character spells.
    setAppState((prev) => {
      const prevLib = prev.homebrewLibrary ?? {}
      let nextLib = prevLib
      let changedLib = false

      const prevPresets = prev.effectPresets ?? {}
      let nextPresets = prevPresets
      let changedPresets = false

      const prevTranslations = prev.spellTranslations ?? {}
      let nextTranslations = prevTranslations
      let changedTranslations = false

      for (const c of prev.characters) {
        for (const s of c.spells) {
          if (!s.homebrew) continue
          const idx = s.spellIndex
          const hb = s.homebrew
          const hbFinal = {
            ...hb,
            castingTimeKind: hb.castingTimeKind ?? s.castTimeKind,
            reactionWhen: (hb.reactionWhen ?? s.reactionWhen)?.trim() || undefined,
          }
          if (!prevLib[idx]) {
            if (nextLib === prevLib) nextLib = { ...prevLib }
            nextLib[idx] = hbFinal
            changedLib = true
          }
        }
      }

      for (const c of prev.characters) {
        for (const s of c.spells) {
          const eff = s.effects
          if (!eff || eff.length === 0) continue
          if (prevPresets[s.spellIndex]) continue
          if (nextPresets === prevPresets) nextPresets = { ...prevPresets }
          nextPresets[s.spellIndex] = eff
          changedPresets = true
        }
      }

      for (const c of prev.characters) {
        for (const s of c.spells) {
          if (s.homebrew || isHomebrewIndex(s.spellIndex)) continue
          const namePt = s.displayNamePt?.trim()
          const descPt = s.officialDescPt
          const higherPt = s.officialHigherLevelPt
          if (!namePt && !descPt?.length && !higherPt?.length) continue

          const prevT = prevTranslations[s.spellIndex]
          const merged: SpellTranslation = {
            namePt: namePt || prevT?.namePt,
            descPt: (descPt?.length ? descPt : prevT?.descPt) ?? undefined,
            higherPt: (higherPt?.length ? higherPt : prevT?.higherPt) ?? undefined,
          }
          if (JSON.stringify(prevT ?? {}) !== JSON.stringify(merged)) {
            if (nextTranslations === prevTranslations) nextTranslations = { ...prevTranslations }
            nextTranslations[s.spellIndex] = merged
            changedTranslations = true
          }
        }
      }

      if (!changedLib && !changedPresets && !changedTranslations) return prev
      return {
        ...prev,
        homebrewLibrary: changedLib ? nextLib : prev.homebrewLibrary,
        effectPresets: changedPresets ? nextPresets : prev.effectPresets,
        spellTranslations: changedTranslations ? nextTranslations : prev.spellTranslations,
      }
    })
  }, [setAppState])

  const [addedNameFilter, setAddedNameFilter] = useState('')
  const [addedLevelFilter, setAddedLevelFilter] = useState<MagicCircleLevel | 'any'>('any')
  const [addedSchoolFilter, setAddedSchoolFilter] = useState<string>('any')
  const [addedClassFilter, setAddedClassFilter] = useState<string>('any')
  const [addedPreparedFilter, setAddedPreparedFilter] = useState<'any' | 'prepared' | 'notPrepared'>('any')

  const [hideUa, setHideUa] = useState(false)

  const [unaddedSearch, setUnaddedSearch] = useState('')

  const [unaddedLevelFilter, setUnaddedLevelFilter] = useState<MagicCircleLevel | 'any'>('any')
  const [unaddedSchoolFilter, setUnaddedSchoolFilter] = useState<string>('any')
  const [unaddedClassFilter, setUnaddedClassFilter] = useState<string>('any')

  const [hbName, setHbName] = useState('')
  const [hbLevel, setHbLevel] = useState<MagicCircleLevel>(1)
  const [hbSchool, setHbSchool] = useState<string>('Evocation')
  const [hbMechanic, setHbMechanic] = useState<HomebrewSpellMechanic>('none')
  const [hbSaveAbility, setHbSaveAbility] = useState<Attribute>('dex')
  const [hbDesc, setHbDesc] = useState('')
  const [hbHigher, setHbHigher] = useState('')

  const [hbRangeKind, setHbRangeKind] = useState<'self' | 'touch' | 'meters' | 'feet' | 'sight' | 'special' | 'unlimited'>('meters')
  const [hbRangeValue, setHbRangeValue] = useState<number>(18)

  const [hbAreaShape, setHbAreaShape] = useState<'none' | 'cone' | 'sphere' | 'cylinder' | 'line' | 'cube'>('none')
  const [hbAreaSize, setHbAreaSize] = useState<number>(6)
  const [hbAreaUnit, setHbAreaUnit] = useState<'m' | 'ft'>('m')

  const [hbDurationKind, setHbDurationKind] = useState<'instant' | 'rounds' | 'minutes' | 'hours' | 'special'>('instant')
  const [hbDurationValue, setHbDurationValue] = useState<number>(1)

  const [hbDamageKind, setHbDamageKind] = useState<'none' | 'dice'>('none')
  const [hbDamageCount, setHbDamageCount] = useState<number>(2)
  const [hbDamageDie, setHbDamageDie] = useState<4 | 6 | 8 | 10 | 12>(6)
  const [hbDamageBonus, setHbDamageBonus] = useState<number>(0)

  const [hbCastTimeKind, setHbCastTimeKind] = useState<SpellCastTimeKind>('action')
  const [hbReactionWhen, setHbReactionWhen] = useState('')
  const [hbConcentration, setHbConcentration] = useState(false)
  const [hbRitual, setHbRitual] = useState(false)

  const [hbComponents, setHbComponents] = useState<Array<'V' | 'S' | 'M'>>([])
  const [hbMaterial, setHbMaterial] = useState('')

  const [hbSourceType, setHbSourceType] = useState<'class' | 'feat'>('class')
  const [hbSourceClassId, setHbSourceClassId] = useState<string>('')
  const [hbFeatName, setHbFeatName] = useState('')
  const [hbFeatAbility, setHbFeatAbility] = useState<Attribute>('cha')

  const [hbBaseClasses, setHbBaseClasses] = useState<string[]>([])

  const [openSpellIndex, setOpenSpellIndex] = useState<string | null>(null)
  const [openSpellTab, setOpenSpellTab] = useState<'official' | 'modifiers' | 'headcanon'>('official')

  type TranslateStatus =
    { kind: 'idle' }
    | { kind: 'loading'; spellIndex: string }
    | { kind: 'error'; spellIndex: string; message: string }

  const [translateStatus, setTranslateStatus] = useState((): TranslateStatus => ({ kind: 'idle' }))

  async function translateOfficialToPt(args: {
    spellIndex: string
    desc: string[]
    higher: string[]
    material?: string
  }): Promise<void> {
    if (!activeCharacter) return
    setTranslateStatus({ kind: 'loading', spellIndex: args.spellIndex })
    try {
      const material = args.material?.trim() || ''
      const translated = await translateTexts({
        texts: [...args.desc, ...args.higher, ...(material ? [material] : [])],
      })
      const descCount = args.desc.length
      const higherCount = args.higher.length
      const officialDescPt = translated.slice(0, descCount)
      const officialHigherLevelPt = translated.slice(descCount, descCount + higherCount)
      const materialPt = material ? (translated[descCount + higherCount] ?? '').trim() : undefined

      setAppState((prev) => {
        const activeId = prev.activeCharacterId
        const prevTranslations = prev.spellTranslations ?? {}
        const prevT = prevTranslations[args.spellIndex]
        const merged: SpellTranslation = {
          namePt: prevT?.namePt,
          descPt: officialDescPt.length ? officialDescPt : undefined,
          higherPt: officialHigherLevelPt.length ? officialHigherLevelPt : undefined,
          materialPt: materialPt || prevT?.materialPt,
        }
        const translationsChanged = JSON.stringify(prevT ?? {}) !== JSON.stringify(merged)
        const nextTranslations = translationsChanged
          ? { ...prevTranslations, [args.spellIndex]: merged }
          : prevTranslations

        const nextCharacters = prev.characters.map((c) => {
          if (c.id !== activeId) return c
          return {
            ...c,
            spells: c.spells.map((s) =>
              s.spellIndex === args.spellIndex
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
        spellIndex: args.spellIndex,
        message: err instanceof Error ? err.message : 'Falha ao traduzir.',
      })
    }
  }

  async function addSpellToActiveTranslated(spellRef: DndApiRef) {
    if (!activeCharacter) return
    if (activeCharacterSpellsSet.has(spellRef.index)) return

    if (isHomebrewIndex(spellRef.index)) {
      await addSpellToActive(spellRef)
      return
    }

    const cachedT = spellTranslations[spellRef.index]
    if (cachedT?.descPt?.length || cachedT?.higherPt?.length || cachedT?.namePt?.trim()) {
      await addSpellToActive(spellRef)
      return
    }

    setTranslateStatus({ kind: 'loading', spellIndex: spellRef.index })
    try {
      const detail = await getSpellDetailsLocal(spellRef.index)
      spellDb.setSpellDetails((prev) => ({ ...prev, [detail.index]: detail }))

      const characterClasses = activeCharacter.classes
      const eligible = characterClasses.length
        ? characterClasses.filter((c) =>
            detail.classes.some((x) => x.index === spellListClassIndex(c.classIndex)),
          )
        : []
      const sourceClassId = eligible[0]?.id ?? characterClasses[0]?.id

      const desc = detail.desc ?? []
      const higher = detail.higher_level ?? []
      const material = detail.material?.trim() || ''
      const translated = await translateTexts({ texts: [...desc, ...higher, ...(material ? [material] : [])] })
      const descCount = desc.length
      const higherCount = higher.length
      const officialDescPt = translated.slice(0, descCount)
      const officialHigherLevelPt = translated.slice(descCount, descCount + higherCount)
      const materialPt = material ? (translated[descCount + higherCount] ?? '').trim() : undefined

      const newSpell: AddedSpell = {
        spellIndex: detail.index,
        spellName: detail.name,
        sourceType: 'class',
        sourceClassId,
        addedAt: Date.now(),
        castSlotLevel: (detail.level as MagicCircleLevel) ?? 1,
        castTimeKind: castTimeKindFromText(detail.casting_time),
        effects: undefined,
        officialDescPt,
        officialHigherLevelPt: officialHigherLevelPt.length ? officialHigherLevelPt : undefined,
      }

      setAppState((prev) => {
        const activeId = prev.activeCharacterId
        const active = prev.characters.find((c) => c.id === activeId)
        if (!active) return prev
        if (active.spells.some((s) => s.spellIndex === detail.index)) return prev

        const preset = (prev.effectPresets ?? {})[detail.index]
        const newSpellWithPreset: AddedSpell = { ...newSpell, effects: cloneEffects(preset) }

        const prevTranslations = prev.spellTranslations ?? {}
        const prevT = prevTranslations[detail.index]
        const merged: SpellTranslation = {
          namePt: prevT?.namePt,
          descPt: officialDescPt.length ? officialDescPt : undefined,
          higherPt: officialHigherLevelPt.length ? officialHigherLevelPt : undefined,
          materialPt: materialPt || prevT?.materialPt,
        }
        const translationsChanged = JSON.stringify(prevT ?? {}) !== JSON.stringify(merged)
        const nextTranslations = translationsChanged
          ? { ...prevTranslations, [detail.index]: merged }
          : prevTranslations

        const nextCharacters = prev.characters.map((c) => {
          if (c.id !== activeId) return c
          const nextSpells = [...c.spells, newSpellWithPreset].sort((a, b) => {
            const aLevel =
              a.spellIndex === detail.index
                ? detail.level
                : (a.homebrew ? a.homebrew.level : spellDetails[a.spellIndex]?.level)
            const bLevel =
              b.spellIndex === detail.index
                ? detail.level
                : (b.homebrew ? b.homebrew.level : spellDetails[b.spellIndex]?.level)
            const aL = aLevel ?? 99
            const bL = bLevel ?? 99
            if (aL !== bL) return aL - bL

            const aName = (a.displayNamePt?.trim() || a.spellName).toLocaleLowerCase('pt-BR')
            const bName = (b.displayNamePt?.trim() || b.spellName).toLocaleLowerCase('pt-BR')
            const byName = aName.localeCompare(bName, 'pt-BR')
            if (byName !== 0) return byName

            return a.spellIndex.localeCompare(b.spellIndex)
          })
          return { ...c, spells: nextSpells }
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
        spellIndex: spellRef.index,
        message: err instanceof Error ? err.message : 'Falha ao traduzir.',
      })
    }
  }

  const { setCalcClassId, activeCharacterTotalLevel, effectiveCalcClassId, atk, dc } =
    useCastingCalc(activeCharacter)

  const activeCharacterSpellsSet = useMemo(() => {
    const set = new Set<string>()
    if (!activeCharacter) return set
    for (const s of activeCharacter.spells) set.add(s.spellIndex)
    return set
  }, [activeCharacter])

  const activeCharacterSchools = useMemo(() => {
    if (!activeCharacter) return [] as string[]
    const values = activeCharacter.spells
      .map((s) =>
        s.homebrew
          ? s.homebrew.school
          : spellDetails[s.spellIndex]?.school?.name,
      )
      .filter((v): v is string => Boolean(v))
    return Array.from(new Set(values)).sort((a, b) =>
      schoolLabel(a).localeCompare(schoolLabel(b), 'pt-BR'),
    )
  }, [activeCharacter, spellDetails])

  const preparedMeta = useMemo(() => {
    if (!activeCharacter) {
      return {
        limitsByClassId: {} as Record<string, number>,
        preparedCountByClassId: {} as Record<string, number>,
      }
    }

    const limitsByClassId: Record<string, number> = {}
    for (const cls of activeCharacter.classes) {
      const abilityScore = activeCharacter.attributes[cls.castingAbility]
      const limit = preparedLimitForClass({
        classIndex: cls.classIndex,
        classLevel: cls.level,
        abilityScore,
      })
      if (limit !== null) limitsByClassId[cls.id] = limit
    }

    const preparedCountByClassId: Record<string, number> = {}
    for (const entry of activeCharacter.spells) {
      if (entry.sourceType === 'feat') continue
      const classId = entry.sourceClassId
      if (!classId) continue
      if (!(classId in limitsByClassId)) continue

      const level = entry.homebrew
        ? entry.homebrew.level
        : spellDetails[entry.spellIndex]?.level
      // Cantrips are always available and should not count against prepared limits.
      if (level === 0) continue

      if (!entry.prepared) continue
      preparedCountByClassId[classId] = (preparedCountByClassId[classId] ?? 0) + 1
    }

    return { limitsByClassId, preparedCountByClassId }
  }, [activeCharacter, spellDetails])

  const filteredAddedSpells = useMemo(() => {
    if (!activeCharacter) return []
    const nameQ = addedNameFilter.trim().toLowerCase()
    const filtered = activeCharacter.spells.filter((entry) => {
      if (nameQ) {
        const hay = `${entry.displayNamePt?.trim() || ''} ${entry.spellName}`.toLowerCase()
        if (!hay.includes(nameQ)) return false
      }

      const detail = entry.homebrew
        ? homebrewToDndSpell({ entry, hb: entry.homebrew })
        : spellDetails[entry.spellIndex]
      if (addedLevelFilter !== 'any' && detail?.level !== undefined && detail.level !== addedLevelFilter)
        return false
      if (addedSchoolFilter !== 'any' && detail?.school?.name && detail.school.name !== addedSchoolFilter)
        return false
      if (addedClassFilter !== 'any') {
        if (addedClassFilter === 'feat') {
          if (entry.sourceType !== 'feat') return false
        } else {
          if (entry.sourceType === 'feat') return false
          const source = entry.sourceClassId
          if (source && source !== addedClassFilter) return false
          if (!source) return false
        }
      }

      const usesPreparedSystem = (() => {
        if (entry.sourceType === 'feat') return false
        const classId = entry.sourceClassId
        if (!classId) return false
        return classId in preparedMeta.limitsByClassId
      })()

      const isCantrip = (detail?.level ?? 1) === 0
      const isRitual = Boolean((detail as DndSpell | undefined)?.ritual)

      // Filtering semantics:
      // - "prepared": show both explicitly prepared spells AND spells that don't require preparation (always available)
      // - "notPrepared": show only spells that use the prepared system and are not marked prepared
      if (addedPreparedFilter === 'prepared') {
        if (usesPreparedSystem && !isCantrip && !isRitual && !entry.prepared) return false
      }
      if (addedPreparedFilter === 'notPrepared') {
        if (!usesPreparedSystem) return false
        if (isCantrip) return false
        if (isRitual) return false
        if (entry.prepared) return false
      }
      return true
    })
    return filtered.sort((a, b) => {
      const aLevel = (a.homebrew ? a.homebrew.level : spellDetails[a.spellIndex]?.level) ?? 99
      const bLevel = (b.homebrew ? b.homebrew.level : spellDetails[b.spellIndex]?.level) ?? 99
      if (aLevel !== bLevel) return aLevel - bLevel

      const aName = (a.displayNamePt?.trim() || a.spellName).toLocaleLowerCase('pt-BR')
      const bName = (b.displayNamePt?.trim() || b.spellName).toLocaleLowerCase('pt-BR')
      const byName = aName.localeCompare(bName, 'pt-BR')
      if (byName !== 0) return byName

      return a.spellIndex.localeCompare(b.spellIndex)
    })
  }, [activeCharacter, addedClassFilter, addedLevelFilter, addedNameFilter, addedPreparedFilter, addedSchoolFilter, spellDetails, preparedMeta])

  const availableSpellRefs = useMemo((): DndApiRef[] => {
    const homebrews: DndApiRef[] = Object.entries(homebrewLibrary).map(([index, hb]) => ({
      index,
      name: hb.name,
      url: `/homebrew/${encodeURIComponent(index)}`,
    }))
    return [...(spellList ?? []), ...homebrews]
  }, [homebrewLibrary, spellList])

  const spellNameAliases = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const s of availableSpellRefs) {
      map[s.index] = [s.name]
    }
    for (const [idx, t] of Object.entries(spellTranslations)) {
      if (!t) continue
      const arr = map[idx] ?? (map[idx] = [])
      if (t.namePt?.trim()) arr.push(t.namePt.trim())
    }
    for (const c of characters) {
      for (const s of c.spells) {
        const namePt = s.displayNamePt?.trim()
        if (!namePt) continue
        const arr = map[s.spellIndex] ?? (map[s.spellIndex] = [s.spellName])
        arr.push(namePt)
      }
    }
    return map
  }, [availableSpellRefs, characters, spellTranslations])

  const cloneEffects = useCallback((effects: SpellEffect[] | undefined): SpellEffect[] | undefined => {
    if (!effects) return undefined
    return effects.map((e) => ({
      ...e,
      rollAppliesTo: e.rollAppliesTo ? [...e.rollAppliesTo] : undefined,
    }))
  }, [])

  useEffect(() => {
    // Backfill: if a preset exists and a spell entry has never set effects,
    // apply the preset for reuse across characters.
    setAppState((prev) => {
      const presets = prev.effectPresets ?? {}
      const translations = prev.spellTranslations ?? {}
      const hasPresets = Object.keys(presets).length > 0
      const hasTranslations = Object.keys(translations).length > 0
      if (!hasPresets && !hasTranslations) return prev

      let changed = false
      const nextCharacters = prev.characters.map((c) => {
        let spellsChanged = false
        const nextSpells = c.spells.map((s) => {
          let next = s

          if (s.effects === undefined) {
            const preset = presets[s.spellIndex]
            if (preset && preset.length) {
              next = { ...next, effects: cloneEffects(preset) }
            }
          }

          if (!(s.homebrew || isHomebrewIndex(s.spellIndex))) {
            const t = translations[s.spellIndex]
            if (t) {
              const patch: Partial<AddedSpell> = {}
              if (!next.displayNamePt?.trim() && t.namePt?.trim()) patch.displayNamePt = t.namePt.trim()
              if (!next.officialDescPt?.length && t.descPt?.length) patch.officialDescPt = t.descPt
              if (!next.officialHigherLevelPt?.length && t.higherPt?.length) patch.officialHigherLevelPt = t.higherPt

              if (Object.keys(patch).length) {
                next = { ...next, ...patch }
              }
            }
          }

          if (next !== s) spellsChanged = true
          return next
        })
        if (!spellsChanged) return c
        changed = true
        return { ...c, spells: nextSpells }
      })

      return changed ? { ...prev, characters: nextCharacters } : prev
    })
  }, [cloneEffects, setAppState, effectPresets])

  const unaddedCandidates = useMemo(() => {
    if (!availableSpellRefs.length) return [] as DndApiRef[]
    const q = unaddedSearch.trim().toLowerCase()
    const hasFilters =
      unaddedLevelFilter !== 'any' || unaddedSchoolFilter !== 'any' || unaddedClassFilter !== 'any'
    if (!q && !hasFilters) return [] as DndApiRef[]

    const base = availableSpellRefs.filter((s) => !activeCharacterSpellsSet.has(s.index))
    if (!q) return base.slice(0, 200)

    const matches = (idx: string, nameFallback: string) => {
      const aliases = spellNameAliases[idx] ?? [nameFallback]
      return aliases.some((n) => n.toLowerCase().includes(q))
    }

    return base.filter((s) => matches(s.index, s.name)).slice(0, 200)
  }, [activeCharacterSpellsSet, availableSpellRefs, spellNameAliases, unaddedClassFilter, unaddedLevelFilter, unaddedSchoolFilter, unaddedSearch])

  const needsUnaddedDetails =
    unaddedLevelFilter !== 'any' || unaddedSchoolFilter !== 'any' || unaddedClassFilter !== 'any'

  useEffect(() => {
    // Intentionally disabled: filtering unadded spells by level/school/class would
    // require fetching many spell details. We avoid mass API calls to prevent rate limiting.
    // Unadded filters will only match spells already present in the local/remote cache.
    if (!needsUnaddedDetails) return
  }, [needsUnaddedDetails])

  const unaddedResults = useMemo(() => {
    if (!unaddedCandidates.length) return [] as DndApiRef[]

    const filtered = unaddedCandidates.filter((s) => {
      const isHb = isHomebrewIndex(s.index)
      const hb = isHb ? homebrewLibrary[s.index] : undefined
      const detail = !isHb ? spellCache[s.index] : undefined

      if (unaddedLevelFilter !== 'any') {
        const lvl = (hb?.level ?? detail?.level) as number | undefined
        if (typeof lvl !== 'number') return false
        if (lvl !== unaddedLevelFilter) return false
      }

      if (unaddedSchoolFilter !== 'any') {
        const school = hb?.school ?? detail?.school?.name
        if (!school) return false
        if (school !== unaddedSchoolFilter) return false
      }

      if (unaddedClassFilter !== 'any') {
        if (hb) {
          if (!hb.classes?.includes(unaddedClassFilter)) return false
        } else {
          const classes = detail?.classes
          if (!classes || !classes.some((c) => c.index === unaddedClassFilter)) return false
        }
      }

      return true
    })

    return filtered.slice(0, 30)
  }, [homebrewLibrary, spellCache, unaddedCandidates, unaddedClassFilter, unaddedLevelFilter, unaddedSchoolFilter])

  function updateCharacter(characterId: string, updater: (c: Character) => Character) {
    setAppState((prev) => {
      const prevPresets = prev.effectPresets ?? {}
      let nextPresets = prevPresets
      let changedPresets = false

      const prevHomebrew = prev.homebrewLibrary ?? {}
      let nextHomebrew = prevHomebrew
      let changedHomebrew = false

      const prevTranslations = prev.spellTranslations ?? {}
      let nextTranslations = prevTranslations
      let changedTranslations = false

      const nextCharacters = prev.characters.map((c) => {
        if (c.id !== characterId) return c
        const nextC = updater(c)

        const prevByIndex = new Map(c.spells.map((s) => [s.spellIndex, s]))
        for (const nextSpell of nextC.spells) {
          const prevSpell = prevByIndex.get(nextSpell.spellIndex)
          const prevEffects = prevSpell?.effects
          const nextEffects = nextSpell.effects
          if (!effectsEqual(prevEffects, nextEffects)) {
            if (nextPresets === prevPresets) nextPresets = { ...prevPresets }
            nextPresets[nextSpell.spellIndex] = nextEffects ?? []
            changedPresets = true
          }

          if (!(nextSpell.homebrew || isHomebrewIndex(nextSpell.spellIndex))) {
            const prevNamePt = prevSpell?.displayNamePt?.trim() || ''
            const nextNamePt = nextSpell.displayNamePt?.trim() || ''
            const prevDescPt = prevSpell?.officialDescPt
            const nextDescPt = nextSpell.officialDescPt
            const prevHigherPt = prevSpell?.officialHigherLevelPt
            const nextHigherPt = nextSpell.officialHigherLevelPt

            const nameChanged = prevNamePt !== nextNamePt
            const descChanged = JSON.stringify(prevDescPt ?? []) !== JSON.stringify(nextDescPt ?? [])
            const higherChanged = JSON.stringify(prevHigherPt ?? []) !== JSON.stringify(nextHigherPt ?? [])

            if (nameChanged || descChanged || higherChanged) {
              const idx = nextSpell.spellIndex
              const prevT = prevTranslations[idx]
              const merged: SpellTranslation = {
                namePt: nextNamePt || prevT?.namePt,
                descPt: (nextDescPt?.length ? nextDescPt : prevT?.descPt) ?? undefined,
                higherPt: (nextHigherPt?.length ? nextHigherPt : prevT?.higherPt) ?? undefined,
              }
              if (JSON.stringify(prevT ?? {}) !== JSON.stringify(merged)) {
                if (nextTranslations === prevTranslations) nextTranslations = { ...prevTranslations }
                nextTranslations[idx] = merged
                changedTranslations = true
              }
            }
          }

          if (nextSpell.homebrew) {
            const idx = nextSpell.spellIndex
            const hb = nextSpell.homebrew
            const hbFinal = {
              ...hb,
              castingTimeKind: hb.castingTimeKind ?? nextSpell.castTimeKind,
              reactionWhen: (hb.reactionWhen ?? nextSpell.reactionWhen)?.trim() || undefined,
            }
            const prevHb = prevHomebrew[idx]
            if (!prevHb || JSON.stringify(prevHb) !== JSON.stringify(hbFinal)) {
              if (nextHomebrew === prevHomebrew) nextHomebrew = { ...prevHomebrew }
              nextHomebrew[idx] = hbFinal
              changedHomebrew = true
            }
          }
        }

        return nextC
      })

      return {
        ...prev,
        characters: nextCharacters,
        effectPresets: changedPresets ? nextPresets : prev.effectPresets,
        homebrewLibrary: changedHomebrew ? nextHomebrew : prev.homebrewLibrary,
        spellTranslations: changedTranslations ? nextTranslations : prev.spellTranslations,
      }
    })
  }

  function addCharacter() {
    const c = newCharacter(`Personagem ${characters.length + 1}`)
    setAppState((prev) => ({
      ...prev,
      characters: [...prev.characters.map(normalizeCharacter), c],
      activeCharacterId: c.id,
    }))
  }

  function deleteCharacter(characterId: string) {
    setAppState((prev) => {
      const nextCharacters = prev.characters.filter((c) => c.id !== characterId)
      const nextActiveId =
        prev.activeCharacterId === characterId
          ? (nextCharacters[0]?.id ?? '')
          : prev.activeCharacterId
      return { ...prev, characters: nextCharacters, activeCharacterId: nextActiveId }
    })
  }

  function addClassToActive(classIndex: string) {
    if (!activeCharacter) return
    const opt = CLASS_OPTIONS.find((c) => c.index === classIndex)
    const cls: CharacterClass = {
      id: crypto.randomUUID(),
      classIndex,
      className: opt?.name ?? classIndex,
      level: 1,
      castingAbility: opt?.defaultAbility ?? 'int',
    }
    updateCharacter(activeCharacter.id, (c) => ({ ...c, classes: [...c.classes, cls] }))
  }

  async function addSpellToActive(spellRef: DndApiRef) {
    if (!activeCharacter) return
    if (activeCharacterSpellsSet.has(spellRef.index)) return

    if (isHomebrewIndex(spellRef.index)) {
      const hb = homebrewLibrary[spellRef.index]
      if (!hb) return

      setAppState((prev) => {
        const activeId = prev.activeCharacterId
        const active = prev.characters.find((c) => c.id === activeId)
        if (!active) return prev
        if (active.spells.some((s) => s.spellIndex === spellRef.index)) return prev

        const characterClasses = active.classes
        const eligible = characterClasses.length
          ? characterClasses.filter((c) => (hb.classes ?? []).includes(spellListClassIndex(c.classIndex)))
          : []
        const sourceClassId = eligible[0]?.id ?? characterClasses[0]?.id

        const preset = (prev.effectPresets ?? {})[spellRef.index]

        const newSpell: AddedSpell = {
          spellIndex: spellRef.index,
          spellName: hb.name,
          homebrew: hb,
          sourceType: 'class',
          sourceClassId,
          addedAt: Date.now(),
          castSlotLevel: hb.level,
          castTimeKind: hb.castingTimeKind ?? 'action',
          reactionWhen:
            (hb.castingTimeKind ?? 'action') === 'reaction'
              ? (hb.reactionWhen?.trim() || undefined)
              : undefined,
          effects: cloneEffects(preset),
        }

        const nextCharacters = prev.characters.map((c) => {
          if (c.id !== activeId) return c
          const nextSpells = [...c.spells, newSpell].sort((a, b) => {
            const aLevel = (a.homebrew ? a.homebrew.level : spellDetails[a.spellIndex]?.level) ?? 99
            const bLevel = (b.homebrew ? b.homebrew.level : spellDetails[b.spellIndex]?.level) ?? 99
            if (aLevel !== bLevel) return aLevel - bLevel

            const aName = (a.displayNamePt?.trim() || a.spellName).toLocaleLowerCase('pt-BR')
            const bName = (b.displayNamePt?.trim() || b.spellName).toLocaleLowerCase('pt-BR')
            const byName = aName.localeCompare(bName, 'pt-BR')
            if (byName !== 0) return byName

            return a.spellIndex.localeCompare(b.spellIndex)
          })
          return { ...c, spells: nextSpells }
        })

        return { ...prev, characters: nextCharacters }
      })
      return
    }

    const detail = await getSpellDetailsLocal(spellRef.index)
    spellDb.setSpellDetails((prev) => ({ ...prev, [detail.index]: detail }))

    const characterClasses = activeCharacter.classes
    const eligible = characterClasses.length
      ? characterClasses.filter((c) =>
          detail.classes.some((x) => x.index === spellListClassIndex(c.classIndex)),
        )
      : []
    const sourceClassId = eligible[0]?.id ?? characterClasses[0]?.id

    const newSpell: AddedSpell = {
      spellIndex: detail.index,
      spellName: detail.name,
      sourceType: 'class',
      sourceClassId,
      addedAt: Date.now(),
      castSlotLevel: (detail.level as MagicCircleLevel) ?? 1,
      castTimeKind: castTimeKindFromText(detail.casting_time),
      effects: undefined,
    }

    setAppState((prev) => {
      const activeId = prev.activeCharacterId
      const active = prev.characters.find((c) => c.id === activeId)
      if (!active) return prev
      if (active.spells.some((s) => s.spellIndex === detail.index)) return prev

      const preset = (prev.effectPresets ?? {})[detail.index]
      const t = (prev.spellTranslations ?? {})[detail.index]
      const newSpellWithPreset: AddedSpell = {
        ...newSpell,
        effects: cloneEffects(preset),
        displayNamePt: t?.namePt?.trim() || undefined,
        officialDescPt: t?.descPt?.length ? t.descPt : undefined,
        officialHigherLevelPt: t?.higherPt?.length ? t.higherPt : undefined,
      }

      const nextCharacters = prev.characters.map((c) => {
        if (c.id !== activeId) return c
        const nextSpells = [...c.spells, newSpellWithPreset].sort((a, b) => {
          const aLevel =
            a.spellIndex === detail.index
              ? detail.level
              : (a.homebrew ? a.homebrew.level : spellDetails[a.spellIndex]?.level)
          const bLevel =
            b.spellIndex === detail.index
              ? detail.level
              : (b.homebrew ? b.homebrew.level : spellDetails[b.spellIndex]?.level)
          const aL = aLevel ?? 99
          const bL = bLevel ?? 99
          if (aL !== bL) return aL - bL

          const aName = (a.displayNamePt?.trim() || a.spellName).toLocaleLowerCase('pt-BR')
          const bName = (b.displayNamePt?.trim() || b.spellName).toLocaleLowerCase('pt-BR')
          const byName = aName.localeCompare(bName, 'pt-BR')
          if (byName !== 0) return byName

          return a.spellIndex.localeCompare(b.spellIndex)
        })
        return { ...c, spells: nextSpells }
      })

      return { ...prev, characters: nextCharacters }
    })
  }

  function addHomebrewToActive() {
    if (!activeCharacter) return
    const name = hbName.trim()
    if (!name) return

    const range = (() => {
      if (hbRangeKind === 'self') return 'Pessoal'
      if (hbRangeKind === 'touch') return 'Toque'
      if (hbRangeKind === 'special') return 'Especial'
      if (hbRangeKind === 'sight') return 'Visão'
      if (hbRangeKind === 'unlimited') return 'Ilimitado'
      if (hbRangeKind === 'feet') {
        const n = clampStep(hbRangeValue, 5, 9999, 5)
        return `${formatPtNumber(n)} ft`
      }
      const n = clampStep(hbRangeValue, 1.5, 9999, 1.5)
      return `${formatPtNumber(n)} m`
    })()

    const area = (() => {
      if (hbAreaShape === 'none') return undefined
      const unit = hbAreaUnit
      const n =
        unit === 'ft'
          ? clampStep(hbAreaSize, 5, 9999, 5)
          : clampStep(hbAreaSize, 1.5, 9999, 1.5)
      const shapePt: Record<Exclude<typeof hbAreaShape, 'none'>, string> = {
        cone: 'Cone',
        sphere: 'Esfera',
        cylinder: 'Cilindro',
        line: 'Linha',
        cube: 'Cubo',
      }
      return `${shapePt[hbAreaShape]} ${formatPtNumber(n)} ${unit}`
    })()

    const duration = (() => {
      if (hbDurationKind === 'instant') return 'Instantânea'
      if (hbDurationKind === 'special') return 'Especial'
      const n = clampInt(hbDurationValue, 1, 9999)
      if (hbDurationKind === 'rounds') return `${n} ${n === 1 ? 'rodada' : 'rodadas'}`
      if (hbDurationKind === 'minutes') return `${n} ${n === 1 ? 'minuto' : 'minutos'}`
      return `${n} ${n === 1 ? 'hora' : 'horas'}`
    })()

    const damageDice = (() => {
      if (hbDamageKind === 'none') return undefined
      const count = clampInt(hbDamageCount, 0, 99)
      const size = hbDamageDie
      const bonus = clampInt(hbDamageBonus, 0, 999)
      return `${count}d${size}${bonus ? `+${bonus}` : ''}`
    })()

    const componentsSet = new Set(hbComponents)
    const materialTrimmed = hbMaterial.trim()
    if (materialTrimmed) componentsSet.add('M')
    const components = Array.from(componentsSet) as Array<'V' | 'S' | 'M'>

    const hb: HomebrewSpell = {
      name,
      level: hbLevel,
      school: hbSchool,
      castingTimeKind: hbCastTimeKind,
      reactionWhen: hbCastTimeKind === 'reaction' ? (hbReactionWhen.trim() || undefined) : undefined,
      ritual: hbRitual || undefined,
      classes: hbBaseClasses.length ? hbBaseClasses : undefined,
      components: components.length ? components : undefined,
      material: components.includes('M') ? (materialTrimmed || undefined) : undefined,
      range: range.trim() || undefined,
      area: area?.trim() || undefined,
      duration: duration.trim() || undefined,
      concentration: hbConcentration || undefined,
      damageDice,
      mechanic: hbMechanic,
      saveAbility: hbMechanic === 'save' || hbMechanic === 'both' ? hbSaveAbility : undefined,
      desc: hbDesc.trim() || undefined,
      higherLevel: hbHigher.trim() || undefined,
    }

    const spellIndex = `hb:${crypto.randomUUID()}`

    const effectiveClassId = hbSourceClassId || effectiveCalcClassId || activeCharacter.classes[0]?.id
    const newSpell: AddedSpell = {
      spellIndex,
      spellName: name,
      homebrew: hb,
      sourceType: hbSourceType,
      sourceClassId: hbSourceType === 'class' ? (effectiveClassId || undefined) : undefined,
      featName: hbSourceType === 'feat' ? (hbFeatName.trim() || 'Feat') : undefined,
      featAbility: hbSourceType === 'feat' ? hbFeatAbility : undefined,
      addedAt: Date.now(),
      castSlotLevel: hbLevel,
      castTimeKind: hbCastTimeKind,
      reactionWhen:
        hbCastTimeKind === 'reaction' ? (hbReactionWhen.trim() || undefined) : undefined,
      effects: undefined,
    }

    updateCharacter(activeCharacter.id, (c) => ({
      ...c,
      spells: [...c.spells, newSpell].sort((a, b) => {
        const aLevel = (a.homebrew ? a.homebrew.level : spellDetails[a.spellIndex]?.level) ?? 99
        const bLevel = (b.homebrew ? b.homebrew.level : spellDetails[b.spellIndex]?.level) ?? 99
        if (aLevel !== bLevel) return aLevel - bLevel

        const aName = (a.displayNamePt?.trim() || a.spellName).toLocaleLowerCase('pt-BR')
        const bName = (b.displayNamePt?.trim() || b.spellName).toLocaleLowerCase('pt-BR')
        const byName = aName.localeCompare(bName, 'pt-BR')
        if (byName !== 0) return byName

        return a.spellIndex.localeCompare(b.spellIndex)
      }),
    }))

    setHbName('')
    setHbDesc('')
    setHbHigher('')
    setHbRangeKind('meters')
    setHbRangeValue(18)
    setHbAreaShape('none')
    setHbAreaSize(6)
    setHbAreaUnit('m')
    setHbDurationKind('instant')
    setHbDurationValue(1)
    setHbDamageKind('none')
    setHbDamageCount(2)
    setHbDamageDie(6)
    setHbDamageBonus(0)
    setHbCastTimeKind('action')
    setHbReactionWhen('')
    setHbConcentration(false)
    setHbRitual(false)

    setHbBaseClasses([])

    setHbComponents([])
    setHbMaterial('')
  }

  function removeSpellFromActive(spellIndex: string) {
    if (!activeCharacter) return
    updateCharacter(activeCharacter.id, (c) => ({
      ...c,
      spells: c.spells.filter((s) => s.spellIndex !== spellIndex),
    }))
  }

  if (!activeCharacter) {
    return (
      <div className="min-h-svh bg-bg text-text">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <Card>
            <CardHeader>
              <div className="font-heading text-xl text-textH">Gerenciador de Magias (D&amp;D)</div>
              <div className="mt-1 text-sm text-text">Nenhum personagem ainda.</div>
            </CardHeader>
            <CardContent>
              <Button variant="primary" onClick={addCharacter}>
                Adicionar personagem
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  function setView(next: ViewsCount) {
    swipe.setViewIndex(next)
  }

  const innerTransform = swipe.innerTransform

  return (
    <div className="min-h-svh bg-[color:var(--social-bg)] text-text">
      <header className="border-b border-accentBorder bg-accentBg">
        <div className="flex w-full flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-heading text-xl text-textH">Gerenciador de Magias (D&amp;D)</h1>
            <p className="text-xs text-text">Sync • Ficha • Magias • Iniciativa </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewIndex === 0 ? 'primary' : 'secondary'}
                onClick={() => setView(0)}
              >
                Sync
              </Button>
              <Button
                size="sm"
                variant={viewIndex === 1 ? 'primary' : 'secondary'}
                onClick={() => setView(1)}
              >
                Ficha
              </Button>
              <Button
                size="sm"
                variant={viewIndex === 2 ? 'primary' : 'secondary'}
                onClick={() => setView(2)}
              >
                Magias
              </Button>

              <Button
                size="sm"
                variant={viewIndex === 3 ? 'primary' : 'secondary'}
                onClick={() => setView(3)}
              >
                Iniciativa
              </Button>
                
            </div>

            <a
              className="text-xs font-medium text-accent underline decoration-accentBorder underline-offset-2 opacity-90 hover:opacity-100"
              href="https://www.dnd5eapi.co/"
              target="_blank"
              rel="noreferrer"
            >
              DnD 5e API
            </a>
          </div>
        </div>
      </header>

      <main
        ref={swipe.swipeRootRef}
        className="mmSwipeRoot w-full overflow-hidden"
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUpOrCancel}
        onPointerCancel={swipe.onPointerUpOrCancel}
      >
        <div
          className="mmSwipeInner flex"
          style={{
            transform: innerTransform,
            transition: swipe.isDragging ? 'none' : 'transform 220ms ease',
          }}
        >
          {/* View 1: Sync */}
          <div className="basis-full shrink-0 px-4 py-6">
            <SyncView
              syncKey={syncKey}
              setSyncKey={setSyncKey}
              canSync={canSync}
              pullFromServer={pullFromServer}
              syncStatus={syncStatus}
            />
          </div>

          {/* View 2: Character sheet */}
          <div className="basis-full shrink-0 px-4 py-6">
            <CharacterView
              characters={characters}
              activeCharacter={activeCharacter}
              setActiveCharacterId={(id) => setAppState((s) => ({ ...s, activeCharacterId: id }))}
              addCharacter={addCharacter}
              deleteActiveCharacter={() => deleteCharacter(activeCharacter.id)}
              disableDelete={characters.length <= 1}
              abilityShort={abilityShort}
              updateCharacter={updateCharacter}
              addClassToActive={addClassToActive}
              effectiveCalcClassId={effectiveCalcClassId}
              setCalcClassId={setCalcClassId}
              disableCalcClassSelect={activeCharacter.classes.length === 0}
              activeCharacterTotalLevel={activeCharacterTotalLevel}
              atk={atk}
              dc={dc}
            />
          </div>

          {/* View 3: Spell listing */}
          <div className="basis-full shrink-0 px-4 py-6">
            <SpellsView
              abilityShort={abilityShort}
              hbName={hbName}
              setHbName={setHbName}
              hbLevel={hbLevel}
              setHbLevel={setHbLevel}
              hbSchool={hbSchool}
              setHbSchool={setHbSchool}
              hbMechanic={hbMechanic}
              setHbMechanic={setHbMechanic}
              hbSaveAbility={hbSaveAbility}
              setHbSaveAbility={setHbSaveAbility}
              hbDesc={hbDesc}
              setHbDesc={setHbDesc}
              hbHigher={hbHigher}
              setHbHigher={setHbHigher}
              hbRangeKind={hbRangeKind}
              setHbRangeKind={setHbRangeKind}
              hbRangeValue={hbRangeValue}
              setHbRangeValue={setHbRangeValue}
              hbAreaShape={hbAreaShape}
              setHbAreaShape={setHbAreaShape}
              hbAreaSize={hbAreaSize}
              setHbAreaSize={setHbAreaSize}
              hbAreaUnit={hbAreaUnit}
              setHbAreaUnit={setHbAreaUnit}
              hbDurationKind={hbDurationKind}
              setHbDurationKind={setHbDurationKind}
              hbDurationValue={hbDurationValue}
              setHbDurationValue={setHbDurationValue}
              hbDamageKind={hbDamageKind}
              setHbDamageKind={setHbDamageKind}
              hbDamageCount={hbDamageCount}
              setHbDamageCount={setHbDamageCount}
              hbDamageDie={hbDamageDie}
              setHbDamageDie={setHbDamageDie}
              hbDamageBonus={hbDamageBonus}
              setHbDamageBonus={setHbDamageBonus}
              hbCastTimeKind={hbCastTimeKind}
              setHbCastTimeKind={setHbCastTimeKind}
              hbReactionWhen={hbReactionWhen}
              setHbReactionWhen={setHbReactionWhen}
              hbConcentration={hbConcentration}
              setHbConcentration={setHbConcentration}
              hbRitual={hbRitual}
              setHbRitual={setHbRitual}
              hbComponents={hbComponents}
              setHbComponents={setHbComponents}
              hbMaterial={hbMaterial}
              setHbMaterial={setHbMaterial}
              hbSourceType={hbSourceType}
              setHbSourceType={setHbSourceType}
              hbSourceClassId={hbSourceClassId}
              setHbSourceClassId={setHbSourceClassId}
              hbFeatName={hbFeatName}
              setHbFeatName={setHbFeatName}
              hbFeatAbility={hbFeatAbility}
              setHbFeatAbility={setHbFeatAbility}
              hbBaseClasses={hbBaseClasses}
              setHbBaseClasses={setHbBaseClasses}
              effectiveCalcClassId={effectiveCalcClassId}
              addHomebrewToActive={addHomebrewToActive}
              activeCharacter={activeCharacter}
              activeCharacterSchools={activeCharacterSchools}
              activeCharacterTotalLevel={activeCharacterTotalLevel}
              filteredAddedSpells={filteredAddedSpells}
              spellDetails={spellDetails}
              spellDetailsError={spellDetailsError}
              ensureSpellDetailsLoaded={ensureSpellDetailsLoaded}
              preparedMeta={preparedMeta}
              spellTranslations={spellTranslations}
              addedNameFilter={addedNameFilter}
              setAddedNameFilter={setAddedNameFilter}
              addedLevelFilter={addedLevelFilter}
              setAddedLevelFilter={setAddedLevelFilter}
              addedSchoolFilter={addedSchoolFilter}
              setAddedSchoolFilter={setAddedSchoolFilter}
              addedPreparedFilter={addedPreparedFilter}
              setAddedPreparedFilter={setAddedPreparedFilter}
              addedClassFilter={addedClassFilter}
              setAddedClassFilter={setAddedClassFilter}
              hideUa={hideUa}
              setHideUa={setHideUa}
              openSpellIndex={openSpellIndex}
              setOpenSpellIndex={setOpenSpellIndex}
              openSpellTab={openSpellTab}
              setOpenSpellTab={setOpenSpellTab}
              translateStatus={translateStatus}
              translateOfficialToPt={translateOfficialToPt}
              updateCharacter={updateCharacter}
              removeSpellFromActive={removeSpellFromActive}
              availableSpellRefs={availableSpellRefs}
              spellListError={spellListError}
              unaddedSearch={unaddedSearch}
              setUnaddedSearch={setUnaddedSearch}
              unaddedLevelFilter={unaddedLevelFilter}
              setUnaddedLevelFilter={setUnaddedLevelFilter}
              unaddedSchoolFilter={unaddedSchoolFilter}
              setUnaddedSchoolFilter={setUnaddedSchoolFilter}
              unaddedClassFilter={unaddedClassFilter}
              setUnaddedClassFilter={setUnaddedClassFilter}
              unaddedResults={unaddedResults}
              activeCharacterSpellsSet={activeCharacterSpellsSet}
              addSpellToActive={addSpellToActive}
              addSpellToActiveTranslated={addSpellToActiveTranslated}
              getSpellDetailsLocal={getSpellDetailsLocal}
              homebrewLibrary={homebrewLibrary}
            />
          </div>

          {/* View 4: Initiative tracker */}
          <div className="basis-full shrink-0 px-4 py-6">
            <InitiativeView
              characters={characters}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
