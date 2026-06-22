import { useEffect, useMemo, useState, type ReactNode } from "react"
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
  averageStartingGold,
  formatStartingGoldFormula,
  getDefaultClassEquipmentSelections,
  getPhbClassEquipmentPreset,
  getSelectedClassEquipment,
  rollStartingGold,
  type StartingItemCategory,
} from "./phbClassEquipment"
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
import {
  createStartingGoldItem,
  createStartingInventoryItem,
} from "./startingEquipmentItems"

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

const EQUIPMENT_CATEGORY_LABELS: Record<StartingItemCategory, string> = {
  weapon: "Arma",
  armor: "Armadura",
  shield: "Escudo",
  ammunition: "Munição",
  tool: "Ferramenta",
  focus: "Foco",
  instrument: "Instrumento",
  pack: "Pacote",
  gear: "Equipamento",
  currency: "Moeda",
}

type Visibility = "private" | "party" | "master"
type EquipmentMode = "equipment" | "gold"

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
  const [visibility, setVisibility] = useState<Visibility>("private")

  const [racePresetId, setRacePresetId] = useState(firstRace.id)
  const [race, setRace] = useState<CharacterRace>(
    racePresetToCharacterRace(firstRace),
  )
  const [raceBonusSlots, setRaceBonusSlots] = useState<RaceBonusSlot[]>(
    getRaceBonusSlots(firstRace.id, firstRace.attributeBonus),
  )
  const [racialSkillChoices, setRacialSkillChoices] = useState<Skill[]>([])

  const [backgroundPresetId, setBackgroundPresetId] = useState(
    firstBackground.id,
  )
  const [background, setBackground] = useState<CharacterBackground>(
    cloneBackground(firstBackground),
  )
  const [backgroundEquipmentText, setBackgroundEquipmentText] = useState(
    getBackgroundEquipmentText(firstBackground),
  )

  const [className, setClassName] = useState<ClassName>(firstClass.id)
  const [level, setLevel] = useState(1)
  const [classSkills, setClassSkills] = useState<Skill[]>([])
  const [equipmentMode, setEquipmentMode] =
    useState<EquipmentMode>("equipment")
  const [equipmentSelections, setEquipmentSelections] = useState<
    Record<string, string>
  >(getDefaultClassEquipmentSelections(firstClass.id))
  const [equipmentFlavors, setEquipmentFlavors] = useState<
    Record<string, string>
  >({})
  const firstEquipmentPreset = getPhbClassEquipmentPreset(firstClass.id)
  const [startingGold, setStartingGold] = useState(
    firstEquipmentPreset
      ? averageStartingGold(firstEquipmentPreset.startingGold)
      : 0,
  )

  const [attributes, setAttributes] = useState<Record<Attribute, number>>({
    ...firstClass.recommendedAttributes,
  })
  const [maxHp, setMaxHp] = useState(
    calculateSuggestedHp(firstClass, 1, firstClass.recommendedAttributes.con),
  )

  const selectedClass = useMemo(
    () =>
      PHB_CLASS_PRESETS.find((entry) => entry.id === className) ?? firstClass,
    [className, firstClass],
  )
  const classEquipmentPreset = useMemo(
    () => getPhbClassEquipmentPreset(className),
    [className],
  )
  const selectedClassEquipment = useMemo(
    () => getSelectedClassEquipment(className, equipmentSelections),
    [className, equipmentSelections],
  )

  const fixedRacialSkills = useMemo(() => getFixedRacialSkills(race), [race])
  const racialSkillChoiceLimit = getRacialSkillChoiceLimit(racePresetId)
  const allRacialSkills = useMemo(
    () => Array.from(new Set([...fixedRacialSkills, ...racialSkillChoices])),
    [fixedRacialSkills, racialSkillChoices],
  )

  useEffect(() => {
    if (!open) return

    const initialRace = racePresetToCharacterRace(firstRace)
    const initialSlots = getRaceBonusSlots(
      firstRace.id,
      firstRace.attributeBonus,
    )
    const equipmentPreset = getPhbClassEquipmentPreset(firstClass.id)

    setStep(0)
    setName("")
    setOwnerName(defaultOwner.name)
    setVisibility("private")
    setRacePresetId(firstRace.id)
    setRace(applyRaceBonusSlots(initialRace, initialSlots))
    setRaceBonusSlots(initialSlots)
    setRacialSkillChoices([])
    setBackgroundPresetId(firstBackground.id)
    setBackground(cloneBackground(firstBackground))
    setBackgroundEquipmentText(getBackgroundEquipmentText(firstBackground))
    setClassName(firstClass.id)
    setLevel(1)
    setClassSkills([])
    setEquipmentMode("equipment")
    setEquipmentSelections(
      getDefaultClassEquipmentSelections(firstClass.id),
    )
    setEquipmentFlavors({})
    setStartingGold(
      equipmentPreset
        ? averageStartingGold(equipmentPreset.startingGold)
        : 0,
    )
    setAttributes({ ...firstClass.recommendedAttributes })
    setMaxHp(
      calculateSuggestedHp(
        firstClass,
        1,
        firstClass.recommendedAttributes.con,
      ),
    )
  }, [defaultOwner.id, open])

  useEffect(() => {
    const blocked = new Set([
      ...background.skillProficiencies,
      ...allRacialSkills,
    ])
    setClassSkills((current) =>
      current.filter((skill) => !blocked.has(skill)),
    )
  }, [allRacialSkills, background.skillProficiencies])

  useEffect(() => {
    const blocked = new Set(background.skillProficiencies)
    setRacialSkillChoices((current) =>
      current.filter((skill) => !blocked.has(skill)),
    )
  }, [background.skillProficiencies])

  if (!open) return null

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
    setRacialSkillChoices([])
  }

  function selectCustomRace() {
    const slots: RaceBonusSlot[] = [
      {
        id: "custom-plus-two",
        amount: 2,
        attribute: "str",
        locked: false,
      },
      {
        id: "custom-plus-one",
        amount: 1,
        attribute: "dex",
        locked: false,
      },
    ]

    setRacePresetId("custom")
    setRaceBonusSlots(slots)
    setRacialSkillChoices([])
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

      setRace((currentRace) => applyRaceBonusSlots(currentRace, nextSlots))
      return nextSlots
    })
  }

  function toggleRacialSkill(skill: Skill) {
    if (
      fixedRacialSkills.includes(skill) ||
      background.skillProficiencies.includes(skill)
    ) {
      return
    }

    setRacialSkillChoices((current) => {
      if (current.includes(skill)) {
        return current.filter((entry) => entry !== skill)
      }
      if (current.length >= racialSkillChoiceLimit) return current
      return [...current, skill]
    })
  }

  function selectBackgroundPreset(preset: BackgroundPreset) {
    const cloned = cloneBackground(preset)
    setBackgroundPresetId(preset.id)
    setBackground(cloned)
    setBackgroundEquipmentText(getBackgroundEquipmentText(cloned))
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

  function toggleBackgroundSkill(skill: Skill) {
    if (allRacialSkills.includes(skill)) return

    setBackground((current) => ({
      ...current,
      skillProficiencies: current.skillProficiencies.includes(skill)
        ? current.skillProficiencies.filter((entry) => entry !== skill)
        : [...current.skillProficiencies, skill],
      custom: true,
    }))
    setBackgroundPresetId("custom")
  }

  function selectClassPreset(preset: ClassPreset) {
    const equipmentPreset = getPhbClassEquipmentPreset(preset.id)

    setClassName(preset.id)
    setClassSkills([])
    setEquipmentMode("equipment")
    setEquipmentSelections(getDefaultClassEquipmentSelections(preset.id))
    setEquipmentFlavors({})
    setStartingGold(
      equipmentPreset
        ? averageStartingGold(equipmentPreset.startingGold)
        : 0,
    )
    setAttributes({ ...preset.recommendedAttributes })
    setMaxHp(
      calculateSuggestedHp(
        preset,
        level,
        preset.recommendedAttributes.con,
      ),
    )
  }

  function toggleClassSkill(skill: Skill) {
    if (
      background.skillProficiencies.includes(skill) ||
      allRacialSkills.includes(skill)
    ) {
      return
    }

    setClassSkills((current) => {
      if (current.includes(skill)) {
        return current.filter((entry) => entry !== skill)
      }
      if (current.length >= selectedClass.skillChoices) return current
      return [...current, skill]
    })
  }

  function updateLevel(nextLevel: number) {
    const clamped = Math.max(1, Math.min(20, Math.trunc(nextLevel || 1)))
    setLevel(clamped)
    setMaxHp(calculateSuggestedHp(selectedClass, clamped, attributes.con))
  }

  function updateAttribute(attribute: Attribute, delta: -1 | 1) {
    const nextValue = Math.max(
      1,
      Math.min(30, attributes[attribute] + delta),
    )
    setAttributes((current) => ({ ...current, [attribute]: nextValue }))

    if (attribute === "con") {
      setMaxHp(calculateSuggestedHp(selectedClass, level, nextValue))
    }
  }

  function createCharacter() {
    const base = newCharacterTemplate(name.trim() || "Personagem", chosenOwner)
    const classEntry = createCharacterClass(className, level as ClassLevel)
    const skills = Object.fromEntries(
      Array.from(
        new Set([
          ...allRacialSkills,
          ...background.skillProficiencies,
          ...classSkills,
        ]),
      ).map((skill) => [skill, "proficient"]),
    )
    const hitDie = selectedClass.hitDie
    const history = [
      `Antecedente: ${background.name}`,
      background.description,
      background.featureName
        ? `Característica: ${background.featureName}`
        : "",
      background.featureDescription ?? "",
    ]
      .filter(Boolean)
      .join("\n")

    const backgroundInventory = equipmentTextToItems(
      backgroundEquipmentText,
      "Equipamento inicial do antecedente.",
    )
    const classInventory =
      equipmentMode === "gold"
        ? startingGold > 0
          ? [createStartingGoldItem(startingGold)]
          : []
        : selectedClassEquipment.map((item, index) =>
            createStartingInventoryItem(
              item,
              equipmentFlavors[`${item.id}:${index}`],
            ),
          )

    const character = base.withPatch({
      visibility,
      profile: {
        ...base.get("profile"),
        history,
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
          hitDice: {
            [hitDie]: {
              max: { quantity: level, sides: hitDie },
              current: { quantity: level, sides: hitDie },
            },
          },
        },
      },
      inventory: [...backgroundInventory, ...classInventory],
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
                Presets do Livro do Jogador, privados por padrão e editáveis.
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
              fixedSkills={fixedRacialSkills}
              selectedSkillChoices={racialSkillChoices}
              skillChoiceLimit={racialSkillChoiceLimit}
              blockedSkills={background.skillProficiencies}
              onSelectPreset={selectRacePreset}
              onSelectCustom={selectCustomRace}
              onChange={setRace}
              onToggleSkill={toggleRacialSkill}
            />
          ) : null}

          {step === 2 ? (
            <BackgroundStep
              selectedPresetId={backgroundPresetId}
              background={background}
              equipmentText={backgroundEquipmentText}
              racialSkills={allRacialSkills}
              onSelectPreset={selectBackgroundPreset}
              onSelectCustom={selectCustomBackground}
              onChange={setBackground}
              onEquipmentChange={setBackgroundEquipmentText}
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
              racialSkills={allRacialSkills}
              equipmentMode={equipmentMode}
              equipmentPreset={classEquipmentPreset}
              equipmentSelections={equipmentSelections}
              equipmentFlavors={equipmentFlavors}
              selectedEquipment={selectedClassEquipment}
              startingGold={startingGold}
              onSelectClass={selectClassPreset}
              onLevelChange={updateLevel}
              onMaxHpChange={setMaxHp}
              onToggleSkill={toggleClassSkill}
              onEquipmentModeChange={setEquipmentMode}
              onEquipmentSelectionChange={(groupId, optionId) =>
                setEquipmentSelections((current) => ({
                  ...current,
                  [groupId]: optionId,
                }))
              }
              onEquipmentFlavorChange={(key, value) =>
                setEquipmentFlavors((current) => ({
                  ...current,
                  [key]: value,
                }))
              }
              onStartingGoldChange={setStartingGold}
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
              racialSkills={allRacialSkills}
              background={background}
              classPreset={selectedClass}
              level={level}
              baseAttributes={attributes}
              finalAttributes={finalAttributes}
              maxHp={maxHp}
              classSkills={classSkills}
              backgroundEquipmentText={backgroundEquipmentText}
              equipmentMode={equipmentMode}
              selectedEquipment={selectedClassEquipment}
              equipmentFlavors={equipmentFlavors}
              startingGold={startingGold}
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
                disabled={step === 0 && name.trim().length === 0}
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
      description="O personagem começa privado. Outros jogadores sabem que ele existe, mas não veem sua ficha."
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Field label="Nome">
          <Input
            autoFocus
            value={name}
            placeholder="Nome do personagem"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </Field>

        <Field label="Dono">
          <Input
            value={ownerName}
            disabled={!canAssignOwners}
            list="character-owner-options-v4"
            onChange={(event) => onOwnerChange(event.target.value)}
          />
          <datalist id="character-owner-options-v4">
            {owners.map((owner) => (
              <option key={owner.id} value={owner.name} />
            ))}
          </datalist>
        </Field>

        <Field label="Visibilidade" className="md:col-span-2">
          <Select
            value={visibility}
            onChange={(event) =>
              onVisibilityChange(event.target.value as Visibility)
            }
          >
            <option value="private">
              Privado — apenas dono e mestre veem detalhes
            </option>
            <option value="party">Grupo — jogadores veem a ficha</option>
            {canAssignOwners ? (
              <option value="master">Apenas mestre</option>
            ) : null}
          </Select>
        </Field>
      </div>
    </StepSection>
  )
}

function RaceStep({
  selectedPresetId,
  race,
  fixedSkills,
  selectedSkillChoices,
  skillChoiceLimit,
  blockedSkills,
  onSelectPreset,
  onSelectCustom,
  onChange,
  onToggleSkill,
}: {
  selectedPresetId: string
  race: CharacterRace
  fixedSkills: Skill[]
  selectedSkillChoices: Skill[]
  skillChoiceLimit: number
  blockedSkills: Skill[]
  onSelectPreset: (preset: RacePreset) => void
  onSelectCustom: () => void
  onChange: (race: CharacterRace) => void
  onToggleSkill: (skill: Skill) => void
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Preset racial"
        description="Escolha uma raça do Livro do Jogador. Bônus e perícias raciais são aplicados à ficha final."
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
            description="Bônus flexíveis de +2 e +1; demais detalhes permanecem editáveis."
            onClick={onSelectCustom}
          />
        </div>
      </StepSection>

      <StepSection title="Personalização racial">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Sub-raça">
            <Input
              value={race.subrace}
              onChange={(event) =>
                onChange({ ...race, subrace: event.target.value })
              }
            />
          </Field>
          <Field label="Tamanho">
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
          </Field>
          <Field label="Ajuste de deslocamento">
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
          </Field>
        </div>

        {fixedSkills.length > 0 ? (
          <div className="mt-4 rounded-xl border border-accentBorder bg-accentBg p-3">
            <div className="text-xs font-semibold text-textH">
              Perícias raciais automáticas
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {fixedSkills.map((skill) => (
                <Badge key={skill}>{SKILL_LABELS[skill]}</Badge>
              ))}
            </div>
          </div>
        ) : null}

        {skillChoiceLimit > 0 ? (
          <div className="mt-4">
            <div className="text-xs font-semibold text-textH">
              Escolha {skillChoiceLimit}{" "}
              {skillChoiceLimit === 1
                ? "perícia racial"
                : "perícias raciais"}{" "}
              ({selectedSkillChoices.length}/{skillChoiceLimit})
            </div>
            <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(SKILL_LABELS).map(([rawSkill, label]) => {
                const skill = rawSkill as Skill
                const conflict =
                  fixedSkills.includes(skill) || blockedSkills.includes(skill)
                const disabled =
                  conflict ||
                  (!selectedSkillChoices.includes(skill) &&
                    selectedSkillChoices.length >= skillChoiceLimit)

                return (
                  <SkillToggle
                    key={skill}
                    label={label}
                    selected={selectedSkillChoices.includes(skill)}
                    disabled={disabled}
                    conflict={conflict}
                    note={
                      fixedSkills.includes(skill)
                        ? "Já racial"
                        : blockedSkills.includes(skill)
                          ? "Antecedente"
                          : undefined
                    }
                    onClick={() => onToggleSkill(skill)}
                  />
                )
              })}
            </div>
          </div>
        ) : null}
      </StepSection>
    </div>
  )
}

function BackgroundStep({
  selectedPresetId,
  background,
  equipmentText,
  racialSkills,
  onSelectPreset,
  onSelectCustom,
  onChange,
  onEquipmentChange,
  onToggleSkill,
}: {
  selectedPresetId: string
  background: CharacterBackground
  equipmentText: string
  racialSkills: Skill[]
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
        description="Escolha um preset ou personalize perícias, história e equipamento."
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
            description="Edite todos os campos a partir do antecedente atual."
            onClick={onSelectCustom}
          />
        </div>
      </StepSection>

      <StepSection title="Personalização do antecedente">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Field label="Nome">
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
          </Field>
          <Field label="Característica">
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
          </Field>
          <Field label="Descrição" className="md:col-span-2">
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
          </Field>
          <Field
            label="Descrição da característica"
            className="md:col-span-2"
          >
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
          </Field>
          <Field
            label="Equipamento do antecedente — um item por linha"
            className="md:col-span-2"
          >
            <Textarea
              value={equipmentText}
              onChange={(event) => onEquipmentChange(event.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-textH">
            Perícias do antecedente
          </div>
          <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(SKILL_LABELS).map(([rawSkill, label]) => {
              const skill = rawSkill as Skill
              const conflict = racialSkills.includes(skill)

              return (
                <SkillToggle
                  key={skill}
                  label={label}
                  selected={background.skillProficiencies.includes(skill)}
                  disabled={conflict}
                  conflict={conflict}
                  note={conflict ? "Raça" : undefined}
                  onClick={() => onToggleSkill(skill)}
                />
              )
            })}
          </div>
        </div>
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
  racialSkills,
  equipmentMode,
  equipmentPreset,
  equipmentSelections,
  equipmentFlavors,
  selectedEquipment,
  startingGold,
  onSelectClass,
  onLevelChange,
  onMaxHpChange,
  onToggleSkill,
  onEquipmentModeChange,
  onEquipmentSelectionChange,
  onEquipmentFlavorChange,
  onStartingGoldChange,
}: {
  selectedClass: ClassPreset
  level: number
  maxHp: number
  selectedSkills: Skill[]
  backgroundSkills: Skill[]
  racialSkills: Skill[]
  equipmentMode: EquipmentMode
  equipmentPreset: ReturnType<typeof getPhbClassEquipmentPreset>
  equipmentSelections: Record<string, string>
  equipmentFlavors: Record<string, string>
  selectedEquipment: ReturnType<typeof getSelectedClassEquipment>
  startingGold: number
  onSelectClass: (preset: ClassPreset) => void
  onLevelChange: (level: number) => void
  onMaxHpChange: (hp: number) => void
  onToggleSkill: (skill: Skill) => void
  onEquipmentModeChange: (mode: EquipmentMode) => void
  onEquipmentSelectionChange: (groupId: string, optionId: string) => void
  onEquipmentFlavorChange: (key: string, value: string) => void
  onStartingGoldChange: (value: number) => void
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Classe inicial"
        description="Escolha uma classe do Livro do Jogador."
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
          <Field label="Nível">
            <Input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(event) => onLevelChange(Number(event.target.value))}
            />
          </Field>
          <Field label="Pontos de vida máximos">
            <Input
              type="number"
              min={1}
              value={maxHp}
              onChange={(event) =>
                onMaxHpChange(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-bg-subtle p-3 text-xs text-text">
          Salvaguardas:{" "}
          {selectedClass.savingThrows
            .map((entry) => ATTRIBUTE_LABELS[entry])
            .join(" e ")}
          . Escolha até {selectedClass.skillChoices} perícias de classe.
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {selectedClass.availableSkills.map((skill) => {
            const fromBackground = backgroundSkills.includes(skill)
            const fromRace = racialSkills.includes(skill)
            const conflict = fromBackground || fromRace
            const limitReached =
              !selectedSkills.includes(skill) &&
              selectedSkills.length >= selectedClass.skillChoices

            return (
              <SkillToggle
                key={skill}
                label={SKILL_LABELS[skill]}
                selected={selectedSkills.includes(skill)}
                disabled={conflict || limitReached}
                conflict={conflict}
                note={
                  fromBackground && fromRace
                    ? "Raça/Antecedente"
                    : fromBackground
                      ? "Antecedente"
                      : fromRace
                        ? "Raça"
                        : selectedSkills.includes(skill)
                          ? "Classe"
                          : undefined
                }
                onClick={() => onToggleSkill(skill)}
              />
            )
          })}
        </div>
      </StepSection>

      <StepSection
        title="Equipamento inicial da classe"
        description="Escolha uma opção em cada grupo. O flavour altera somente o nome e a aparência, preservando a categoria e os valores mecânicos."
      >
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg-subtle p-2">
          <ModeButton
            active={equipmentMode === "equipment"}
            onClick={() => onEquipmentModeChange("equipment")}
          >
            Equipamento
          </ModeButton>
          <ModeButton
            active={equipmentMode === "gold"}
            onClick={() => onEquipmentModeChange("gold")}
          >
            Ouro inicial
          </ModeButton>
        </div>

        {equipmentMode === "equipment" ? (
          <div className="mt-4 grid min-w-0 gap-4">
            {equipmentPreset?.choiceGroups.map((choiceGroup) => (
              <div
                key={choiceGroup.id}
                className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
              >
                <div className="text-xs font-semibold text-textH">
                  {choiceGroup.label}
                </div>
                <div className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                  {choiceGroup.options.map((choiceOption) => {
                    const selected =
                      equipmentSelections[choiceGroup.id] === choiceOption.id

                    return (
                      <button
                        key={choiceOption.id}
                        type="button"
                        onClick={() =>
                          onEquipmentSelectionChange(
                            choiceGroup.id,
                            choiceOption.id,
                          )
                        }
                        className={
                          selected
                            ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-2 text-[11px] font-semibold text-textH"
                            : "shrink-0 rounded-full border border-border bg-bg px-3 py-2 text-[11px] text-text"
                        }
                      >
                        {selected ? "✓ " : ""}
                        {choiceOption.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {selectedEquipment.map((item, index) => {
                const flavorKey = `${item.id}:${index}`

                return (
                  <label
                    key={flavorKey}
                    className="grid min-w-0 gap-1.5 rounded-xl border border-border bg-bg-subtle p-3"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-textMuted">
                      <span className="truncate">
                        {item.name}
                        {(item.quantity ?? 1) > 1
                          ? ` ×${item.quantity}`
                          : ""}
                      </span>
                      <span className="shrink-0 uppercase">
                        {EQUIPMENT_CATEGORY_LABELS[item.category]}
                      </span>
                    </span>
                    <Input
                      value={equipmentFlavors[flavorKey] ?? item.name}
                      onChange={(event) =>
                        onEquipmentFlavorChange(flavorKey, event.target.value)
                      }
                      placeholder="Nome/aparência personalizada"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ) : equipmentPreset ? (
          <div className="mt-4 grid min-w-0 gap-3 rounded-xl border border-border bg-bg-subtle p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field
              label={`Peças de ouro — ${formatStartingGoldFormula(
                equipmentPreset.startingGold,
              )}`}
            >
              <Input
                type="number"
                min={0}
                step={1}
                value={startingGold}
                onChange={(event) =>
                  onStartingGoldChange(
                    Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                  )
                }
              />
            </Field>
            <Button
              variant="secondary"
              onClick={() =>
                onStartingGoldChange(
                  rollStartingGold(equipmentPreset.startingGold),
                )
              }
            >
              Rolar ouro
            </Button>
          </div>
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
  return (
    <StepSection
      title="Atributos"
      description="Ajuste os valores base com − e +. Bônus fixos ficam travados; bônus flexíveis podem ser movidos."
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ATTRIBUTE_KEYS.map((attribute) => {
          const base = attributes[attribute]
          const racial = raceBonuses[attribute] ?? 0
          const relevantSlots = bonusSlots.filter(
            (slot) => !slot.locked || slot.attribute === attribute,
          )

          return (
            <div
              key={attribute}
              className="grid min-w-0 gap-3 rounded-xl border border-border bg-bg-subtle p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-textH">
                    {ATTRIBUTE_LABELS[attribute]}
                  </div>
                  <div className="text-[11px] text-textMuted">
                    Final {base + racial} · racial +{racial}
                  </div>
                </div>
                <div className="text-2xl font-bold text-textH">{base}</div>
              </div>

              <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                <button
                  type="button"
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
                  disabled={base >= 30}
                  onClick={() => onChange(attribute, 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-bg text-textH disabled:opacity-35"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {relevantSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {relevantSlots.map((slot) => {
                    const active = slot.attribute === attribute
                    const blockedByLocked = bonusSlots.some(
                      (other) =>
                        other.id !== slot.id &&
                        other.attribute === attribute &&
                        other.locked,
                    )
                    const disabled =
                      slot.locked || (!active && blockedByLocked)

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
                            : "rounded-lg border border-border bg-bg px-2 py-2 text-xs font-semibold text-textMuted disabled:opacity-35"
                        }
                      >
                        +{slot.amount}
                        {slot.locked ? " 🔒" : ""}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </StepSection>
  )
}

function ReviewStep({
  name,
  owner,
  visibility,
  race,
  racialSkills,
  background,
  classPreset,
  level,
  baseAttributes,
  finalAttributes,
  maxHp,
  classSkills,
  backgroundEquipmentText,
  equipmentMode,
  selectedEquipment,
  equipmentFlavors,
  startingGold,
}: {
  name: string
  owner: Player
  visibility: Visibility
  race: CharacterRace
  racialSkills: Skill[]
  background: CharacterBackground
  classPreset: ClassPreset
  level: number
  baseAttributes: Record<Attribute, number>
  finalAttributes: Record<Attribute, number>
  maxHp: number
  classSkills: Skill[]
  backgroundEquipmentText: string
  equipmentMode: EquipmentMode
  selectedEquipment: ReturnType<typeof getSelectedClassEquipment>
  equipmentFlavors: Record<string, string>
  startingGold: number
}) {
  const equipmentSummary =
    equipmentMode === "gold"
      ? `${startingGold} po`
      : selectedEquipment
          .map((item, index) => {
            const flavor = equipmentFlavors[`${item.id}:${index}`]?.trim()
            const name = flavor || item.name
            return (item.quantity ?? 1) > 1
              ? `${name} ×${item.quantity}`
              : name
          })
          .join(", ") || "Nenhum"

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
        <ReviewLine
          label="Perícias raciais"
          value={
            racialSkills.map((skill) => SKILL_LABELS[skill]).join(", ") ||
            "Nenhuma"
          }
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
          value={summarizeEquipment(backgroundEquipmentText)}
        />
      </ReviewCard>

      <ReviewCard title="Classe">
        <ReviewLine label="Classe" value={classPreset.name} />
        <ReviewLine label="Nível" value={String(level)} />
        <ReviewLine label="Vida máxima" value={String(maxHp)} />
        <ReviewLine
          label="Perícias escolhidas"
          value={
            classSkills.map((skill) => SKILL_LABELS[skill]).join(", ") ||
            "Nenhuma"
          }
        />
        <ReviewLine label="Equipamento" value={equipmentSummary} />
      </ReviewCard>

      <ReviewCard title="Atributos" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <div
              key={attribute}
              className="rounded-lg border border-border bg-bg-subtle p-3 text-center"
            >
              <div className="text-[10px] uppercase text-textMuted">
                {ATTRIBUTE_SHORT[attribute]}
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
      <div className="mb-4">
        <h3 className="break-words text-base font-semibold text-textH">
          {title}
        </h3>
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

function Field({
  label,
  className = "",
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`grid min-w-0 gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-textH">{label}</span>
      {children}
    </label>
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
          ? "min-h-24 min-w-0 rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
          : "min-h-24 min-w-0 rounded-xl border border-border bg-bg-subtle p-3 text-left hover:bg-bg"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="break-words text-sm font-semibold text-textH">
          {title}
        </span>
        {selected ? (
          <Check className="h-4 w-4 shrink-0 text-accent" />
        ) : null}
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
          ? "rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs font-semibold text-danger"
          : selected
            ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
            : "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text disabled:opacity-40"
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

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-3 text-xs font-semibold text-textH"
          : "rounded-lg border border-transparent px-3 py-3 text-xs text-textMuted"
      }
    >
      {children}
    </button>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-accentBorder bg-bg px-3 py-1 text-[11px] font-semibold text-textH">
      {children}
    </span>
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
    <section
      className={`min-w-0 rounded-xl border border-border bg-bg p-4 ${className}`}
    >
      <h3 className="text-sm font-semibold text-textH">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
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
      {
        id: "variant-plus-one-a",
        amount: 1,
        attribute: "str",
        locked: false,
      },
      {
        id: "variant-plus-one-b",
        amount: 1,
        attribute: "dex",
        locked: false,
      },
    ]
  }

  if (presetId === "half-elf") {
    return [
      {
        id: "half-elf-plus-two",
        amount: 2,
        attribute: "cha",
        locked: true,
      },
      {
        id: "half-elf-plus-one-a",
        amount: 1,
        attribute: "dex",
        locked: false,
      },
      {
        id: "half-elf-plus-one-b",
        amount: 1,
        attribute: "con",
        locked: false,
      },
    ]
  }

  return ATTRIBUTE_KEYS.flatMap((attribute) => {
    const amount = bonuses[attribute] ?? 0
    return amount === 0
      ? []
      : [
          {
            id: `${presetId}-${attribute}-${amount}`,
            amount,
            attribute,
            locked: true,
          },
        ]
  })
}

function applyRaceBonusSlots(
  race: CharacterRace,
  slots: RaceBonusSlot[],
): CharacterRace {
  const attributeBonus = Object.fromEntries(
    ATTRIBUTE_KEYS.map((attribute) => [attribute, 0]),
  ) as Record<Attribute, number>

  slots.forEach((slot) => {
    if (slot.attribute) attributeBonus[slot.attribute] += slot.amount
  })

  return { ...race, attributeBonus }
}

function getRacialSkillChoiceLimit(presetId: string): number {
  if (presetId === "variant-human") return 1
  if (presetId === "half-elf") return 2
  return 0
}

function getFixedRacialSkills(race: CharacterRace): Skill[] {
  return race.proficiencies.flatMap((proficiency) => {
    if (proficiency.category !== "skill") return []
    const normalized = normalizeText(proficiency.name)
    const match = (Object.entries(SKILL_LABELS) as Array<[Skill, string]>).find(
      ([skill, label]) =>
        normalizeText(skill) === normalized || normalizeText(label) === normalized,
    )
    return match ? [match[0]] : []
  })
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function cloneBackground(
  background: CharacterBackground,
): CharacterBackground {
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

function getBackgroundEquipmentText(background: CharacterBackground): string {
  return background.startingEquipment
    .map((entry) =>
      entry.quantity > 1 ? `${entry.name} ×${entry.quantity}` : entry.name,
    )
    .join("\n")
}

function equipmentTextToItems(
  value: string,
  description: string,
): Itemmable[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*?)(?:\s*[×x]\s*(\d+))?$/)
      const itemName = match?.[1]?.trim() || entry
      const quantity = Math.max(1, Number(match?.[2]) || 1)

      return {
        id: crypto.randomUUID(),
        name: itemName,
        desc: description,
        notes: "",
        quantity,
        weight: 0,
        pocketable: false,
        kind: "common" as const,
      }
    })
}

function summarizeEquipment(value: string): string {
  return (
    value
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(", ") || "Nenhum"
  )
}

function createCharacterClass(
  className: ClassName,
  level: ClassLevel,
): CharacterClassInterface {
  const builder = new CharacterClassBuilder()
  let created: CharacterClassInterface

  switch (className) {
    case "barbarian":
      created = builder.barbarian()
      break
    case "bard":
      created = builder.bard()
      break
    case "cleric":
      created = builder.cleric()
      break
    case "druid":
      created = builder.druid()
      break
    case "fighter":
      created = builder.fighter()
      break
    case "monk":
      created = builder.monk()
      break
    case "paladin":
      created = builder.paladin()
      break
    case "ranger":
      created = builder.ranger()
      break
    case "rogue":
      created = builder.rogue()
      break
    case "sorcerer":
      created = builder.sorcerer()
      break
    case "warlock":
      created = builder.warlock()
      break
    case "wizard":
      created = builder.wizard()
      break
    default:
      created = builder.fighter()
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
    dieMaximum +
      constitutionModifier +
      Math.max(0, level - 1) *
        Math.max(1, laterLevelAverage + constitutionModifier),
  )
}
