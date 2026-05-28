import type { Dispatch, SetStateAction } from 'react'
import type {
  Attribute,
  AddedSpell,
  Character,
  DndApiRef,
  DndSpell,
  MagicCircleLevel,
  HomebrewSpellMechanic,
  SpellCastTimeKind,
  SpellTranslation,
} from '../types'
import { ABILITIES, magicCircleOptions } from '../lib/rules'
import { SCHOOL_NAME_PT, apiClassLabel, classDisplayName, schoolLabel } from '../lib/spellLabels'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { AddedSpellsCard } from '../components/addedSpells/AddedSpellsCard'
import { AddSpellsCard } from '../components/addedSpells/AddSpellsCard'
import { CharacterSelector } from '../features/characters/characterSelector'

export type TranslateStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; spellIndex: string }
  | { kind: 'error'; spellIndex: string; message: string }

  
export function SpellsView(props: {
  abilityShort: (ability: Attribute) => string
  characters: Character[]
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean

  // Homebrew creator state
  hbName: string
  setHbName: (v: string) => void
  hbLevel: MagicCircleLevel
  setHbLevel: (v: MagicCircleLevel) => void
  hbSchool: string
  setHbSchool: (v: string) => void
  hbMechanic: HomebrewSpellMechanic
  setHbMechanic: (v: HomebrewSpellMechanic) => void
  hbSaveAbility: Attribute
  setHbSaveAbility: (v: Attribute) => void
  hbDesc: string
  setHbDesc: (v: string) => void
  hbHigher: string
  setHbHigher: (v: string) => void

  hbRangeKind: 'self' | 'touch' | 'meters' | 'feet' | 'sight' | 'special' | 'unlimited'
  setHbRangeKind: (v: 'self' | 'touch' | 'meters' | 'feet' | 'sight' | 'special' | 'unlimited') => void
  hbRangeValue: number
  setHbRangeValue: (v: number) => void

  hbAreaShape: 'none' | 'cone' | 'sphere' | 'cylinder' | 'line' | 'cube'
  setHbAreaShape: (v: 'none' | 'cone' | 'sphere' | 'cylinder' | 'line' | 'cube') => void
  hbAreaSize: number
  setHbAreaSize: (v: number) => void
  hbAreaUnit: 'm' | 'ft'
  setHbAreaUnit: (v: 'm' | 'ft') => void

  hbDurationKind: 'instant' | 'rounds' | 'minutes' | 'hours' | 'special'
  setHbDurationKind: (v: 'instant' | 'rounds' | 'minutes' | 'hours' | 'special') => void
  hbDurationValue: number
  setHbDurationValue: (v: number) => void

  hbDamageKind: 'none' | 'dice'
  setHbDamageKind: (v: 'none' | 'dice') => void
  hbDamageCount: number
  setHbDamageCount: (v: number) => void
  hbDamageDie: 4 | 6 | 8 | 10 | 12
  setHbDamageDie: (v: 4 | 6 | 8 | 10 | 12) => void
  hbDamageBonus: number
  setHbDamageBonus: (v: number) => void

  hbCastTimeKind: SpellCastTimeKind
  setHbCastTimeKind: (v: SpellCastTimeKind) => void
  hbReactionWhen: string
  setHbReactionWhen: (v: string) => void
  hbConcentration: boolean
  setHbConcentration: (v: boolean) => void
  hbRitual: boolean
  setHbRitual: (v: boolean) => void

  hbComponents: Array<'V' | 'S' | 'M'>
  setHbComponents: (v: Array<'V' | 'S' | 'M'>) => void
  hbMaterial: string
  setHbMaterial: (v: string) => void

  hbSourceType: 'class' | 'feat'
  setHbSourceType: (v: 'class' | 'feat') => void
  hbSourceClassId: string
  setHbSourceClassId: (v: string) => void
  hbFeatName: string
  setHbFeatName: (v: string) => void
  hbFeatAbility: Attribute
  setHbFeatAbility: (v: Attribute) => void

  hbBaseClasses: string[]
  setHbBaseClasses: (v: string[]) => void

  effectiveCalcClassId: string

  addHomebrewToActive: () => void

  // Added spells
  activeCharacter: Character
  activeCharacterSchools: string[]
  activeCharacterTotalLevel: number
  filteredAddedSpells: AddedSpell[]
  spellDetails: Record<string, DndSpell | undefined>
  spellDetailsError: Record<string, string | undefined>
  ensureSpellDetailsLoaded: () => Promise<void>
  preparedMeta: {
    limitsByClassId: Record<string, number>
    preparedCountByClassId: Record<string, number>
  }
  spellTranslations: Record<string, SpellTranslation>

  addedNameFilter: string
  setAddedNameFilter: Dispatch<SetStateAction<string>>
  addedLevelFilter: MagicCircleLevel | 'any'
  setAddedLevelFilter: Dispatch<SetStateAction<MagicCircleLevel | 'any'>>
  addedSchoolFilter: string
  setAddedSchoolFilter: Dispatch<SetStateAction<string>>
  addedPreparedFilter: 'any' | 'prepared' | 'notPrepared'
  setAddedPreparedFilter: Dispatch<SetStateAction<'any' | 'prepared' | 'notPrepared'>>
  addedClassFilter: string
  setAddedClassFilter: Dispatch<SetStateAction<string>>
  hideUa: boolean
  setHideUa: Dispatch<SetStateAction<boolean>>
  openSpellIndex: string | null
  setOpenSpellIndex: Dispatch<SetStateAction<string | null>>
  openSpellTab: 'official' | 'modifiers' | 'headcanon'
  setOpenSpellTab: Dispatch<SetStateAction<'official' | 'modifiers' | 'headcanon'>>
  translateStatus: TranslateStatus
  translateOfficialToPt: (args: {
    spellIndex: string
    desc: string[]
    higher: string[]
    material?: string
  }) => Promise<void>
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  removeSpellFromActive: (spellIndex: string) => void

  // Add spells
  availableSpellRefs: DndApiRef[]
  spellListError: string | null
  unaddedSearch: string
  setUnaddedSearch: Dispatch<SetStateAction<string>>
  unaddedLevelFilter: MagicCircleLevel | 'any'
  setUnaddedLevelFilter: Dispatch<SetStateAction<MagicCircleLevel | 'any'>>
  unaddedSchoolFilter: string
  setUnaddedSchoolFilter: Dispatch<SetStateAction<string>>
  unaddedClassFilter: string
  setUnaddedClassFilter: Dispatch<SetStateAction<string>>
  unaddedResults: DndApiRef[]
  activeCharacterSpellsSet: Set<string>
  addSpellToActive: (spellRef: DndApiRef) => Promise<void>
  addSpellToActiveTranslated: (spellRef: DndApiRef) => Promise<void>
  getSpellDetailsLocal: (index: string, signal?: AbortSignal) => Promise<DndSpell>
  homebrewLibrary: Record<string, { name: string }>
}) {
  const {
    abilityShort,
    characters,
    setActiveCharacterId,
    addCharacter,
    deleteActiveCharacter,
    disableDelete,
    showOwnerBadge,
    hbName,
    setHbName,
    hbLevel,
    setHbLevel,
    hbSchool,
    setHbSchool,
    hbMechanic,
    setHbMechanic,
    hbSaveAbility,
    setHbSaveAbility,
    hbDesc,
    setHbDesc,
    hbHigher,
    setHbHigher,
    hbRangeKind,
    setHbRangeKind,
    hbRangeValue,
    setHbRangeValue,
    hbAreaShape,
    setHbAreaShape,
    hbAreaSize,
    setHbAreaSize,
    hbAreaUnit,
    setHbAreaUnit,
    hbDurationKind,
    setHbDurationKind,
    hbDurationValue,
    setHbDurationValue,
    hbDamageKind,
    setHbDamageKind,
    hbDamageCount,
    setHbDamageCount,
    hbDamageDie,
    setHbDamageDie,
    hbDamageBonus,
    setHbDamageBonus,
    hbCastTimeKind,
    setHbCastTimeKind,
    hbReactionWhen,
    setHbReactionWhen,
    hbConcentration,
    setHbConcentration,
    hbRitual,
    setHbRitual,
    hbComponents,
    setHbComponents,
    hbMaterial,
    setHbMaterial,
    hbSourceType,
    setHbSourceType,
    hbSourceClassId,
    setHbSourceClassId,
    hbFeatName,
    setHbFeatName,
    hbFeatAbility,
    setHbFeatAbility,
    hbBaseClasses,
    setHbBaseClasses,
    effectiveCalcClassId,
    addHomebrewToActive,
    activeCharacter,
    activeCharacterSchools,
    activeCharacterTotalLevel,
    filteredAddedSpells,
    spellDetails,
    spellDetailsError,
    ensureSpellDetailsLoaded,
    preparedMeta,
    spellTranslations,
    addedNameFilter,
    setAddedNameFilter,
    addedLevelFilter,
    setAddedLevelFilter,
    addedSchoolFilter,
    setAddedSchoolFilter,
    addedPreparedFilter,
    setAddedPreparedFilter,
    addedClassFilter,
    setAddedClassFilter,
    hideUa,
    setHideUa,
    openSpellIndex,
    setOpenSpellIndex,
    openSpellTab,
    setOpenSpellTab,
    translateStatus,
    translateOfficialToPt,
    updateCharacter,
    removeSpellFromActive,
    availableSpellRefs,
    spellListError,
    unaddedSearch,
    setUnaddedSearch,
    unaddedLevelFilter,
    setUnaddedLevelFilter,
    unaddedSchoolFilter,
    setUnaddedSchoolFilter,
    unaddedClassFilter,
    setUnaddedClassFilter,
    unaddedResults,
    activeCharacterSpellsSet,
    addSpellToActive,
    addSpellToActiveTranslated,
    getSpellDetailsLocal,
    homebrewLibrary,
  } = props

  const effectiveClassId = hbSourceClassId || effectiveCalcClassId || activeCharacter.classes[0]?.id

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setActiveCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={disableDelete}
        showOwnerBadge={showOwnerBadge}
      />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Criar magia (Homebrew)</div>
          <div className="mt-1 text-xs text-text">Cria uma magia personalizada e adiciona ao personagem (sincroniza junto).</div>
        </CardHeader>
        <CardContent>
          <details className="group">
            <summary className="cursor-pointer list-none select-none rounded-md border border-accentBorder bg-[color:var(--social-bg)] px-3 py-2 text-sm text-textH hover:bg-accentBg">
              Abrir criador
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div>
                <label className="text-xs text-text">Nome</label>
                <Input
                  className="mt-1"
                  value={hbName}
                  onChange={(e) => setHbName(e.target.value)}
                  placeholder="ex: Raio de Gelo Azul"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-text">Nível</label>
                  <Select className="mt-1" value={hbLevel} onChange={(e) => setHbLevel(Number(e.target.value) as MagicCircleLevel)}>
                    {magicCircleOptions().map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-text">Escola</label>
                  <Select className="mt-1" value={hbSchool} onChange={(e) => setHbSchool(e.target.value)}>
                    {Object.keys(SCHOOL_NAME_PT)
                      .sort((a, b) => schoolLabel(a).localeCompare(schoolLabel(b), 'pt-BR'))
                      .map((k) => (
                        <option key={k} value={k}>
                          {schoolLabel(k)}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-text">Alcance</label>
                  <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px]">
                    <Select value={hbRangeKind} onChange={(e) => setHbRangeKind(e.target.value as typeof hbRangeKind)}>
                      <option value="self">Pessoal</option>
                      <option value="touch">Toque</option>
                      <option value="meters">Distância (m)</option>
                      <option value="feet">Distância (ft)</option>
                      <option value="sight">Visão</option>
                      <option value="special">Especial</option>
                      <option value="unlimited">Ilimitado</option>
                    </Select>
                    <Input
                      type="number"
                      value={hbRangeKind === 'meters' || hbRangeKind === 'feet' ? hbRangeValue : ''}
                      disabled={!(hbRangeKind === 'meters' || hbRangeKind === 'feet')}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) setHbRangeValue(v)
                      }}
                      min={hbRangeKind === 'feet' ? 5 : 1.5}
                      max={9999}
                      step={hbRangeKind === 'feet' ? 5 : 1.5}
                      placeholder="ex: 18"
                      title="Valor do alcance (quando aplicável)"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text">Área</label>
                  <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_84px]">
                    <Select value={hbAreaShape} onChange={(e) => setHbAreaShape(e.target.value as typeof hbAreaShape)}>
                      <option value="none">(sem área)</option>
                      <option value="cone">Cone</option>
                      <option value="sphere">Esfera</option>
                      <option value="cylinder">Cilindro</option>
                      <option value="line">Linha</option>
                      <option value="cube">Cubo</option>
                    </Select>
                    <Input
                      type="number"
                      value={hbAreaShape === 'none' ? '' : hbAreaSize}
                      disabled={hbAreaShape === 'none'}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) setHbAreaSize(v)
                      }}
                      min={hbAreaUnit === 'ft' ? 5 : 1.5}
                      max={9999}
                      step={hbAreaUnit === 'ft' ? 5 : 1.5}
                      placeholder="ex: 6"
                      title="Tamanho da área (quando aplicável)"
                    />
                    <Select
                      value={hbAreaUnit}
                      onChange={(e) => setHbAreaUnit(e.target.value as typeof hbAreaUnit)}
                      disabled={hbAreaShape === 'none'}
                      title="Unidade"
                    >
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                  <label className="text-xs text-text">Duração</label>
                  <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px]">
                    <Select value={hbDurationKind} onChange={(e) => setHbDurationKind(e.target.value as typeof hbDurationKind)}>
                      <option value="instant">Instantânea</option>
                      <option value="rounds">Rodadas</option>
                      <option value="minutes">Minutos</option>
                      <option value="hours">Horas</option>
                      <option value="special">Especial</option>
                    </Select>
                    <Input
                      type="number"
                      value={hbDurationKind === 'rounds' || hbDurationKind === 'minutes' || hbDurationKind === 'hours' ? hbDurationValue : ''}
                      disabled={!(hbDurationKind === 'rounds' || hbDurationKind === 'minutes' || hbDurationKind === 'hours')}
                      onChange={(e) => setHbDurationValue(Number(e.target.value))}
                      min={1}
                      max={9999}
                      placeholder="ex: 1"
                      title="Valor da duração (quando aplicável)"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text">Conjuração</label>
                  <Select
                    className="mt-1"
                    value={hbCastTimeKind}
                    onChange={(e) => {
                      const next = e.target.value as SpellCastTimeKind
                      setHbCastTimeKind(next)
                      if (next !== 'reaction') setHbReactionWhen('')
                    }}
                  >
                    <option value="action">Ação</option>
                    <option value="bonus">Bônus</option>
                    <option value="reaction">Reação</option>
                  </Select>

                  {hbCastTimeKind === 'reaction' ? (
                    <div className="mt-2">
                      <div className="text-xs text-text">Quando (reação)</div>
                      <Input
                        className="mt-1"
                        value={hbReactionWhen}
                        onChange={(e) => setHbReactionWhen(e.target.value)}
                        placeholder="ex: quando você for atingido por um ataque…"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs text-text">Concentração</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={hbConcentration} onChange={(e) => setHbConcentration(e.target.checked)} />
                    <span className="text-xs text-text">Exige concentração</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text">Ritual</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={hbRitual} onChange={(e) => setHbRitual(e.target.checked)} />
                    <span className="text-xs text-text">Pode ser conjurada como ritual</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-text">Componentes</label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {(['V', 'S', 'M'] as const).map((comp) => {
                    const checked = hbComponents.includes(comp)
                    return (
                      <label key={comp} className="flex items-center gap-2 text-xs text-text">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked
                            const set = new Set(hbComponents)
                            if (nextChecked) set.add(comp)
                            else set.delete(comp)
                            const next = Array.from(set) as Array<'V' | 'S' | 'M'>
                            setHbComponents(next)
                            if (comp === 'M' && !nextChecked) setHbMaterial('')
                          }}
                        />
                        <span>{comp}</span>
                      </label>
                    )
                  })}
                </div>

                {hbComponents.includes('M') ? (
                  <div className="mt-2">
                    <Input
                      className="mt-1"
                      value={hbMaterial}
                      onChange={(e) => setHbMaterial(e.target.value)}
                      placeholder="Material (ex: um pedaço de fio de cobre…)"
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-text">Dano (base)</label>
                  <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-[1fr_88px_88px_88px]">
                    <Select value={hbDamageKind} onChange={(e) => setHbDamageKind(e.target.value as typeof hbDamageKind)} title="Tipo de dano base">
                      <option value="none">(sem dano)</option>
                      <option value="dice">Dados</option>
                    </Select>
                    <Input
                      type="number"
                      value={hbDamageKind === 'dice' ? hbDamageCount : ''}
                      disabled={hbDamageKind !== 'dice'}
                      onChange={(e) => setHbDamageCount(Number(e.target.value))}
                      min={0}
                      max={99}
                      placeholder="Qtd"
                      title="Quantidade de dados"
                    />
                    <Select
                      value={String(hbDamageDie)}
                      disabled={hbDamageKind !== 'dice'}
                      onChange={(e) => setHbDamageDie(Number(e.target.value) as 4 | 6 | 8 | 10 | 12)}
                      title="Tamanho do dado"
                    >
                      <option value="4">d4</option>
                      <option value="6">d6</option>
                      <option value="8">d8</option>
                      <option value="10">d10</option>
                      <option value="12">d12</option>
                    </Select>
                    <Input
                      type="number"
                      value={hbDamageKind === 'dice' ? hbDamageBonus : ''}
                      disabled={hbDamageKind !== 'dice'}
                      onChange={(e) => setHbDamageBonus(Number(e.target.value))}
                      min={0}
                      max={999}
                      placeholder="+0"
                      title="Bônus fixo (opcional)"
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-text">
                    Usado só para estimativa de dano (ex.: 2d6+3).
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text">Mecânica</label>
                  <Select className="mt-1" value={hbMechanic} onChange={(e) => setHbMechanic(e.target.value as HomebrewSpellMechanic)}>
                    <option value="none">Nenhuma</option>
                    <option value="attack">Ataque</option>
                    <option value="save">Teste de resistência</option>
                    <option value="both">Ataque + Teste</option>
                  </Select>
                </div>
              </div>

              {hbMechanic === 'save' || hbMechanic === 'both' ? (
                <div>
                  <label className="text-xs text-text">Resistência (atributo)</label>
                  <Select className="mt-1" value={hbSaveAbility} onChange={(e) => setHbSaveAbility(e.target.value as Attribute)}>
                    {ABILITIES.map(({ key }) => (
                      <option key={key} value={key}>
                        {abilityShort(key)}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div>
                <label className="text-xs text-text">Fonte</label>
                <Select className="mt-1" value={hbSourceType} onChange={(e) => setHbSourceType(e.target.value as 'class' | 'feat')}>
                  <option value="class">Classe</option>
                  <option value="feat">Feat</option>
                </Select>
              </div>

              <div>
                <label className="text-xs text-text">Classes base</label>
                <div className="mt-1 text-[11px] text-text">Define quais classes têm essa magia na lista (coluna “Classes”).</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {(
                    [
                      'artificer',
                      'barbarian',
                      'bard',
                      'cleric',
                      'druid',
                      'fighter',
                      'monk',
                      'paladin',
                      'ranger',
                      'rogue',
                      'sorcerer',
                      'warlock',
                      'wizard',
                    ] as const
                  ).map((idx) => {
                    const checked = hbBaseClasses.includes(idx)
                    const label = apiClassLabel({ index: idx, name: idx, url: '' })
                    return (
                      <label key={idx} className="flex items-center gap-2 text-xs text-text">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked
                            const set = new Set(hbBaseClasses)
                            if (nextChecked) set.add(idx)
                            else set.delete(idx)
                            setHbBaseClasses(Array.from(set).sort())
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {hbSourceType === 'class' ? (
                <div>
                  <label className="text-xs text-text">Conjurar como (classe)</label>
                  <Select
                    className="mt-1"
                    value={effectiveClassId}
                    onChange={(e) => setHbSourceClassId(e.target.value)}
                    disabled={activeCharacter.classes.length === 0}
                  >
                    {activeCharacter.classes.length === 0 ? (
                      <option value="">Adicione uma classe primeiro</option>
                    ) : (
                      activeCharacter.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {classDisplayName(c)}
                        </option>
                      ))
                    )}
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-text">Nome do feat</label>
                    <Input
                      className="mt-1"
                      value={hbFeatName}
                      onChange={(e) => setHbFeatName(e.target.value)}
                      placeholder="ex: Fey Touched"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text">Atributo do feat</label>
                    <Select className="mt-1" value={hbFeatAbility} onChange={(e) => setHbFeatAbility(e.target.value as Attribute)}>
                      {ABILITIES.map(({ key }) => (
                        <option key={key} value={key}>
                          {abilityShort(key)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-text">Descrição</label>
                <Textarea className="mt-1" value={hbDesc} onChange={(e) => setHbDesc(e.target.value)} placeholder="Opcional. Texto livre." />
              </div>

              <div>
                <label className="text-xs text-text">Em níveis superiores</label>
                <Textarea
                  className="mt-1"
                  value={hbHigher}
                  onChange={(e) => setHbHigher(e.target.value)}
                  placeholder="Opcional. Se preencher, aparece badge de upcast."
                />
              </div>

              <Button size="sm" variant="primary" onClick={addHomebrewToActive} disabled={!hbName.trim()} title={!hbName.trim() ? 'Preencha o nome' : 'Adicionar magia homebrew'}>
                Adicionar homebrew
              </Button>
            </div>
          </details>
        </CardContent>
      </Card>

      <AddedSpellsCard
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
      />

      <AddSpellsCard
        spellList={availableSpellRefs.length ? availableSpellRefs : null}
        spellListError={spellListError}
        unaddedSearch={unaddedSearch}
        setUnaddedSearch={setUnaddedSearch}
        unaddedLevelFilter={unaddedLevelFilter}
        setUnaddedLevelFilter={setUnaddedLevelFilter}
        unaddedSchoolFilter={unaddedSchoolFilter}
        setUnaddedSchoolFilter={setUnaddedSchoolFilter}
        unaddedClassFilter={unaddedClassFilter}
        setUnaddedClassFilter={setUnaddedClassFilter}
        hideUa={hideUa}
        setHideUa={setHideUa}
        unaddedResults={unaddedResults}
        activeCharacter={activeCharacter}
        activeCharacterSpellsSet={activeCharacterSpellsSet}
        addSpellToActive={addSpellToActive}
        addSpellToActiveTranslated={addSpellToActiveTranslated}
        translateStatus={translateStatus}
        getSpellDetails={getSpellDetailsLocal}
        homebrewLibrary={homebrewLibrary as any}
        spellTranslations={spellTranslations}
      />
    </div>
  )
}
