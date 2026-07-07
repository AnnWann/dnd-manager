import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, Plus, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { attributeShort } from "../../../lib/attributeShorts"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  CharacterRace,
  CreatureSize,
} from "../../../models/races/CharacterRace"
import type { Race } from "../../../models/races/Race"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import {
  PHB_RACE_PRESETS,
  SKILL_LABELS,
  racePresetToCharacterRace,
  type RacePreset,
} from "../creation/phbPresets"
import { AbilityCard } from "../abilities/abilityCard"
import { AbilityDialog } from "../abilities/abilityDialog"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

const RACE_OPTIONS: Array<{ value: Race; label: string }> = [
  { value: "aarakocra", label: "Aarakocra" },
  { value: "aasimar", label: "Aasimar" },
  { value: "bugbear", label: "Bugbear" },
  { value: "centaur", label: "Centauro" },
  { value: "changeling", label: "Changeling" },
  { value: "dragonborn", label: "Draconato" },
  { value: "dwarf", label: "Anão" },
  { value: "duergar", label: "Duergar" },
  { value: "elf", label: "Elfo" },
  { value: "eladrin", label: "Eladrin" },
  { value: "fairy", label: "Fada" },
  { value: "firbolg", label: "Firbolg" },
  { value: "genasi", label: "Genasi" },
  { value: "giff", label: "Giff" },
  { value: "githyanki", label: "Githyanki" },
  { value: "githzerai", label: "Githzerai" },
  { value: "gnome", label: "Gnomo" },
  { value: "deep-gnome", label: "Gnomo das Profundezas" },
  { value: "goblin", label: "Goblin" },
  { value: "goliath", label: "Golias" },
  { value: "half-elf", label: "Meio-elfo" },
  { value: "half-orc", label: "Meio-orc" },
  { value: "halfling", label: "Halfling" },
  { value: "harengon", label: "Harengon" },
  { value: "hobgoblin", label: "Hobgoblin" },
  { value: "human", label: "Humano" },
  { value: "kenku", label: "Kenku" },
  { value: "kobold", label: "Kobold" },
  { value: "leonin", label: "Leonin" },
  { value: "lizardfolk", label: "Povo-lagarto" },
  { value: "loxodon", label: "Loxodon" },
  { value: "minotaur", label: "Minotauro" },
  { value: "orc", label: "Orc" },
  { value: "owlin", label: "Owlin" },
  { value: "satyr", label: "Sátiro" },
  { value: "shadar-kai", label: "Shadar-kai" },
  { value: "shifter", label: "Shifter" },
  { value: "tabaxi", label: "Tabaxi" },
  { value: "thri-kreen", label: "Thri-kreen" },
  { value: "tiefling", label: "Tiefling" },
  { value: "tortle", label: "Tortle" },
  { value: "triton", label: "Tritão" },
  { value: "vedalken", label: "Vedalken" },
  { value: "verdan", label: "Verdan" },
  { value: "warforged", label: "Forjado Bélico" },
  { value: "yuan-ti", label: "Yuan-ti" },
]

const SIZE_OPTIONS: Array<{ value: CreatureSize; label: string }> = [
  { value: "tiny", label: "Minúsculo" },
  { value: "small", label: "Pequeno" },
  { value: "medium", label: "Médio" },
  { value: "large", label: "Grande" },
  { value: "huge", label: "Enorme" },
  { value: "gargantuan", label: "Colossal" },
]

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

const PROFICIENCY_CATEGORIES: Array<{
  value: ProficiencyCategory
  label: string
}> = [
  { value: "skill", label: "Perícia" },
  { value: "saving-throw", label: "Salvaguarda" },
  { value: "weapon", label: "Arma" },
  { value: "armor", label: "Armadura" },
  { value: "shield", label: "Escudo" },
  { value: "tool", label: "Ferramenta" },
  { value: "vehicle", label: "Veículo" },
  { value: "mount", label: "Montaria" },
  { value: "language", label: "Idioma" },
  { value: "instrument", label: "Instrumento" },
  { value: "game", label: "Jogo" },
  { value: "other", label: "Outro" },
]

export function CharacterRaceTab({
  character,
  updateCharacter,
}: Props) {
  const [creatingAbility, setCreatingAbility] = useState(false)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [proficiencyModalOpen, setProficiencyModalOpen] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState(
    detectRacePresetId(character.get("sheet").race),
  )

  const race = character.get("sheet").race
  const naturalAbilities = race.naturalAbilities ?? []
  const selectedPreset = useMemo(
    () => PHB_RACE_PRESETS.find((preset) => preset.id === selectedPresetId),
    [selectedPresetId],
  )

  useEffect(() => {
    setSelectedPresetId(detectRacePresetId(character.get("sheet").race))
  }, [character])

  function updateRace(updater: (race: CharacterRace) => CharacterRace) {
    updateCharacter(character.get("id"), (current) =>
      current.withSheet("race", updater(current.get("sheet").race)),
    )
  }

  function setRaceField<K extends keyof CharacterRace>(
    key: K,
    value: CharacterRace[K],
  ) {
    updateRace((currentRace) => ({
      ...currentRace,
      [key]: value,
    }))
    setSelectedPresetId("custom")
  }

  function setAttributeBonus(attribute: Attribute, value: number) {
    updateRace((currentRace) => ({
      ...currentRace,
      attributeBonus: {
        ...(currentRace.attributeBonus ?? {}),
        [attribute]: value,
      },
    }))
    setSelectedPresetId("custom")
  }

  function applyPreset(preset: RacePreset) {
    updateCharacter(character.get("id"), (current) => {
      const sheet = current.get("sheet")
      const currentRace = sheet.race
      const presetRace = racePresetToCharacterRace(preset)
      const skills = { ...sheet.skills }
      const savingThrowProficiencies = {
        ...sheet.savingThrowProficiencies,
      }

      for (const proficiency of presetRace.proficiencies) {
        if (proficiency.category === "skill") {
          const skill = getSkillFromName(proficiency.name)
          if (skill && skills[skill] !== "expertise") {
            skills[skill] = "proficient"
          }
        }

        if (proficiency.category === "saving-throw") {
          const attribute = getAttributeFromName(proficiency.name)
          if (attribute) savingThrowProficiencies[attribute] = true
        }
      }

      return current.withPatch({
        sheet: {
          ...sheet,
          skills,
          savingThrowProficiencies,
          race: {
            ...currentRace,
            ...presetRace,
            supplyConsumption: currentRace.supplyConsumption,
            supplyConsumptionCustomized:
              currentRace.supplyConsumptionCustomized,
          },
        },
      })
    })
    setSelectedPresetId(preset.id)
  }

  function saveAbility(ability: Ability) {
    updateRace((currentRace) => {
      const abilities = currentRace.naturalAbilities ?? []
      const alreadyExists = abilities.some(
        (currentAbility) => currentAbility.id === ability.id,
      )

      return {
        ...currentRace,
        naturalAbilities: alreadyExists
          ? abilities.map((currentAbility) =>
              currentAbility.id === ability.id ? ability : currentAbility,
            )
          : [...abilities, ability],
      }
    })

    setCreatingAbility(false)
    setEditingAbility(null)
  }

  function removeAbility(abilityId: string) {
    updateRace((currentRace) => ({
      ...currentRace,
      naturalAbilities: (currentRace.naturalAbilities ?? []).filter(
        (ability) => ability.id !== abilityId,
      ),
    }))
    setSelectedPresetId("custom")
  }

  function updateAbilityUsage(abilityId: string, delta: 1 | -1) {
    updateRace((currentRace) => ({
      ...currentRace,
      naturalAbilities: (currentRace.naturalAbilities ?? []).map(
        (ability) => {
          if (ability.id !== abilityId || !ability.usage) return ability
          if (ability.usage.reset === "spellSlot") return ability

          return {
            ...ability,
            usage: {
              ...ability.usage,
              used: Math.min(
                ability.usage.max,
                Math.max(0, ability.usage.used + delta),
              ),
            },
          }
        },
      ),
    }))
  }

  function addProficiency(proficiency: Proficiency) {
    updateCharacter(character.get("id"), (current) => {
      const sheet = current.get("sheet")
      const currentRace = sheet.race
      const existing = currentRace.proficiencies ?? []
      const duplicate = existing.some(
        (entry) =>
          entry.category === proficiency.category &&
          normalizeText(entry.name) === normalizeText(proficiency.name),
      )
      const skills = { ...sheet.skills }
      const savingThrowProficiencies = {
        ...sheet.savingThrowProficiencies,
      }

      if (proficiency.category === "skill") {
        const skill = getSkillFromName(proficiency.name)
        if (skill && skills[skill] !== "expertise") {
          skills[skill] = "proficient"
        }
      }

      if (proficiency.category === "saving-throw") {
        const attribute = getAttributeFromName(proficiency.name)
        if (attribute) savingThrowProficiencies[attribute] = true
      }

      return current.withPatch({
        sheet: {
          ...sheet,
          skills,
          savingThrowProficiencies,
          race: {
            ...currentRace,
            proficiencies: duplicate
              ? existing
              : [...existing, proficiency],
          },
        },
      })
    })
    setSelectedPresetId("custom")
  }

  function removeProficiency(proficiencyId: string) {
    updateRace((currentRace) => ({
      ...currentRace,
      proficiencies: (currentRace.proficiencies ?? []).filter(
        (proficiency) => proficiency.id !== proficiencyId,
      ),
    }))
    setSelectedPresetId("custom")
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-textH">Preset racial</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Aplique um dos presets do PHB usados na criação de personagens. Isso
            substitui identidade, bônus, habilidades e proficiências raciais,
            preservando a configuração de suprimentos.
          </p>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Select
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            <option value="custom">Personalizada / sem preset correspondente</option>
            {PHB_RACE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            disabled={!selectedPreset}
            onClick={() => selectedPreset && applyPreset(selectedPreset)}
          >
            <Check className="h-4 w-4" />
            Aplicar preset
          </Button>
        </div>

        {selectedPreset ? (
          <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-text">
            <span className="font-semibold text-textH">{selectedPreset.name}:</span>{" "}
            {selectedPreset.summary}
          </div>
        ) : null}
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-textH">Raça</h2>
          <p className="mt-1 text-xs text-textMuted">
            Todos os campos continuam editáveis após aplicar um preset.
          </p>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Raça</span>
            <Select
              value={race.race}
              onChange={(event) =>
                setRaceField("race", event.target.value as Race)
              }
            >
              {RACE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Sub-raça</span>
            <Input
              value={race.subrace ?? ""}
              placeholder="Ex: Alto Elfo"
              onChange={(event) =>
                setRaceField("subrace", event.target.value)
              }
            />
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Tamanho</span>
            <Select
              value={race.size ?? "medium"}
              onChange={(event) =>
                setRaceField(
                  "size",
                  event.target.value as CreatureSize,
                )
              }
            >
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Bônus de deslocamento
            </span>
            <Input
              type="number"
              step="0.5"
              value={race.speedBonus ?? 0}
              onChange={(event) =>
                setRaceField(
                  "speedBonus",
                  Number(event.target.value) || 0,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-textH">
            Bônus de atributo
          </h2>
          <p className="mt-1 text-xs text-textMuted">
            Esses valores são somados aos atributos base do personagem.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <label
              key={attribute}
              className="grid min-w-0 gap-1.5 rounded-lg border border-border bg-bg-subtle p-3"
            >
              <span className="text-center text-xs font-bold uppercase tracking-wide text-textH">
                {attributeShort(attribute)}
              </span>
              <Input
                type="number"
                className="text-center"
                value={race.attributeBonus?.[attribute] ?? 0}
                onChange={(event) =>
                  setAttributeBonus(
                    attribute,
                    Number(event.target.value) || 0,
                  )
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-textH">
              Habilidades naturais
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Podem ter ações, gatilhos, usos, recargas e magias concedidas.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setCreatingAbility(true)}
          >
            <Plus className="h-4 w-4" />
            Habilidade
          </Button>
        </div>

        {naturalAbilities.length > 0 ? (
          <div className="grid gap-3">
            {[...naturalAbilities]
              .sort((left, right) =>
                left.name.localeCompare(right.name, "pt-BR"),
              )
              .map((ability) => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  sourceLabel="Raça"
                  onEdit={() => setEditingAbility(ability)}
                  onRemove={() => removeAbility(ability.id)}
                  onUse={() => updateAbilityUsage(ability.id, 1)}
                  onRestore={() => updateAbilityUsage(ability.id, -1)}
                />
              ))}
          </div>
        ) : (
          <EmptyCard text="Nenhuma habilidade natural cadastrada." />
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-textH">
              Proficiências raciais
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Inclui perícias e salvaguardas funcionais, além de armas,
              armaduras, ferramentas, veículos, idiomas e outros treinamentos.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setProficiencyModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Proficiência
          </Button>
        </div>

        {(race.proficiencies ?? []).length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {(race.proficiencies ?? [])
              .slice()
              .sort((left, right) =>
                left.name.localeCompare(right.name, "pt-BR"),
              )
              .map((proficiency) => (
                <div
                  key={proficiency.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium text-textH">
                      {proficiency.name}
                    </div>
                    <div className="mt-0.5 text-xs text-textMuted">
                      {formatProficiencyCategory(proficiency.category)}
                    </div>
                    {proficiency.notes ? (
                      <p className="mt-1 break-words text-xs text-text">
                        {proficiency.notes}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    title="Remover proficiência racial"
                    aria-label={`Remover ${proficiency.name}`}
                    onClick={() => removeProficiency(proficiency.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-danger hover:bg-dangerBg hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <EmptyCard text="Nenhuma proficiência racial cadastrada." />
        )}

        <p className="mt-3 text-[11px] leading-5 text-textMuted">
          Ao adicionar uma perícia ou salvaguarda, a ficha é atualizada
          imediatamente. Remover o registro racial não retira automaticamente a
          proficiência funcional, pois ela também pode vir de classe,
          antecedente ou outra fonte.
        </p>
      </section>

      <AbilityDialog
        open={creatingAbility || editingAbility !== null}
        ability={editingAbility}
        onClose={() => {
          setCreatingAbility(false)
          setEditingAbility(null)
        }}
        onSave={saveAbility}
      />

      <AddRaceProficiencyModal
        open={proficiencyModalOpen}
        onClose={() => setProficiencyModalOpen(false)}
        onSave={(proficiency) => {
          addProficiency(proficiency)
          setProficiencyModalOpen(false)
        }}
      />
    </div>
  )
}

function AddRaceProficiencyModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (proficiency: Proficiency) => void
}) {
  const [category, setCategory] =
    useState<ProficiencyCategory>("skill")
  const [skill, setSkill] = useState<Skill>("perception")
  const [savingThrow, setSavingThrow] = useState<Attribute>("str")
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  if (!open) return null

  function reset() {
    setCategory("skill")
    setSkill("perception")
    setSavingThrow("str")
    setName("")
    setNotes("")
    setError("")
  }

  function close() {
    reset()
    onClose()
  }

  function save() {
    const resolvedName =
      category === "skill"
        ? SKILL_LABELS[skill]
        : category === "saving-throw"
          ? ATTRIBUTE_LABELS[savingThrow]
          : name.trim()

    if (!resolvedName) {
      setError("Informe o nome da proficiência.")
      return
    }

    onSave({
      id: crypto.randomUUID(),
      category,
      name: resolvedName,
      notes: notes.trim() || undefined,
    })
    reset()
  }

  return (
    <ModalShell
      title="Adicionar proficiência racial"
      description="Perícias e salvaguardas são aplicadas diretamente aos cálculos da ficha."
      onClose={close}
    >
      <div className="grid min-w-0 gap-4">
        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-medium text-textH">Categoria</span>
          <Select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as ProficiencyCategory)
              setError("")
            }}
          >
            {PROFICIENCY_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        {category === "skill" ? (
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Perícia</span>
            <Select
              value={skill}
              onChange={(event) => setSkill(event.target.value as Skill)}
            >
              {Object.entries(SKILL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        ) : category === "saving-throw" ? (
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Salvaguarda
            </span>
            <Select
              value={savingThrow}
              onChange={(event) =>
                setSavingThrow(event.target.value as Attribute)
              }
            >
              {ATTRIBUTE_KEYS.map((attribute) => (
                <option key={attribute} value={attribute}>
                  {ATTRIBUTE_LABELS[attribute]} ({attributeShort(attribute)})
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Nome</span>
            <Input
              value={name}
              invalid={Boolean(error)}
              placeholder="Ex: Comum, Espadas Longas, Ferramentas de Ladrão..."
              onChange={(event) => {
                setName(event.target.value)
                setError("")
              }}
            />
          </label>
        )}

        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-medium text-textH">
            Observações
          </span>
          <Textarea
            value={notes}
            placeholder="Opcional."
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {error ? (
          <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <ModalActions
        onCancel={close}
        onConfirm={save}
        confirmLabel="Adicionar"
      />
    </ModalShell>
  )
}

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/65 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="grid max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-lg grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-bg-elevated text-text shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold text-textH">
              {title}
            </h2>
            <p className="mt-1 break-words text-xs text-textMuted">
              {description}
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-border hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 min-w-0 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
}) {
  return (
    <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
      <Button size="sm" variant="secondary" onClick={onCancel}>
        Cancelar
      </Button>
      <Button size="sm" variant="primary" onClick={onConfirm}>
        <Plus className="h-4 w-4" />
        {confirmLabel}
      </Button>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
      {text}
    </div>
  )
}

function formatProficiencyCategory(
  category: ProficiencyCategory,
): string {
  return (
    PROFICIENCY_CATEGORIES.find((entry) => entry.value === category)?.label ??
    "Outro"
  )
}

function detectRacePresetId(race: CharacterRace): string {
  const match = PHB_RACE_PRESETS.find(
    (preset) =>
      preset.race === race.race &&
      normalizeText(preset.subrace) === normalizeText(race.subrace ?? ""),
  )
  return match?.id ?? "custom"
}

function getSkillFromName(name: string): Skill | undefined {
  const normalized = normalizeText(name)
  return (Object.entries(SKILL_LABELS) as Array<[Skill, string]>).find(
    ([skill, label]) =>
      normalizeText(skill) === normalized || normalizeText(label) === normalized,
  )?.[0]
}

function getAttributeFromName(name: string): Attribute | undefined {
  const normalized = normalizeText(name)
  return ATTRIBUTE_KEYS.find(
    (attribute) =>
      normalizeText(attribute) === normalized ||
      normalizeText(attributeShort(attribute)) === normalized ||
      normalizeText(ATTRIBUTE_LABELS[attribute]) === normalized,
  )
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}
