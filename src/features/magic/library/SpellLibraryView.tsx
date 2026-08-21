import { useEffect, useMemo, useState, type ReactNode } from "react"

import {
  getCachedAllOfficialSpellSummaries,
  getOfficialSpell,
  queryAllOfficialSpellSummaries,
  type SpellCompendiumSummary,
} from "../../../api/spell-compendium"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import {
  CASTING_TIME_NAMES,
  CLASS_NAMES,
  MAGIC_SCHOOLS_MAP,
  SPELL_CLASS_OPTIONS,
} from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import { SpellCreatorModule } from "../spellCreator/spellCreatorModule"

export type SpellLibraryRecord = {
  index: string
  owned: boolean
  updatedAt?: string
  campaignNames?: string[]
  characterNames?: string[]
}

type LibrarySpell = Spell | SpellCompendiumSummary
type SourceFilter = "all" | "official" | "owned" | "campaign" | "character" | "homebrew"
type BooleanFilter = "all" | "yes" | "no"
type LevelFilter = "all" | `${number}`
type ClassFilter = "all" | ClassName
type CastingTimeFilter = "all" | "action" | "bonusAction" | "reaction" | "minute" | "hour" | "special"
type SortMode = "level-name" | "name" | "recent"

type Props = {
  variant: "user" | "session"
  records: SpellLibraryRecord[]
  loading?: boolean
  errorMessage?: string
  onEditorOpen?: (spell: Spell | null) => void
  creatorPrelude?: ReactNode
  prepareSpellForSave?: (spell: Spell) => Spell
}

export function SpellLibraryView({
  variant,
  records,
  loading = false,
  errorMessage = "",
  onEditorOpen,
  creatorPrelude,
  prepareSpellForSave,
}: Props) {
  const { spells, saveSpell, deleteSpell } = useMagicContext()
  const initialOfficialPage = getCachedAllOfficialSpellSummaries()
  const [query, setQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [classFilter, setClassFilter] = useState<ClassFilter>("all")
  const [concentrationFilter, setConcentrationFilter] = useState<BooleanFilter>("all")
  const [ritualFilter, setRitualFilter] = useState<BooleanFilter>("all")
  const [attackFilter, setAttackFilter] = useState<BooleanFilter>("all")
  const [saveFilter, setSaveFilter] = useState<BooleanFilter>("all")
  const [castingTimeFilter, setCastingTimeFilter] = useState<CastingTimeFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("level-name")
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null)
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [officialSummaries, setOfficialSummaries] = useState<SpellCompendiumSummary[]>(
    () => initialOfficialPage?.spells ?? [],
  )
  const [officialTotal, setOfficialTotal] = useState(
    () => initialOfficialPage?.total ?? 0,
  )
  const [officialLoading, setOfficialLoading] = useState(false)
  const [officialError, setOfficialError] = useState("")

  const isSession = variant === "session"
  const recordByIndex = useMemo(
    () => new Map(records.map((record) => [record.index, record])),
    [records],
  )
  const homebrewSpells = useMemo(
    () => spells.filter((spell) => spell.homebrew),
    [spells],
  )

  useEffect(() => {
    if (sourceFilter !== "all" && sourceFilter !== "official") {
      setOfficialSummaries([])
      setOfficialTotal(0)
      setOfficialLoading(false)
      return
    }

    const isDefaultQuery =
      !query.trim() &&
      levelFilter === "all" &&
      classFilter === "all" &&
      schoolFilter === "all" &&
      concentrationFilter === "all" &&
      ritualFilter === "all" &&
      attackFilter === "all" &&
      saveFilter === "all" &&
      castingTimeFilter === "all"

    if (isDefaultQuery) {
      const cached = getCachedAllOfficialSpellSummaries()
      if (cached) {
        setOfficialSummaries(cached.spells)
        setOfficialTotal(cached.total)
        setOfficialLoading(false)
        setOfficialError("")
        return
      }
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setOfficialLoading(true)
      setOfficialError("")
      void queryAllOfficialSpellSummaries({
        q: query.trim() || undefined,
        level: levelFilter === "all" ? undefined : Number(levelFilter),
        className: classFilter === "all" ? undefined : classFilter,
        school: schoolFilter === "all" ? undefined : schoolFilter,
        concentration: booleanFilterValue(concentrationFilter),
        ritual: booleanFilterValue(ritualFilter),
        attack: booleanFilterValue(attackFilter),
        save: booleanFilterValue(saveFilter),
        castingTime: castingTimeFilter === "all" ? undefined : castingTimeFilter,
      })
        .then((page) => {
          if (cancelled) return
          setOfficialSummaries(page.spells)
          setOfficialTotal(page.total)
        })
        .catch(() => {
          if (cancelled) return
          setOfficialSummaries([])
          setOfficialTotal(0)
          setOfficialError("Não foi possível consultar o compêndio oficial de magias.")
        })
        .finally(() => {
          if (!cancelled) setOfficialLoading(false)
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [
    attackFilter,
    castingTimeFilter,
    classFilter,
    concentrationFilter,
    levelFilter,
    query,
    ritualFilter,
    saveFilter,
    schoolFilter,
    sourceFilter,
  ])

  const filteredHomebrew = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    return homebrewSpells.filter((spell) => {
      const record = recordByIndex.get(spell.index)
      const campaignNames = record?.campaignNames ?? []
      const characterNames = record?.characterNames ?? []
      const owned = Boolean(record?.owned)
      const sourceMatches = (() => {
        if (sourceFilter === "official") return false
        if (sourceFilter === "all" || sourceFilter === "homebrew") return true
        if (sourceFilter === "owned") return owned
        if (sourceFilter === "campaign") return campaignNames.length > 0
        return characterNames.length > 0
      })()
      if (!sourceMatches) return false

      const searchableText = normalizeSearch(
        [
          spell.displayName,
          spell.name,
          spell.description,
          spell.higherLevelText,
          MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school,
          ...spell.classes.map((className) => CLASS_NAMES[className]),
          ...campaignNames,
          ...characterNames,
        ]
          .filter(Boolean)
          .join(" "),
      )

      return (
        (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
        (levelFilter === "all" || spell.slotLevel === Number(levelFilter)) &&
        (schoolFilter === "all" || spell.school === schoolFilter) &&
        (classFilter === "all" || spell.classes.includes(classFilter)) &&
        matchesBoolean(concentrationFilter, spell.concentration) &&
        matchesBoolean(ritualFilter, spell.ritual) &&
        matchesBoolean(attackFilter, spell.targeting.hasAttackRoll) &&
        matchesBoolean(saveFilter, spell.targeting.hasSavingThrow) &&
        (castingTimeFilter === "all" || spell.castingTime.type === castingTimeFilter)
      )
    })
  }, [
    attackFilter,
    castingTimeFilter,
    classFilter,
    concentrationFilter,
    homebrewSpells,
    levelFilter,
    query,
    recordByIndex,
    ritualFilter,
    saveFilter,
    schoolFilter,
    sourceFilter,
  ])

  const filteredSpells = useMemo<LibrarySpell[]>(() => {
    const result: LibrarySpell[] = [...officialSummaries, ...filteredHomebrew]
    return result.sort((left, right) => {
      if (sortMode === "name") return spellName(left).localeCompare(spellName(right), "pt-BR")
      if (sortMode === "recent") {
        const dateDifference = (recordByIndex.get(right.index)?.updatedAt ?? "").localeCompare(
          recordByIndex.get(left.index)?.updatedAt ?? "",
        )
        if (dateDifference !== 0) return dateDifference
      }
      const levelDifference = left.slotLevel - right.slotLevel
      return levelDifference !== 0
        ? levelDifference
        : spellName(left).localeCompare(spellName(right), "pt-BR")
    })
  }, [filteredHomebrew, officialSummaries, recordByIndex, sortMode])

  const availableSchools = useMemo(
    () =>
      Object.keys(MAGIC_SCHOOLS_MAP)
        .map((school) => ({ value: school, label: MAGIC_SCHOOLS_MAP[school] ?? school }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [],
  )

  const ownedCount = records.filter((record) => record.owned).length
  const campaignCount = records.filter((record) => record.campaignNames?.length).length
  const characterCount = records.filter((record) => record.characterNames?.length).length
  const visibleTotal = officialTotal + filteredHomebrew.length

  function clearFilters() {
    setQuery("")
    setSourceFilter("all")
    setLevelFilter("all")
    setSchoolFilter("all")
    setClassFilter("all")
    setConcentrationFilter("all")
    setRitualFilter("all")
    setAttackFilter("all")
    setSaveFilter("all")
    setCastingTimeFilter("all")
    setSortMode("level-name")
  }

  function openCreate() {
    setEditingSpell(null)
    onEditorOpen?.(null)
    setCreatorOpen(true)
  }

  function openEdit(spell: Spell) {
    if (!recordByIndex.get(spell.index)?.owned) return
    setEditingSpell(spell)
    onEditorOpen?.(spell)
    setCreatorOpen(true)
  }

  function closeCreator() {
    setEditingSpell(null)
    setCreatorOpen(false)
  }

  function removeSpell(spell: Spell) {
    if (!recordByIndex.get(spell.index)?.owned) return
    const verb = isSession ? "Remover" : "Arquivar"
    const consequence = isSession
      ? "Ela deixará de fazer parte da biblioteca desta sessão."
      : "A magia deixará de aparecer na biblioteca, mas o histórico será preservado."
    if (window.confirm(`${verb} “${spellName(spell)}”? ${consequence}`)) deleteSpell(spell.index)
  }

  async function openDetails(spell: LibrarySpell) {
    setDetailError("")
    if (isFullSpell(spell)) {
      setViewingSpell(spell)
      return
    }

    setDetailLoading(true)
    try {
      setViewingSpell(await getOfficialSpell(spell.index))
    } catch {
      setDetailError("Não foi possível carregar os detalhes desta magia.")
    } finally {
      setDetailLoading(false)
    }
  }

  const combinedError = [errorMessage, officialError, detailError].filter(Boolean).join(" ")
  const combinedLoading = loading || officialLoading

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-textH">
              {isSession ? "Biblioteca de magias da sessão" : "Biblioteca de magias"}
            </h1>
            <p className="mt-1 text-sm text-textMuted">
              {isSession
                ? "Consulte magias oficiais e homebrew desta sessão. A inclusão em personagens é feita na aba Magias da ficha."
                : "Consulte magias oficiais e homebrew. A inclusão em personagens agora é feita na aba Magias da ficha."}
            </p>
          </div>
          <Button onClick={openCreate}>Criar magia homebrew</Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <LibraryBadge label={`${visibleTotal} disponíveis`} />
          <LibraryBadge label={`${ownedCount} ${isSession ? "da sessão" : "próprias"}`} />
          {!isSession ? <LibraryBadge label={`${campaignCount} de campanhas`} /> : null}
          {!isSession ? <LibraryBadge label={`${characterCount} em personagens`} /> : null}
        </div>

        {combinedLoading ? <p className="mt-3 text-xs text-textMuted">Carregando magias...</p> : null}
        {combinedError ? (
          <p className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{combinedError}</p>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-textH">Filtros</div>
              <div className="mt-1 text-xs text-textMuted">{filteredSpells.length} de {visibleTotal} magias exibidas.</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={clearFilters}>Limpar</Button>
              <Button size="sm" variant="secondary" onClick={() => setAdvancedOpen((current) => !current)}>
                {advancedOpen ? "Ocultar avançados" : "Mostrar avançados"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input value={query} placeholder="Nome, descrição, escola..." onChange={(event) => setQuery(event.target.value)} />
            <FilterSelect value={sourceFilter} onChange={setSourceFilter}>
              <option value="all">Todas as origens</option>
              <option value="official">Oficiais</option>
              <option value="homebrew">Todas homebrew</option>
              <option value="owned">{isSession ? "Homebrew da sessão" : "Minhas homebrew"}</option>
              {!isSession ? <option value="campaign">Homebrew de campanha</option> : null}
              {!isSession ? <option value="character">Usadas em personagens</option> : null}
            </FilterSelect>
            <FilterSelect value={levelFilter} onChange={setLevelFilter}>
              <option value="all">Todos os níveis</option>
              <option value="0">Truques</option>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                <option key={level} value={level}>{level}º nível</option>
              ))}
            </FilterSelect>
            <FilterSelect value={schoolFilter} onChange={setSchoolFilter}>
              <option value="all">Todas as escolas</option>
              {availableSchools.map((school) => <option key={school.value} value={school.value}>{school.label}</option>)}
            </FilterSelect>
          </div>

          {advancedOpen ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FilterSelect value={classFilter} onChange={setClassFilter}>
                <option value="all">Todas as classes</option>
                {SPELL_CLASS_OPTIONS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </FilterSelect>
              <FilterSelect value={concentrationFilter} onChange={setConcentrationFilter}>
                <option value="all">Concentração: qualquer</option><option value="yes">Com concentração</option><option value="no">Sem concentração</option>
              </FilterSelect>
              <FilterSelect value={ritualFilter} onChange={setRitualFilter}>
                <option value="all">Ritual: qualquer</option><option value="yes">Apenas rituais</option><option value="no">Sem ritual</option>
              </FilterSelect>
              <FilterSelect value={castingTimeFilter} onChange={setCastingTimeFilter}>
                <option value="all">Qualquer conjuração</option><option value="action">Ação</option><option value="bonusAction">Ação bônus</option><option value="reaction">Reação</option><option value="minute">Minuto</option><option value="hour">Hora</option><option value="special">Especial</option>
              </FilterSelect>
              <FilterSelect value={attackFilter} onChange={setAttackFilter}>
                <option value="all">Ataque: qualquer</option><option value="yes">Exige ataque</option><option value="no">Sem ataque</option>
              </FilterSelect>
              <FilterSelect value={saveFilter} onChange={setSaveFilter}>
                <option value="all">Salvaguarda: qualquer</option><option value="yes">Exige salvaguarda</option><option value="no">Sem salvaguarda</option>
              </FilterSelect>
              <FilterSelect value={sortMode} onChange={setSortMode}>
                <option value="level-name">Ordenar por nível</option><option value="name">Ordenar por nome</option><option value="recent">Homebrew mais recentes</option>
              </FilterSelect>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {!filteredSpells.length && !combinedLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-bg p-6 text-center text-sm text-textMuted">Nenhuma magia corresponde aos filtros.</div>
        ) : null}
        {filteredSpells.map((spell) => {
          const record = recordByIndex.get(spell.index)
          const owned = Boolean(record?.owned)
          const fullSpell = isFullSpell(spell) ? spell : null
          return (
            <article key={spell.index} className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openDetails(spell)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-textH">{spellName(spell)}</h2>
                    <LibraryBadge label={formatLevel(spell.slotLevel)} />
                    <LibraryBadge label={schoolLabel(String(spell.school))} />
                    {!spell.homebrew ? <LibraryBadge label="Oficial" /> : owned ? <LibraryBadge label={isSession ? "Homebrew da sessão" : "Sua homebrew"} /> : <LibraryBadge label="Homebrew compartilhada" />}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-textMuted">
                    <span>{formatCastingTime(spell)}</span><span>{formatRange(spell)}</span><span>{formatDuration(spell)}</span><span>{formatComponents(spell)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    {spell.concentration ? <LibraryBadge label="Concentração" /> : null}
                    {spell.ritual ? <LibraryBadge label="Ritual" /> : null}
                    {spell.targeting.hasAttackRoll ? <LibraryBadge label="Ataque" /> : null}
                    {spell.targeting.hasSavingThrow ? <LibraryBadge label="Salvaguarda" /> : null}
                    {spell.classes.map((className) => <LibraryBadge key={className} label={CLASS_NAMES[className]} />)}
                    {record?.campaignNames?.map((name) => <LibraryBadge key={`campaign-${name}`} label={name} />)}
                    {record?.characterNames?.map((name) => <LibraryBadge key={`character-${name}`} label={`Personagem: ${name}`} />)}
                  </div>
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-text">{spell.description?.trim() || "Sem descrição."}</p>
                </button>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="secondary" loading={detailLoading} onClick={() => void openDetails(spell)}>Ver detalhes</Button>
                  {owned && fullSpell ? <Button size="sm" variant="secondary" onClick={() => openEdit(fullSpell)}>Editar</Button> : null}
                  {owned && fullSpell ? <Button size="sm" variant="danger" onClick={() => removeSpell(fullSpell)}>{isSession ? "Remover" : "Arquivar"}</Button> : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {creatorOpen ? (
        <ModalFrame title={editingSpell ? "Editar magia" : "Criar magia homebrew"} onClose={closeCreator}>
          {creatorPrelude}
          <SpellCreatorModule
            editingSpell={editingSpell}
            saveSpell={(spell) => {
              saveSpell(prepareSpellForSave ? prepareSpellForSave(spell) : spell)
              closeCreator()
            }}
          />
        </ModalFrame>
      ) : null}

      {viewingSpell ? (
        <ModalFrame title={spellName(viewingSpell)} onClose={() => setViewingSpell(null)}>
          <SpellDetails spell={viewingSpell} />
        </ModalFrame>
      ) : null}
    </div>
  )
}

function SpellDetails({ spell }: { spell: Spell }) {
  return (
    <div className="grid gap-5 text-sm text-text">
      <div className="flex flex-wrap gap-2 text-xs"><LibraryBadge label={formatLevel(spell.slotLevel)} /><LibraryBadge label={schoolLabel(String(spell.school))} />{spell.concentration ? <LibraryBadge label="Concentração" /> : null}{spell.ritual ? <LibraryBadge label="Ritual" /> : null}</div>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Tempo de conjuração" value={formatCastingTime(spell)} /><Info label="Alcance" value={formatRange(spell)} /><Info label="Duração" value={formatDuration(spell)} /><Info label="Componentes" value={formatComponents(spell)} /><Info label="Classes" value={spell.classes.map((entry) => CLASS_NAMES[entry]).join(", ") || "Nenhuma"} /><Info label="Alvo" value={formatTargeting(spell)} /><Info label="Área" value={formatArea(spell)} /><Info label="Rolagens" value={spell.rollMode.join(", ") || "Nenhuma"} /><Info label="Dano" value={spell.damageDice ? `${spell.damageDice.quantity}${spell.damageDice.sides}` : "Nenhum"} />
      </section>
      {spell.material?.trim() ? <Info label="Material" value={spell.material} /> : null}
      <section><h3 className="font-semibold text-textH">Descrição</h3><div className="mt-2 whitespace-pre-wrap leading-6">{spell.description?.trim() || "Sem descrição."}</div></section>
      <section><h3 className="font-semibold text-textH">Em níveis superiores</h3><div className="mt-2 whitespace-pre-wrap leading-6">{spell.higherLevelText?.trim() || "Sem efeito adicional."}</div></section>
      {spell.headcanon?.trim() ? <section><h3 className="font-semibold text-textH">Descrição personalizada</h3><div className="mt-2 whitespace-pre-wrap leading-6">{spell.headcanon}</div></section> : null}
    </div>
  )
}

function isFullSpell(spell: LibrarySpell): spell is Spell {
  return "higherLevelText" in spell && "effects" in spell
}
function booleanFilterValue(filter: BooleanFilter): boolean | undefined { return filter === "all" ? undefined : filter === "yes" }
function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true"><div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-bg shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg p-4"><h2 className="text-lg font-semibold text-textH">{title}</h2><Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button></div><div className="grid gap-4 p-4">{children}</div></div></div> }
function FilterSelect<T extends string>({ value, onChange, children }: { value: T; onChange: (value: T) => void; children: ReactNode }) { return <select className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent" value={value} onChange={(event) => onChange(event.target.value as T)}>{children}</select> }
function LibraryBadge({ label }: { label: string }) { return <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-textH">{label}</span> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-bg-subtle p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</div><div className="mt-1 text-sm text-textH">{value}</div></div> }
function matchesBoolean(filter: BooleanFilter, value: boolean): boolean { return filter === "all" || (filter === "yes" ? value : !value) }
function normalizeSearch(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() }
function spellName(spell: LibrarySpell): string { return spell.displayName?.trim() || spell.name }
function schoolLabel(school: string): string { return MAGIC_SCHOOLS_MAP[school] ?? school }
function formatLevel(level: number): string { return level === 0 ? "Truque" : `${level}º nível` }
function formatCastingTime(spell: LibrarySpell): string { const label = CASTING_TIME_NAMES[spell.castingTime.type] ?? spell.castingTime.type; const amount = spell.castingTime.value || 1; if (spell.castingTime.type === "reaction" && spell.castingTime.reactionWhen) return `${label}: ${spell.castingTime.reactionWhen}`; if (spell.castingTime.type === "special" && spell.castingTime.special) return spell.castingTime.special; return amount === 1 ? label : `${amount} ${label.toLocaleLowerCase("pt-BR")}` }
function formatRange(spell: LibrarySpell): string { const labels: Record<string, string> = { self: "Pessoal", touch: "Toque", point: "Ponto", target: "Alvo", ally: "Aliado", enemy: "Inimigo" }; const origin = labels[spell.range.origin] ?? spell.range.origin; return spell.range.distance > 0 ? `${origin}, ${spell.range.distance} m` : origin }
function formatDuration(spell: LibrarySpell): string { const labels: Record<string, string> = { instantaneous: "Instantânea", round: "rodada", minute: "minuto", hour: "hora", day: "dia", permanent: "Permanente", special: "Especial" }; const label = labels[spell.duration.unit] ?? spell.duration.unit; return spell.duration.value <= 0 ? label : `${spell.duration.value} ${label}${spell.duration.value === 1 ? "" : "s"}` }
function formatComponents(spell: LibrarySpell): string { if (!spell.components.length) return "Sem componentes"; const components = spell.components.join(", "); return spell.material?.trim() ? `${components} (${spell.material})` : components }
function formatTargeting(spell: Spell): string { const labels: Record<string, string> = { self: "Pessoal", "single-creature": "Uma criatura", "multiple-creatures": "Múltiplas criaturas", area: "Área", object: "Objeto", special: "Especial" }; const base = labels[spell.targeting.kind] ?? spell.targeting.kind; return spell.targeting.targetCount && spell.targeting.targetCount > 1 ? `${base} (${spell.targeting.targetCount})` : base }
function formatArea(spell: Spell): string { const area = spell.range.area; if (!area && !spell.targeting.affectsArea) return "Nenhuma"; const shape = area?.shape ?? spell.targeting.areaShape ?? "área"; const size = area?.size ?? spell.targeting.areaSize; const labels: Record<string, string> = { circle: "Círculo", square: "Quadrado", cone: "Cone", line: "Linha" }; return size ? `${labels[shape] ?? shape}, ${size} m` : labels[shape] ?? shape }
