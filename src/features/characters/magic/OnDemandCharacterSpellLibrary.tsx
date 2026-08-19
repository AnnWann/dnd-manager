import { useEffect, useMemo, useState } from "react"

import { getOfficialSpell, queryOfficialSpells, type SpellCompendiumSummary } from "../../../api/spell-compendium"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { CLASS_NAMES, MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSourceType } from "../../../models/magic/spells/spellDefinitions"
import type { ClassName } from "../../../models/sheet/Class"

type SourceChoice = "" | "feat" | "ability" | `class:${ClassName}`
type OriginFilter = "all" | "official" | "homebrew"
type LevelFilter = "all" | `${number}`
type ClassFilter = "all" | ClassName

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  onSpellAdded?: (spell: Spell) => void
  onCancel?: () => void
}

type CatalogEntry = Spell | SpellCompendiumSummary

export function OnDemandCharacterSpellLibrary({
  character,
  updateCharacter,
  onSpellAdded,
  onCancel,
}: Props) {
  const { savedSpells } = useMagicContext()
  const [query, setQuery] = useState("")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [classFilter, setClassFilter] = useState<ClassFilter>("all")
  const [concentrationOnly, setConcentrationOnly] = useState(false)
  const [official, setOfficial] = useState<SpellCompendiumSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null)
  const [selectedSource, setSelectedSource] = useState<SourceChoice>("")
  const [extendedList, setExtendedList] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const knownSpellIds = useMemo(
    () => new Set((character.get("magic")?.spells.knownSpells ?? []).map((entry) => entry.spells.id)),
    [character],
  )

  useEffect(() => {
    if (originFilter === "homebrew") {
      setOfficial([])
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setLoadError("")
      void queryOfficialSpells({
        q: query.trim() || undefined,
        level: levelFilter === "all" ? undefined : Number(levelFilter),
        className: classFilter === "all" ? undefined : classFilter,
        school: schoolFilter === "all" ? undefined : schoolFilter,
        concentration: concentrationOnly ? true : undefined,
        page: 1,
        pageSize: 100,
      })
        .then((page) => {
          if (!cancelled) setOfficial(page.spells)
        })
        .catch(() => {
          if (!cancelled) setLoadError("Não foi possível consultar o compêndio oficial.")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [classFilter, concentrationOnly, levelFilter, originFilter, query, schoolFilter])

  const homebrew = useMemo(() => {
    const normalized = normalizeSearch(query)
    return savedSpells.filter((spell) => {
      if (!spell.homebrew || knownSpellIds.has(spell.index)) return false
      return (
        (!normalized || normalizeSearch(`${spell.displayName ?? ""} ${spell.name} ${spell.description}`).includes(normalized)) &&
        (levelFilter === "all" || spell.slotLevel === Number(levelFilter)) &&
        (schoolFilter === "all" || spell.school === schoolFilter) &&
        (classFilter === "all" || spell.classes.includes(classFilter)) &&
        (!concentrationOnly || spell.concentration)
      )
    })
  }, [classFilter, concentrationOnly, knownSpellIds, levelFilter, query, savedSpells, schoolFilter])

  const available = useMemo<CatalogEntry[]>(() => {
    const entries: CatalogEntry[] = []
    if (originFilter !== "homebrew") entries.push(...official.filter((spell) => !knownSpellIds.has(spell.index)))
    if (originFilter !== "official") entries.push(...homebrew)
    return entries.toSorted((left, right) =>
      left.slotLevel - right.slotLevel || spellName(left).localeCompare(spellName(right), "pt-BR"),
    )
  }, [homebrew, knownSpellIds, official, originFilter])

  const schools = useMemo(() =>
    Object.keys(MAGIC_SCHOOLS_MAP).map((value) => ({ value, label: MAGIC_SCHOOLS_MAP[value] ?? value })),
  [])

  async function resolveEntry(entry: CatalogEntry): Promise<Spell> {
    if ("higherLevelText" in entry) return entry
    return getOfficialSpell(entry.index)
  }

  async function openDetails(entry: CatalogEntry) {
    setLoadError("")
    try {
      setViewingSpell(await resolveEntry(entry))
    } catch {
      setLoadError("Não foi possível carregar os detalhes da magia.")
    }
  }

  async function openAdd(entry: CatalogEntry) {
    setLoadError("")
    try {
      const spell = await resolveEntry(entry)
      setSelectedSpell(spell)
      setSelectedSource("")
      setExtendedList(false)
      setErrorMessage("")
    } catch {
      setLoadError("Não foi possível carregar a magia selecionada.")
    }
  }

  function closeAdd() {
    setSelectedSpell(null)
    setSelectedSource("")
    setExtendedList(false)
    setErrorMessage("")
  }

  const selectedClassName = selectedSource.startsWith("class:")
    ? selectedSource.slice(6) as ClassName
    : undefined
  const selectedClass = selectedClassName
    ? character.get("sheet").classes?.find((entry) => entry.className === selectedClassName)
    : undefined
  const outsideSelectedClassList = Boolean(
    selectedSpell && selectedClassName && !selectedSpell.classes.includes(selectedClassName),
  )

  function addSelectedSpell() {
    if (!selectedSpell || !selectedSource) return
    if (outsideSelectedClassList && !extendedList) {
      setErrorMessage(`Esta magia não pertence à lista de ${selectedClassName ? CLASS_NAMES[selectedClassName] : "classe selecionada"}. Ative Lista expandida para continuar.`)
      return
    }

    const spellToAdd = selectedSpell
    const sourceType: SpellSourceType = selectedSource.startsWith("class:")
      ? "class"
      : selectedSource === "feat"
        ? "feat"
        : "ability"
    updateCharacter(character.get("id"), (current) => {
      const alreadyKnown = current.get("magic")?.spells.knownSpells.some((entry) => entry.spells.id === spellToAdd.index) ?? false
      if (alreadyKnown) return current
      const attribute = selectedClass?.castingAttribute ?? (selectedSource === "feat" || selectedSource === "ability" ? "cha" : "int")
      const usesPreparation = selectedClass?.knownSpells?.mode === "prepared-only"
      return current.addSpell({
        source: {
          type: sourceType,
          name: selectedClassName ?? selectedSource,
          sourceId: selectedClassName ?? selectedSource,
          attribute,
          extendedList: selectedSource.startsWith("class:") && extendedList ? true : undefined,
        },
        spells: { id: spellToAdd.index, prepared: !usesPreparation },
      })
    })
    closeAdd()
    onSpellAdded?.(spellToAdd)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">Adicionar magia ao personagem</div>
            <div className="mt-1 text-xs text-textMuted">Escolha uma magia disponível e registre a origem correta na ficha.</div>
          </div>
          {onCancel ? <Button size="sm" variant="secondary" onClick={onCancel}>Voltar para a lista</Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input value={query} placeholder="Buscar magia" onChange={(event) => setQuery(event.target.value)} />
          <select className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text" value={originFilter} onChange={(event) => setOriginFilter(event.target.value as OriginFilter)}>
            <option value="all">Oficiais e homebrew</option><option value="official">Somente oficiais</option><option value="homebrew">Somente homebrew</option>
          </select>
          <select className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}>
            <option value="all">Todos os níveis</option><option value="0">Truques</option>{Array.from({ length: 9 }, (_, index) => index + 1).map((level) => <option key={level} value={level}>{level}º nível</option>)}
          </select>
          <select className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text" value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
            <option value="all">Todas as escolas</option>{schools.map((school) => <option key={school.value} value={school.value}>{school.label}</option>)}
          </select>
          <select className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text" value={classFilter} onChange={(event) => setClassFilter(event.target.value as ClassFilter)}>
            <option value="all">Todas as classes</option>{Object.entries(CLASS_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-textMuted"><input type="checkbox" checked={concentrationOnly} onChange={(event) => setConcentrationOnly(event.target.checked)} />Apenas magias de concentração</label>
        {loading ? <div className="mt-3 text-xs text-textMuted">Consultando magias oficiais...</div> : null}
        {loadError ? <div className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{loadError}</div> : null}
        <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
          {!loading && !available.length ? <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-textMuted">Nenhuma magia disponível corresponde aos filtros.</div> : null}
          {available.map((spell) => <article key={spell.index} className="flex flex-col gap-3 rounded-xl border border-border bg-bg-subtle p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><div className="font-semibold text-textH">{spellName(spell)}</div><div className="mt-1 text-xs text-textMuted">{spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} · {MAGIC_SCHOOLS_MAP[spell.school] ?? String(spell.school)} · {spell.homebrew ? "Homebrew" : "Oficial"}</div><p className="mt-2 line-clamp-2 text-xs leading-5 text-text">{spell.description || "Sem descrição."}</p></div>
            <div className="flex shrink-0 gap-2"><Button size="sm" variant="secondary" onClick={() => void openDetails(spell)}>Ver detalhes</Button><Button size="sm" onClick={() => void openAdd(spell)}>Adicionar</Button></div>
          </article>)}
        </div>
      </CardContent>

      {viewingSpell ? <SimpleModal title={spellName(viewingSpell)} onClose={() => setViewingSpell(null)}><p className="whitespace-pre-wrap text-sm leading-6 text-text">{viewingSpell.description || "Sem descrição."}</p>{viewingSpell.higherLevelText?.trim() ? <p className="whitespace-pre-wrap text-sm leading-6 text-text"><strong>Em níveis superiores: </strong>{viewingSpell.higherLevelText}</p> : null}</SimpleModal> : null}

      {selectedSpell ? <SimpleModal title={`Adicionar ${spellName(selectedSpell)}`} onClose={closeAdd}>
        <label className="grid gap-1 text-sm text-text">Origem da magia<select className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text" value={selectedSource} onChange={(event) => { setSelectedSource(event.target.value as SourceChoice); setExtendedList(false); setErrorMessage("") }}><option value="">Selecione...</option>{(character.get("sheet").classes ?? []).map((entry) => <option key={entry.className} value={`class:${entry.className}`}>{CLASS_NAMES[entry.className]}</option>)}<option value="feat">Talento</option><option value="ability">Habilidade</option></select></label>
        {outsideSelectedClassList ? <label className="flex items-center gap-2 text-xs text-text"><input type="checkbox" checked={extendedList} onChange={(event) => setExtendedList(event.target.checked)} />Lista expandida</label> : null}
        {errorMessage ? <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">{errorMessage}</div> : null}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={closeAdd}>Cancelar</Button><Button disabled={!selectedSource} onClick={addSelectedSpell}>Adicionar</Button></div>
      </SimpleModal> : null}
    </Card>
  )
}

function SimpleModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-2xl bg-bg p-4 shadow-xl"><div className="flex items-center justify-between gap-3 border-b border-border pb-3"><h2 className="font-semibold text-textH">{title}</h2><Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button></div>{children}</div></div>
}

function spellName(spell: Pick<Spell, "name" | "displayName">): string { return spell.displayName?.trim() || spell.name }
function normalizeSearch(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() }
