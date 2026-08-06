import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import {
  getClassProgression,
  getFeaturesAtLevel,
  type LevelFeatureDefinition,
} from "../../../data/classProgression"
import {
  checkMulticlassRequirements,
  formatClassMulticlassRequirement,
} from "../../../models/leveling/MulticlassRequirements"
import {
  canReplaceMetamagicAtLevel,
  createClassEntry,
  getClassSpellSelectionRule,
  getMetamagicLimit,
  getSubclassOptions,
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
import { AbilityDialog } from "../abilities/abilityDialog"

const ALL_CLASS_NAMES: ClassName[] = [
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

type Props = {
  mode: "creation" | "level-up"
  character: CharacterTemplate
  targetTotalLevel?: number
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

type Step = "classes" | "features" | "spells" | "metamagic" | "review"
type HpMode = "average" | "manual" | "rolled"
type AbilitySource = "class" | "race"

type SpellSelectionState = Record<
  string,
  {
    selected: string[]
    prepared: string[]
    initial: string[]
  }
>

export function CharacterProgressionConfigurator({
  mode,
  character,
  targetTotalLevel,
  primaryClassName,
  onCancel,
  onComplete,
}: Props) {
  const { spells, metamagics } = useMagicContext()
  const existingClasses = character.get("sheet").classes ?? []
  const existingTotal = existingClasses.reduce(
    (sum, entry) => sum + entry.level,
    0,
  )
  const creationTotal = Math.max(
    1,
    Math.min(20, (targetTotalLevel ?? existingTotal) || 1),
  )
  const initialAdvancedClass =
    primaryClassName ?? existingClasses[0]?.className ?? "fighter"
  const [step, setStep] = useState<Step>("classes")
  const [advancedClassName, setAdvancedClassName] =
    useState<ClassName>(initialAdvancedClass)
  const [classPlans, setClassPlans] = useState<ProgressionClassPlan[]>(() =>
    createInitialPlans(
      mode,
      character,
      creationTotal,
      initialAdvancedClass,
    ),
  )
  const [spellSelections, setSpellSelections] =
    useState<SpellSelectionState>(() =>
      createInitialSpellSelections(character, classPlans),
    )
  const [selectedMetamagics, setSelectedMetamagics] =
    useState<MetamagicId[]>(() =>
      character.get("magic")?.metamagic?.metamagics ?? [],
    )
  const [customAbilities, setCustomAbilities] =
    useState<ProgressionCustomAbility[]>([])
  const [abilitySource, setAbilitySource] =
    useState<AbilitySource | null>(null)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [customAbilityClass, setCustomAbilityClass] =
    useState<ClassName>(initialAdvancedClass)
  const [customAbilityLevel, setCustomAbilityLevel] = useState(1)
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledDie, setRolledDie] = useState<number | null>(null)
  const [spellQueries, setSpellQueries] = useState<Record<string, string>>({})
  const [validationMessage, setValidationMessage] = useState("")

  const configuredCharacter = useMemo(
    () => characterWithPlans(character, classPlans),
    [character, classPlans],
  )
  const finalTotal = classPlans.reduce((sum, plan) => sum + plan.level, 0)
  const advancedProgression = getClassProgression(advancedClassName)
  const conModifier = configuredCharacter.getAttributeModifier("con")
  const averageHp = Math.max(
    1,
    Math.floor(Number(advancedProgression.hitDie.slice(1)) / 2) +
      1 +
      conModifier,
  )
  const hpGain =
    hpMode === "manual"
      ? Math.max(1, Math.trunc(Number(manualHp) || 1))
      : hpMode === "rolled"
        ? Math.max(1, (rolledDie ?? averageHp - conModifier) + conModifier)
        : averageHp
  const sorcererLevel =
    classPlans.find((plan) => plan.className === "sorcerer")?.level ?? 0
  const metamagicLimit = getMetamagicLimit(sorcererLevel)
  const initialMetamagics =
    character.get("magic")?.metamagic?.metamagics ?? []
  const metamagicReplacementAllowed =
    mode === "creation" ||
    (advancedClassName === "sorcerer" &&
      canReplaceMetamagicAtLevel(sorcererLevel))

  useEffect(() => {
    setSpellSelections((current) =>
      synchronizeSpellSelections(
        configuredCharacter,
        classPlans,
        current,
        spells,
      ),
    )
  }, [classPlans, configuredCharacter, spells])

  useEffect(() => {
    setSelectedMetamagics((current) => {
      const preserved = current.filter((id) =>
        metamagics.some((entry) => entry.id === id),
      )
      if (mode === "level-up" && !metamagicReplacementAllowed) {
        const required = initialMetamagics.filter((id) =>
          metamagics.some((entry) => entry.id === id),
        )
        return unique([...required, ...preserved]).slice(0, metamagicLimit)
      }
      return preserved.slice(0, metamagicLimit)
    })
  }, [
    initialMetamagics,
    metamagicLimit,
    metamagicReplacementAllowed,
    metamagics,
    mode,
  ])

  useEffect(() => {
    if (mode !== "level-up") return
    setClassPlans(createLevelUpPlans(character, advancedClassName))
    setCustomAbilityClass(advancedClassName)
    setValidationMessage("")
  }, [advancedClassName, character, mode])

  function addMulticlass(className: ClassName) {
    if (mode !== "creation") return
    if (classPlans.some((plan) => plan.className === className)) return
    const donor = classPlans.find((plan) => plan.level > 1)
    if (!donor) return

    const requirement = checkMulticlassRequirements(
      configuredCharacter,
      className,
    )
    if (!requirement.allowed) {
      setValidationMessage(
        requirement.failures
          .map(
            (failure) =>
              `${failure.classLabel}: exige ${failure.requirement}.`,
          )
          .join(" "),
      )
      return
    }

    setValidationMessage("")
    setClassPlans((current) => [
      ...current.map((plan) =>
        plan.className === donor.className
          ? { ...plan, level: plan.level - 1 }
          : plan,
      ),
      createPlan(className, 1, 0),
    ])
  }

  function removeMulticlass(className: ClassName) {
    if (mode !== "creation" || classPlans.length <= 1) return
    const removed = classPlans.find((plan) => plan.className === className)
    const receiver = classPlans.find((plan) => plan.className !== className)
    if (!removed || !receiver) return

    setClassPlans((current) =>
      current
        .filter((plan) => plan.className !== className)
        .map((plan) =>
          plan.className === receiver.className
            ? { ...plan, level: plan.level + removed.level }
            : plan,
        ),
    )
  }

  function shiftClassLevel(className: ClassName, delta: -1 | 1) {
    if (mode !== "creation") return
    const target = classPlans.find((plan) => plan.className === className)
    if (!target || (delta === -1 && target.level <= 1)) return

    const counterpart =
      delta === 1
        ? classPlans.find(
            (plan) => plan.className !== className && plan.level > 1,
          )
        : classPlans.find((plan) => plan.className !== className)
    if (!counterpart) return

    setClassPlans((current) =>
      current.map((plan) => {
        if (plan.className === className) {
          return { ...plan, level: plan.level + delta }
        }
        if (plan.className === counterpart.className) {
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
    feature: LevelFeatureDefinition,
    value: string,
  ) {
    const choice = feature.choice
    if (!choice) return

    updatePlan(className, (plan) => {
      const current = plan.levelChoices[choice.id] ?? []
      const selected = current.includes(value)
      const next = selected
        ? current.filter((entry) => entry !== value)
        : current.length < choice.count
          ? [...current, value]
          : choice.count === 1
            ? [value]
            : current

      return {
        ...plan,
        levelChoices: {
          ...plan.levelChoices,
          [choice.id]: next,
        },
      }
    })
  }

  function setCustomFeatureChoice(
    className: ClassName,
    feature: LevelFeatureDefinition,
    value: string,
  ) {
    if (!feature.choice) return
    updatePlan(className, (plan) => ({
      ...plan,
      levelChoices: {
        ...plan.levelChoices,
        [feature.choice!.id]: value.trim() ? [value.trim()] : [],
      },
    }))
  }

  function toggleSpell(plan: ProgressionClassPlan, spell: Spell) {
    const key = plan.className
    const state = spellSelections[key] ?? {
      selected: [],
      prepared: [],
      initial: [],
    }
    const rule = getClassSpellSelectionRule(
      configuredCharacter,
      plan.className,
      plan.level,
      plan.subclassId,
    )
    const selected = state.selected.includes(spell.index)

    if (selected) {
      if (isMandatorySpell(plan, spell)) return
      if (
        mode === "level-up" &&
        state.initial.includes(spell.index) &&
        !canRemoveExistingSpell(plan, spell, state, rule, spells)
      ) {
        return
      }

      setSpellSelections((current) => ({
        ...current,
        [key]: {
          ...state,
          selected: state.selected.filter((entry) => entry !== spell.index),
          prepared: state.prepared.filter((entry) => entry !== spell.index),
        },
      }))
      return
    }

    const isCantrip = spell.slotLevel === 0
    const selectedSpells = resolveSpells(state.selected, spells)
    const currentCount = selectedSpells.filter(
      (entry) => (entry.slotLevel === 0) === isCantrip,
    ).length
    const limit = isCantrip ? rule.maxCantrips : rule.maxLeveledSpells
    if (currentCount >= limit) return

    if (
      !isCantrip &&
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

    setSpellSelections((current) => ({
      ...current,
      [key]: {
        ...state,
        selected: [...state.selected, spell.index],
        prepared:
          rule.mode === "prepared"
            ? [...state.prepared, spell.index]
            : state.prepared,
      },
    }))
  }

  function togglePrepared(plan: ProgressionClassPlan, spellIndex: string) {
    const state = spellSelections[plan.className]
    if (!state?.selected.includes(spellIndex)) return
    const rule = getClassSpellSelectionRule(
      configuredCharacter,
      plan.className,
      plan.level,
      plan.subclassId,
    )
    if (rule.mode !== "spellbook") return
    const preparedLimit = getPreparedLimit(
      configuredCharacter,
      plan.className,
      plan.level,
    )
    const prepared = state.prepared.includes(spellIndex)
    if (!prepared && state.prepared.length >= preparedLimit) return

    setSpellSelections((current) => ({
      ...current,
      [plan.className]: {
        ...state,
        prepared: prepared
          ? state.prepared.filter((entry) => entry !== spellIndex)
          : [...state.prepared, spellIndex],
      },
    }))
  }

  function toggleMetamagic(id: MetamagicId) {
    const selected = selectedMetamagics.includes(id)

    if (selected) {
      if (
        mode === "level-up" &&
        initialMetamagics.includes(id) &&
        !metamagicReplacementAllowed
      ) {
        return
      }
      if (
        mode === "level-up" &&
        initialMetamagics.includes(id) &&
        metamagicReplacementAllowed &&
        initialMetamagics.filter(
          (entry) => !selectedMetamagics.includes(entry),
        ).length >= 1
      ) {
        return
      }
      setSelectedMetamagics((current) =>
        current.filter((entry) => entry !== id),
      )
      return
    }

    if (selectedMetamagics.length >= metamagicLimit) return
    setSelectedMetamagics((current) => [...current, id])
  }

  function saveCustomAbility(ability: Ability) {
    if (!abilitySource) return
    const entry: ProgressionCustomAbility = {
      ability,
      source: abilitySource,
      className:
        abilitySource === "class" ? customAbilityClass : undefined,
      classLevel:
        abilitySource === "class" ? customAbilityLevel : undefined,
    }
    setCustomAbilities((current) => {
      const exists = current.some(
        (currentEntry) => currentEntry.ability.id === ability.id,
      )
      return exists
        ? current.map((currentEntry) =>
            currentEntry.ability.id === ability.id ? entry : currentEntry,
          )
        : [...current, entry]
    })
    setAbilitySource(null)
    setEditingAbility(null)
  }

  function confirm() {
    const error = validateProgression({
      mode,
      character: configuredCharacter,
      plans: classPlans,
      creationTotal,
      spellSelections,
      spells,
      selectedMetamagics,
      metamagicLimit,
    })
    if (error) {
      setValidationMessage(error)
      setStep("review")
      return
    }

    const selections: ProgressionSpellSelection[] = classPlans
      .filter((plan) =>
        getClassSpellSelectionRule(
          configuredCharacter,
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

    onComplete(
      applyCharacterProgression(character, {
        mode,
        classPlans,
        spellSelections: selections,
        metamagics: selectedMetamagics,
        customAbilities,
        spells,
        advancedClassName:
          mode === "level-up" ? advancedClassName : undefined,
        hpGain: mode === "level-up" ? hpGain : undefined,
      }),
    )
  }

  const steps: Array<{ id: Step; label: string }> = [
    { id: "classes", label: "Classes" },
    { id: "features", label: "Características" },
    { id: "spells", label: "Magias" },
    { id: "metamagic", label: "Metamagia" },
    { id: "review", label: "Revisão" },
  ]

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-textH">
              {mode === "creation"
                ? "Progressão inicial do personagem"
                : "Subir de nível"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-textMuted">
              Configure classes, subclasses, características, magias e metamagia antes de confirmar.
            </p>
          </div>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {steps.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setStep(entry.id)}
              className={
                step === entry.id
                  ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-textH"
                  : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-textMuted"
              }
            >
              {index + 1}. {entry.label}
            </button>
          ))}
        </div>
      </header>

      {step === "classes" ? (
        <ClassesStep
          mode={mode}
          character={configuredCharacter}
          classPlans={classPlans}
          advancedClassName={advancedClassName}
          finalTotal={finalTotal}
          creationTotal={creationTotal}
          hpMode={hpMode}
          manualHp={manualHp}
          rolledDie={rolledDie}
          hpGain={hpGain}
          onAdvancedClassChange={setAdvancedClassName}
          onAddClass={addMulticlass}
          onRemoveClass={removeMulticlass}
          onShiftLevel={shiftClassLevel}
          onSubclassChange={(className, subclassId) =>
            updatePlan(className, (plan) => ({
              ...plan,
              subclassId: subclassId || undefined,
              levelChoices: {},
              enabledOptionalFeatureIds: [],
            }))
          }
          onHpModeChange={setHpMode}
          onManualHpChange={setManualHp}
          onRoll={() => {
            const sides = Number(advancedProgression.hitDie.slice(1)) || 6
            setRolledDie(Math.floor(Math.random() * sides) + 1)
            setHpMode("rolled")
          }}
        />
      ) : null}

      {step === "features" ? (
        <FeaturesStep
          mode={mode}
          classPlans={classPlans}
          customAbilities={customAbilities}
          onToggleOptional={(className, featureId) =>
            updatePlan(className, (plan) => ({
              ...plan,
              enabledOptionalFeatureIds:
                plan.enabledOptionalFeatureIds.includes(featureId)
                  ? plan.enabledOptionalFeatureIds.filter(
                      (id) => id !== featureId,
                    )
                  : [...plan.enabledOptionalFeatureIds, featureId],
            }))
          }
          onToggleChoice={toggleFeatureChoice}
          onSetCustomChoice={setCustomFeatureChoice}
          onAddAbility={(source, className, level) => {
            setAbilitySource(source)
            setEditingAbility(null)
            setCustomAbilityClass(className ?? classPlans[0].className)
            setCustomAbilityLevel(level ?? classPlans[0].level)
          }}
          onEditAbility={(entry) => {
            setAbilitySource(entry.source)
            setEditingAbility(entry.ability)
            setCustomAbilityClass(
              entry.className ?? classPlans[0].className,
            )
            setCustomAbilityLevel(
              entry.classLevel ?? classPlans[0].level,
            )
          }}
          onRemoveAbility={(abilityId) =>
            setCustomAbilities((current) =>
              current.filter((entry) => entry.ability.id !== abilityId),
            )
          }
        />
      ) : null}

      {step === "spells" ? (
        <SpellsStep
          mode={mode}
          character={configuredCharacter}
          classPlans={classPlans}
          spells={spells}
          selections={spellSelections}
          queries={spellQueries}
          onQueryChange={(className, query) =>
            setSpellQueries((current) => ({
              ...current,
              [className]: query,
            }))
          }
          onToggleSpell={toggleSpell}
          onTogglePrepared={togglePrepared}
        />
      ) : null}

      {step === "metamagic" ? (
        <MetamagicStep
          sorcererLevel={sorcererLevel}
          limit={metamagicLimit}
          metamagics={metamagics}
          selected={selectedMetamagics}
          initial={initialMetamagics}
          replacementAllowed={metamagicReplacementAllowed}
          onToggle={toggleMetamagic}
        />
      ) : null}

      {step === "review" ? (
        <ReviewStep
          mode={mode}
          classPlans={classPlans}
          spellSelections={spellSelections}
          selectedMetamagics={selectedMetamagics}
          customAbilities={customAbilities}
          hpGain={mode === "level-up" ? hpGain : undefined}
          validationMessage={validationMessage}
        />
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {step !== "review" ? (
            <Button onClick={() => setStep(nextStep(step))}>
              Continuar
            </Button>
          ) : (
            <Button onClick={confirm}>
              {mode === "creation"
                ? "Confirmar progressão inicial"
                : "Confirmar subida de nível"}
            </Button>
          )}
        </div>
      </footer>

      <AbilityDialog
        open={abilitySource !== null}
        ability={editingAbility}
        onClose={() => {
          setAbilitySource(null)
          setEditingAbility(null)
        }}
        onSave={saveCustomAbility}
      />
    </section>
  )
}

function ClassesStep({
  mode,
  character,
  classPlans,
  advancedClassName,
  finalTotal,
  creationTotal,
  hpMode,
  manualHp,
  rolledDie,
  hpGain,
  onAdvancedClassChange,
  onAddClass,
  onRemoveClass,
  onShiftLevel,
  onSubclassChange,
  onHpModeChange,
  onManualHpChange,
  onRoll,
}: {
  mode: "creation" | "level-up"
  character: CharacterTemplate
  classPlans: ProgressionClassPlan[]
  advancedClassName: ClassName
  finalTotal: number
  creationTotal: number
  hpMode: HpMode
  manualHp: string
  rolledDie: number | null
  hpGain: number
  onAdvancedClassChange: (value: ClassName) => void
  onAddClass: (value: ClassName) => void
  onRemoveClass: (value: ClassName) => void
  onShiftLevel: (value: ClassName, delta: -1 | 1) => void
  onSubclassChange: (className: ClassName, subclassId: string) => void
  onHpModeChange: (value: HpMode) => void
  onManualHpChange: (value: string) => void
  onRoll: () => void
}) {
  const availableClass =
    ALL_CLASS_NAMES.find(
      (className) =>
        !classPlans.some((plan) => plan.className === className),
    ) ?? "artificer"
  const [newClassName, setNewClassName] =
    useState<ClassName>(availableClass)
  const existing = character.get("sheet").classes ?? []

  useEffect(() => {
    if (classPlans.some((plan) => plan.className === newClassName)) {
      setNewClassName(availableClass)
    }
  }, [availableClass, classPlans, newClassName])

  return (
    <div className="grid gap-5">
      {mode === "level-up" ? (
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <label className="grid gap-1.5 text-xs text-text">
            Classe que recebe o nível
            <Select
              value={advancedClassName}
              onChange={(event) =>
                onAdvancedClassChange(event.target.value as ClassName)
              }
            >
              {ALL_CLASS_NAMES.map((className) => {
                const current = existing.find(
                  (entry) => entry.className === className,
                )?.level
                const requirement = checkMulticlassRequirements(
                  character,
                  className,
                )
                return (
                  <option
                    key={className}
                    value={className}
                    disabled={!requirement.allowed}
                  >
                    {getClassProgression(className).label}
                    {current
                      ? ` ${current} → ${current + 1}`
                      : ` 1 (multiclasse; ${formatClassMulticlassRequirement(className)})`}
                  </option>
                )
              })}
            </Select>
          </label>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5 text-xs text-text">
              Adicionar multiclasse
              <Select
                value={newClassName}
                onChange={(event) =>
                  setNewClassName(event.target.value as ClassName)
                }
              >
                {ALL_CLASS_NAMES.filter(
                  (className) =>
                    !classPlans.some((plan) => plan.className === className),
                ).map((className) => (
                  <option key={className} value={className}>
                    {getClassProgression(className).label} · exige {formatClassMulticlassRequirement(className)}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              variant="secondary"
              disabled={
                classPlans.length >= creationTotal ||
                !classPlans.some((plan) => plan.level > 1)
              }
              onClick={() => onAddClass(newClassName)}
            >
              Adicionar classe
            </Button>
          </div>
          <div className="mt-3 text-xs text-textMuted">
            Níveis distribuídos: {finalTotal}/{creationTotal}. A primeira classe mantém salvaguardas, perícias e equipamento inicial.
          </div>
        </section>
      )}

      <div className="grid gap-3">
        {classPlans.map((plan, index) => {
          const progression = getClassProgression(plan.className)
          const subclassRequired = plan.level >= progression.subclassLevel
          const subclassOptions = getSubclassOptions(plan.className)

          return (
            <article
              key={plan.className}
              className="grid gap-4 rounded-xl border border-border bg-bg p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-textH">
                    {progression.label} {plan.level}
                  </h2>
                  <p className="mt-1 text-xs text-textMuted">
                    {progression.hitDie} · {index === 0 ? "classe inicial" : "multiclasse"}
                  </p>
                </div>
                {mode === "creation" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={plan.level <= 1}
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
                            entry.className !== plan.className &&
                            entry.level > 1,
                        )
                      }
                      onClick={() => onShiftLevel(plan.className, 1)}
                    >
                      + nível
                    </Button>
                    {classPlans.length > 1 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveClass(plan.className)}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {subclassRequired && subclassOptions.length ? (
                <label className="grid gap-1.5 text-xs text-text">
                  Subclasse obrigatória a partir do nível {progression.subclassLevel}
                  <Select
                    value={plan.subclassId ?? ""}
                    onChange={(event) =>
                      onSubclassChange(plan.className, event.target.value)
                    }
                  >
                    <option value="">Selecione a subclasse</option>
                    {subclassOptions.map((subclass) => (
                      <option key={subclass.id} value={subclass.id}>
                        {subclass.name} · {subclass.source}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
            </article>
          )
        })}
      </div>

      {mode === "level-up" ? (
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <h2 className="font-semibold text-textH">Pontos de vida</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <ChoiceButton
              active={hpMode === "average"}
              label="Média fixa"
              detail={`Ganho final: ${hpGain} PV`}
              onClick={() => onHpModeChange("average")}
            />
            <ChoiceButton
              active={hpMode === "manual"}
              label="Manual"
              detail="Informe o ganho final."
              onClick={() => onHpModeChange("manual")}
            />
            <ChoiceButton
              active={hpMode === "rolled"}
              label="Rolar dado"
              detail={
                rolledDie
                  ? `Resultado do dado: ${rolledDie}`
                  : "Ainda não rolado."
              }
              onClick={onRoll}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {hpMode === "manual" ? (
              <label className="grid gap-1.5 text-xs text-text">
                PV ganhos
                <Input
                  type="number"
                  min={1}
                  value={manualHp}
                  onChange={(event) => onManualHpChange(event.target.value)}
                />
              </label>
            ) : null}
            <Button variant="secondary" onClick={onRoll}>
              Rolar {getClassProgression(advancedClassName).hitDie}
            </Button>
            <Badge label={`Aplicar +${hpGain} PV`} />
          </div>
        </section>
      ) : null}
    </div>
  )
}

function FeaturesStep({
  mode,
  classPlans,
  customAbilities,
  onToggleOptional,
  onToggleChoice,
  onSetCustomChoice,
  onAddAbility,
  onEditAbility,
  onRemoveAbility,
}: {
  mode: "creation" | "level-up"
  classPlans: ProgressionClassPlan[]
  customAbilities: ProgressionCustomAbility[]
  onToggleOptional: (className: ClassName, featureId: string) => void
  onToggleChoice: (
    className: ClassName,
    feature: LevelFeatureDefinition,
    value: string,
  ) => void
  onSetCustomChoice: (
    className: ClassName,
    feature: LevelFeatureDefinition,
    value: string,
  ) => void
  onAddAbility: (
    source: AbilitySource,
    className?: ClassName,
    level?: number,
  ) => void
  onEditAbility: (entry: ProgressionCustomAbility) => void
  onRemoveAbility: (abilityId: string) => void
}) {
  return (
    <div className="grid gap-5">
      {classPlans.map((plan) => {
        const progression = getClassProgression(plan.className)
        const fromLevel = mode === "creation" ? 1 : plan.previousLevel + 1
        const features = Array.from(
          { length: Math.max(0, plan.level - fromLevel + 1) },
          (_, index) => fromLevel + index,
        ).flatMap((level) =>
          getFeaturesAtLevel(plan.className, level, plan.subclassId),
        )

        return (
          <section
            key={plan.className}
            className="rounded-xl border border-border bg-bg-subtle p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-textH">
                  {progression.label}: níveis {fromLevel}–{plan.level}
                </h2>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  Características obrigatórias entram automaticamente. Características opcionais e escolhas permanecem explícitas.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  onAddAbility("class", plan.className, plan.level)
                }
              >
                Habilidade personalizada
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              {features.map((feature) => {
                const enabled =
                  !feature.optional ||
                  plan.enabledOptionalFeatureIds.includes(feature.id)
                const selectedChoices = feature.choice
                  ? plan.levelChoices[feature.choice.id] ?? []
                  : []
                const handledElsewhere =
                  feature.choice?.kind === "metamagic"

                return (
                  <article
                    key={`${plan.className}:${feature.id}`}
                    className="rounded-lg border border-border bg-bg p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-textH">
                            {feature.name}
                          </h3>
                          <Badge label={`Nível ${feature.level}`} />
                          <Badge label={feature.source} />
                          {feature.optional ? <Badge label="Opcional" /> : null}
                        </div>
                        {feature.description ? (
                          <p className="mt-1 text-xs leading-5 text-textMuted">
                            {feature.description}
                          </p>
                        ) : null}
                        {handledElsewhere ? (
                          <p className="mt-2 text-xs text-textMuted">
                            As opções desta característica são selecionadas na etapa Metamagia.
                          </p>
                        ) : null}
                      </div>
                      {feature.optional ? (
                        <Button
                          size="sm"
                          variant={enabled ? "secondary" : "ghost"}
                          onClick={() =>
                            onToggleOptional(plan.className, feature.id)
                          }
                        >
                          {enabled ? "Incluída" : "Incluir"}
                        </Button>
                      ) : null}
                    </div>

                    {enabled && feature.choice && !handledElsewhere ? (
                      <div className="mt-3 grid gap-2">
                        <div className="text-xs font-medium text-textH">
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
                                    feature,
                                    option,
                                  )
                                }
                                className={
                                  selectedChoices.includes(option)
                                    ? "rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-medium text-textH"
                                    : "rounded-full border border-border px-3 py-1.5 text-xs text-textMuted"
                                }
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {feature.choice.allowCustom ? (
                          <Input
                            value={selectedChoices[0] ?? ""}
                            placeholder="Digite a escolha"
                            onChange={(event) =>
                              onSetCustomChoice(
                                plan.className,
                                feature,
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
              {!features.length ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-textMuted">
                  Nenhuma característica nova neste intervalo.
                </div>
              ) : null}
            </div>
          </section>
        )
      })}

      <section className="rounded-xl border border-border bg-bg-subtle p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-textH">
              Características raciais por nível
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Adicione magia racial escalonada ou outra característica liberada no nível final.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAddAbility("race")}
          >
            Adicionar racial
          </Button>
        </div>
      </section>

      {customAbilities.length ? (
        <section className="grid gap-2 rounded-xl border border-border bg-bg p-4">
          {customAbilities.map((entry) => (
            <article
              key={entry.ability.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3"
            >
              <div>
                <div className="font-medium text-textH">
                  {entry.ability.name}
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {entry.source === "race"
                    ? "Raça"
                    : `${getClassProgression(entry.className!).label} ${entry.classLevel}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditAbility(entry)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveAbility(entry.ability.id)}
                >
                  Remover
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}

function SpellsStep({
  mode,
  character,
  classPlans,
  spells,
  selections,
  queries,
  onQueryChange,
  onToggleSpell,
  onTogglePrepared,
}: {
  mode: "creation" | "level-up"
  character: CharacterTemplate
  classPlans: ProgressionClassPlan[]
  spells: Spell[]
  selections: SpellSelectionState
  queries: Record<string, string>
  onQueryChange: (className: ClassName, query: string) => void
  onToggleSpell: (plan: ProgressionClassPlan, spell: Spell) => void
  onTogglePrepared: (plan: ProgressionClassPlan, spellIndex: string) => void
}) {
  const castingPlans = classPlans.filter(
    (plan) =>
      getClassSpellSelectionRule(
        character,
        plan.className,
        plan.level,
        plan.subclassId,
      ).mode !== "none",
  )

  if (!castingPlans.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-textMuted">
        Nenhuma das classes configuradas possui conjuração neste nível.
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {castingPlans.map((plan) => {
        const rule = getClassSpellSelectionRule(
          character,
          plan.className,
          plan.level,
          plan.subclassId,
        )
        const state = selections[plan.className] ?? {
          selected: [],
          prepared: [],
          initial: [],
        }
        const subclassGrants = getSubclassSpellGrants(
          plan.className,
          plan.subclassId,
          plan.level,
        )
        const subclassNames = subclassGrants.flatMap(
          (grant) => grant.spellNames,
        )
        const query = normalizeSpellName(queries[plan.className] ?? "")
        const visible = spells
          .filter((spell) =>
            isAvailableClassSpell(spell, plan, rule, subclassNames),
          )
          .filter(
            (spell) =>
              !query ||
              normalizeSpellName(
                `${spell.displayName ?? ""} ${spell.name} ${spell.school}`,
              ).includes(query),
          )
          .toSorted(
            (left, right) =>
              left.slotLevel - right.slotLevel ||
              spellName(left).localeCompare(spellName(right), "pt-BR"),
          )
        const selectedSpells = resolveSpells(state.selected, spells)
        const cantripCount = selectedSpells.filter(
          (spell) => spell.slotLevel === 0,
        ).length
        const leveledCount = selectedSpells.filter(
          (spell) => spell.slotLevel > 0,
        ).length
        const preparedLimit =
          rule.mode === "spellbook"
            ? getPreparedLimit(character, plan.className, plan.level)
            : rule.mode === "prepared"
              ? rule.maxLeveledSpells
              : 0
        const autoGrants = resolveAutomaticSubclassSpells(
          spells,
          subclassGrants,
        )

        return (
          <section
            key={plan.className}
            className="rounded-xl border border-border bg-bg-subtle p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-textH">
                  {getClassProgression(plan.className).label} {plan.level}
                </h2>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  Nível máximo de magia: {rule.maxSpellLevel || "—"}. Modo: {spellModeLabel(rule.mode)}.
                  {mode === "level-up" && rule.swap.leveledKnown
                    ? ` Pode substituir ${rule.swap.leveledKnown} magia conhecida nesta subida.`
                    : ""}
                  {mode === "level-up" && rule.swap.cantrips
                    ? ` Pode substituir ${rule.swap.cantrips} truque nesta subida.`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge label={`Truques ${cantripCount}/${rule.maxCantrips}`} />
                  <Badge label={`Magias ${leveledCount}/${rule.maxLeveledSpells}`} />
                  {preparedLimit ? (
                    <Badge
                      label={`Preparadas ${state.prepared.length}/${preparedLimit}`}
                    />
                  ) : null}
                </div>
              </div>
              <Input
                value={queries[plan.className] ?? ""}
                placeholder="Buscar magia"
                onChange={(event) =>
                  onQueryChange(plan.className, event.target.value)
                }
              />
            </div>

            {autoGrants.length ? (
              <div className="mt-4 rounded-lg border border-accentBorder bg-accentBg p-3">
                <div className="text-xs font-semibold text-textH">
                  Magias concedidas pela subclasse — não contam no limite
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {autoGrants.map(({ spell, mode: grantMode }) => (
                    <Badge
                      key={spell.index}
                      label={`${spellName(spell)} · ${grantMode === "always-prepared" ? "sempre preparada" : "conhecida adicional"}`}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid max-h-[42rem] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {visible.map((spell) => {
                const selected = state.selected.includes(spell.index)
                const prepared = state.prepared.includes(spell.index)
                const mandatory = isMandatorySpell(plan, spell)
                const expanded =
                  !spell.classes.includes(plan.className) &&
                  subclassNames.some(
                    (name) =>
                      normalizeSpellName(name) ===
                        normalizeSpellName(spell.name) ||
                      normalizeSpellName(name) ===
                        normalizeSpellName(spell.displayName ?? ""),
                  )

                return (
                  <article
                    key={spell.index}
                    className={
                      selected
                        ? "rounded-xl border border-accentBorder bg-accentBg p-3"
                        : "rounded-xl border border-border bg-bg p-3"
                    }
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onToggleSpell(plan, spell)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-textH">
                          {spellName(spell)}
                        </span>
                        <Badge
                          label={
                            spell.slotLevel === 0
                              ? "Truque"
                              : `Nível ${spell.slotLevel}`
                          }
                        />
                        {expanded ? <Badge label="Lista expandida" /> : null}
                        {mandatory ? <Badge label="Obrigatória" /> : null}
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-textMuted">
                        {spell.description || "Sem descrição."}
                      </p>
                    </button>
                    {selected &&
                    rule.mode === "spellbook" &&
                    spell.slotLevel > 0 ? (
                      <label className="mt-3 flex items-center gap-2 text-xs text-text">
                        <input
                          type="checkbox"
                          checked={prepared}
                          onChange={() =>
                            onTogglePrepared(plan, spell.index)
                          }
                        />
                        Preparar esta magia
                      </label>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function MetamagicStep({
  sorcererLevel,
  limit,
  metamagics,
  selected,
  initial,
  replacementAllowed,
  onToggle,
}: {
  sorcererLevel: number
  limit: number
  metamagics: Array<{
    id: MetamagicId
    name: string
    desc: string[]
  }>
  selected: MetamagicId[]
  initial: MetamagicId[]
  replacementAllowed: boolean
  onToggle: (id: MetamagicId) => void
}) {
  if (sorcererLevel < 3) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-textMuted">
        Metamagia é liberada no nível 3 de Feiticeiro.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border bg-bg-subtle p-4 text-sm text-text">
        Feiticeiro {sorcererLevel}: {selected.length}/{limit} opções.
        {initial.length && !replacementAllowed
          ? " Opções já conhecidas não podem ser trocadas neste nível."
          : initial.length
            ? " Este nível permite trocar no máximo uma opção já conhecida."
            : ""}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {metamagics.map((metamagic) => {
          const active = selected.includes(metamagic.id)
          return (
            <button
              key={metamagic.id}
              type="button"
              onClick={() => onToggle(metamagic.id)}
              className={
                active
                  ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                  : "rounded-xl border border-border bg-bg-subtle p-4 text-left"
              }
            >
              <div className="font-semibold text-textH">
                {metamagic.name}
              </div>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-textMuted">
                {metamagic.desc.join(" ")}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReviewStep({
  mode,
  classPlans,
  spellSelections,
  selectedMetamagics,
  customAbilities,
  hpGain,
  validationMessage,
}: {
  mode: "creation" | "level-up"
  classPlans: ProgressionClassPlan[]
  spellSelections: SpellSelectionState
  selectedMetamagics: MetamagicId[]
  customAbilities: ProgressionCustomAbility[]
  hpGain?: number
  validationMessage: string
}) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-4">
        <Summary
          label="Classes"
          value={classPlans
            .map(
              (plan) =>
                `${getClassProgression(plan.className).label} ${plan.level}${plan.subclassId ? ` — ${getSubclassOptions(plan.className).find((entry) => entry.id === plan.subclassId)?.name ?? plan.subclassId}` : ""}`,
            )
            .join(" / ")}
        />
        <Summary
          label="Magias selecionadas"
          value={String(
            Object.values(spellSelections).reduce(
              (sum, entry) => sum + entry.selected.length,
              0,
            ),
          )}
        />
        <Summary
          label="Metamagias"
          value={String(selectedMetamagics.length)}
        />
        <Summary
          label="Habilidades personalizadas"
          value={String(customAbilities.length)}
        />
        {mode === "level-up" && hpGain ? (
          <Summary label="PV ganhos" value={`+${hpGain}`} />
        ) : null}
      </section>
      <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
        Características, magias, características raciais e metamagia serão gravadas com o evento, data, nível total, classe, nível da classe, subclasse e origem correspondentes.
      </div>
      {validationMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
          {validationMessage}
        </div>
      ) : null}
    </div>
  )
}

function createInitialPlans(
  mode: "creation" | "level-up",
  character: CharacterTemplate,
  creationTotal: number,
  primaryClassName: ClassName,
): ProgressionClassPlan[] {
  if (mode === "level-up") {
    return createLevelUpPlans(character, primaryClassName)
  }

  const existing = character
    .get("sheet")
    .classes?.find((entry) => entry.className === primaryClassName)
  return [
    createPlan(
      primaryClassName,
      creationTotal,
      0,
      existing?.subclass?.id,
      existing?.levelChoices,
    ),
  ]
}

function createLevelUpPlans(
  character: CharacterTemplate,
  advancedClassName: ClassName,
): ProgressionClassPlan[] {
  const existing = character.get("sheet").classes ?? []
  const plans = existing.map((entry) =>
    createPlan(
      entry.className,
      entry.level + (entry.className === advancedClassName ? 1 : 0),
      entry.level,
      entry.subclass?.id,
      entry.levelChoices,
    ),
  )

  if (!existing.some((entry) => entry.className === advancedClassName)) {
    plans.push(createPlan(advancedClassName, 1, 0))
  }

  return plans
}

function createPlan(
  className: ClassName,
  level: number,
  previousLevel: number,
  subclassId?: string,
  levelChoices: Record<string, string[]> = {},
): ProgressionClassPlan {
  return {
    className,
    level: Math.max(1, Math.min(20, Math.trunc(level))),
    previousLevel: Math.max(0, Math.min(20, Math.trunc(previousLevel))),
    subclassId,
    levelChoices: { ...levelChoices },
    enabledOptionalFeatureIds: [],
  }
}

function createInitialSpellSelections(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): SpellSelectionState {
  const result: SpellSelectionState = {}
  const known = character.get("magic")?.spells.knownSpells ?? []

  for (const plan of plans) {
    const entries = known.filter(
      (entry) =>
        entry.source.type === "class" &&
        sourceMatchesClass(
          entry.source.sourceId,
          entry.source.name,
          plan.className,
        ),
    )
    const indexes = entries.map((entry) => entry.spells.id)
    result[plan.className] = {
      selected: indexes,
      prepared: entries
        .filter((entry) => entry.spells.prepared)
        .map((entry) => entry.spells.id),
      initial: indexes,
    }
  }

  return result
}

function synchronizeSpellSelections(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
  current: SpellSelectionState,
  spells: Spell[],
): SpellSelectionState {
  const initial = createInitialSpellSelections(character, plans)
  const next: SpellSelectionState = {}

  for (const plan of plans) {
    const existing = current[plan.className] ?? initial[plan.className]
    const rule = getClassSpellSelectionRule(
      character,
      plan.className,
      plan.level,
      plan.subclassId,
    )
    const subclassNames = getSubclassSpellGrants(
      plan.className,
      plan.subclassId,
      plan.level,
    ).flatMap((grant) => grant.spellNames)
    const allowed = unique(existing.selected)
      .map((index) => spells.find((spell) => spell.index === index))
      .filter((spell): spell is Spell => Boolean(spell))
      .filter((spell) =>
        isAvailableClassSpell(spell, plan, rule, subclassNames),
      )

    const mandatory =
      plan.className === "rogue" &&
      plan.subclassId === "arcane-trickster"
        ? spells.find(
            (spell) =>
              spell.slotLevel === 0 &&
              normalizeSpellName(spell.name) ===
                normalizeSpellName("Mage Hand"),
          )
        : undefined
    const withMandatory = mandatory
      ? uniqueSpells([mandatory, ...allowed])
      : allowed
    const cantrips = withMandatory
      .filter((spell) => spell.slotLevel === 0)
      .slice(0, rule.maxCantrips)
    const leveled = withMandatory
      .filter((spell) => spell.slotLevel > 0)
      .slice(0, rule.maxLeveledSpells)
    const selected = [...cantrips, ...leveled].map((spell) => spell.index)
    const preparedLimit =
      rule.mode === "spellbook"
        ? getPreparedLimit(character, plan.className, plan.level)
        : rule.mode === "prepared"
          ? rule.maxLeveledSpells
          : 0
    const prepared =
      rule.mode === "prepared"
        ? leveled.map((spell) => spell.index)
        : existing.prepared
            .filter((index) => selected.includes(index))
            .slice(0, preparedLimit)

    next[plan.className] = {
      selected,
      prepared,
      initial: initial[plan.className]?.initial ?? [],
    }
  }

  return next
}

function canRemoveExistingSpell(
  plan: ProgressionClassPlan,
  spell: Spell,
  state: SpellSelectionState[string],
  rule: ReturnType<typeof getClassSpellSelectionRule>,
  spells: Spell[],
): boolean {
  if (rule.mode === "prepared") return true
  if (rule.mode === "spellbook") return false

  const isCantrip = spell.slotLevel === 0
  const allowed = isCantrip ? rule.swap.cantrips : rule.swap.leveledKnown
  if (allowed <= 0) return false
  const removed = state.initial
    .map((index) => spells.find((entry) => entry.index === index))
    .filter((entry): entry is Spell => Boolean(entry))
    .filter(
      (entry) =>
        (entry.slotLevel === 0) === isCantrip &&
        !state.selected.includes(entry.index),
    )
  return removed.length < allowed
}

function isAvailableClassSpell(
  spell: Spell,
  plan: ProgressionClassPlan,
  rule: ReturnType<typeof getClassSpellSelectionRule>,
  subclassNames: string[],
): boolean {
  if (spell.slotLevel > rule.maxSpellLevel) return false
  if (spell.slotLevel === 0 && rule.maxCantrips <= 0) return false
  const thirdCaster =
    (plan.className === "fighter" &&
      plan.subclassId === "eldritch-knight") ||
    (plan.className === "rogue" &&
      plan.subclassId === "arcane-trickster")
  return (
    isSpellAllowedForClassSelection(spell, rule, subclassNames) ||
    (thirdCaster && spell.classes.includes("wizard"))
  )
}

function resolveAutomaticSubclassSpells(
  spells: Spell[],
  grants: ReturnType<typeof getSubclassSpellGrants>,
) {
  return grants
    .filter((grant) => grant.mode !== "expanded-list")
    .flatMap((grant) =>
      grant.spellNames.map((name) => ({
        spell: spells.find(
          (spell) =>
            normalizeSpellName(spell.name) === normalizeSpellName(name) ||
            normalizeSpellName(spell.displayName ?? "") ===
              normalizeSpellName(name),
        ),
        mode: grant.mode,
      })),
    )
    .filter(
      (
        entry,
      ): entry is {
        spell: Spell
        mode: "always-prepared" | "bonus-known"
      } => Boolean(entry.spell),
    )
}

function isMandatorySpell(plan: ProgressionClassPlan, spell: Spell): boolean {
  return (
    plan.className === "rogue" &&
    plan.subclassId === "arcane-trickster" &&
    normalizeSpellName(spell.name) === normalizeSpellName("Mage Hand")
  )
}

function characterWithPlans(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  return character.withSheet(
    "classes",
    plans.map((plan) => {
      const existing = character
        .get("sheet")
        .classes?.find((entry) => entry.className === plan.className)
      const subclass = plan.subclassId
        ? getSubclassOptions(plan.className).find(
            (entry) => entry.id === plan.subclassId,
          )
        : undefined

      return {
        ...createClassEntry(plan.className, plan.level),
        ...existing,
        level: plan.level as never,
        subclass: subclass
          ? {
              id: subclass.id,
              name: subclass.name,
              source: subclass.source,
            }
          : undefined,
        levelChoices: plan.levelChoices,
      }
    }),
  )
}

function getPreparedLimit(
  character: CharacterTemplate,
  className: ClassName,
  level: number,
): number {
  switch (className) {
    case "wizard":
      return Math.max(
        1,
        level + character.getAttributeModifier("int"),
      )
    case "cleric":
    case "druid":
      return Math.max(
        1,
        level + character.getAttributeModifier("wis"),
      )
    case "paladin":
      return Math.max(
        1,
        Math.floor(level / 2) + character.getAttributeModifier("cha"),
      )
    case "artificer":
      return Math.max(
        1,
        Math.floor(level / 2) + character.getAttributeModifier("int"),
      )
    default:
      return 0
  }
}

function validateProgression({
  mode,
  character,
  plans,
  creationTotal,
  spellSelections,
  spells,
  selectedMetamagics,
  metamagicLimit,
}: {
  mode: "creation" | "level-up"
  character: CharacterTemplate
  plans: ProgressionClassPlan[]
  creationTotal: number
  spellSelections: SpellSelectionState
  spells: Spell[]
  selectedMetamagics: MetamagicId[]
  metamagicLimit: number
}): string {
  const total = plans.reduce((sum, plan) => sum + plan.level, 0)
  if (total > 20) return "O nível total não pode ultrapassar 20."
  if (mode === "creation" && total !== creationTotal) {
    return `Distribua exatamente ${creationTotal} níveis entre as classes.`
  }

  for (const plan of plans) {
    const progression = getClassProgression(plan.className)
    if (
      plan.level >= progression.subclassLevel &&
      progression.subclasses.length > 0 &&
      !plan.subclassId
    ) {
      return `Selecione a subclasse de ${progression.label}.`
    }

    const fromLevel = mode === "creation" ? 1 : plan.previousLevel + 1
    for (let level = fromLevel; level <= plan.level; level += 1) {
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
            return `Complete a escolha “${feature.choice.label}” de ${progression.label}.`
          }
        }
      }
    }

    const rule = getClassSpellSelectionRule(
      character,
      plan.className,
      plan.level,
      plan.subclassId,
    )
    const state = spellSelections[plan.className]
    if (!state || rule.mode === "none") continue
    const selected = resolveSpells(state.selected, spells)
    const cantrips = selected.filter((spell) => spell.slotLevel === 0)
    const leveled = selected.filter((spell) => spell.slotLevel > 0)
    if (cantrips.length > rule.maxCantrips) {
      return `${progression.label} excedeu o limite de ${rule.maxCantrips} truques.`
    }
    if (leveled.length > rule.maxLeveledSpells) {
      return `${progression.label} excedeu o limite de ${rule.maxLeveledSpells} magias.`
    }
    if (selected.some((spell) => spell.slotLevel > rule.maxSpellLevel)) {
      return `${progression.label} possui magia acima do nível permitido.`
    }
    if (
      plan.className === "rogue" &&
      plan.subclassId === "arcane-trickster" &&
      !selected.some(
        (spell) =>
          normalizeSpellName(spell.name) === normalizeSpellName("Mage Hand"),
      )
    ) {
      return "O Trapaceiro Arcano precisa conhecer Mãos Mágicas."
    }
  }

  if (selectedMetamagics.length > metamagicLimit) {
    return `O personagem excedeu o limite de ${metamagicLimit} opções de Metamagia.`
  }

  return ""
}

function sourceMatchesClass(
  sourceId: string,
  sourceName: string,
  className: ClassName,
): boolean {
  return sourceId.split(":")[0] === className || sourceName === className
}

function nextStep(step: Step): Step {
  if (step === "classes") return "features"
  if (step === "features") return "spells"
  if (step === "spells") return "metamagic"
  return "review"
}

function spellModeLabel(
  mode: ReturnType<typeof getClassSpellSelectionRule>["mode"],
): string {
  if (mode === "limited-known") return "magias conhecidas"
  if (mode === "spellbook") return "grimório"
  if (mode === "prepared") return "preparação diária"
  return "sem conjuração"
}

function resolveSpells(indexes: string[], spells: Spell[]): Spell[] {
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  return unique(indexes)
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
}

function uniqueSpells(spells: Spell[]): Spell[] {
  const seen = new Set<string>()
  return spells.filter((spell) => {
    if (seen.has(spell.index)) return false
    seen.add(spell.index)
    return true
  })
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function ChoiceButton({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
          : "rounded-xl border border-border bg-bg p-4 text-left"
      }
    >
      <span className="block font-semibold text-textH">{label}</span>
      <span className="mt-1 block text-xs text-textMuted">{detail}</span>
    </button>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-bg p-3 text-sm">
      <span className="text-textMuted">{label}</span>
      <span className="text-right font-medium text-textH">{value}</span>
    </div>
  )
}
