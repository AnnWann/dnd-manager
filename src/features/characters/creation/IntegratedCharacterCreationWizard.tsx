import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  getDefaultClassEquipmentSelections,
  getSelectedClassEquipment,
} from "../../../data/characterCreation/phbClassEquipment"
import {
  PHB_BACKGROUND_PRESETS,
  PHB_CLASS_PRESETS,
  PHB_RACE_PRESETS,
  SKILL_LABELS,
  racePresetToCharacterRace,
  type BackgroundPreset,
  type RacePreset,
} from "../../../data/characterCreation/phbPresets"
import { hydrateBackgroundStartingItems } from "../../../lib/characterCreation/backgroundStartingEquipment"
import { createStartingInventoryItem } from "../../../lib/characterCreation/startingEquipmentItems"
import { newCharacterTemplate } from "../../../lib/newCharacterTemplate"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterBackground } from "../../../models/characters/CharacterBackground"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { CharacterCreationProgressionPlan } from "../../../models/characters/creation/CharacterCreation"
import {
  CUSTOM_CLASS_RUNTIME_ID,
  DEFAULT_CUSTOM_CLASS_CONFIG,
  createCustomClassRuntimeId,
  getCustomClassConfig,
  isCustomClassName,
  normalizeCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../models/characters/customClassConfig"
import type { Itemmable } from "../../../models/items/item"
import {
  getDynamicSubclassSpellGrants,
} from "../../../models/leveling/DynamicSubclassSpellRules"
import {
  getClassProgression,
  getFeaturesAtLevel,
} from "../../../data/classProgression"
import {
  applyClassProficiencies,
  getClassProficiencyRule,
  validateClassProficiencySelections,
  type ClassProficiencySelection,
} from "../../../models/leveling/ClassProficiencyRules"
import {
  createClassEntry,
  getClassSpellSelectionRule,
  getMetamagicLimit,
  getSubclassSpellGrants,
  isSpellAllowedForClassSelection,
  normalizeSpellName,
} from "../../../models/leveling/SpellSelectionRules"
import {
  applyCharacterProgression,
  type ProgressionClassPlan,
  type ProgressionCustomAbility,
  type ProgressionSpellSelection,
} from "../../../models/leveling/applyCharacterProgression"
import { prepareCharacterForProgression } from "../../../models/leveling/prepareCharacterForProgression"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Player } from "../../../models/player/Player"
import type { CharacterRace, CreatureSize } from "../../../models/races/CharacterRace"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import { getClassNamePt } from "../../../models/leveling/ClassLocalization"
import { AbilityDialog } from "../abilities/abilityDialog"
import { CustomClassConfigurationEditor } from "../characterSheet/classes/CustomClassConfigurationTab"
import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"
import { finalizeDynamicSubclassSpells } from "../progression/CharacterProgressionFlow"
import {
  readCharacterCreationDraftSection,
  writeCharacterCreationDraftSection,
} from "./characterCreationDraftCache"
import { InlineStartingEquipmentEditor } from "./components/InlineStartingEquipmentEditor"

const STEPS = [
  "Identidade",
  "Raça e características",
  "Antecedente e características",
  "Equipamento do antecedente",
  "Nível do personagem",
  "Classes, características e magias",
  "Equipamento da classe inicial",
  "Atributos",
  "Confirmação",
] as const

const ALL_CLASSES: ClassName[] = [
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]

const AVAILABLE_CLASSES: ClassName[] = [...ALL_CLASSES, CUSTOM_CLASS_RUNTIME_ID]

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
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
type FeatureEditorSource = "race" | "background" | "class"
type SpellSelections = Record<
  string,
  { selected: string[]; prepared: string[] }
>

type IntegratedCreationDraft = {
  step: number
  name: string
  ownerName: string
  visibility: Visibility
  racePresetId: string
  race: CharacterRace
  backgroundPresetId: string
  background: CharacterBackground
  backgroundAbilities: Ability[]
  backgroundItems: Itemmable[]
  totalLevel: number
  classPlans: ProgressionClassPlan[]
  classSkillSelections: Partial<Record<ClassName, Skill[]>>
  classToolChoices: Partial<Record<ClassName, string>>
  customClassAbilities: ProgressionCustomAbility[]
  spellSelections: SpellSelections
  spellQueries: Partial<Record<ClassName, string>>
  selectedMetamagics: MetamagicId[]
  classEquipmentItems: Itemmable[]
  attributes: Record<Attribute, number>
}

type Props = {
  open: boolean
  draftId: string
  defaultOwner: Player
  owners: Player[]
  canAssignOwners: boolean
  onClose: () => void
  onCreate: (
    character: CharacterTemplate,
    plan: CharacterCreationProgressionPlan,
  ) => void | Promise<void>
  createOwner: (ownerName: string) => Player
  customClassName?: string
  customClassConfigs?: Record<string, CustomClassRuntimeConfig>
  onApplyCustomClassConfig?: (
    className: ClassName,
    config: CustomClassRuntimeConfig,
  ) => void
  onRemoveCustomClassConfig?: (className: ClassName) => void
  mode?: "modal" | "page"
}

export function IntegratedCharacterCreationWizard({
  open,
  draftId,
  defaultOwner,
  owners,
  canAssignOwners,
  onClose,
  onCreate,
  createOwner,
  customClassName = "Classe personalizada",
  customClassConfigs,
  onApplyCustomClassConfig,
  onRemoveCustomClassConfig,
  mode = "modal",
}: Props) {
  const { spells, metamagics } = useMagicContext()
  const firstRace = PHB_RACE_PRESETS[0]
  const firstBackground = PHB_BACKGROUND_PRESETS[0]
  const firstClass = PHB_CLASS_PRESETS[0]
  const initialDraft = useMemo(
    () =>
      readCharacterCreationDraftSection<IntegratedCreationDraft>(
        draftId,
        "integrated",
      ),
    [draftId],
  )

  const [step, setStep] = useState(() =>
    Math.max(
      0,
      Math.min(
        STEPS.length - 1,
        Math.trunc(initialDraft?.step ?? 0),
      ),
    ),
  )
  const [name, setName] = useState(initialDraft?.name ?? "")
  const [ownerName, setOwnerName] = useState(
    initialDraft?.ownerName ?? defaultOwner.name,
  )
  const [visibility, setVisibility] = useState<Visibility>(
    initialDraft?.visibility ?? "private",
  )

  const [racePresetId, setRacePresetId] = useState(
    initialDraft?.racePresetId ?? firstRace.id,
  )
  const [race, setRace] = useState<CharacterRace>(
    initialDraft?.race ?? racePresetToCharacterRace(firstRace),
  )

  const [backgroundPresetId, setBackgroundPresetId] = useState(
    initialDraft?.backgroundPresetId ?? firstBackground.id,
  )
  const [background, setBackground] = useState<CharacterBackground>(
    initialDraft?.background ?? cloneBackground(firstBackground),
  )
  const [backgroundAbilities, setBackgroundAbilities] = useState<Ability[]>(
    initialDraft?.backgroundAbilities ?? backgroundPresetAbilities(firstBackground),
  )
  const [backgroundItems, setBackgroundItems] = useState<Itemmable[]>(
    initialDraft?.backgroundItems ??
      hydrateBackgroundStartingItems(firstBackground.startingEquipment, {
        type: "background",
        sourceId: firstBackground.id,
        sourceName: firstBackground.name,
      }),
  )

  const [totalLevel, setTotalLevel] = useState(
    Math.max(1, Math.min(20, initialDraft?.totalLevel ?? 1)),
  )
  const [classPlans, setClassPlans] = useState<ProgressionClassPlan[]>(
    initialDraft?.classPlans ?? [],
  )
  const [classSkillSelections, setClassSkillSelections] = useState<
    Partial<Record<ClassName, Skill[]>>
  >(initialDraft?.classSkillSelections ?? {})
  const [classToolChoices, setClassToolChoices] = useState<
    Partial<Record<ClassName, string>>
  >(initialDraft?.classToolChoices ?? {})
  const [customClassAbilities, setCustomClassAbilities] = useState<
    ProgressionCustomAbility[]
  >(initialDraft?.customClassAbilities ?? [])
  const [spellSelections, setSpellSelections] = useState<SpellSelections>(
    initialDraft?.spellSelections ?? {},
  )
  const [spellQueries, setSpellQueries] = useState<
    Partial<Record<ClassName, string>>
  >(initialDraft?.spellQueries ?? {})
  const [selectedMetamagics, setSelectedMetamagics] = useState<MetamagicId[]>(
    initialDraft?.selectedMetamagics ?? [],
  )

  const [classEquipmentItems, setClassEquipmentItems] = useState<Itemmable[]>(
    initialDraft?.classEquipmentItems ??
      (initialDraft?.classPlans?.[0]
        ? defaultClassEquipment(initialDraft.classPlans[0].className)
        : []),
  )
  const [attributes, setAttributes] = useState<Record<Attribute, number>>(
    initialDraft?.attributes ?? { ...firstClass.recommendedAttributes },
  )

  const [abilityEditor, setAbilityEditor] = useState<{
    source: FeatureEditorSource
    ability: Ability | null
    className?: ClassName
    classLevel?: number
  } | null>(null)
  const [validationMessage, setValidationMessage] = useState("")

  useEffect(() => {
    if (!open) return
    writeCharacterCreationDraftSection(draftId, "integrated", {
      step,
      name,
      ownerName,
      visibility,
      racePresetId,
      race,
      backgroundPresetId,
      background,
      backgroundAbilities,
      backgroundItems,
      totalLevel,
      classPlans,
      classSkillSelections,
      classToolChoices,
      customClassAbilities,
      spellSelections,
      spellQueries,
      selectedMetamagics,
      classEquipmentItems,
      attributes,
    } satisfies IntegratedCreationDraft)
  }, [
    attributes,
    background,
    backgroundAbilities,
    backgroundItems,
    backgroundPresetId,
    classEquipmentItems,
    classPlans,
    classSkillSelections,
    classToolChoices,
    customClassAbilities,
    draftId,
    name,
    open,
    ownerName,
    race,
    racePresetId,
    selectedMetamagics,
    spellQueries,
    spellSelections,
    step,
    totalLevel,
    visibility,
  ])

  if (!open) return null

  const chosenOwner =
    owners.find(
      (owner) =>
        owner.id === ownerName.trim() || owner.name === ownerName.trim(),
    ) ?? createOwner(ownerName)
  const primaryClass = classPlans[0]?.className ?? firstClass.id
  const primaryCustomConfig = customClassConfigs?.[String(primaryClass)]
  const primaryClassLabel = isCustomClassName(primaryClass)
    ? primaryCustomConfig?.name.trim() ||
      customClassName.trim() ||
      getClassNamePt(primaryClass)
    : getClassNamePt(primaryClass)
  const primaryPreset =
    PHB_CLASS_PRESETS.find((entry) => entry.id === primaryClass) ?? firstClass
  const baseDraftCharacter = createDraftCharacter({
    name,
    owner: chosenOwner,
    visibility,
    race,
    attributes,
    classPlans,
  })
  const draftCharacter = classPlans.reduce((current, plan) => {
    if (!isCustomClassName(plan.className)) return current
    const config = customClassConfigs?.[String(plan.className)]
    return config
      ? updateCustomClassConfig(current, config, plan.className)
      : current
  }, baseDraftCharacter)
  const racialSkills = proficiencySkills(race.proficiencies)
  const blockedClassSkills = new Set<Skill>([
    ...racialSkills,
    ...background.skillProficiencies,
  ])
  const sorcererLevel =
    classPlans.find((plan) => plan.className === "sorcerer")?.level ?? 0
  const metamagicLimit = getMetamagicLimit(sorcererLevel)

  function selectRacePreset(preset: RacePreset) {
    setRacePresetId(preset.id)
    setRace(racePresetToCharacterRace(preset))
  }

  function selectCustomRace() {
    setRacePresetId("custom")
    setRace((current) => ({
      ...current,
      race: "custom",
      customName:
        current.customName?.trim() ||
        current.subrace?.trim() ||
        "Raça personalizada",
      subrace: current.subrace ?? "",
      size: current.size ?? "medium",
      mobility: current.mobility ?? 9,
      naturalAbilities: (current.naturalAbilities ?? []).map(cloneAbility),
      proficiencies: (current.proficiencies ?? []).map((entry) => ({ ...entry })),
      attributeBonus: { ...current.attributeBonus },
    }))
  }

  function selectBackgroundPreset(preset: BackgroundPreset) {
    setBackgroundPresetId(preset.id)
    setBackground(cloneBackground(preset))
    setBackgroundAbilities(backgroundPresetAbilities(preset))
    setBackgroundItems(
      hydrateBackgroundStartingItems(preset.startingEquipment, {
        type: "background",
        sourceId: preset.id,
        sourceName: preset.name,
      }),
    )
  }

  function selectCustomBackground() {
    setBackgroundPresetId("custom")
    setBackground((current) => ({
      ...current,
      id: "custom",
      name: current.name || "Antecedente personalizado",
      custom: true,
    }))
  }

  function changeTotalLevel(value: number) {
    const nextTotal = Math.max(1, Math.min(20, Math.trunc(value || 1)))
    const currentTotal = classPlans.reduce((sum, plan) => sum + plan.level, 0)
    const delta = nextTotal - currentTotal
    setTotalLevel(nextTotal)

    if (delta === 0) return
    setClassPlans((current) => redistributeTotal(current, nextTotal))
  }

  function addClass(className: ClassName) {
    const addingCustom =
      String(className) === String(CUSTOM_CLASS_RUNTIME_ID)
    const runtimeClassName = addingCustom
      ? createCustomClassRuntimeId()
      : className

    if (classPlans.some((plan) => plan.className === runtimeClassName)) return

    const addCustomConfig = () => {
      if (!addingCustom || !onApplyCustomClassConfig) return
      onApplyCustomClassConfig(
        runtimeClassName,
        normalizeCustomClassConfig({
          ...DEFAULT_CUSTOM_CLASS_CONFIG,
          savingThrows: [...DEFAULT_CUSTOM_CLASS_CONFIG.savingThrows],
          spellSlotProgression: {},
          additionalSlotPools: [],
        }),
      )
    }

    if (!classPlans.length) {
      addCustomConfig()
      setClassPlans([createPlan(runtimeClassName, totalLevel)])
      setClassSkillSelections({})
      setClassToolChoices({})
      setCustomClassAbilities([])
      setSpellSelections({})
      setSelectedMetamagics([])
      setClassEquipmentItems(defaultClassEquipment(runtimeClassName))
      const preset = PHB_CLASS_PRESETS.find(
        (entry) => entry.id === runtimeClassName,
      )
      if (preset) setAttributes({ ...preset.recommendedAttributes })
      return
    }

    const donor = classPlans.find((plan) => plan.level > 1)
    if (!donor || classPlans.length >= totalLevel) return
    addCustomConfig()
    setClassPlans((current) => [
      ...current.map((plan) =>
        plan.className === donor.className
          ? { ...plan, level: plan.level - 1 }
          : plan,
      ),
      createPlan(runtimeClassName, 1),
    ])
  }

  function removeClass(className: ClassName) {
    const removedIndex = classPlans.findIndex(
      (plan) => plan.className === className,
    )
    if (removedIndex < 0) return

    const removed = classPlans[removedIndex]
    const nextPlans = classPlans
      .filter((plan) => plan.className !== className)
      .map((plan, index) =>
        index === 0 ? { ...plan, level: plan.level + removed.level } : plan,
      )

    setClassPlans(nextPlans)
    setClassSkillSelections((current) => ({ ...current, [className]: undefined }))
    setClassToolChoices((current) => ({ ...current, [className]: undefined }))
    setSpellSelections((current) => ({ ...current, [className]: undefined as never }))
    setCustomClassAbilities((current) =>
      current.filter((entry) => entry.className !== className),
    )
    if (className === "sorcerer") setSelectedMetamagics([])
    if (isCustomClassName(className)) {
      onRemoveCustomClassConfig?.(className)
    }

    if (removedIndex === 0) {
      const nextPrimary = nextPlans[0]?.className
      setClassEquipmentItems(
        nextPrimary ? defaultClassEquipment(nextPrimary) : [],
      )
      const preset = nextPrimary
        ? PHB_CLASS_PRESETS.find((entry) => entry.id === nextPrimary)
        : undefined
      if (preset) setAttributes({ ...preset.recommendedAttributes })
    }
  }

  function shiftClassLevel(className: ClassName, delta: -1 | 1) {
    const target = classPlans.find((plan) => plan.className === className)
    if (!target || (delta < 0 && target.level <= 1)) return
    const other =
      delta > 0
        ? classPlans.find(
            (plan) => plan.className !== className && plan.level > 1,
          )
        : classPlans.find((plan) => plan.className !== className)
    if (!other) return

    setClassPlans((current) =>
      current.map((plan) => {
        if (plan.className === className) {
          return { ...plan, level: plan.level + delta }
        }
        if (plan.className === other.className) {
          return { ...plan, level: plan.level - delta }
        }
        return plan
      }),
    )
  }

  function updatePlan(
    className: ClassName,
    updater: (plan: ProgressionClassPlan) => ProgressionClassPlan,
  ) {
    setClassPlans((current) =>
      current.map((plan) =>
        plan.className === className ? updater(plan) : plan,
      ),
    )
  }

  function toggleFeatureChoice(
    className: ClassName,
    choiceId: string,
    count: number,
    option: string,
  ) {
    updatePlan(className, (plan) => {
      const current = plan.levelChoices[choiceId] ?? []
      const selected = current.includes(option)
      const next = selected
        ? current.filter((entry) => entry !== option)
        : current.length < count
          ? [...current, option]
          : count === 1
            ? [option]
            : current
      return {
        ...plan,
        levelChoices: { ...plan.levelChoices, [choiceId]: next },
      }
    })
  }

  function setCustomFeatureChoice(
    className: ClassName,
    choiceId: string,
    value: string,
  ) {
    updatePlan(className, (plan) => ({
      ...plan,
      levelChoices: {
        ...plan.levelChoices,
        [choiceId]: value.trim() ? [value.trim()] : [],
      },
    }))
  }

  function toggleClassSkill(className: ClassName, skill: Skill, limit: number) {
    if (blockedClassSkills.has(skill)) return
    setClassSkillSelections((current) => {
      const selected = current[className] ?? []
      if (selected.includes(skill)) {
        return {
          ...current,
          [className]: selected.filter((entry) => entry !== skill),
        }
      }
      if (selected.length >= limit) return current
      return { ...current, [className]: [...selected, skill] }
    })
  }

  function toggleSpell(plan: ProgressionClassPlan, spell: Spell) {
    const rule = getClassSpellSelectionRule(
      draftCharacter,
      plan.className,
      plan.level,
      plan.subclassId,
    )
    const current = spellSelections[plan.className] ?? {
      selected: [],
      prepared: [],
    }
    const selected = current.selected.includes(spell.index)

    if (selected) {
      setSpellSelections((all) => ({
        ...all,
        [plan.className]: {
          selected: current.selected.filter((entry) => entry !== spell.index),
          prepared: current.prepared.filter((entry) => entry !== spell.index),
        },
      }))
      return
    }

    const selectedSpells = resolveSpells(current.selected, spells)
    const isCantrip = spell.slotLevel === 0
    const count = selectedSpells.filter(
      (entry) => (entry.slotLevel === 0) === isCantrip,
    ).length
    const limit = isCantrip ? rule.maxCantrips : rule.maxLeveledSpells
    if (count >= limit) return

    if (
      spell.slotLevel > 0 &&
      rule.allowedSchools &&
      !rule.allowedSchools.includes(normalizeSpellName(String(spell.school)))
    ) {
      const unrestricted = selectedSpells.filter(
        (entry) =>
          entry.slotLevel > 0 &&
          !rule.allowedSchools!.includes(
            normalizeSpellName(String(entry.school)),
          ),
      ).length
      if (unrestricted >= (rule.unrestrictedLeveledSpellCount ?? 0)) return
    }

    setSpellSelections((all) => ({
      ...all,
      [plan.className]: {
        selected: [...current.selected, spell.index],
        prepared:
          rule.mode === "prepared"
            ? [...current.prepared, spell.index]
            : current.prepared,
      },
    }))
  }

  function togglePrepared(className: ClassName, spellIndex: string) {
    const current = spellSelections[className]
    if (!current?.selected.includes(spellIndex)) return
    setSpellSelections((all) => ({
      ...all,
      [className]: {
        ...current,
        prepared: current.prepared.includes(spellIndex)
          ? current.prepared.filter((entry) => entry !== spellIndex)
          : [...current.prepared, spellIndex],
      },
    }))
  }

  function saveAbility(ability: Ability) {
    if (!abilityEditor) return
    if (abilityEditor.source === "race") {
      setRace((current) => ({
        ...current,
        naturalAbilities: upsertAbility(current.naturalAbilities ?? [], {
          ...ability,
          source: "race",
        }),
      }))
    } else if (abilityEditor.source === "background") {
      setBackgroundAbilities((current) =>
        upsertAbility(current, { ...ability, source: "background" }),
      )
    } else {
      const entry: ProgressionCustomAbility = {
        ability: { ...ability, source: "class" },
        source: "class",
        className: abilityEditor.className,
        classLevel: abilityEditor.classLevel,
      }
      setCustomClassAbilities((current) => {
        const exists = current.some(
          (candidate) => candidate.ability.id === ability.id,
        )
        return exists
          ? current.map((candidate) =>
              candidate.ability.id === ability.id ? entry : candidate,
            )
          : [...current, entry]
      })
    }
    setAbilityEditor(null)
  }

  function validateCreation(): string {
    if (!name.trim()) return "Informe o nome do personagem."
    if (!classPlans.length) return "Adicione pelo menos uma classe."
    if (
      classPlans.reduce((sum, plan) => sum + plan.level, 0) !== totalLevel
    ) {
      return `Distribua exatamente ${totalLevel} níveis entre as classes.`
    }

    for (const plan of classPlans) {
      const progression = getClassProgression(plan.className)
      if (
        plan.level >= progression.subclassLevel &&
        progression.subclasses.length &&
        !plan.subclassId
      ) {
        return `Selecione a subclasse de ${progression.label}.`
      }

      for (let level = 1; level <= plan.level; level += 1) {
        for (const feature of getFeaturesAtLevel(
          plan.className,
          level,
          plan.subclassId,
        )) {
          if (
            feature.optional &&
            !plan.enabledOptionalFeatureIds.includes(feature.id)
          ) {
            continue
          }
          if (feature.choice && feature.choice.kind !== "metamagic") {
            const selected = plan.levelChoices[feature.choice.id] ?? []
            if (selected.length < feature.choice.count) {
              return `Complete “${feature.choice.label}” em ${progression.label}.`
            }
          }
        }
      }
    }

    const proficiencyError = validateClassProficiencySelections(
      classProficiencySelections(classPlans, classSkillSelections, classToolChoices),
      primaryClass,
    )
    if (proficiencyError) return proficiencyError

    if (selectedMetamagics.length !== metamagicLimit) {
      return metamagicLimit
        ? `Escolha exatamente ${metamagicLimit} opções de Metamagia.`
        : "Remova as opções de Metamagia; o personagem ainda não possui essa característica."
    }

    return ""
  }

  function createCharacter() {
    const error = validateCreation()
    if (error) {
      setValidationMessage(error)
      setStep(STEPS.length - 1)
      return
    }

    const history = [
      `Antecedente: ${background.name}`,
      background.description,
    ]
      .filter(Boolean)
      .join("\n")
    const skills = Object.fromEntries(
      Array.from(
        new Set([
          ...racialSkills,
          ...background.skillProficiencies,
        ]),
      ).map((skill) => [skill, "proficient"]),
    )
    const classes = classPlans.map((plan) => {
      const subclass = getClassProgression(
        plan.className,
      ).subclasses.find((entry) => entry.id === plan.subclassId)
      return {
        ...createClassEntry(plan.className, plan.level),
        subclass: subclass
          ? { id: subclass.id, name: subclass.name, source: subclass.source }
          : undefined,
        levelChoices: plan.levelChoices,
      }
    })

    let character = newCharacterTemplate(
      name.trim() || "Personagem",
      chosenOwner,
    ).withPatch({
      visibility,
      profile: {
        ...newCharacterTemplate("", chosenOwner).get("profile"),
        history,
      },
      abilities: backgroundAbilities.map((ability) => ({
        ...ability,
        source: "background",
      })),
      inventory: [...backgroundItems, ...classEquipmentItems],
      sheet: {
        ...newCharacterTemplate("", chosenOwner).get("sheet"),
        attributes: { ...attributes },
        skills,
        proficiencies: [
          ...(race.proficiencies ?? []).map((entry) => ({ ...entry })),
          ...(background.proficiencies ?? []).map((entry) => ({ ...entry })),
        ],
        race: {
          ...race,
          naturalAbilities: (race.naturalAbilities ?? []).map(cloneAbility),
          proficiencies: (race.proficiencies ?? []).map((entry) => ({ ...entry })),
          attributeBonus: { ...race.attributeBonus },
        },
        classes,
      },
    })

    character = prepareCharacterForProgression(character)
    character = applyClassProficiencies(
      character,
      classProficiencySelections(
        classPlans,
        classSkillSelections,
        classToolChoices,
      ),
      primaryClass,
    )

    const selections: ProgressionSpellSelection[] = classPlans
      .filter(
        (plan) =>
          getClassSpellSelectionRule(
            draftCharacter,
            plan.className,
            plan.level,
            plan.subclassId,
          ).mode !== "none",
      )
      .map((plan) => ({
        className: plan.className,
        spellIndexes: spellSelections[plan.className]?.selected ?? [],
        preparedSpellIndexes:
          spellSelections[plan.className]?.prepared ?? [],
      }))

    character = applyCharacterProgression(character, {
      mode: "creation",
      classPlans,
      spellSelections: selections,
      metamagics: selectedMetamagics,
      customAbilities: customClassAbilities,
      spells,
      advancedClassName: primaryClass,
    })
    character = finalizeDynamicSubclassSpells(character, spells, "creation")

    void onCreate(character, {
      className: primaryClass,
      targetLevel: totalLevel,
    })
  }

  return (
    <div
      className={
        mode === "page"
          ? "mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-7xl items-start px-2 py-4 sm:px-4"
          : "fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/65 p-0 backdrop-blur-sm sm:p-4"
      }
      onMouseDown={mode === "modal" ? onClose : undefined}
    >
      <div
        className={
          mode === "page"
            ? "grid min-h-[calc(100dvh-10rem)] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-theme-lg"
            : "grid h-[100dvh] w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg-elevated shadow-theme-lg sm:max-h-[95dvh] sm:rounded-xl sm:border sm:border-border"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-border p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-semibold text-textH">Criar personagem</h1>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Raça, antecedente, equipamentos, classes, características, magias e atributos são configurados antes da criação da ficha.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={
                  index === step
                    ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-[11px] font-semibold text-textH"
                    : "shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] text-textMuted"
                }
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </header>

        <main className="min-h-0 overflow-y-auto p-3 sm:p-5">
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
              onAddAbility={() =>
                setAbilityEditor({ source: "race", ability: null })
              }
              onEditAbility={(ability) =>
                setAbilityEditor({ source: "race", ability })
              }
            />
          ) : null}

          {step === 2 ? (
            <BackgroundStep
              selectedPresetId={backgroundPresetId}
              background={background}
              abilities={backgroundAbilities}
              racialSkills={racialSkills}
              onSelectPreset={selectBackgroundPreset}
              onSelectCustom={selectCustomBackground}
              onChange={setBackground}
              onAbilitiesChange={setBackgroundAbilities}
              onAddAbility={() =>
                setAbilityEditor({ source: "background", ability: null })
              }
              onEditAbility={(ability) =>
                setAbilityEditor({ source: "background", ability })
              }
            />
          ) : null}

          {step === 3 ? (
            <InlineStartingEquipmentEditor
              title="Equipamento do antecedente"
              description="Os itens padrão do antecedente já foram carregados. Edite esta lista antes de selecionar classes."
              sourceLabel={background.name || "Antecedente"}
              items={backgroundItems}
              onChange={setBackgroundItems}
            />
          ) : null}

          {step === 4 ? (
            <LevelStep totalLevel={totalLevel} onChange={changeTotalLevel} />
          ) : null}

          {step === 5 ? (
            <ClassesStep
              totalLevel={totalLevel}
              draftCharacter={draftCharacter}
              classPlans={classPlans}
              customClassName={customClassName}
              customClassConfigs={customClassConfigs}
              blockedSkills={blockedClassSkills}
              classSkillSelections={classSkillSelections}
              classToolChoices={classToolChoices}
              customAbilities={customClassAbilities}
              spells={spells}
              spellSelections={spellSelections}
              spellQueries={spellQueries}
              metamagics={metamagics}
              selectedMetamagics={selectedMetamagics}
              metamagicLimit={metamagicLimit}
              onAddClass={addClass}
              onRemoveClass={removeClass}
              onApplyCustomClassConfig={onApplyCustomClassConfig}
              onShiftLevel={shiftClassLevel}
              onUpdatePlan={updatePlan}
              onToggleChoice={toggleFeatureChoice}
              onSetCustomChoice={setCustomFeatureChoice}
              onToggleSkill={toggleClassSkill}
              onToolChoiceChange={(className, value) =>
                setClassToolChoices((current) => ({
                  ...current,
                  [className]: value,
                }))
              }
              onAddCustomAbility={(className, classLevel) =>
                setAbilityEditor({
                  source: "class",
                  ability: null,
                  className,
                  classLevel,
                })
              }
              onEditCustomAbility={(entry) =>
                setAbilityEditor({
                  source: "class",
                  ability: entry.ability,
                  className: entry.className,
                  classLevel: entry.classLevel,
                })
              }
              onRemoveCustomAbility={(abilityId) =>
                setCustomClassAbilities((current) =>
                  current.filter((entry) => entry.ability.id !== abilityId),
                )
              }
              onSpellQueryChange={(className, value) =>
                setSpellQueries((current) => ({
                  ...current,
                  [className]: value,
                }))
              }
              onToggleSpell={toggleSpell}
              onTogglePrepared={togglePrepared}
              onToggleMetamagic={(id) =>
                setSelectedMetamagics((current) =>
                  current.includes(id)
                    ? current.filter((entry) => entry !== id)
                    : current.length < metamagicLimit
                      ? [...current, id]
                      : current,
                )
              }
            />
          ) : null}

          {step === 6 ? (
            <InlineStartingEquipmentEditor
              title={
                classPlans.length
                  ? `Equipamento de nível 1 de ${primaryClassLabel}`
                  : "Equipamento da classe inicial"
              }
              description="Somente a classe inicial concede equipamento. Níveis adicionais e multiclasse não duplicam o pacote inicial."
              sourceLabel={
                classPlans.length
                  ? `Classe inicial: ${primaryClassLabel}`
                  : "Nenhuma classe inicial"
              }
              items={classEquipmentItems}
              onChange={setClassEquipmentItems}
            />
          ) : null}

          {step === 7 ? (
            <AttributesStep
              attributes={attributes}
              raceBonuses={race.attributeBonus}
              onChange={(attribute, value) =>
                setAttributes((current) => ({
                  ...current,
                  [attribute]: Math.max(1, Math.min(30, value)),
                }))
              }
              onUseRecommended={() =>
                setAttributes({ ...primaryPreset.recommendedAttributes })
              }
            />
          ) : null}

          {step === 8 ? (
            <ReviewStep
              name={name}
              race={race}
              background={background}
              backgroundAbilities={backgroundAbilities}
              backgroundItems={backgroundItems}
              totalLevel={totalLevel}
              classPlans={classPlans}
              customClassName={customClassName}
              customClassConfigs={customClassConfigs}
              classEquipmentItems={classEquipmentItems}
              attributes={attributes}
              classSkillSelections={classSkillSelections}
              validationMessage={validationMessage}
            />
          ) : null}
        </main>

        <footer className="flex flex-col-reverse gap-2 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <Button
            variant="secondary"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                disabled={step === 0 && !name.trim()}
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
              <Button variant="primary" onClick={createCharacter}>
                <Check className="h-4 w-4" />
                Confirmar e criar personagem
              </Button>
            )}
          </div>
        </footer>
      </div>

      <AbilityDialog
        open={abilityEditor !== null}
        ability={abilityEditor?.ability ?? null}
        onClose={() => setAbilityEditor(null)}
        onSave={saveAbility}
      />
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
      title="Identidade"
      description="Defina a identidade da ficha. Nenhum personagem é salvo antes da confirmação final."
    >
      <div className="grid gap-4 md:grid-cols-2">
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
            list="integrated-character-owner-options"
            onChange={(event) => onOwnerChange(event.target.value)}
          />
          <datalist id="integrated-character-owner-options">
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
            <option value="private">Privado</option>
            <option value="party">Grupo</option>
            <option value="master">Mestre</option>
          </Select>
        </Field>
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
  onAddAbility,
  onEditAbility,
}: {
  selectedPresetId: string
  race: CharacterRace
  onSelectPreset: (preset: RacePreset) => void
  onSelectCustom: () => void
  onChange: (race: CharacterRace) => void
  onAddAbility: () => void
  onEditAbility: (ability: Ability) => void
}) {
  const custom = selectedPresetId === "custom"
  const selectedPreset = PHB_RACE_PRESETS.find(
    (preset) => preset.id === selectedPresetId,
  )
  const displayName = custom
    ? race.customName?.trim() || race.subrace?.trim() || "Raça personalizada"
    : selectedPreset?.name ??
      race.customName?.trim() ??
      race.subrace?.trim() ??
      String(race.race)
  const fixedBonuses = selectedPreset?.attributeBonus ?? race.attributeBonus

  return (
    <div className="grid gap-5">
      <StepSection
        title="Raça"
        description="Escolha um preset racial para usar seus dados como definidos. Para alterar os dados-base da raça, selecione Personalizada."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
  selected={custom}
  title="Personalizada"
  description="Use a raça atual como base e edite identidade, tamanho, mobilidade, bônus, características e proficiências."
  onClick={onSelectCustom}
/>
        </div>
      </StepSection>

      <div
        data-character-creation-race-details="true"
        data-race-preset-id={selectedPresetId}
        data-race-name={displayName}
        data-race-fixed-bonuses={JSON.stringify(fixedBonuses)}
      >
        <StepSection
title={
  custom
    ? "Construir raça personalizada"
    : `Visualização do preset racial: ${displayName}`
}
description={
  custom
    ? "Todos os dados raciais abaixo pertencem à raça personalizada e podem ser editados."
    : "Os dados-base abaixo vêm do preset selecionado e são somente leitura. Selecione Personalizada para editá-los."
}
        >
{custom ? (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Field label="Nome da raça">
      <Input
        value={race.customName ?? ""}
        placeholder="Nome da raça"
        onChange={(event) =>
          onChange({
            ...race,
            customName: event.target.value,
          })
        }
      />
    </Field>
    <Field label="Sub-raça">
      <Input
        value={race.subrace ?? ""}
        placeholder="Opcional"
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
    <Field label="Mobilidade base (m)">
      <Input
        type="number"
        min={0}
        step={0.5}
        value={race.mobility ?? 9}
        onChange={(event) =>
          onChange({
            ...race,
            mobility: Math.max(0, Number(event.target.value) || 0),
            speedBonus: undefined,
          })
        }
      />
    </Field>
  </div>
) : (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Summary label="Nome" value={displayName} />
    <Summary label="Sub-raça" value={race.subrace?.trim() || "—"} />
    <Summary
      label="Tamanho"
      value={SIZE_LABELS[race.size ?? "medium"]}
    />
    <Summary
      label="Mobilidade base"
      value={`${race.mobility ?? 9} m`}
    />
  </div>
)}

{!custom ? (
  <div className="mt-4 rounded-xl border border-border bg-bg p-3">
    <div className="text-xs font-semibold text-textH">
      Bônus raciais atuais
    </div>
    <div className="mt-2 flex flex-wrap gap-2">
      {ATTRIBUTE_KEYS.map((attribute) => {
        const value = race.attributeBonus[attribute] ?? 0
        return value ? (
          <Badge key={attribute}>
            {ATTRIBUTE_LABELS[attribute]} +{value}
          </Badge>
        ) : null
      })}
    </div>
  </div>
) : null}

<div className="hidden" aria-hidden="true">
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    {ATTRIBUTE_KEYS.map((attribute) => (
      <Field
        key={attribute}
        label={`Bônus de ${ATTRIBUTE_LABELS[attribute]}`}
      >
        <Input
          type="number"
          min={0}
          max={4}
          value={race.attributeBonus[attribute] ?? 0}
          onChange={(event) =>
            onChange({
              ...race,
              attributeBonus: {
                ...race.attributeBonus,
                [attribute]: Math.max(
                  0,
                  Math.min(4, Number(event.target.value) || 0),
                ),
              },
            })
          }
        />
      </Field>
    ))}
  </div>
</div>

<FeatureList
  title="Características raciais"
  abilities={race.naturalAbilities ?? []}
  onAdd={onAddAbility}
  onEdit={onEditAbility}
  onRemove={(abilityId) =>
    onChange({
      ...race,
      naturalAbilities: (race.naturalAbilities ?? []).filter(
        (entry) => entry.id !== abilityId,
      ),
    })
  }
  readOnly={!custom}
/>

<div className="mt-4">
  {custom ? (
    <GrantedProficienciesEditor
      proficiencies={race.proficiencies ?? []}
      onChange={(proficiencies: Proficiency[]) =>
        onChange({ ...race, proficiencies })
      }
      title="Proficiências raciais"
      description="Edite idiomas, perícias, armas, armaduras e ferramentas concedidos pela raça."
      emptyMessage="Nenhuma proficiência racial cadastrada."
    />
  ) : (
    <section className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-xs font-semibold text-textH">
        Proficiências raciais
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(race.proficiencies ?? []).length ? (
          race.proficiencies.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border bg-bg p-3"
            >
              <span className="block text-xs font-medium text-textH">
                {entry.name}
              </span>
              <span className="mt-1 block text-[10px] text-textMuted">
                {entry.category}
              </span>
              {entry.notes ? (
                <span className="mt-1 block text-[10px] text-textMuted">
                  {entry.notes}
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <div className="text-xs text-textMuted">
            Nenhuma proficiência racial cadastrada.
          </div>
        )}
      </div>
    </section>
  )}
</div>
        </StepSection>
      </div>
    </div>
  )
}

function BackgroundStep({
  selectedPresetId,
  background,
  abilities,
  racialSkills,
  onSelectPreset,
  onSelectCustom,
  onChange,
  onAbilitiesChange,
  onAddAbility,
  onEditAbility,
}: {
  selectedPresetId: string
  background: CharacterBackground
  abilities: Ability[]
  racialSkills: Skill[]
  onSelectPreset: (preset: BackgroundPreset) => void
  onSelectCustom: () => void
  onChange: (background: CharacterBackground) => void
  onAbilitiesChange: (abilities: Ability[]) => void
  onAddAbility: () => void
  onEditAbility: (ability: Ability) => void
}) {
  return (
    <div className="grid gap-5">
      <StepSection
        title="Antecedente"
        description="Escolha um antecedente padrão e depois edite suas características e proficiências. O equipamento vem no próximo passo."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            description="Use o antecedente atual como base e edite todos os campos."
            onClick={onSelectCustom}
          />
        </div>
      </StepSection>

      <StepSection title="Construir características do antecedente">
        <div className="grid gap-4 md:grid-cols-2">
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
          <Field label="Descrição">
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
        </div>

        <FeatureList
          title="Características do antecedente"
          abilities={abilities}
          onAdd={onAddAbility}
          onEdit={onEditAbility}
          onRemove={(abilityId) =>
            onAbilitiesChange(
              abilities.filter((entry) => entry.id !== abilityId),
            )
          }
        />

        <div className="mt-4">
          <div className="text-xs font-semibold text-textH">
            Perícias do antecedente
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(SKILL_LABELS).map(([rawSkill, label]) => {
              const skill = rawSkill as Skill
              const selected = background.skillProficiencies.includes(skill)
              const blocked = racialSkills.includes(skill)
              return (
                <ToggleCard
                  key={skill}
                  label={label}
                  selected={selected}
                  disabled={blocked}
                  note={blocked ? "Já concedida pela raça" : undefined}
                  onClick={() =>
                    onChange({
                      ...background,
                      custom: true,
                      skillProficiencies: selected
                        ? background.skillProficiencies.filter(
                            (entry) => entry !== skill,
                          )
                        : [...background.skillProficiencies, skill],
                    })
                  }
                />
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <GrantedProficienciesEditor
            proficiencies={background.proficiencies ?? []}
            onChange={(proficiencies) =>
              onChange({ ...background, proficiencies, custom: true })
            }
            title="Outras proficiências do antecedente"
            description="Edite idiomas, ferramentas, veículos, instrumentos e jogos concedidos pelo antecedente."
            emptyMessage="Nenhuma outra proficiência cadastrada."
          />
        </div>
      </StepSection>
    </div>
  )
}

function LevelStep({
  totalLevel,
  onChange,
}: {
  totalLevel: number
  onChange: (value: number) => void
}) {
  return (
    <StepSection
      title="Nível total do personagem"
      description="Defina o nível final antes de distribuir níveis entre classes. A classe inicial concede equipamento somente no nível 1."
    >
      <div className="mx-auto grid max-w-md gap-3 rounded-xl border border-border bg-bg p-5 text-center">
        <label className="text-xs text-textMuted">Nível total</label>
        <Input
          type="number"
          min={1}
          max={20}
          value={totalLevel}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <p className="text-xs leading-5 text-textMuted">
          Depois de selecionar as classes, todas as características dos níveis distribuídos serão exibidas e poderão ser revisadas antes dos atributos.
        </p>
      </div>
    </StepSection>
  )
}

function ClassesStep({
  totalLevel,
  draftCharacter,
  classPlans,
  customClassName,
  customClassConfigs,
  blockedSkills,
  classSkillSelections,
  classToolChoices,
  customAbilities,
  spells,
  spellSelections,
  spellQueries,
  metamagics,
  selectedMetamagics,
  metamagicLimit,
  onAddClass,
  onRemoveClass,
  onApplyCustomClassConfig,
  onShiftLevel,
  onUpdatePlan,
  onToggleChoice,
  onSetCustomChoice,
  onToggleSkill,
  onToolChoiceChange,
  onAddCustomAbility,
  onEditCustomAbility,
  onRemoveCustomAbility,
  onSpellQueryChange,
  onToggleSpell,
  onTogglePrepared,
  onToggleMetamagic,
}: {
  totalLevel: number
  draftCharacter: CharacterTemplate
  classPlans: ProgressionClassPlan[]
  customClassName: string
  customClassConfigs?: Record<string, CustomClassRuntimeConfig>
  blockedSkills: Set<Skill>
  classSkillSelections: Partial<Record<ClassName, Skill[]>>
  classToolChoices: Partial<Record<ClassName, string>>
  customAbilities: ProgressionCustomAbility[]
  spells: Spell[]
  spellSelections: SpellSelections
  spellQueries: Partial<Record<ClassName, string>>
  metamagics: Array<{ id: MetamagicId; name: string; desc: string[] }>
  selectedMetamagics: MetamagicId[]
  metamagicLimit: number
  onAddClass: (className: ClassName) => void
  onRemoveClass: (className: ClassName) => void
  onApplyCustomClassConfig?: (
    className: ClassName,
    config: CustomClassRuntimeConfig,
  ) => void
  onShiftLevel: (className: ClassName, delta: -1 | 1) => void
  onUpdatePlan: (
    className: ClassName,
    updater: (plan: ProgressionClassPlan) => ProgressionClassPlan,
  ) => void
  onToggleChoice: (
    className: ClassName,
    choiceId: string,
    count: number,
    option: string,
  ) => void
  onSetCustomChoice: (
    className: ClassName,
    choiceId: string,
    value: string,
  ) => void
  onToggleSkill: (className: ClassName, skill: Skill, limit: number) => void
  onToolChoiceChange: (className: ClassName, value: string) => void
  onAddCustomAbility: (className: ClassName, classLevel: number) => void
  onEditCustomAbility: (entry: ProgressionCustomAbility) => void
  onRemoveCustomAbility: (abilityId: string) => void
  onSpellQueryChange: (className: ClassName, value: string) => void
  onToggleSpell: (plan: ProgressionClassPlan, spell: Spell) => void
  onTogglePrepared: (className: ClassName, spellIndex: string) => void
  onToggleMetamagic: (id: MetamagicId) => void
}) {
  const [newClass, setNewClass] = useState<ClassName | "">("")
  const [expandedClasses, setExpandedClasses] = useState<Set<ClassName>>(
    () => new Set(),
  )
  const selectedAlreadyAdded =
    newClass !== "" &&
    String(newClass) !== String(CUSTOM_CLASS_RUNTIME_ID) &&
    classPlans.some((plan) => plan.className === newClass)
  const canAddSelectedClass =
    newClass !== "" &&
    !selectedAlreadyAdded &&
    (classPlans.length === 0 ||
      (classPlans.length < totalLevel &&
        classPlans.some((plan) => plan.level > 1)))

  useEffect(() => {
    if (selectedAlreadyAdded) setNewClass("")
  }, [selectedAlreadyAdded])

  return (
    <div className="grid gap-5">
      <StepSection title="Classes">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field label="Classe">
            <Select
              value={newClass}
              onChange={(event) =>
                setNewClass(event.target.value as ClassName | "")
              }
            >
              <option value="">Selecionar classe</option>
              {AVAILABLE_CLASSES.map((className) => {
                const customOption =
                  String(className) === String(CUSTOM_CLASS_RUNTIME_ID)
                const added =
                  !customOption &&
                  classPlans.some((plan) => plan.className === className)
                const label = customOption
                  ? "Classe personalizada"
                  : getClassNamePt(className)
                return (
                  <option key={className} value={className} disabled={added}>
                    {label}
                  </option>
                )
              })}
            </Select>
          </Field>
          <Button
            variant="secondary"
            disabled={!canAddSelectedClass}
            onClick={() => {
              if (!newClass) return
              onAddClass(newClass)
              setNewClass("")
            }}
          >
            <Plus className="h-4 w-4" />
            Adicionar classe
          </Button>
        </div>
      </StepSection>

      {!classPlans.length ? (
        <div className="rounded-xl border border-dashed border-border bg-bg p-4 text-center text-xs text-textMuted">
          Nenhuma classe adicionada. A primeira classe adicionada será a classe inicial.
        </div>
      ) : null}

      {classPlans.map((plan, index) => {
        const progression = getClassProgression(plan.className)
        const isCustomClass = isCustomClassName(plan.className)
        const customClassConfig =
          customClassConfigs?.[String(plan.className)] ??
          getCustomClassConfig(draftCharacter, plan.className)
        const displayLabel = isCustomClass
          ? customClassConfig?.name.trim() ||
            customClassName.trim() ||
            progression.label
          : progression.label
        const subclassRequired = plan.level >= progression.subclassLevel
        const proficiencyRule = getClassProficiencyRule(plan.className)
        const skillRule =
          index === 0
            ? proficiencyRule.initialSkills
            : proficiencyRule.multiclassSkills
        const selectedSkills = classSkillSelections[plan.className] ?? []
        const features = Array.from(
          { length: plan.level },
          (_, levelIndex) => levelIndex + 1,
        ).flatMap((level) =>
          getFeaturesAtLevel(
            plan.className,
            level,
            plan.subclassId,
          ),
        )
        const classCustomAbilities = customAbilities.filter(
          (entry) => entry.className === plan.className,
        )
        const staticGrants = getSubclassSpellGrants(
          plan.className,
          plan.subclassId,
          plan.level,
        )
        const dynamicGrants = getDynamicSubclassSpellGrants(
          draftCharacter,
          plan.className,
          plan.subclassId,
          plan.level,
        )
        const allGrantRows = [
          ...staticGrants.flatMap((grant) =>
            grant.spellNames.map((spellName) => ({
              spellName,
              mode: grant.mode,
              classLevel: grant.classLevel,
            })),
          ),
          ...dynamicGrants.map((grant) => ({
            spellName: grant.spellName,
            mode: grant.mode,
            classLevel: grant.classLevel,
          })),
        ]

        return (
          <section
            key={plan.className}
            className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-textH">
                  {displayLabel} — nível {plan.level}
                </h2>
                <p className="mt-1 text-xs text-textMuted">
                  {index === 0 ? "Classe inicial" : "Multiclasse"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={plan.level <= 1 || classPlans.length <= 1}
                  onClick={() => onShiftLevel(plan.className, -1)}
                >
                  − nível
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={
                    !classPlans.some(
                      (entry) =>
                        entry.className !== plan.className && entry.level > 1,
                    )
                  }
                  onClick={() => onShiftLevel(plan.className, 1)}
                >
                  + nível
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setExpandedClasses((current) => {
                      const next = new Set(current)
                      if (next.has(plan.className)) next.delete(plan.className)
                      else next.add(plan.className)
                      return next
                    })
                  }}
                >
                  {expandedClasses.has(plan.className)
                    ? "Fechar configuração"
                    : "Configurar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveClass(plan.className)}
                >
                  Remover
                </Button>
              </div>
            </div>

            {expandedClasses.has(plan.className) ? (
              <>
                {isCustomClass && customClassConfig && onApplyCustomClassConfig ? (
                  <div className="rounded-lg border border-border bg-bg p-3">
                    <CustomClassConfigurationEditor
                      config={customClassConfig}
                      applyLabel="Aplicar ao rascunho"
                      onApply={(next) =>
                        onApplyCustomClassConfig(plan.className, next)
                      }
                    />
                  </div>
                ) : null}

            {subclassRequired && progression.subclasses.length ? (
              <Field
                label={`Subclasse obrigatória a partir do nível ${progression.subclassLevel}`}
              >
                <Select
                  value={plan.subclassId ?? ""}
                  onChange={(event) =>
                    onUpdatePlan(plan.className, (current) => ({
                      ...current,
                      subclassId: event.target.value || undefined,
                      levelChoices: {},
                      enabledOptionalFeatureIds: [],
                    }))
                  }
                >
                  <option value="">Selecione uma subclasse</option>
                  {progression.subclasses.map((subclass) => (
                    <option key={subclass.id} value={subclass.id}>
                      {subclass.name} · {subclass.source}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <details className="rounded-lg border border-border bg-bg p-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-textH">
                Proficiências concedidas
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {(index === 0
                  ? proficiencyRule.initial
                  : proficiencyRule.multiclass
                ).map((entry) => (
                  <Badge key={entry.id}>
                    {entry.name} · {entry.category}
                  </Badge>
                ))}
                {index === 0
                  ? proficiencyRule.savingThrows.map((attribute) => (
                      <Badge key={attribute}>
                        Salvaguarda de {ATTRIBUTE_LABELS[attribute]}
                      </Badge>
                    ))
                  : null}
              </div>

              {skillRule ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-textH">
                    Escolha {skillRule.count}{" "}
                    {skillRule.count === 1 ? "perícia" : "perícias"} ({selectedSkills.length}/{skillRule.count})
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {Object.entries(SKILL_LABELS)
                      .filter(([rawSkill]) =>
                        skillRule.options === "any"
                          ? true
                          : skillRule.options.includes(rawSkill as Skill),
                      )
                      .map(([rawSkill, label]) => {
                        const skill = rawSkill as Skill
                        const selected = selectedSkills.includes(skill)
                        const blocked = blockedSkills.has(skill)
                        return (
                          <ToggleCard
                            key={skill}
                            label={label}
                            selected={selected}
                            disabled={
                              blocked ||
                              (!selected &&
                                selectedSkills.length >= skillRule.count)
                            }
                            note={blocked ? "Já concedida" : undefined}
                            onClick={() =>
                              onToggleSkill(
                                plan.className,
                                skill,
                                skillRule.count,
                              )
                            }
                          />
                        )
                      })}
                  </div>
                </div>
              ) : null}

              {index > 0 && proficiencyRule.multiclassChoiceLabel ? (
                <Field label={proficiencyRule.multiclassChoiceLabel} className="mt-4">
                  <Input
                    value={classToolChoices[plan.className] ?? ""}
                    placeholder="Digite a escolha"
                    onChange={(event) =>
                      onToolChoiceChange(plan.className, event.target.value)
                    }
                  />
                </Field>
              ) : null}
            </details>

            <details className="rounded-lg border border-border bg-bg p-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-textH">
                Características dos níveis 1–{plan.level}
              </summary>
              <div className="mt-3 grid gap-3">
                {features.map((feature) => {
                  const enabled =
                    !feature.optional ||
                    plan.enabledOptionalFeatureIds.includes(feature.id)
                  const choices = feature.choice
                    ? plan.levelChoices[feature.choice.id] ?? []
                    : []
                  return (
                    <article
                      key={`${plan.className}:${feature.id}`}
                      className="rounded-lg border border-border bg-bg-subtle p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm text-textH">
                              {feature.name}
                            </strong>
                            <Badge>Nível {feature.level}</Badge>
                            <Badge>{feature.source}</Badge>
                            {feature.optional ? <Badge>Opcional</Badge> : null}
                          </div>
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-medium text-textH">
                              Ler detalhes da característica
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">
                              {feature.description || "Sem descrição cadastrada."}
                            </p>
                            {feature.choice?.description ? (
                              <p className="mt-2 leading-5 text-textMuted">
                                {feature.choice.description}
                              </p>
                            ) : null}
                          </details>
                        </div>
                        {feature.optional ? (
                          <Button
                            size="sm"
                            variant={enabled ? "secondary" : "ghost"}
                            onClick={() =>
                              onUpdatePlan(plan.className, (current) => ({
                                ...current,
                                enabledOptionalFeatureIds: current.enabledOptionalFeatureIds.includes(feature.id)
                                  ? current.enabledOptionalFeatureIds.filter((id) => id !== feature.id)
                                  : [...current.enabledOptionalFeatureIds, feature.id],
                              }))
                            }
                          >
                            {enabled ? "Incluída" : "Incluir"}
                          </Button>
                        ) : null}
                      </div>

                      {enabled && feature.choice && feature.choice.kind !== "metamagic" ? (
                        <div className="mt-3 grid gap-2">
                          <div className="text-xs font-semibold text-textH">
                            {feature.choice.label} · escolha {feature.choice.count}
                          </div>
                          {feature.choice.options?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {feature.choice.options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() =>
                                    onToggleChoice(
                                      plan.className,
                                      feature.choice!.id,
                                      feature.choice!.count,
                                      option,
                                    )
                                  }
                                  className={
                                    choices.includes(option)
                                      ? "rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-medium text-textH"
                                      : "rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-textMuted"
                                  }
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {feature.choice.allowCustom ? (
                            <Input
                              value={choices[0] ?? ""}
                              placeholder="Digite a escolha ou talento"
                              onChange={(event) =>
                                onSetCustomChoice(
                                  plan.className,
                                  feature.choice!.id,
                                  event.target.value,
                                )
                              }
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </details>

            {allGrantRows.length ? (
              <details className="rounded-lg border border-accentBorder bg-accentBg p-3">
                <summary className="cursor-pointer text-sm font-semibold text-textH">
                  Ler detalhes das magias concedidas pela subclasse
                </summary>
                <div className="mt-3 grid gap-2">
                  {allGrantRows.map((grant, grantIndex) => {
                    const spell = findSpellByName(spells, grant.spellName)
                    return (
                      <article
                        key={`${grant.spellName}:${grant.classLevel}:${grantIndex}`}
                        className="rounded-lg border border-border bg-bg p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-textH">
                            {spell?.displayName || spell?.name || grant.spellName}
                          </strong>
                          <Badge>Nível de classe {grant.classLevel}</Badge>
                          <Badge>{grantModeLabel(grant.mode)}</Badge>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                          {spell?.description || "A descrição desta magia não está disponível no compêndio carregado."}
                        </p>
                      </article>
                    )
                  })}
                </div>
              </details>
            ) : null}

            <ClassSpellSelector
              plan={plan}
              character={draftCharacter}
              spells={spells}
              selection={spellSelections[plan.className] ?? { selected: [], prepared: [] }}
              query={spellQueries[plan.className] ?? ""}
              onQueryChange={(value) =>
                onSpellQueryChange(plan.className, value)
              }
              onToggleSpell={(spell) => onToggleSpell(plan, spell)}
              onTogglePrepared={(spellIndex) =>
                onTogglePrepared(plan.className, spellIndex)
              }
            />

            {plan.className === "sorcerer" && metamagicLimit > 0 ? (
              <div className="grid gap-3 rounded-lg border border-border bg-bg p-3">
                <div>
                  <strong className="text-sm text-textH">Metamagia</strong>
                  <p className="mt-1 text-xs text-textMuted">
                    Escolha {metamagicLimit} opções para Feiticeiro {plan.level}.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {metamagics.map((metamagic) => {
                    const selected = selectedMetamagics.includes(metamagic.id)
                    return (
                      <button
                        key={metamagic.id}
                        type="button"
                        onClick={() => onToggleMetamagic(metamagic.id)}
                        className={
                          selected
                            ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                            : "rounded-xl border border-border bg-bg-subtle p-4 text-left"
                        }
                      >
                        <strong className="text-sm text-textH">{metamagic.name}</strong>
                        <details
                          className="mt-2 text-xs"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <summary className="cursor-pointer font-medium text-textH">
                            Ler detalhes da Metamagia
                          </summary>
                          <p className="mt-2 leading-5 text-textMuted">
                            {metamagic.desc.join(" ")}
                          </p>
                        </details>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <FeatureList
              title="Características personalizadas desta classe"
              abilities={classCustomAbilities.map((entry) => entry.ability)}
              onAdd={() => onAddCustomAbility(plan.className, plan.level)}
              onEdit={(ability) => {
                const entry = classCustomAbilities.find(
                  (candidate) => candidate.ability.id === ability.id,
                )
                if (entry) onEditCustomAbility(entry)
              }}
              onRemove={onRemoveCustomAbility}
            />
              </>
            ) : null}
          </section>
        )
      })}

    </div>
  )
}

function ClassSpellSelector({
  plan,
  character,
  spells,
  selection,
  query,
  onQueryChange,
  onToggleSpell,
  onTogglePrepared,
}: {
  plan: ProgressionClassPlan
  character: CharacterTemplate
  spells: Spell[]
  selection: { selected: string[]; prepared: string[] }
  query: string
  onQueryChange: (value: string) => void
  onToggleSpell: (spell: Spell) => void
  onTogglePrepared: (spellIndex: string) => void
}) {
  const rule = getClassSpellSelectionRule(
    character,
    plan.className,
    plan.level,
    plan.subclassId,
  )
  if (rule.mode === "none") return null

  const subclassNames = getSubclassSpellGrants(
    plan.className,
    plan.subclassId,
    plan.level,
  ).flatMap((grant) => grant.spellNames)
  const normalizedQuery = normalizeSpellName(query)
  const available = spells
    .filter((spell) =>
      isSpellAllowedForClassSelection(spell, rule, subclassNames),
    )
    .filter(
      (spell) =>
        !normalizedQuery ||
        normalizeSpellName(
          `${spell.displayName ?? ""} ${spell.name} ${spell.school}`,
        ).includes(normalizedQuery),
    )
    .toSorted(
      (left, right) =>
        left.slotLevel - right.slotLevel ||
        spellLabel(left).localeCompare(spellLabel(right), "pt-BR"),
    )
  const selectedSpells = resolveSpells(selection.selected, spells)
  const cantrips = selectedSpells.filter((spell) => spell.slotLevel === 0).length
  const leveled = selectedSpells.filter((spell) => spell.slotLevel > 0).length

  return (
    <details className="rounded-lg border border-border bg-bg p-3">
      <summary className="cursor-pointer text-sm font-semibold text-textH">
        Selecionar e ler magias de {getClassNamePt(plan.className)} · truques {cantrips}/{rule.maxCantrips} · magias {leveled}/{rule.maxLeveledSpells}
      </summary>
      <div className="mt-3 grid gap-3">
        <Input
          value={query}
          placeholder="Buscar magia"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="grid max-h-[42rem] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
          {available.map((spell) => {
            const selected = selection.selected.includes(spell.index)
            const prepared = selection.prepared.includes(spell.index)
            return (
              <article
                key={spell.index}
                className={
                  selected
                    ? "rounded-lg border border-accentBorder bg-accentBg p-3"
                    : "rounded-lg border border-border bg-bg-subtle p-3"
                }
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onToggleSpell(spell)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-textH">
                      {spellLabel(spell)}
                    </strong>
                    <Badge>
                      {spell.slotLevel === 0
                        ? "Truque"
                        : `Nível ${spell.slotLevel}`}
                    </Badge>
                    <Badge>{String(spell.school)}</Badge>
                  </div>
                </button>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-textH">
                    Ler descrição completa da magia
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">
                    {spell.description || "Sem descrição cadastrada."}
                  </p>
                </details>
                {selected && rule.mode === "spellbook" && spell.slotLevel > 0 ? (
                  <label className="mt-3 flex items-center gap-2 text-xs text-text">
                    <input
                      type="checkbox"
                      checked={prepared}
                      onChange={() => onTogglePrepared(spell.index)}
                    />
                    Preparar esta magia
                  </label>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </details>
  )
}

function AttributesStep({
  attributes,
  raceBonuses,
  onChange,
  onUseRecommended,
}: {
  attributes: Record<Attribute, number>
  raceBonuses: Partial<Record<Attribute, number>>
  onChange: (attribute: Attribute, value: number) => void
  onUseRecommended: () => void
}) {
  return (
    <StepSection
      title="Atributos"
      description="Defina os valores base. Os bônus raciais são somados ao valor final exibido."
    >
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={onUseRecommended}>
          Usar atributos recomendados da classe inicial
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ATTRIBUTE_KEYS.map((attribute) => {
          const bonus = raceBonuses[attribute] ?? 0
          const final = attributes[attribute] + bonus
          return (
            <article
              key={attribute}
              className="rounded-xl border border-border bg-bg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-textH">
                    {ATTRIBUTE_LABELS[attribute]}
                  </strong>
                  <div className="mt-1 text-xs text-textMuted">
                    Base {attributes[attribute]} + raça {bonus} = {final}
                  </div>
                </div>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  max={30}
                  value={attributes[attribute]}
                  onChange={(event) =>
                    onChange(attribute, Number(event.target.value) || 1)
                  }
                />
              </div>
            </article>
          )
        })}
      </div>
    </StepSection>
  )
}

function ReviewStep({
  name,
  race,
  background,
  backgroundAbilities,
  backgroundItems,
  totalLevel,
  classPlans,
  customClassName,
  customClassConfigs,
  classEquipmentItems,
  attributes,
  classSkillSelections,
  validationMessage,
}: {
  name: string
  race: CharacterRace
  background: CharacterBackground
  backgroundAbilities: Ability[]
  backgroundItems: Itemmable[]
  totalLevel: number
  classPlans: ProgressionClassPlan[]
  customClassName: string
  customClassConfigs?: Record<string, CustomClassRuntimeConfig>
  classEquipmentItems: Itemmable[]
  attributes: Record<Attribute, number>
  classSkillSelections: Partial<Record<ClassName, Skill[]>>
  validationMessage: string
}) {
  return (
    <div className="grid gap-4">
      <StepSection
        title="Confirmar personagem"
        description="Esta é a única etapa que grava a ficha. Use a barra superior para voltar e editar qualquer origem."
      >
        <div className="grid gap-2 md:grid-cols-2">
          <Summary label="Nome" value={name || "—"} />
          <Summary
            label="Raça"
            value={race.customName || race.subrace || String(race.race)}
          />
          <Summary label="Antecedente" value={background.name} />
          <Summary label="Nível total" value={String(totalLevel)} />
          <Summary
            label="Classes"
            value={classPlans
              .map(
                (plan) =>
                  `${isCustomClassName(plan.className) ? customClassConfigs?.[String(plan.className)]?.name.trim() || customClassName.trim() || getClassNamePt(plan.className) : getClassNamePt(plan.className)} ${plan.level}${plan.subclassId ? ` — ${getClassProgression(plan.className).subclasses.find((entry) => entry.id === plan.subclassId)?.name ?? plan.subclassId}` : ""}`,
              )
              .join(" / ")}
          />
          <Summary
            label="Características raciais"
            value={String((race.naturalAbilities ?? []).length)}
          />
          <Summary
            label="Características do antecedente"
            value={String(backgroundAbilities.length)}
          />
          <Summary
            label="Equipamento do antecedente"
            value={`${backgroundItems.length} tipos de item`}
          />
          <Summary
            label="Equipamento da classe inicial"
            value={`${classEquipmentItems.length} tipos de item`}
          />
          <Summary
            label="Perícias de classe escolhidas"
            value={String(
              Object.values(classSkillSelections).reduce(
                (sum, entries) => sum + (entries?.length ?? 0),
                0,
              ),
            )}
          />
        </div>

        <details className="mt-4 rounded-lg border border-border bg-bg p-3">
          <summary className="cursor-pointer text-sm font-semibold text-textH">
            Revisar atributos finais
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {ATTRIBUTE_KEYS.map((attribute) => (
              <Summary
                key={attribute}
                label={ATTRIBUTE_LABELS[attribute]}
                value={String(
                  attributes[attribute] + (race.attributeBonus[attribute] ?? 0),
                )}
              />
            ))}
          </div>
        </details>
      </StepSection>

      {validationMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
          {validationMessage}
        </div>
      ) : null}
    </div>
  )
}

function FeatureList({
  title,
  abilities,
  onAdd,
  onEdit,
  onRemove,
  readOnly = false,
}: {
  title: string
  abilities: Ability[]
  onAdd: () => void
  onEdit: (ability: Ability) => void
  onRemove: (abilityId: string) => void
  readOnly?: boolean
}) {
  return (
    <section className="mt-4 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-xs font-semibold text-textH">{title}</div>
        {!readOnly ? (
<Button size="sm" variant="secondary" onClick={onAdd}>
  <Plus className="h-4 w-4" />
  Característica
</Button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {abilities.length ? (
abilities.map((ability) => (
  <article
    key={ability.id}
    className="rounded-lg border border-border bg-bg p-3"
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <strong className="text-sm text-textH">{ability.name}</strong>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium text-textH">
            Ler detalhes da característica
          </summary>
          <p className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">
            {ability.description || "Sem descrição cadastrada."}
          </p>
          {ability.grantedSpells?.length ? (
            <div className="mt-2">
              Magias concedidas: {ability.grantedSpells.map((grant) => grant.index).join(", ")}
            </div>
          ) : null}
        </details>
      </div>
      {!readOnly ? (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(ability)}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRemove(ability.id)}>
            Remover
          </Button>
        </div>
      ) : null}
    </div>
  </article>
))
        ) : (
<div className="rounded-lg border border-dashed border-border bg-bg p-4 text-center text-xs text-textMuted">
  Nenhuma característica cadastrada.
</div>
        )}
      </div>
    </section>
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
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <h2 className="font-semibold text-textH">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`grid gap-1.5 text-xs text-text ${className ?? ""}`}>
      {label}
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
          ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
          : "rounded-xl border border-border bg-bg p-4 text-left hover:border-accentBorder"
      }
    >
      <strong className="text-sm text-textH">{title}</strong>
      <span className="mt-1 block text-xs leading-5 text-textMuted">
        {description}
      </span>
    </button>
  )
}

function ToggleCard({
  label,
  selected,
  disabled,
  note,
  onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  note?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        selected
          ? "rounded-lg border border-accentBorder bg-accentBg p-2 text-left text-xs text-textH"
          : "rounded-lg border border-border bg-bg p-2 text-left text-xs text-textMuted disabled:opacity-50"
      }
    >
      <span className="block font-medium">{label}</span>
      {note ? <span className="mt-1 block text-[10px]">{note}</span> : null}
    </button>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {children}
    </span>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3 text-xs">
      <span className="text-textMuted">{label}</span>
      <strong className="text-right text-textH">{value}</strong>
    </div>
  )
}

function cloneBackground(background: CharacterBackground): CharacterBackground {
  return {
    ...background,
    skillProficiencies: [...background.skillProficiencies],
    proficiencies: background.proficiencies.map((entry) => ({ ...entry })),
    startingEquipment: background.startingEquipment.map((entry) => ({ ...entry })),
  }
}

function backgroundPresetAbilities(background: CharacterBackground): Ability[] {
  if (!background.featureName?.trim()) return []
  return [
    {
      id: `background-feature-${background.id}`,
      name: background.featureName,
      description: background.featureDescription || background.description,
      kind: "feature",
      category: "general",
      source: "background",
    },
  ]
}

function cloneAbility(ability: Ability): Ability {
  return {
    ...ability,
    usage: ability.usage ? { ...ability.usage } : undefined,
    grantedSpells: ability.grantedSpells?.map((entry) => ({ ...entry })),
    grantedProficiencies: ability.grantedProficiencies?.map((entry) => ({ ...entry })),
  }
}

function upsertAbility(abilities: Ability[], ability: Ability): Ability[] {
  return abilities.some((entry) => entry.id === ability.id)
    ? abilities.map((entry) => (entry.id === ability.id ? ability : entry))
    : [...abilities, ability]
}

function createPlan(className: ClassName, level: number): ProgressionClassPlan {
  return {
    className,
    level,
    previousLevel: 0,
    levelChoices: {},
    enabledOptionalFeatureIds: [],
  }
}

function redistributeTotal(
  plans: ProgressionClassPlan[],
  totalLevel: number,
): ProgressionClassPlan[] {
  if (!plans.length) return []
  const minimumForOthers = Math.max(0, plans.length - 1)
  if (totalLevel < plans.length) {
    const trimmed = plans.slice(0, totalLevel).map((plan) => ({
      ...plan,
      level: 1,
    }))
    return trimmed.length ? trimmed : [createPlan(plans[0].className, 1)]
  }
  const next = plans.map((plan, index) => ({
    ...plan,
    level: index === 0 ? Math.max(1, totalLevel - minimumForOthers) : 1,
  }))
  return next
}

function defaultClassEquipment(className: ClassName): Itemmable[] {
  if (isCustomClassName(className)) return []
  const selections = getDefaultClassEquipmentSelections(className)
  return getSelectedClassEquipment(className, selections).map((spec) =>
    createStartingInventoryItem(spec),
  )
}

function createDraftCharacter({
  name,
  owner,
  visibility,
  race,
  attributes,
  classPlans,
}: {
  name: string
  owner: Player
  visibility: Visibility
  race: CharacterRace
  attributes: Record<Attribute, number>
  classPlans: ProgressionClassPlan[]
}): CharacterTemplate {
  const base = newCharacterTemplate(name || "Rascunho", owner)
  return prepareCharacterForProgression(
    base.withPatch({
      visibility,
      sheet: {
        ...base.get("sheet"),
        attributes,
        race,
        classes: classPlans.map((plan) => {
          const subclass = getClassProgression(
            plan.className,
          ).subclasses.find((entry) => entry.id === plan.subclassId)
          return {
            ...createClassEntry(plan.className, plan.level),
            subclass: subclass
              ? { id: subclass.id, name: subclass.name, source: subclass.source }
              : undefined,
            levelChoices: plan.levelChoices,
          }
        }),
      },
    }),
  )
}

function classProficiencySelections(
  plans: ProgressionClassPlan[],
  selectedSkills: Partial<Record<ClassName, Skill[]>>,
  toolChoices: Partial<Record<ClassName, string>>,
): ClassProficiencySelection[] {
  return plans.map((plan) => ({
    className: plan.className,
    previousLevel: 0,
    selectedSkills: selectedSkills[plan.className] ?? [],
    selectedToolOrInstrument: toolChoices[plan.className],
  }))
}

function proficiencySkills(proficiencies: Proficiency[]): Skill[] {
  return proficiencies
    .filter((entry) => entry.category === "skill")
    .map((entry) => proficiencyNameToSkill(entry.name))
    .filter((entry): entry is Skill => Boolean(entry))
}

function proficiencyNameToSkill(value: string): Skill | undefined {
  const normalized = normalizeSpellName(value)
  const pairs = Object.entries(SKILL_LABELS) as Array<[Skill, string]>
  return pairs.find(
    ([skill, label]) =>
      normalizeSpellName(skill) === normalized ||
      normalizeSpellName(label) === normalized,
  )?.[0]
}

function resolveSpells(indexes: string[], spells: Spell[]): Spell[] {
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  return Array.from(new Set(indexes))
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
}

function findSpellByName(spells: Spell[], name: string): Spell | undefined {
  const normalized = normalizeSpellName(name)
  return spells.find(
    (spell) =>
      normalizeSpellName(spell.name) === normalized ||
      normalizeSpellName(spell.displayName ?? "") === normalized,
  )
}

function spellLabel(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function grantModeLabel(mode: string): string {
  if (mode === "always-prepared") return "Sempre preparada"
  if (mode === "bonus-known") return "Conhecida adicional"
  return "Lista expandida"
}
