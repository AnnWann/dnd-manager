import { useEffect, useMemo, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { useCharacterContext } from "../../../contexts/characterContext"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  CASTING_TIME_NAMES,
  CLASS_NAMES,
  MAGIC_SCHOOLS_MAP,
} from "../../../contexts/consts"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"

type SpellLevelFilter = "all" | `${number}`
type ClassFilter = "all" | ClassName
type ConcentrationFilter = "all" | "concentration" | "non-concentration"

type SpellAddSource =
  | ""
  | "feat"
  | "ability"
  | `class:${ClassName}`

type Props = {
  onEditSpell: (spell: Spell) => void
}

export function SpellSearchModule({ onEditSpell }: Props) {
  const [addSpellError, setAddSpellError] = useState("")
  const { spells, deleteSpell } = useMagicContext()

  const {
    visibleCharacters: characters,
    activeCharacter,
    updateCharacter,
  } = useCharacterContext()

  const [baseSpells, setBaseSpells] = useState<Spell[]>([])
  const [nameFilter, setNameFilter] = useState("")
  const [levelFilter, setLevelFilter] = useState<SpellLevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [classFilter, setClassFilter] = useState<ClassFilter>("all")
  const [concentrationFilter, setConcentrationFilter] =
    useState<ConcentrationFilter>("all")

  const [spellToAdd, setSpellToAdd] = useState<Spell | null>(null)
  const [spellToView, setSpellToView] = useState<Spell | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState("")
  const [selectedSource, setSelectedSource] = useState<SpellAddSource>("")



  const availableSchools = useMemo(() => {
    return Array.from(
      new Set(spells.map((spell) => spell.school).filter(Boolean)),
    ).sort()
  }, [spells])

  const filteredSpells = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase()

    return spells
      .filter((spell) => {
        const matchesName =
          !normalizedName ||
          spell.name.toLowerCase().includes(normalizedName)

        const matchesLevel =
          levelFilter === "all" ||
          spell.slotLevel === Number(levelFilter)

        const matchesSchool =
          schoolFilter === "all" || spell.school === schoolFilter

        const matchesClass =
          classFilter === "all" || spell.classes.includes(classFilter)

        const matchesConcentration =
          concentrationFilter === "all" ||
          (concentrationFilter === "concentration" &&
            spell.concentration) ||
          (concentrationFilter === "non-concentration" &&
            !spell.concentration)

        return (
          matchesName &&
          matchesLevel &&
          matchesSchool &&
          matchesClass &&
          matchesConcentration
        )
      })
      .sort((a, b) => {
        if (a.slotLevel !== b.slotLevel) {
          return a.slotLevel - b.slotLevel
        }

        return a.name.localeCompare(b.name, "pt-BR")
      })
  }, [
    spells,
    nameFilter,
    levelFilter,
    schoolFilter,
    classFilter,
    concentrationFilter,
  ])

 function openAddSpellModal(spell: Spell) {
    setSpellToAdd(spell)
    setSelectedCharacterId(activeCharacter?.get("id") ?? "")
    setSelectedSource("")
    setAddSpellError("")
  }

  function closeAddSpellModal() {
    setSpellToAdd(null)
    setSelectedCharacterId("")
    setSelectedSource("")
    setAddSpellError("")
  } 

  function addSpellToSelectedCharacter() {
    if (!spellToAdd || !selectedCharacterId || !selectedSource) return

    const selectedCharacter = characterList.find(
      (character) => character.get("id") === selectedCharacterId,
    )

    if (!selectedCharacter) return

    const className = getSelectedClassName(selectedSource)

    if (className && !canClassUseSpell(spellToAdd, className)) {
      setAddSpellError(
        `${CLASS_NAMES[className]} não pode aprender ${spellToAdd.displayName || spellToAdd.name}.`,
      )
      return
    }

    updateCharacter(selectedCharacterId, (character) => {
      const currentSpells =
        character.get("magic")?.spells.knownSpells ?? []

      const alreadyHasSpell = currentSpells.some(
        (knownSpell) => knownSpell.spells.id === spellToAdd.index,
      )

      if (alreadyHasSpell) {
        setAddSpellError("Esse personagem já conhece essa magia.")
        return character
      }

      const classData = className
        ? character
            .get("sheet")
            .classes?.find((entry) => entry.className === className)
        : undefined

      const usesPreparation = classUsesPreparation(classData)

      return character.addSpell({
        source: getSpellSource(selectedSource, character),
        spells: {
          id: spellToAdd.index,
          prepared: !usesPreparation,
        },
      })
    })

    closeAddSpellModal()
  }


  const characterList: CharacterTemplate[] = characters ?? []

  const selectedCharacter = characterList.find(
    (character) => character.get("id") === selectedCharacterId,
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">
            Magias
          </div>

          <div className="mt-1 text-xs text-text">
            Busque, visualize, edite, delete ou adicione magias ao personagem.
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-5">
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Buscar por nome"
              />

              <select
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
                value={levelFilter}
                onChange={(e) =>
                  setLevelFilter(e.target.value as SpellLevelFilter)
                }
              >
                <option value="all">Todos os círculos</option>
                <option value="0">Truques</option>
                <option value="1">1º círculo</option>
                <option value="2">2º círculo</option>
                <option value="3">3º círculo</option>
                <option value="4">4º círculo</option>
                <option value="5">5º círculo</option>
                <option value="6">6º círculo</option>
                <option value="7">7º círculo</option>
                <option value="8">8º círculo</option>
                <option value="9">9º círculo</option>
              </select>

              <select
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
              >
                <option value="all">Todas as escolas</option>

                {availableSchools.map((school) => (
                  <option key={school} value={school}>
                    {MAGIC_SCHOOLS_MAP[school] ?? school}
                  </option>
                ))}
              </select>

              <select
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
                value={classFilter}
                onChange={(e) =>
                  setClassFilter(e.target.value as ClassFilter)
                }
              >
                <option value="all">Todas as classes</option>

                {Object.entries(CLASS_NAMES).map(([className, label]) => (
                  <option key={className} value={className}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
                value={concentrationFilter}
                onChange={(e) =>
                  setConcentrationFilter(
                    e.target.value as ConcentrationFilter,
                  )
                }
              >
                <option value="all">Todas</option>
                <option value="concentration">Concentração</option>
                <option value="non-concentration">
                  Sem concentração
                </option>
              </select>
            </div>

            {filteredSpells.length === 0 ? (
              <div className="rounded-xl border border-accentBorder bg-bg px-3 py-4 text-sm text-text">
                Nenhuma magia encontrada.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredSpells.map((spell) => (
                  <SpellSearchCard
                    key={spell.index}
                    spell={spell}
                    canAddToCharacter={characters.length > 0}
                    canEdit={spell.homebrew}
                    canDelete={spell.homebrew}
                    onAddToCharacter={() => openAddSpellModal(spell)}
                    onView={() => setSpellToView(spell)}
                    onDelete={() => deleteSpell(spell.index)}
                    onEdit={() => onEditSpell(spell)}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {spellToView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-accentBorder p-4">
              <div>
                <h2 className="font-heading text-lg text-textH">
                  {spellToView.displayName || spellToView.name}
                </h2>

                <div className="mt-1 flex flex-wrap gap-2 text-xs text-text">
                  <span>{formatSpellLevel(spellToView)}</span>
                  <span>
                    {MAGIC_SCHOOLS_MAP[spellToView.school] ??
                      spellToView.school}
                  </span>
                  <span>
                    {spellToView.concentration
                      ? "Concentração"
                      : "Sem concentração"}
                  </span>
                  {spellToView.ritual ? <span>Ritual</span> : null}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSpellToView(null)}
              >
                Fechar
              </Button>
            </div>

            <div className="grid gap-5 p-4 text-sm text-text">
              <section>
                <h3 className="text-sm font-semibold text-textH">
                  Informações
                </h3>

                <div className="mt-2 flex flex-wrap gap-2">
                  <InfoChip label="Nível" value={formatSpellLevel(spellToView)} />
                  <InfoChip
                    label="Escola"
                    value={MAGIC_SCHOOLS_MAP[spellToView.school] ?? String(spellToView.school)}
                  />
                  <InfoChip label="Conjuração" value={formatCastingTime(spellToView)} />
                  <InfoChip label="Alcance" value={formatRange(spellToView)} />
                  <InfoChip label="Duração" value={formatDuration(spellToView)} />
                  <InfoChip
                    label="Concentração"
                    value={spellToView.concentration ? "Sim" : "Não"}
                  />
                  <InfoChip label="Ritual" value={spellToView.ritual ? "Sim" : "Não"} />
                  <InfoChip
                    label="Componentes"
                    value={spellToView.components.length ? spellToView.components.join(", ") : "Nenhum"}
                  />
                  <InfoChip label="Área" value={formatArea(spellToView)} />
                  <InfoChip label="Alvo" value={formatTargeting(spellToView)} />
                  <InfoChip label="Rolagem" value={formatRollMode(spellToView)} />
                  <InfoChip label="Classes" value={formatClasses(spellToView)} />
                </div>

                {spellToView.material?.trim() ? (
                  <div className="mt-3 rounded-xl border border-border px-3 py-2 text-xs">
                    <span className="font-semibold text-textH">Material: </span>
                    <span>{spellToView.material}</span>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-textH">
                  Descrição
                </h3>

                <div className="mt-2 whitespace-pre-wrap break-words leading-6">
                  {spellToView.description?.trim() || "Sem descrição."}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-textH">
                  Em níveis superiores
                </h3>

                <div className="mt-2 whitespace-pre-wrap break-words leading-6">
                  {spellToView.higherLevelText?.trim() ||
                    "Sem efeito adicional em níveis superiores."}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {spellToAdd ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-accentBorder p-4">
              <h2 className="font-heading text-lg text-textH">
                Adicionar magia
              </h2>

              <Button
                variant="secondary"
                size="sm"
                onClick={closeAddSpellModal}
              >
                Fechar
              </Button>
            </div>

            <div className="grid gap-4 p-4">
              <div>
                <div className="text-sm font-semibold text-textH">
                  {spellToAdd.name}
                </div>

                <div className="mt-1 text-xs text-text">
                  {formatSpellLevel(spellToAdd)} •{" "}
                  {MAGIC_SCHOOLS_MAP[spellToAdd.school] ??
                    spellToAdd.school}
                </div>
              </div>

              <label className="grid gap-1 text-sm text-text">
                Personagem

                <select
                  className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
                  value={selectedCharacterId}
                  onChange={(e) => {
                    setSelectedCharacterId(e.target.value)
                    setSelectedSource("")
                    setAddSpellError("")
                  }}
                >
                  <option value="">Selecione um personagem</option>

                  {characters.map((character) => (
                    <option
                      key={character.get("id")}
                      value={character.get("id")}
                    >
                      {character.get("name")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm text-text">
                Origem da magia

                <select
                  className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none transition-colors focus:border-accent"
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value as SpellAddSource)
                    setAddSpellError("")
                  }}
                  disabled={!selectedCharacter}
                >
                  <option value="">Selecione uma origem</option>
                  <option value="ability">Habilidade</option>
                  <option value="feat">Talento</option>

                  {selectedCharacter
                    ?.get("sheet")
                    .classes?.map((classData) => (
                      <option
                        key={classData.className}
                        value={`class:${classData.className}`}
                      >
                        Classe: {CLASS_NAMES[classData.className]}
                      </option>
                    ))}
                </select>
              </label>

              {addSpellError ? (
                <div className="rounded-xl border border-accentBorder bg-bg px-3 py-2 text-xs text-accent">
                  {addSpellError}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeAddSpellModal}>
                  Cancelar
                </Button>

                <Button
                  onClick={addSpellToSelectedCharacter}
                  disabled={!selectedCharacterId || !selectedSource}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function SpellSearchCard({
  spell,
  canAddToCharacter,
  canEdit,
  canDelete,
  onAddToCharacter,
  onView,
  onDelete,
  onEdit,
}: {
  spell: Spell
  canAddToCharacter: boolean
  canEdit: boolean
  canDelete: boolean
  onAddToCharacter: () => void
  onView: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <div className="rounded-xl border border-accentBorder bg-bg p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-heading text-base text-textH">
            {spell.name || "Magia sem nome"}
          </div>

          <div className="mt-1 text-xs text-text">
            {formatSpellLevel(spell)} •{" "}
            {MAGIC_SCHOOLS_MAP[spell.school] ?? spell.school}
            {spell.concentration ? " • Concentração" : " • Sem concentração"}
          </div>

          <div className="mt-2 line-clamp-3 text-sm text-text">
            {spell.description || "Sem descrição."}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button size="sm" variant="secondary" onClick={onView}>
            Visualizar
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={onAddToCharacter}
            disabled={!canAddToCharacter}
          >
            Adicionar
          </Button>

          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
          ) : null}

          {canDelete ? (
            <Button size="sm" variant="danger" onClick={onDelete}>
              Deletar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="grid gap-1 rounded-xl border border-border px-3 py-2 md:grid-cols-[170px_1fr]">
      <span className="font-medium text-textH">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  )
}

function formatSpellLevel(spell: Spell): string {
  return spell.slotLevel === 0
    ? "Truque"
    : `${spell.slotLevel}º círculo`
}

function formatCastingTime(spell: Spell): string {
  const castingTime = spell.castingTime

  if (castingTime.type === "special") {
    return castingTime.special || "Especial"
  }

  if (castingTime.type === "reaction") {
    return castingTime.reactionWhen
      ? `Reação: ${castingTime.reactionWhen}`
      : "Reação"
  }

  if (castingTime.value === 1) {
    return `1 ${CASTING_TIME_NAMES[castingTime.type]}`
  }

  return `${castingTime.value} ${CASTING_TIME_NAMES[castingTime.type]}s`
}

function formatRange(spell: Spell): string {
  const { range } = spell

  if (range.origin === "self") return "Pessoal"
  if (range.origin === "touch") return "Toque"

  const base = `${range.distance} m`

  if (!range.area) return base

  return `${base}, ${formatAreaShape(range.area.shape)} de ${
    range.area.size
  } m`
}

function formatDuration(spell: Spell): string {
  if (!spell.duration) return "Especial"

  if (spell.duration.value === 0) {
    return formatDurationUnit(spell.duration.unit)
  }

  return `${spell.duration.value} ${formatDurationUnit(spell.duration.unit)}`
}

function formatDurationUnit(unit: string): string {
  const units: Record<string, string> = {
    instantaneous: "Instantânea",
    round: "rodada",
    minute: "minuto",
    hour: "hora",
    day: "dia",
    special: "Especial",
    untilDispelled: "Até ser dissipada",
  }

  return units[unit] ?? unit
}

function formatArea(spell: Spell): string {
  const area = spell.range.area

  if (area) {
    return `${formatAreaShape(area.shape)} de ${area.size} m`
  }

  if (spell.targeting.areaShape && spell.targeting.areaSize) {
    return `${formatAreaShape(spell.targeting.areaShape)} de ${
      spell.targeting.areaSize
    } m`
  }

  if (spell.targeting.affectsArea) return "Área especial"

  return "Não se aplica"
}

function formatAreaShape(shape: string): string {
  const shapes: Record<string, string> = {
    circle: "círculo",
    square: "quadrado",
    cone: "cone",
    line: "linha",
  }

  return shapes[shape] ?? shape
}

function formatTargeting(spell: Spell): string {
  const targeting = spell.targeting

  switch (targeting.kind) {
    case "self":
      return "Pessoal"

    case "single-creature":
      return "Uma criatura"

    case "multiple-creatures":
      return targeting.targetCount
        ? `${targeting.targetCount} criaturas`
        : "Múltiplas criaturas"

    case "area":
      return formatArea(spell)

    case "object":
      return "Objeto"

    case "special":
      return "Especial"

    default:
      return "Especial"
  }
}

function formatRollMode(spell: Spell): string {
  const parts: string[] = []

  if (spell.targeting.hasAttackRoll) {
    parts.push("Ataque mágico")
  }

  if (spell.targeting.hasSavingThrow) {
    parts.push(
      spell.targeting.savingThrowAttribute
        ? `Teste de resistência: ${spell.targeting.savingThrowAttribute.toUpperCase()}`
        : "Teste de resistência",
    )
  }

  //if (spell.rollMode.length) {
 //   parts.push(...spell.rollMode)
  //}

  return parts.length ? parts.join(" • ") : "Nenhuma"
}

function formatClasses(spell: Spell): string {
  if (!spell.classes.length) return "Nenhuma"

  return spell.classes
    .map((className) => CLASS_NAMES[className] ?? className)
    .join(", ")
}

function classUsesPreparation(classData: unknown): boolean {
  if (!classData) return false

  const knownSpells = (classData as any).knownSpells

  return (
    knownSpells?.mode === "prepared-only" ||
    knownSpells?.mode === "spellbook"
  )
}

function InfoChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-full border border-border px-3 py-1 text-xs">
      <span className="font-semibold text-textH">{label}: </span>
      <span>{value}</span>
    </div>
  )
}

function getSelectedClassName(source: SpellAddSource): ClassName | undefined {
  if (!source.startsWith("class:")) return undefined
  return source.replace("class:", "") as ClassName
}

function getSpellSource(
  source: SpellAddSource,
  character: CharacterTemplate,
): SpellSource {
  const className = getSelectedClassName(source)

  if (className) {
    const classData = character
      .get("sheet")
      .classes?.find((entry) => entry.className === className)

    return {
      type: "class",
      name: className,
      sourceId: className,
      attribute: classData?.castingAttribute ?? "cha",
    }
  }

  if (source === "feat") {
    return {
      type: "feat",
      name: "Talento",
      sourceId: "feat",
      attribute: "cha",
    }
  }

  return {
    type: "ability",
    name: "Habilidade",
    sourceId: "ability",
    attribute: "cha",
  }
}

function canClassUseSpell(spell: Spell, className: ClassName): boolean {
  return spell.classes.includes(className)
}