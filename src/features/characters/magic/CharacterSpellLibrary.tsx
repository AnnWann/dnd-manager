import { Select as SharedSelect } from "../../../components/ui/Select"
import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import {
  CASTING_TIME_NAMES,
  CLASS_NAMES,
  MAGIC_SCHOOLS_MAP,
} from "../../../contexts/consts"
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

export function CharacterSpellLibrary({
  character,
  updateCharacter,
  onSpellAdded,
  onCancel,
}: Props) {
  const { spells } = useMagicContext()
  const [query, setQuery] = useState("")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [classFilter, setClassFilter] = useState<ClassFilter>("all")
  const [concentrationOnly, setConcentrationOnly] = useState(false)
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null)
  const [selectedSource, setSelectedSource] = useState<SourceChoice>("")
  const [extendedList, setExtendedList] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const knownSpellIds = useMemo(
    () =>
      new Set(
        (character.get("magic")?.spells.knownSpells ?? []).map(
          (entry) => entry.spells.id,
        ),
      ),
    [character],
  )

  const schools = useMemo(
    () =>
      Array.from(new Set(spells.map((spell) => spell.school).filter(Boolean)))
        .map((school) => ({
          value: String(school),
          label: MAGIC_SCHOOLS_MAP[school] ?? String(school),
        }))
        .toSorted((left, right) =>
          left.label.localeCompare(right.label, "pt-BR"),
        ),
    [spells],
  )

  const availableSpells = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)

    return spells
      .filter((spell) => !knownSpellIds.has(spell.index))
      .filter((spell) => {
        const searchable = normalizeSearch(
          [
            spell.displayName,
            spell.name,
            spell.description,
            MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school,
            ...spell.classes.map((className) => CLASS_NAMES[className]),
          ]
            .filter(Boolean)
            .join(" "),
        )

        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (originFilter === "all" ||
            (originFilter === "official" ? !spell.homebrew : spell.homebrew)) &&
          (levelFilter === "all" || spell.slotLevel === Number(levelFilter)) &&
          (schoolFilter === "all" || spell.school === schoolFilter) &&
          (classFilter === "all" || spell.classes.includes(classFilter)) &&
          (!concentrationOnly || spell.concentration)
        )
      })
      .toSorted((left, right) => {
        const levelDifference = left.slotLevel - right.slotLevel
        if (levelDifference !== 0) return levelDifference
        return spellName(left).localeCompare(spellName(right), "pt-BR")
      })
  }, [
    classFilter,
    concentrationOnly,
    knownSpellIds,
    levelFilter,
    originFilter,
    query,
    schoolFilter,
    spells,
  ])

  const selectedClassName = getSelectedClassName(selectedSource)
  const selectedClass = selectedClassName
    ? character
        .get("sheet")
        .classes?.find((entry) => entry.className === selectedClassName)
    : undefined
  const outsideSelectedClassList = Boolean(
    selectedSpell &&
      selectedClassName &&
      !selectedSpell.classes.includes(selectedClassName),
  )

  function openAdd(spell: Spell) {
    setSelectedSpell(spell)
    setSelectedSource("")
    setExtendedList(false)
    setErrorMessage("")
  }

  function closeAdd() {
    setSelectedSpell(null)
    setSelectedSource("")
    setExtendedList(false)
    setErrorMessage("")
  }

  function addSelectedSpell() {
    if (!selectedSpell || !selectedSource) return

    if (outsideSelectedClassList && !extendedList) {
      setErrorMessage(
        `Esta magia não pertence à lista de ${selectedClassName ? CLASS_NAMES[selectedClassName] : "classe selecionada"}. Ative Lista expandida para continuar.`,
      )
      return
    }

    const spellToAdd = selectedSpell
    const sourceType = getSpellSourceType(selectedSource)

    updateCharacter(character.get("id"), (current) => {
      const alreadyKnown =
        current
          .get("magic")
          ?.spells.knownSpells.some(
            (entry) => entry.spells.id === spellToAdd.index,
          ) ?? false

      if (alreadyKnown) return current

      const attribute = selectedClass?.castingAttribute ?? inferAttribute(selectedSource)
      const usesPreparation = selectedClass
        ? selectedClass.knownSpells?.mode === "prepared-only"
        : false

      return current.addSpell({
        source: {
          type: sourceType,
          name: selectedClassName ?? selectedSource,
          sourceId: selectedClassName ?? selectedSource,
          attribute,
          extendedList:
            selectedSource.startsWith("class:") && extendedList
              ? true
              : undefined,
        },
        spells: {
          id: spellToAdd.index,
          prepared: !usesPreparation,
        },
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
            <div className="text-sm font-semibold text-textH">
              Adicionar magia ao personagem
            </div>
            <div className="mt-1 text-xs text-textMuted">
              Escolha uma magia disponível e registre a origem correta na ficha.
            </div>
          </div>

          {onCancel ? (
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Voltar para a lista
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={query}
            placeholder="Buscar magia"
            onChange={(event) => setQuery(event.target.value)}
          />

          <SharedSelect
            className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text"
            value={originFilter}
            onChange={(event) => setOriginFilter(event.target.value as OriginFilter)}
          >
            <option value="all">Oficiais e homebrew</option>
            <option value="official">Somente oficiais</option>
            <option value="homebrew">Somente homebrew</option>
          </SharedSelect>

          <SharedSelect
            className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
          >
            <option value="all">Todos os níveis</option>
            <option value="0">Truques</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>{level}º nível</option>
            ))}
          </SharedSelect>

          <SharedSelect
            className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text"
            value={schoolFilter}
            onChange={(event) => setSchoolFilter(event.target.value)}
          >
            <option value="all">Todas as escolas</option>
            {schools.map((school) => (
              <option key={school.value} value={school.value}>{school.label}</option>
            ))}
          </SharedSelect>

          <SharedSelect
            className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text"
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value as ClassFilter)}
          >
            <option value="all">Todas as classes</option>
            {Object.entries(CLASS_NAMES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SharedSelect>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-textMuted">
          <input
            type="checkbox"
            checked={concentrationOnly}
            onChange={(event) => setConcentrationOnly(event.target.checked)}
          />
          Apenas magias de concentração
        </label>

        <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
          {availableSpells.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-textMuted">
              Nenhuma magia disponível corresponde aos filtros.
            </div>
          ) : null}

          {availableSpells.map((spell) => (
            <article
              key={spell.index}
              className="flex flex-col gap-3 rounded-xl border border-border bg-bg-subtle p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-textH">{spellName(spell)}</div>
                  <Badge label={formatLevel(spell.slotLevel)} />
                  <Badge label={MAGIC_SCHOOLS_MAP[spell.school] ?? String(spell.school)} />
                  <Badge label={spell.homebrew ? "Homebrew" : "Oficial"} />
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {spell.classes.map((entry) => CLASS_NAMES[entry]).join(", ") || "Sem classe"}
                  {spell.concentration ? " · Concentração" : ""}
                  {spell.ritual ? " · Ritual" : ""}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-text">
                  {spell.description || "Sem descrição."}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setViewingSpell(spell)}
                >
                  Ver detalhes
                </Button>
                <Button size="sm" onClick={() => openAdd(spell)}>
                  Adicionar
                </Button>
              </div>
            </article>
          ))}
        </div>
      </CardContent>

      {viewingSpell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div>
                <h2 className="text-lg font-semibold text-textH">
                  {spellName(viewingSpell)}
                </h2>
                <div className="mt-1 text-xs text-textMuted">
                  {formatLevel(viewingSpell.slotLevel)} · {MAGIC_SCHOOLS_MAP[viewingSpell.school] ?? String(viewingSpell.school)}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewingSpell(null)}
              >
                Fechar
              </Button>
            </div>

            <div className="grid gap-5 p-4 text-sm text-text">
              <div className="flex flex-wrap gap-2">
                <Badge label={formatCastingTime(viewingSpell)} />
                <Badge label={formatRange(viewingSpell)} />
                <Badge label={formatDuration(viewingSpell)} />
                <Badge label={`Componentes: ${viewingSpell.components.join(", ") || "nenhum"}`} />
                {viewingSpell.concentration ? <Badge label="Concentração" /> : null}
                {viewingSpell.ritual ? <Badge label="Ritual" /> : null}
                {viewingSpell.targeting.hasAttackRoll ? <Badge label="Jogada de ataque" /> : null}
                {viewingSpell.targeting.hasSavingThrow ? <Badge label="Teste de resistência" /> : null}
              </div>

              {viewingSpell.material?.trim() ? (
                <section>
                  <h3 className="font-semibold text-textH">Material</h3>
                  <p className="mt-1 whitespace-pre-wrap leading-6">{viewingSpell.material}</p>
                </section>
              ) : null}

              <section>
                <h3 className="font-semibold text-textH">Descrição</h3>
                <p className="mt-1 whitespace-pre-wrap leading-6">
                  {viewingSpell.description || "Sem descrição."}
                </p>
              </section>

              {viewingSpell.higherLevelText?.trim() ? (
                <section>
                  <h3 className="font-semibold text-textH">Em níveis superiores</h3>
                  <p className="mt-1 whitespace-pre-wrap leading-6">
                    {viewingSpell.higherLevelText}
                  </p>
                </section>
              ) : null}

              {viewingSpell.headcanon?.trim() ? (
                <section>
                  <h3 className="font-semibold text-textH">Personalização</h3>
                  <p className="mt-1 whitespace-pre-wrap leading-6">
                    {viewingSpell.headcanon}
                  </p>
                </section>
              ) : null}

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    const spell = viewingSpell
                    setViewingSpell(null)
                    openAdd(spell)
                  }}
                >
                  Adicionar esta magia
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedSpell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <div className="font-semibold text-textH">Adicionar {spellName(selectedSpell)}</div>
                <div className="mt-1 text-xs text-textMuted">
                  {formatLevel(selectedSpell.slotLevel)} · {MAGIC_SCHOOLS_MAP[selectedSpell.school] ?? String(selectedSpell.school)}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={closeAdd}>Fechar</Button>
            </div>

            <div className="grid gap-4 p-4">
              <label className="grid gap-1 text-sm text-text">
                Origem da magia
                <SharedSelect
                  className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text"
                  value={selectedSource}
                  onChange={(event) => {
                    setSelectedSource(event.target.value as SourceChoice)
                    setExtendedList(false)
                    setErrorMessage("")
                  }}
                >
                  <option value="">Selecione uma origem</option>
                  <option value="ability">Habilidade</option>
                  <option value="feat">Talento</option>
                  {character.get("sheet").classes?.map((classData) => (
                    <option key={classData.className} value={`class:${classData.className}`}>
                      Classe: {CLASS_NAMES[classData.className]}
                    </option>
                  ))}
                </SharedSelect>
              </label>

              {selectedClassName ? (
                <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={extendedList}
                    onChange={(event) => {
                      setExtendedList(event.target.checked)
                      setErrorMessage("")
                    }}
                  />
                  <span>
                    <span className="block font-semibold text-textH">Lista expandida</span>
                    <span className="mt-1 block text-xs leading-5 text-textMuted">
                      Permite adicionar a magia à classe mesmo quando ela não pertence à lista normal dessa classe.
                    </span>
                  </span>
                </label>
              ) : null}

              {outsideSelectedClassList && !extendedList ? (
                <div className="rounded-xl border border-warning bg-warningBg p-3 text-xs text-textH">
                  Esta magia não pertence à lista normal de {selectedClassName ? CLASS_NAMES[selectedClassName] : "classe selecionada"}.
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-xl border border-danger bg-dangerBg p-3 text-xs text-danger">
                  {errorMessage}
                </div>
              ) : null}

              <Button disabled={!selectedSource} onClick={addSelectedSpell}>
                Adicionar à ficha
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function getSpellSourceType(
  source: Exclude<SourceChoice, "">,
): SpellSourceType {
  if (source.startsWith("class:")) return "class"
  return source as "feat" | "ability"
}

function getSelectedClassName(source: SourceChoice): ClassName | undefined {
  return source.startsWith("class:")
    ? (source.slice("class:".length) as ClassName)
    : undefined
}

function inferAttribute(source: SourceChoice): "int" | "wis" | "cha" {
  if (source === "feat") return "cha"
  if (source === "ability") return "cha"
  return "int"
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function formatLevel(level: number): string {
  return level === 0 ? "Truque" : `${level}º nível`
}

function formatCastingTime(spell: Spell): string {
  const label = CASTING_TIME_NAMES[spell.castingTime.type] ?? spell.castingTime.type
  return `Conjuração: ${spell.castingTime.value} ${label}`
}

function formatRange(spell: Spell): string {
  if (spell.range.origin === "self") return "Alcance: pessoal"
  if (spell.range.origin === "touch") return "Alcance: toque"
  return `Alcance: ${spell.range.distance} m`
}

function formatDuration(spell: Spell): string {
  const { value, unit } = spell.duration

  if (unit === "instantaneous") return "Duração: instantânea"
  if (unit === "special") return "Duração: especial"
  if (unit === "untilDispelled") return "Duração: até ser dissipada"
  if (unit === "short rest") return "Duração: até um descanso curto"
  if (unit === "long rest") return "Duração: até um descanso longo"
  if (unit === "permanent") return "Duração: permanente"

  const singular: Record<string, string> = {
    turn: "turno",
    round: "rodada",
    minute: "minuto",
    hour: "hora",
    day: "dia",
  }
  const plural: Record<string, string> = {
    turn: "turnos",
    round: "rodadas",
    minute: "minutos",
    hour: "horas",
    day: "dias",
  }

  const label = value === 1
    ? singular[unit] ?? unit
    : plural[unit] ?? unit

  return `Duração: ${value} ${label}`
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {label}
    </span>
  )
}