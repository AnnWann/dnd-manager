import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  X,
} from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { newCharacterTemplate } from "../../../lib/newCharacterTemplate"
import type { CharacterBackground } from "../../../models/characters/CharacterBackground"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"
import type { Player } from "../../../models/player/Player"
import type {
  CharacterRace,
  CreatureSize,
} from "../../../models/races/CharacterRace"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import {
  CharacterClassBuilder,
  type CharacterClassInterface,
  type ClassLevel,
  type ClassName,
} from "../../../models/sheet/Class"
import type { Skill } from "../../../models/sheet/Skills"
import {
  PHB_BACKGROUND_PRESETS,
  PHB_CLASS_PRESETS,
  PHB_RACE_PRESETS,
  SKILL_LABELS,
  racePresetToCharacterRace,
  type BackgroundPreset,
  type ClassPreset,
  type RacePreset,
} from "./phbPresets"

const STEPS = [
  "Identidade",
  "Raça",
  "Antecedente",
  "Classe",
  "Atributos",
  "Revisão",
] as const

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

const ATTRIBUTE_SHORT: Record<Attribute, string> = {
  str: "FOR",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
}

const SIZE_LABELS: Record<CreatureSize, string> = {
  tiny: "Minúsculo",
  small: "Pequeno",
  medium: "Médio",
  large: "Grande",
  huge: "Enorme",
  gargantuan: "Colossal",
}

type Visibility = "private" | "party" | "master"

type RaceBonusSlot = {
  id: string
  amount: number
  attribute?: Attribute
  locked: boolean
}

type Props = {
  open: boolean
  defaultOwner: Player
  owners: Player[]
  canAssignOwners: boolean
  onClose: () => void
  onCreate: (character: CharacterTemplate) => void
  createOwner: (ownerName: string) => Player
}

export function CharacterCreationWizard({
  open,
  defaultOwner,
  owners,
  canAssignOwners,
  onClose,
  onCreate,
  createOwner,
}: Props) {
  const firstRace = PHB_RACE_PRESETS[0]
  const firstBackground = PHB_BACKGROUND_PRESETS[0]
  const firstClass = PHB_CLASS_PRESETS[0]

  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [ownerName, setOwnerName] = useState(defaultOwner.name)
  const [visibility, setVisibility] = useState<Visibility>("party")
  const [racePresetId, setRacePresetId] = useState(firstRace.id)
  const [race, setRace] = useState<CharacterRace>(
    racePresetToCharacterRace(firstRace),
  )
  const [raceBonusSlots, setRaceBonusSlots] = useState<RaceBonusSlot[]>(
    getRaceBonusSlots(firstRace.id, firstRace.attributeBonus),
  )
  const [backgroundPresetId, setBackgroundPresetId] = useState(
    firstBackground.id,
  )
  const [background, setBackground] = useState<CharacterBackground>(
    cloneBackground(firstBackground),
  )
  const [className, setClassName] = useState<ClassName>(firstClass.id)
  const [level, setLevel] = useState(1)
  const [classSkills, setClassSkills] = useState<Skill[]>([])
  const [attributes, setAttributes] = useState<Record<Attribute, number>>({
    ...firstClass.recommendedAttributes,
  })
  const [maxHp, setMaxHp] = useState(
    calculateSuggestedHp(firstClass, 1, firstClass.recommendedAttributes.con),
  )
  const [equipmentText, setEquipmentText] = useState(
    backgroundEquipmentText(firstBackground),
  )

  const selectedClass = useMemo(
    () =>
      PHB_CLASS_PRESETS.find((entry) => entry.id === className) ??
      firstClass,
    [className, firstClass],
  )

  useEffect(() => {
    if (!open) return

    const initialRace = racePresetToCharacterRace(firstRace)
    setStep(0)
    setName("")
    setOwnerName(defaultOwner.name)
    setVisibility("party")
    setRacePresetId(firstRace.id)
    setRace(initialRace)
    setRaceBonusSlots(
      getRaceBonusSlots(firstRace.id, firstRace.attributeBonus),
    )
    setBackgroundPresetId(firstBackground.id)
    setBackground(cloneBackground(firstBackground))
    setClassName(firstClass.id)
    setLevel(1)
    setClassSkills([])
    setAttributes({ ...firstClass.recommendedAttributes })
    setMaxHp(
      calculateSuggestedHp(
        firstClass,
        1,
        firstClass.recommendedAttributes.con,
      ),
    )
    setEquipmentText(backgroundEquipmentText(firstBackground))
  }, [defaultOwner.id, open])

  useEffect(() => {
    setClassSkills((current) =>
      current.filter(
        (skill) => !background.skillProficiencies.includes(skill),
      ),
    )
  }, [background.skillProficiencies])

  if (!open) return null

  const canContinue = step !== 0 || name.trim().length > 0
  const chosenOwner =
    owners.find(
      (owner) =>
        owner.id === ownerName.trim() || owner.name === ownerName.trim(),
    ) ?? createOwner(ownerName)
  const finalAttributes = ATTRIBUTE_KEYS.reduce(
    (result, attribute) => ({
      ...result,
      [attribute]:
        attributes[attribute] + (race.attributeBonus[attribute] ?? 0),
    }),
    {} as Record<Attribute, number>,
  )

  function selectRacePreset(preset: RacePreset) {
    const nextRace = racePresetToCharacterRace(preset)
    const slots = getRaceBonusSlots(preset.id, preset.attributeBonus)
    setRacePresetId(preset.id)
    setRace(applyRaceBonusSlots(nextRace, slots))
    setRaceBonusSlots(slots)
  }

  function selectCustomRace() {
    const slots: RaceBonusSlot[] = [
      { id: "custom-plus-two", amount: 2, attribute: "str", locked: false },
      { id: "custom-plus-one", amount: 1, attribute: "dex", locked: false },
    ]
    setRacePresetId("custom")
    setRaceBonusSlots(slots)
    setRace((current) =>
      applyRaceBonusSlots(
        {
          ...current,
          naturalAbilities: [...(current.naturalAbilities ?? [])],
          proficiencies: [...(current.proficiencies ?? [])],
        },
        slots,
      ),
    )
  }

  function moveRaceBonus(slotId: string, attribute: Attribute) {
    setRaceBonusSlots((current) => {
      const targetSlot = current.find((slot) => slot.id === slotId)
      if (!targetSlot || targetSlot.locked) return current

      const occupied = current.find(
        (slot) => slot.id !== slotId && slot.attribute === attribute,
      )
      if (occupied?.locked) return current

      const previousAttribute = targetSlot.attribute
      const nextSlots = current.map((slot) => {
        if (slot.id === slotId) return { ...slot, attribute }
        if (occupied && slot.id === occupied.id) {
          return { ...slot, attribute: previousAttribute }
        }
        return slot
      })

      setRace((currentRace) =>
        applyRaceBonusSlots(currentRace, nextSlots),
      )
      return nextSlots
    })
  }

  function selectBackgroundPreset(preset: BackgroundPreset) {
    const cloned = cloneBackground(preset)
    setBackgroundPresetId(preset.id)
    setBackground(cloned)
    setEquipmentText(backgroundEquipmentText(cloned))
  }

  function selectCustomBackground() {
    setBackgroundPresetId("custom")
    setBackground((current) => ({
      ...current,
      id: "custom",
      name:
        current.name === "Antecedente personalizado"
          ? current.name
          : `${current.name} personalizado`,
      custom: true,
    }))
  }

  function selectClassPreset(preset: ClassPreset) {
    setClassName(preset.id)
    setClassSkills([])
    setAttributes({ ...preset.recommendedAttributes })
    setMaxHp(
      calculateSuggestedHp(
        preset,
        level,
        preset.recommendedAttributes.con,
      ),
    )
  }

  function updateLevel(nextLevel: number) {
    const clamped = Math.max(1, Math.min(20, Math.trunc(nextLevel || 1)))
    setLevel(clamped)
    setMaxHp(
      calculateSuggestedHp(selectedClass, clamped, attributes.con),
    )
  }

  function updateAttribute(attribute: Attribute, delta: -1 | 1) {
    const nextValue = Math.max(
      1,
      Math.min(30, attributes[attribute] + delta),
    )
    const nextAttributes = { ...attributes, [attribute]: nextValue }
    setAttributes(nextAttributes)

    if (attribute === "con") {
      setMaxHp(calculateSuggestedHp(selectedClass, level, nextValue))
    }
  }

  function toggleClassSkill(skill: Skill) {
    if (background.skillProficiencies.includes(skill)) return

    setClassSkills((current) => {
      if (current.includes(skill)) {
        return current.filter((entry) => entry !== skill)
      }

      if (current.length >= selectedClass.skillChoices) return current
      return [...current, skill]
    })
  }

  function toggleBackgroundSkill(skill: Skill) {
    setBackground((current) => ({
      ...current,
      skillProficiencies: current.skillProficiencies.includes(skill)
        ? current.skillProficiencies.filter((entry) => entry !== skill)
        : [...current.skillProficiencies, skill],
      custom: true,
    }))
    setBackgroundPresetId("custom")
  }

  function createCharacter() {
    const base = newCharacterTemplate(name.trim() || "Personagem", chosenOwner)
    const classEntry = createCharacterClass(className, level as ClassLevel)
    const backgroundEquipment = equipmentTextToItems(equipmentText)
    const racialSkills = getRacialSkills(race)
    const skillSet = new Set<Skill>([
      ...racialSkills,
      ...background.skillProficiencies,
      ...classSkills,
    ])
    const skills = Object.fromEntries(
      Array.from(skillSet).map((skill) => [skill, "proficient"]),
    )
    const hitDie = selectedClass.hitDie
    const hitDice = {
      [hitDie]: {
        max: { quantity: level, sides: hitDie },
        current: { quantity: level, sides: hitDie },
      },
    }
    const historyHeader = [
      `Antecedente: ${background.name}`,
      background.description,
      background.featureName
        ? `Característica: ${background.featureName}`
        : "",
      background.featureDescription ?? "",
    ]
      .filter(Boolean)
      .join("\n")

    const character = base.withPatch({
      visibility,
      profile: {
        ...base.get("profile"),
        history: historyHeader,
      },
      sheet: {
        ...base.get("sheet"),
        attributes: { ...attributes },
        savingThrowProficiencies: Object.fromEntries(
          selectedClass.savingThrows.map((attribute) => [attribute, true]),
        ),
        skills,
        proficiencies: [
          ...selectedClass.proficiencies.map((entry) => ({ ...entry })),
          ...background.proficiencies.map((entry) => ({ ...entry })),
        ],
        race: {
          ...race,
          naturalAbilities: race.naturalAbilities.map((entry) => ({ ...entry })),
          proficiencies: race.proficiencies.map((entry) => ({ ...entry })),
          attributeBonus: { ...race.attributeBonus },
        },
        classes: [classEntry],
        HP: {
          max: Math.max(1, Math.trunc(maxHp)),
          current: Math.max(1, Math.trunc(maxHp)),
          temporary: 0,
          hitDice,
        },
      },
      inventory: backgroundEquipment,
    })

    onCreate(character)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/65 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-creation-title"
        className="grid h-[100dvh] w-full min-w-0 max-w-[100vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-border bg-bg-elevated text-text shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl sm:rounded-xl sm:border"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="min-w-0 overflow-hidden border-b border-border p-3 sm:p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="character-creation-title"
                className="text-base font-semibold text-textH"
              >
                Criar personagem
              </h2>
              <p className="mt-1 break-words text-xs text-textMuted">
                Presets do Livro do Jogador com todos os campos editáveis.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex max-w-full gap-1 overflow-x-auto pb-1">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={
                  index === step
                    ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-[11px] font-semibold text-textH"
                    : index < step
                      ? "shrink-0 rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-[11px] text-text"
                      : "shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] text-textMuted"
                }
              >
                {index < step ? "✓ " : ""}
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </header>

        <main className="min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-5">
          {step === 0 ? (
            <IdentityStep
              name={name}
              ownerName={ownerName}
              visibility={visibility}
              owners={owners}
              canAssignOwners={canAssignOwners}
              onNameChange={setName}
              onOwnerChange={setOwnerName}
              onVisibilityChange={setVisibility}
            />
          ) : null}

          {step === 1 ? (
            <RaceStep
              selectedPresetId={racePresetId}
              race={race}
              onSelectPreset={selectRacePreset}
              onSelectCustom={selectCustomRace}
              onChange={setRace}
            />
          ) : null}

          {step === 2 ? (
            <BackgroundStep
              selectedPresetId={backgroundPresetId}
              background={background}
              equipmentText={equipmentText}
              onSelectPreset={selectBackgroundPreset}
              onSelectCustom={selectCustomBackground}
              onChange={setBackground}
              onEquipmentChange={setEquipmentText}
              onToggleSkill={toggleBackgroundSkill}
            />
          ) : null}

          {step === 3 ? (
            <ClassStep
              selectedClass={selectedClass}
              level={level}
              maxHp={maxHp}
              selectedSkills={classSkills}
              backgroundSkills={background.skillProficiencies}
              onSelectClass={selectClassPreset}
              onLevelChange={updateLevel}
              onMaxHpChange={setMaxHp}
              onToggleSkill={toggleClassSkill}
            />
          ) : null}

          {step === 4 ? (
            <AttributesStep
              attributes={attributes}
              raceBonuses={race.attributeBonus}
              bonusSlots={raceBonusSlots}
              onChange={updateAttribute}
              onMoveBonus={moveRaceBonus}
            />
          ) : null}

          {step === 5 ? (
            <ReviewStep
              name={name}
              owner={chosenOwner}
              visibility={visibility}
              race={race}
              background={background}
              classPreset={selectedClass}
              level={level}
              baseAttributes={attributes}
              finalAttributes={finalAttributes}
              maxHp={maxHp}
              classSkills={classSkills}
              equipmentText={equipmentText}
            />
          ) : null}
        </main>

        <footer className="flex min-w-0 max-w-full flex-col-reverse gap-2 overflow-hidden border-t border-border bg-bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <Button
            variant="secondary"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                disabled={!canContinue}
                onClick={() =>
                  setStep((current) =>
                    Math.min(STEPS.length - 1, current + 1),
                  )
                }
              >
                Continuar
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={name.trim().length === 0}
                onClick={createCharacter}
              >
                <Check className="h-4 w-4" />
                Criar personagem
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

function IdentityStep({
  name,
  ownerName,
  visibility,
  owners,
  canAssignOwners,
  onNameChange,
  onOwnerChange,
  onVisibilityChange,
}: {
  name: string
  ownerName: string
  visibility: Visibility
  owners: Player[]
  canAssignOwners: boolean
  onNameChange: (value: string) => void
  onOwnerChange: (value: string) => void
  onVisibilityChange: (value: Visibility) => void
}) {
  return (
    <StepSection
      title="Identidade básica"
      description="Defina quem é o personagem e quem poderá controlá-lo."
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-medium text-textH">Nome</span>
          <Input
            autoFocus
            value={name}
            placeholder="Nome do personagem"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>

        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-medium text-textH">Dono</span>
          <Input
            value={ownerName}
            disabled={!canAssignOwners}
            list="character-owner-options"
            onChange={(event) => onOwnerChange(event.target.value)}
          />
          <datalist id="character-owner-options">
            {owners.map((owner) => (
              <option key={owner.id} value={owner.name} />
            ))}
          </datalist>
        </label>

        <label className="grid min-w-0 gap-1.5 md:col-span-2">
          <span className="text-xs font-medium text-textH">Visibilidade</span>
          <Select
            value={visibility}
            onChange={(event) =>
              onVisibilityChange(event.target.value as Visibility)
            }
          >
            <option value="party">Grupo</option>
            <option value="private">Privado</option>
            {canAssignOwners ? <option value="master">Apenas mestre</option> : null}
          </Select>
        </label>
      </div>
    </StepSection>
  )
}

function RaceStep({
  selectedPresetId,
  race,
  onSelectPreset,
  onSelectCustom,
  onChange,
}: {
  selectedPresetId: string
  race: CharacterRace
  onSelectPreset: (preset: RacePreset) => void
  onSelectCustom: () => void
  onChange: (race: CharacterRace) => void
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Preset racial"
        description="Escolha uma raça do Livro do Jogador. O preset preenche os campos; bônus fixos ficam travados e bônus flexíveis podem ser redistribuídos na etapa de atributos."
      >
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PHB_RACE_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              selected={selectedPresetId === preset.id}
              title={preset.name}
              description={preset.summary}
              onClick={() => onSelectPreset(preset)}
            />
          ))}
          <PresetCard
            selected={selectedPresetId === "custom"}
            title="Personalizada"
            description="Usa um bônus flexível de +2 e outro de +1, reposicionáveis na etapa de atributos."
            onClick={onSelectCustom}
          />
        </div>
      </StepSection>

      <StepSection title="Personalização racial">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Sub-raça</span>
            <Input
              value={race.subrace}
              onChange={(event) =>
                onChange({ ...race, subrace: event.target.value })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Tamanho</span>
            <Select
              value={race.size ?? "medium"}
              onChange={(event) =>
                onChange({
                  ...race,
                  size: event.target.value as CreatureSize,
                })
              }
            >
              {Object.entries(SIZE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Ajuste de deslocamento
            </span>
            <Input
              type="number"
              step="0.5"
              value={race.speedBonus ?? 0}
              onChange={(event) =>
                onChange({
                  ...race,
                  speedBonus: Number(event.target.value) || 0,
                })
              }
            />
          </label>
          <div className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3 text-xs text-textMuted">
            Deslocamento base do sistema: 9 m. O ajuste racial é somado a ele.
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
          {race.naturalAbilities.map((ability) => (
            <div
              key={ability.id}
              className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
            >
              <div className="break-words text-sm font-semibold text-textH">
                {ability.name}
              </div>
              <div className="mt-1 break-words text-xs leading-5 text-textMuted">
                {ability.description}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 break-words text-[11px] text-textMuted">
          Habilidades naturais e proficiências podem ser editadas detalhadamente na aba Raça após a criação.
        </p>
      </StepSection>
    </div>
  )
}

function BackgroundStep({
  selectedPresetId,
  background,
  equipmentText,
  onSelectPreset,
  onSelectCustom,
  onChange,
  onEquipmentChange,
  onToggleSkill,
}: {
  selectedPresetId: string
  background: CharacterBackground
  equipmentText: string
  onSelectPreset: (preset: BackgroundPreset) => void
  onSelectCustom: () => void
  onChange: (background: CharacterBackground) => void
  onEquipmentChange: (value: string) => void
  onToggleSkill: (skill: Skill) => void
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Antecedente"
        description="Escolha um antecedente do Livro do Jogador ou use-o apenas como ponto de partida."
      >
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PHB_BACKGROUND_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              selected={selectedPresetId === preset.id}
              title={preset.name}
              description={preset.summary}
              onClick={() => onSelectPreset(preset)}
            />
          ))}
          <PresetCard
            selected={selectedPresetId === "custom"}
            title="Personalizado"
            description="Edite nome, perícias, característica e equipamento."
            onClick={onSelectCustom}
          />
        </div>
      </StepSection>

      <StepSection title="Personalização do antecedente">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Nome</span>
            <Input
              value={background.name}
              onChange={(event) =>
                onChange({
                  ...background,
                  name: event.target.value,
                  custom: true,
                })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Característica
            </span>
            <Input
              value={background.featureName ?? ""}
              onChange={(event) =>
                onChange({
                  ...background,
                  featureName: event.target.value,
                  custom: true,
                })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-textH">Descrição</span>
            <Textarea
              value={background.description}
              onChange={(event) =>
                onChange({
                  ...background,
                  description: event.target.value,
                  custom: true,
                })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-textH">
              Descrição da característica
            </span>
            <Textarea
              value={background.featureDescription ?? ""}
              onChange={(event) =>
                onChange({
                  ...background,
                  featureDescription: event.target.value,
                  custom: true,
                })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-textH">
              Equipamento inicial — um item por linha
            </span>
            <Textarea
              value={equipmentText}
              onChange={(event) => onEquipmentChange(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 min-w-0">
          <div className="text-xs font-semibold text-textH">
            Perícias do antecedente
          </div>
          <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(SKILL_LABELS).map(([skill, label]) => (
              <SkillToggle
                key={skill}
                label={label}
                selected={background.skillProficiencies.includes(
                  skill as Skill,
                )}
                onClick={() => onToggleSkill(skill as Skill)}
              />
            ))}
          </div>
        </div>

        <p className="mt-3 break-words text-[11px] text-textMuted">
          Ferramentas, idiomas e outras proficiências do preset serão adicionados à ficha e poderão ser alterados na aba Proficiências.
        </p>
      </StepSection>
    </div>
  )
}

function ClassStep({
  selectedClass,
  level,
  maxHp,
  selectedSkills,
  backgroundSkills,
  onSelectClass,
  onLevelChange,
  onMaxHpChange,
  onToggleSkill,
}: {
  selectedClass: ClassPreset
  level: number
  maxHp: number
  selectedSkills: Skill[]
  backgroundSkills: Skill[]
  onSelectClass: (preset: ClassPreset) => void
  onLevelChange: (level: number) => void
  onMaxHpChange: (hp: number) => void
  onToggleSkill: (skill: Skill) => void
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Classe inicial"
        description="As doze classes do Livro do Jogador estão disponíveis. Multiclasse pode ser configurada depois."
      >
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PHB_CLASS_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              selected={selectedClass.id === preset.id}
              title={`${preset.name} · ${preset.hitDie}`}
              description={preset.summary}
              onClick={() => onSelectClass(preset)}
            />
          ))}
        </div>
      </StepSection>

      <StepSection title="Nível, vida e perícias">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Nível</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(event) => onLevelChange(Number(event.target.value))}
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Pontos de vida máximos
            </span>
            <Input
              type="number"
              min={1}
              value={maxHp}
              onChange={(event) =>
                onMaxHpChange(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </label>
        </div>

        <div className="mt-4 min-w-0 rounded-xl border border-border bg-bg-subtle p-3 text-xs text-text">
          Salvaguardas: {selectedClass.savingThrows.map((entry) => ATTRIBUTE_LABELS[entry]).join(" e ")}.
          Escolha até {selectedClass.skillChoices} perícias de classe.
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {selectedClass.availableSkills.map((skill) => {
            const inheritedFromBackground = backgroundSkills.includes(skill)
            const choiceLimitReached =
              !selectedSkills.includes(skill) &&
              selectedSkills.length >= selectedClass.skillChoices

            return (
              <SkillToggle
                key={skill}
                label={SKILL_LABELS[skill]}
                selected={selectedSkills.includes(skill)}
                disabled={inheritedFromBackground || choiceLimitReached}
                conflict={inheritedFromBackground}
                note={
                  inheritedFromBackground
                    ? "Antecedente"
                    : selectedSkills.includes(skill)
                      ? "Classe"
                      : undefined
                }
                onClick={() => onToggleSkill(skill)}
              />
            )
          })}
        </div>

        {backgroundSkills.some((skill) =>
          selectedClass.availableSkills.includes(skill),
        ) ? (
          <p className="mt-3 text-[11px] leading-5 text-danger">
            Perícias vermelhas já são concedidas pelo antecedente. Elas ficam bloqueadas e não consomem uma escolha de classe.
          </p>
        ) : null}
      </StepSection>
    </div>
  )
}

function AttributesStep({
  attributes,
  raceBonuses,
  bonusSlots,
  onChange,
  onMoveBonus,
}: {
  attributes: Record<Attribute, number>
  raceBonuses: Partial<Record<Attribute, number>>
  bonusSlots: RaceBonusSlot[]
  onChange: (attribute: Attribute, delta: -1 | 1) => void
  onMoveBonus: (slotId: string, attribute: Attribute) => void
}) {
  const hasFlexibleBonuses = bonusSlots.some((slot) => !slot.locked)

  return (
    <StepSection
      title="Atributos"
      description="Ajuste os valores base com − e +. Os botões raciais funcionam como em BG3: bônus fixos ficam travados e bônus flexíveis podem ser movidos."
    >
      <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-textMuted">
        {bonusSlots.map((slot) => (
          <span
            key={slot.id}
            className={
              slot.locked
                ? "rounded-full border border-border bg-bg-subtle px-3 py-1"
                : "rounded-full border border-accentBorder bg-accentBg px-3 py-1 text-textH"
            }
          >
            +{slot.amount} {slot.attribute ? ATTRIBUTE_SHORT[slot.attribute] : "não atribuído"}
            {slot.locked ? " · fixo" : " · flexível"}
          </span>
        ))}
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ATTRIBUTE_KEYS.map((attribute) => {
          const base = attributes[attribute]
          const racial = raceBonuses[attribute] ?? 0
          const assignedSlots = bonusSlots.filter(
            (slot) => slot.attribute === attribute,
          )

          return (
            <div
              key={attribute}
              className="grid min-w-0 gap-3 rounded-xl border border-border bg-bg-subtle p-3"
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-textH">
                    {ATTRIBUTE_LABELS[attribute]}
                  </div>
                  <div className="text-[11px] text-textMuted">
                    Final {base + racial} · racial {racial >= 0 ? "+" : ""}{racial}
                  </div>
                </div>
                <div className="text-2xl font-bold text-textH">{base}</div>
              </div>

              <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                <button
                  type="button"
                  aria-label={`Diminuir ${ATTRIBUTE_LABELS[attribute]}`}
                  disabled={base <= 1}
                  onClick={() => onChange(attribute, -1)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-bg text-textH disabled:opacity-35"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="rounded-lg border border-border bg-bg px-3 py-2 text-center text-lg font-bold text-textH">
                  {base}
                </div>
                <button
                  type="button"
                  aria-label={`Aumentar ${ATTRIBUTE_LABELS[attribute]}`}
                  disabled={base >= 30}
                  onClick={() => onChange(attribute, 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-bg text-textH disabled:opacity-35"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {bonusSlots
                  .filter((slot) => slot.amount === 2 || slot.amount === 1)
                  .map((slot) => {
                    const active = slot.attribute === attribute
                    const occupiedByLockedSlot = bonusSlots.some(
                      (other) =>
                        other.id !== slot.id &&
                        other.attribute === attribute &&
                        other.locked,
                    )
                    const disabled =
                      slot.locked || (!active && occupiedByLockedSlot)

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onMoveBonus(slot.id, attribute)}
                        className={
                          active
                            ? slot.locked
                              ? "rounded-lg border border-borderStrong bg-bg px-2 py-2 text-xs font-bold text-textMuted"
                              : "rounded-lg border border-accentBorder bg-accentBg px-2 py-2 text-xs font-bold text-textH"
                            : "rounded-lg border border-border bg-bg px-2 py-2 text-xs font-semibold text-textMuted disabled:cursor-not-allowed disabled:opacity-35"
                        }
                      >
                        +{slot.amount}
                        {slot.locked ? " 🔒" : ""}
                      </button>
                    )
                  })}
              </div>

              {assignedSlots.length > 0 ? (
                <div className="text-[10px] text-textMuted">
                  {assignedSlots
                    .map(
                      (slot) =>
                        `+${slot.amount}${slot.locked ? " fixo" : " flexível"}`,
                    )
                    .join(" · ")}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {!hasFlexibleBonuses ? (
        <p className="mt-4 text-[11px] leading-5 text-textMuted">
          Esta raça usa bônus fixos do Livro do Jogador. Selecione “Personalizada” na etapa de raça para distribuir livremente +2 e +1.
        </p>
      ) : null}
    </StepSection>
  )
}

function ReviewStep({
  name,
  owner,
  visibility,
  race,
  background,
  classPreset,
  level,
  baseAttributes,
  finalAttributes,
  maxHp,
  classSkills,
  equipmentText,
}: {
  name: string
  owner: Player
  visibility: Visibility
  race: CharacterRace
  background: CharacterBackground
  classPreset: ClassPreset
  level: number
  baseAttributes: Record<Attribute, number>
  finalAttributes: Record<Attribute, number>
  maxHp: number
  classSkills: Skill[]
  equipmentText: string
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ReviewCard title="Identidade">
        <ReviewLine label="Nome" value={name || "Sem nome"} />
        <ReviewLine label="Dono" value={owner.name} />
        <ReviewLine label="Visibilidade" value={visibility} />
      </ReviewCard>

      <ReviewCard title="Raça">
        <ReviewLine label="Raça" value={race.race} />
        <ReviewLine label="Sub-raça" value={race.subrace || "—"} />
        <ReviewLine label="Tamanho" value={SIZE_LABELS[race.size ?? "medium"]} />
        <ReviewLine
          label="Habilidades naturais"
          value={String(race.naturalAbilities.length)}
        />
      </ReviewCard>

      <ReviewCard title="Antecedente">
        <ReviewLine label="Nome" value={background.name} />
        <ReviewLine
          label="Perícias"
          value={
            background.skillProficiencies
              .map((skill) => SKILL_LABELS[skill])
              .join(", ") || "Nenhuma"
          }
        />
        <ReviewLine
          label="Equipamento"
          value={
            equipmentText
              .split("\n")
              .filter((entry) => entry.trim())
              .join(", ") || "Nenhum"
          }
        />
      </ReviewCard>

      <ReviewCard title="Classe">
        <ReviewLine label="Classe" value={classPreset.name} />
        <ReviewLine label="Nível" value={String(level)} />
        <ReviewLine label="Vida máxima" value={String(maxHp)} />
        <ReviewLine label="Dado de vida" value={classPreset.hitDie} />
        <ReviewLine
          label="Perícias escolhidas"
          value={
            classSkills.map((skill) => SKILL_LABELS[skill]).join(", ") ||
            "Nenhuma"
          }
        />
      </ReviewCard>

      <ReviewCard title="Atributos" className="lg:col-span-2">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <div
              key={attribute}
              className="min-w-0 rounded-lg border border-border bg-bg-subtle p-3 text-center"
            >
              <div className="text-[10px] uppercase text-textMuted">
                {ATTRIBUTE_LABELS[attribute]}
              </div>
              <div className="mt-1 text-xl font-bold text-textH">
                {finalAttributes[attribute]}
              </div>
              <div className="text-[10px] text-textMuted">
                base {baseAttributes[attribute]}
              </div>
            </div>
          ))}
        </div>
      </ReviewCard>
    </div>
  )
}

function StepSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-4 min-w-0">
        <h3 className="break-words text-base font-semibold text-textH">{title}</h3>
        {description ? (
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function PresetCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "min-h-24 min-w-0 max-w-full overflow-hidden rounded-xl border border-accentBorder bg-accentBg p-3 text-left shadow-theme-sm"
          : "min-h-24 min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-bg-subtle p-3 text-left hover:border-borderStrong hover:bg-bg"
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-semibold text-textH">
          {title}
        </span>
        {selected ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
      </div>
      <p className="mt-1 break-words text-xs leading-5 text-textMuted">
        {description}
      </p>
    </button>
  )
}

function SkillToggle({
  label,
  selected,
  disabled = false,
  conflict = false,
  note,
  onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  conflict?: boolean
  note?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        conflict
          ? "min-w-0 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs font-semibold text-danger"
          : selected
            ? "min-w-0 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
            : "min-w-0 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text disabled:opacity-40"
      }
    >
      <span className="block break-words">{label}</span>
      {note ? (
        <span className="mt-0.5 block text-[9px] uppercase tracking-wide opacity-80">
          {note}
        </span>
      ) : null}
    </button>
  )
}

function ReviewCard({
  title,
  className = "",
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-border bg-bg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-textH">{title}</h3>
      <div className="mt-3 grid min-w-0 gap-2">{children}</div>
    </section>
  )
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 text-xs">
      <span className="shrink-0 text-textMuted">{label}</span>
      <span className="min-w-0 max-w-[70%] break-words text-right font-medium text-textH">
        {value}
      </span>
    </div>
  )
}

function getRaceBonusSlots(
  presetId: string,
  bonuses: Partial<Record<Attribute, number>>,
): RaceBonusSlot[] {
  if (presetId === "variant-human") {
    return [
      { id: "variant-plus-one-a", amount: 1, attribute: "str", locked: false },
      { id: "variant-plus-one-b", amount: 1, attribute: "dex", locked: false },
    ]
  }

  if (presetId === "half-elf") {
    return [
      { id: "half-elf-plus-two", amount: 2, attribute: "cha", locked: true },
      { id: "half-elf-plus-one-a", amount: 1, attribute: "dex", locked: false },
      { id: "half-elf-plus-one-b", amount: 1, attribute: "con", locked: false },
    ]
  }

  const slots: RaceBonusSlot[] = []
  ATTRIBUTE_KEYS.forEach((attribute) => {
    const amount = bonuses[attribute] ?? 0
    if (amount === 0) return
    slots.push({
      id: `${presetId}-${attribute}-${amount}`,
      amount,
      attribute,
      locked: true,
    })
  })
  return slots
}

function applyRaceBonusSlots(
  race: CharacterRace,
  slots: RaceBonusSlot[],
): CharacterRace {
  const attributeBonus = ATTRIBUTE_KEYS.reduce(
    (result, attribute) => ({ ...result, [attribute]: 0 }),
    {} as Record<Attribute, number>,
  )

  slots.forEach((slot) => {
    if (!slot.attribute) return
    attributeBonus[slot.attribute] += slot.amount
  })

  return { ...race, attributeBonus }
}

function cloneBackground(background: CharacterBackground): CharacterBackground {
  return {
    ...background,
    skillProficiencies: [...background.skillProficiencies],
    proficiencies: background.proficiencies.map((entry) => ({ ...entry })),
    startingEquipment: background.startingEquipment.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
    })) as Itemmable[],
  }
}

function backgroundEquipmentText(background: CharacterBackground): string {
  return background.startingEquipment
    .map((entry) =>
      entry.quantity > 1 ? `${entry.name} ×${entry.quantity}` : entry.name,
    )
    .join("\n")
}

function equipmentTextToItems(value: string): Itemmable[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((name) => ({
      id: crypto.randomUUID(),
      name,
      desc: "Equipamento inicial da criação do personagem.",
      notes: "",
      quantity: 1,
      weight: 0,
      pocketable: false,
      kind: "common" as const,
    }))
}

function createCharacterClass(
  className: ClassName,
  level: ClassLevel,
): CharacterClassInterface {
  const builder = new CharacterClassBuilder()
  let created

  switch (className) {
    case "barbarian": created = builder.barbarian(); break
    case "bard": created = builder.bard(); break
    case "cleric": created = builder.cleric(); break
    case "druid": created = builder.druid(); break
    case "fighter": created = builder.fighter(); break
    case "monk": created = builder.monk(); break
    case "paladin": created = builder.paladin(); break
    case "ranger": created = builder.ranger(); break
    case "rogue": created = builder.rogue(); break
    case "sorcerer": created = builder.sorcerer(); break
    case "warlock": created = builder.warlock(); break
    case "wizard": created = builder.wizard(); break
    default: created = builder.fighter()
  }

  created.level = level
  return created
}

function calculateSuggestedHp(
  classPreset: ClassPreset,
  level: number,
  constitution: number,
): number {
  const dieMaximum = Number(classPreset.hitDie.slice(1))
  const constitutionModifier = Math.floor((constitution - 10) / 2)
  const laterLevelAverage = Math.floor(dieMaximum / 2) + 1

  return Math.max(
    1,
    dieMaximum + constitutionModifier +
      Math.max(0, level - 1) * Math.max(1, laterLevelAverage + constitutionModifier),
  )
}

function getRacialSkills(race: CharacterRace): Skill[] {
  const entries = Object.entries(SKILL_LABELS) as Array<[Skill, string]>
  return race.proficiencies.flatMap((proficiency) => {
    if (proficiency.category !== "skill") return []
    const normalized = proficiency.name.toLocaleLowerCase("pt-BR")
    const match = entries.find(
      ([, label]) => label.toLocaleLowerCase("pt-BR") === normalized,
    )
    return match ? [match[0]] : []
  })
}
