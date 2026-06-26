import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Dice6,
  GraduationCap,
  Search,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import type { Skill } from "../../../models/sheet/Skills"
import {
  CLASS_PROGRESSIONS,
  type LevelChoiceDefinition,
  type LevelFeatureDefinition,
} from "../../../models/leveling/ClassProgression"
import {
  applyLevelUp,
  getLevelUpPlan,
  levelUpRequirementSpellLabel,
  spellMatchesRequirement,
  validateLevelUpSelections,
  type AbilityScoreSelection,
  type LevelUpPlan,
  type LevelUpSelections,
  type LevelUpSpellRequirement,
} from "../../../models/leveling/LevelUpEngine"

const STEPS = ["Classe", "Características", "Magias", "Revisão"] as const

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

const SKILL_LABELS: Record<Skill, string> = {
  acrobatics: "Acrobacia",
  animalHandling: "Lidar com Animais",
  arcana: "Arcanismo",
  athletics: "Atletismo",
  deception: "Enganação",
  history: "História",
  insight: "Intuição",
  intimidation: "Intimidação",
  investigation: "Investigação",
  medicine: "Medicina",
  nature: "Natureza",
  perception: "Percepção",
  performance: "Atuação",
  persuasion: "Persuasão",
  religion: "Religião",
  sleightOfHand: "Prestidigitação",
  stealth: "Furtividade",
  survival: "Sobrevivência",
}

const ATTRIBUTES = Object.keys(ATTRIBUTE_LABELS) as Attribute[]

export function LevelUpWizard({
  open,
  character,
  updateCharacter,
  onClose,
}: {
  open: boolean
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  onClose: () => void
}) {
  const { spells, metamagics } = useMagicContext()
  const existingClasses = character.get("sheet").classes ?? []
  const defaultClass = existingClasses[0]?.className ?? "fighter"
  const [step, setStep] = useState(0)
  const [className, setClassName] = useState<ClassName>(defaultClass)
  const [subclassId, setSubclassId] = useState<string | undefined>(
    existingClasses.find((entry) => entry.className === defaultClass)?.subclass?.id,
  )
  const [optionalFeatureIds, setOptionalFeatureIds] = useState<string[]>([])
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [spellChoices, setSpellChoices] = useState<Record<string, string[]>>({})
  const [hpGain, setHpGain] = useState(1)
  const [abilityScore, setAbilityScore] = useState<AbilityScoreSelection | undefined>()
  const [errors, setErrors] = useState<string[]>([])

  const plan = useMemo(
    () => getLevelUpPlan(character, className, subclassId),
    [character, className, subclassId],
  )

  useEffect(() => {
    if (!open) return

    const nextDefaultClass = character.get("sheet").classes?.[0]?.className ?? "fighter"
    const classEntry = character
      .get("sheet")
      .classes?.find((entry) => entry.className === nextDefaultClass)
    const initialPlan = getLevelUpPlan(
      character,
      nextDefaultClass,
      classEntry?.subclass?.id,
    )

    setStep(0)
    setClassName(nextDefaultClass)
    setSubclassId(classEntry?.subclass?.id)
    setOptionalFeatureIds([])
    setChoices({})
    setSpellChoices({})
    setHpGain(initialPlan.averageHpGain)
    setAbilityScore(createDefaultAbilityScore(initialPlan))
    setErrors([])
  }, [character, open])

  if (!open) return null

  const selections: LevelUpSelections = {
    className,
    subclassId,
    optionalFeatureIds,
    choices,
    spellChoices,
    hpGain,
    abilityScore,
  }
  const finalErrors = validateLevelUpSelections(plan, selections)
  const canAdvance = getStepErrors(step, plan, selections).length === 0

  function selectClass(nextClassName: ClassName) {
    const existing = existingClasses.find(
      (entry) => entry.className === nextClassName,
    )
    const nextPlan = getLevelUpPlan(
      character,
      nextClassName,
      existing?.subclass?.id,
    )

    setClassName(nextClassName)
    setSubclassId(existing?.subclass?.id)
    setOptionalFeatureIds([])
    setChoices({})
    setSpellChoices({})
    setHpGain(nextPlan.averageHpGain)
    setAbilityScore(createDefaultAbilityScore(nextPlan))
    setErrors([])
  }

  function selectSubclass(nextSubclassId: string) {
    const nextPlan = getLevelUpPlan(character, className, nextSubclassId)
    setSubclassId(nextSubclassId)
    setChoices({})
    setSpellChoices({})
    setAbilityScore(createDefaultAbilityScore(nextPlan))
    setErrors([])
  }

  function toggleChoice(choiceId: string, value: string, limit: number) {
    setChoices((current) => {
      const existing = current[choiceId] ?? []
      if (existing.includes(value)) {
        return {
          ...current,
          [choiceId]: existing.filter((entry) => entry !== value),
        }
      }
      if (existing.length >= limit) return current
      return { ...current, [choiceId]: [...existing, value] }
    })
  }

  function confirmLevelUp() {
    const validation = validateLevelUpSelections(plan, selections)
    if (validation.length) {
      setErrors(validation)
      return
    }

    updateCharacter(character.get("id"), (current) => {
      const currentPlan = getLevelUpPlan(current, className, subclassId)
      return applyLevelUp(current, currentPlan, selections)
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[13000] flex items-center justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:p-4">
      <div className="grid h-[100dvh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg-elevated shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:rounded-xl sm:border sm:border-border">
        <header className="border-b border-border p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-textH">
                <GraduationCap className="h-5 w-5 text-accent" />
                Subir de nível
              </h2>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                {character.get("name")} passará do nível total {plan.currentTotalLevel} para {plan.nextTotalLevel}.
              </p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
              aria-label="Fechar"
              onClick={onClose}
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
                    : "shrink-0 rounded-full border border-border bg-bg px-3 py-1.5 text-[11px] text-textMuted"
                }
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </header>

        <main className="min-h-0 overflow-y-auto p-3 sm:p-5">
          {step === 0 ? (
            <ClassStep
              character={character}
              plan={plan}
              className={className}
              subclassId={subclassId}
              onClassChange={selectClass}
              onSubclassChange={selectSubclass}
            />
          ) : null}

          {step === 1 ? (
            <FeaturesStep
              character={character}
              plan={plan}
              optionalFeatureIds={optionalFeatureIds}
              choices={choices}
              abilityScore={abilityScore}
              metamagicOptions={metamagics.map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
              onToggleOptional={(featureId) =>
                setOptionalFeatureIds((current) =>
                  current.includes(featureId)
                    ? current.filter((entry) => entry !== featureId)
                    : [...current, featureId],
                )
              }
              onToggleChoice={toggleChoice}
              onAbilityScoreChange={setAbilityScore}
            />
          ) : null}

          {step === 2 ? (
            <SpellsStep
              character={character}
              plan={plan}
              spells={spells}
              spellChoices={spellChoices}
              onToggleSpell={(requirementId, spellIndex, limit) =>
                setSpellChoices((current) => {
                  const existing = current[requirementId] ?? []
                  if (existing.includes(spellIndex)) {
                    return {
                      ...current,
                      [requirementId]: existing.filter(
                        (entry) => entry !== spellIndex,
                      ),
                    }
                  }
                  if (existing.length >= limit) return current
                  return {
                    ...current,
                    [requirementId]: [...existing, spellIndex],
                  }
                })
              }
            />
          ) : null}

          {step === 3 ? (
            <ReviewStep
              character={character}
              plan={plan}
              selections={selections}
              hpGain={hpGain}
              onHpGainChange={setHpGain}
              spells={spells}
              errors={errors.length ? errors : finalErrors}
            />
          ) : null}
        </main>

        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
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
                disabled={!canAdvance}
                onClick={() => {
                  const stepErrors = getStepErrors(step, plan, selections)
                  setErrors(stepErrors)
                  if (!stepErrors.length) setStep((current) => current + 1)
                }}
              >
                Continuar
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={finalErrors.length > 0 || plan.nextTotalLevel > 20}
                onClick={confirmLevelUp}
              >
                <Check className="h-4 w-4" />
                Aplicar nível
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

function ClassStep({
  character,
  plan,
  className,
  subclassId,
  onClassChange,
  onSubclassChange,
}: {
  character: CharacterTemplate
  plan: LevelUpPlan
  className: ClassName
  subclassId?: string
  onClassChange: (className: ClassName) => void
  onSubclassChange: (subclassId: string) => void
}) {
  const classes = character.get("sheet").classes ?? []
  const existingClass = classes.find((entry) => entry.className === className)

  return (
    <div className="grid gap-4">
      <StepSection
        title="Escolha a classe"
        description="Você pode avançar uma classe existente ou iniciar uma nova classe. Magias conhecidas e preparadas continuam sendo calculadas separadamente para cada classe."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(CLASS_PROGRESSIONS).map((progression) => {
            const existing = classes.find(
              (entry) => entry.className === progression.className,
            )
            const selected = progression.className === className
            const disabled = existing?.level === 20

            return (
              <button
                key={progression.className}
                type="button"
                disabled={disabled}
                onClick={() => onClassChange(progression.className)}
                className={
                  selected
                    ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                    : "rounded-xl border border-border bg-bg-subtle p-3 text-left hover:bg-bg disabled:opacity-40"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-textH">
                    {progression.label}
                  </span>
                  <span className="text-[10px] text-textMuted">
                    {progression.source}
                  </span>
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {existing
                    ? `Nível ${existing.level} → ${Math.min(20, existing.level + 1)}`
                    : "Nova classe — nível 1"}
                </div>
              </button>
            )
          })}
        </div>
      </StepSection>

      {plan.nextClassLevel >= plan.progression.subclassLevel ? (
        <StepSection
          title="Subclasse"
          description={
            existingClass?.subclass
              ? "A subclasse já escolhida permanece vinculada a esta classe."
              : `Esta classe escolhe a subclasse no nível ${plan.progression.subclassLevel}.`
          }
        >
          {existingClass?.subclass ? (
            <div className="rounded-xl border border-accentBorder bg-accentBg p-3">
              <div className="text-sm font-semibold text-textH">
                {existingClass.subclass.name}
              </div>
              <div className="mt-1 text-xs text-textMuted">
                Fonte: {existingClass.subclass.source}
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plan.progression.subclasses.map((subclass) => (
                <button
                  key={subclass.id}
                  type="button"
                  onClick={() => onSubclassChange(subclass.id)}
                  className={
                    subclassId === subclass.id
                      ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                      : "rounded-xl border border-border bg-bg-subtle p-3 text-left hover:bg-bg"
                  }
                >
                  <div className="text-sm font-semibold text-textH">
                    {subclass.name}
                  </div>
                  <div className="mt-1 text-[10px] text-textMuted">
                    {subclass.source}
                  </div>
                </button>
              ))}
            </div>
          )}
        </StepSection>
      ) : null}

      {plan.multiclassEntry ? (
        <div className="rounded-xl border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
          Esta é uma nova classe para o personagem. O assistente registra a progressão e as escolhas, mas requisitos de atributo e proficiências específicas de multiclasse continuam sob validação do mestre.
        </div>
      ) : null}
    </div>
  )
}

function FeaturesStep({
  character,
  plan,
  optionalFeatureIds,
  choices,
  abilityScore,
  metamagicOptions,
  onToggleOptional,
  onToggleChoice,
  onAbilityScoreChange,
}: {
  character: CharacterTemplate
  plan: LevelUpPlan
  optionalFeatureIds: string[]
  choices: Record<string, string[]>
  abilityScore?: AbilityScoreSelection
  metamagicOptions: Array<{ value: string; label: string }>
  onToggleOptional: (featureId: string) => void
  onToggleChoice: (choiceId: string, value: string, limit: number) => void
  onAbilityScoreChange: (selection: AbilityScoreSelection) => void
}) {
  if (plan.features.length === 0) {
    return (
      <StepSection title="Características">
        <p className="text-sm text-textMuted">
          Este nível não concede uma característica de classe além da progressão de magias, espaços e dados de vida.
        </p>
      </StepSection>
    )
  }

  return (
    <div className="grid gap-3">
      {plan.features.map((feature) => {
        const enabled =
          !feature.optional || optionalFeatureIds.includes(feature.id)

        return (
          <section
            key={feature.id}
            className="rounded-xl border border-border bg-bg p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-textH">
                    {feature.name}
                  </h3>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-textMuted">
                    {feature.source}
                  </span>
                  {feature.optional ? (
                    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                      Opcional
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  {feature.description ||
                    `${plan.progression.label} nível ${plan.nextClassLevel}. O texto integral permanece no livro de origem.`}
                </p>
              </div>

              {feature.optional ? (
                <label className="flex shrink-0 items-center gap-2 text-xs text-text">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onToggleOptional(feature.id)}
                  />
                  Usar
                </label>
              ) : null}
            </div>

            {enabled && feature.choice ? (
              feature.choice.kind === "asi" ? (
                <div className="mt-4">
                  <AbilityScoreEditor
                    character={character}
                    value={abilityScore ?? createEmptyAbilityScore()}
                    onChange={onAbilityScoreChange}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <ChoiceEditor
                    character={character}
                    choice={feature.choice}
                    selected={choices[feature.choice.id] ?? []}
                    metamagicOptions={metamagicOptions}
                    onToggle={(value) =>
                      onToggleChoice(
                        feature.choice!.id,
                        value,
                        feature.choice!.count,
                      )
                    }
                  />
                </div>
              )
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

function ChoiceEditor({
  character,
  choice,
  selected,
  metamagicOptions,
  onToggle,
}: {
  character: CharacterTemplate
  choice: LevelChoiceDefinition
  selected: string[]
  metamagicOptions: Array<{ value: string; label: string }>
  onToggle: (value: string) => void
}) {
  const existingClassChoices = character
    .get("sheet")
    .classes?.flatMap((entry) => Object.values(entry.levelChoices ?? {}).flat()) ?? []
  const options = getChoiceOptions(
    character,
    choice,
    metamagicOptions,
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-textH">{choice.label}</div>
        <div className="text-[11px] text-textMuted">
          {selected.length}/{choice.count}
        </div>
      </div>
      {choice.description ? (
        <p className="mt-1 text-xs text-textMuted">{choice.description}</p>
      ) : null}

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          const alreadyKnown = existingClassChoices.includes(option.value)
          const disabled =
            alreadyKnown ||
            (!isSelected && selected.length >= choice.count)

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(option.value)}
              className={
                isSelected
                  ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left text-xs font-semibold text-textH"
                  : "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left text-xs text-text disabled:opacity-40"
              }
            >
              {option.label}
              {alreadyKnown ? (
                <span className="mt-0.5 block text-[9px] uppercase text-textMuted">
                  Já escolhido
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AbilityScoreEditor({
  character,
  value,
  onChange,
}: {
  character: CharacterTemplate
  value: AbilityScoreSelection
  onChange: (value: AbilityScoreSelection) => void
}) {
  const distributed = Object.values(value.increases).reduce(
    (sum, increase) => sum + Math.max(0, Number(increase) || 0),
    0,
  )

  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: "attributes" })}
          className={
            value.mode === "attributes"
              ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
              : "rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
          }
        >
          Aumentar atributos
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: "feat" })}
          className={
            value.mode === "feat"
              ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
              : "rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
          }
        >
          Escolher talento
        </button>
      </div>

      {value.mode === "attributes" ? (
        <div className="mt-3">
          <div className="mb-2 text-xs text-textMuted">
            Distribua 2 pontos. Limite normal de atributo: 20. ({distributed}/2)
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ATTRIBUTES.map((attribute) => {
              const current = character.get("sheet").attributes[attribute]
              const increase = value.increases[attribute] ?? 0
              const canIncrease =
                distributed < 2 && current + increase < 20

              return (
                <div
                  key={attribute}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg p-2"
                >
                  <div>
                    <div className="text-xs font-medium text-textH">
                      {ATTRIBUTE_LABELS[attribute]}
                    </div>
                    <div className="text-[10px] text-textMuted">
                      {current} → {current + increase}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={increase <= 0}
                      onClick={() =>
                        onChange({
                          ...value,
                          increases: {
                            ...value.increases,
                            [attribute]: Math.max(0, increase - 1),
                          },
                        })
                      }
                      className="h-8 w-8 rounded-md border border-border disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-textH">
                      {increase}
                    </span>
                    <button
                      type="button"
                      disabled={!canIncrease}
                      onClick={() =>
                        onChange({
                          ...value,
                          increases: {
                            ...value.increases,
                            [attribute]: increase + 1,
                          },
                        })
                      }
                      className="h-8 w-8 rounded-md border border-border disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Talento</span>
            <Input
              value={value.featName}
              placeholder="Nome do talento do PHB ou Tasha"
              onChange={(event) =>
                onChange({ ...value, featName: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Notas e escolhas do talento
            </span>
            <Textarea
              rows={3}
              value={value.featDescription}
              placeholder="Registre atributo escolhido, magia, proficiência ou outra decisão exigida pelo talento."
              onChange={(event) =>
                onChange({ ...value, featDescription: event.target.value })
              }
            />
          </label>
        </div>
      )}
    </div>
  )
}

function SpellsStep({
  character,
  plan,
  spells,
  spellChoices,
  onToggleSpell,
}: {
  character: CharacterTemplate
  plan: LevelUpPlan
  spells: Spell[]
  spellChoices: Record<string, string[]>
  onToggleSpell: (
    requirementId: string,
    spellIndex: string,
    limit: number,
  ) => void
}) {
  if (plan.spellRequirements.length === 0) {
    return (
      <StepSection
        title="Magias"
        description="Espaços de magia ainda são recalculados automaticamente pela progressão multiclasse."
      >
        <p className="text-sm text-textMuted">
          Este nível não exige escolher novas magias ou truques.
        </p>
      </StepSection>
    )
  }

  return (
    <div className="grid gap-4">
      {plan.spellRequirements.map((requirement) => (
        <SpellRequirementEditor
          key={requirement.id}
          character={character}
          requirement={requirement}
          spells={spells}
          selected={spellChoices[requirement.id] ?? []}
          onToggle={(spellIndex) =>
            onToggleSpell(requirement.id, spellIndex, requirement.count)
          }
        />
      ))}
    </div>
  )
}

function SpellRequirementEditor({
  character,
  requirement,
  spells,
  selected,
  onToggle,
}: {
  character: CharacterTemplate
  requirement: LevelUpSpellRequirement
  spells: Spell[]
  selected: string[]
  onToggle: (spellIndex: string) => void
}) {
  const [search, setSearch] = useState("")
  const knownSpells = new Set(
    character.get("magic")?.spells.knownSpells.map((entry) => entry.spells.id) ?? [],
  )
  const normalizedSearch = normalizeText(search)
  const eligible = spells
    .filter((spell) => spellMatchesRequirement(spell, requirement, character))
    .filter(
      (spell) =>
        requirement.existingOnly ||
        !knownSpells.has(spell.index) ||
        selected.includes(spell.index),
    )
    .filter((spell) => {
      if (!normalizedSearch) return true
      return normalizeText(
        `${spell.displayName ?? spell.name} ${spell.name}`,
      ).includes(normalizedSearch)
    })
    .toSorted((left, right) => {
      const levelDifference = left.slotLevel - right.slotLevel
      if (levelDifference !== 0) return levelDifference
      return (left.displayName ?? left.name).localeCompare(
        right.displayName ?? right.name,
        "pt-BR",
      )
    })

  return (
    <StepSection
      title={levelUpRequirementSpellLabel(requirement)}
      description={requirement.note}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-textMuted">
          Selecione {requirement.count} magia{requirement.count === 1 ? "" : "s"}.
        </span>
        <span className="font-semibold text-textH">
          {selected.length}/{requirement.count}
        </span>
      </div>

      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
        <Input
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar magia..."
        />
      </label>

      <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {eligible.map((spell) => {
          const isSelected = selected.includes(spell.index)
          const disabled =
            !isSelected && selected.length >= requirement.count

          return (
            <button
              key={spell.index}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(spell.index)}
              className={
                isSelected
                  ? "rounded-lg border border-accentBorder bg-accentBg p-3 text-left"
                  : "rounded-lg border border-border bg-bg-subtle p-3 text-left disabled:opacity-40"
              }
            >
              <div className="text-xs font-semibold text-textH">
                {spell.displayName ?? spell.name}
              </div>
              <div className="mt-1 text-[10px] text-textMuted">
                {spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} · {spell.school}
              </div>
            </button>
          )
        })}
      </div>

      {eligible.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
          Nenhuma magia da biblioteca corresponde a este requisito.
        </div>
      ) : null}
    </StepSection>
  )
}

function ReviewStep({
  character,
  plan,
  selections,
  hpGain,
  onHpGainChange,
  spells,
  errors,
}: {
  character: CharacterTemplate
  plan: LevelUpPlan
  selections: LevelUpSelections
  hpGain: number
  onHpGainChange: (value: number) => void
  spells: Spell[]
  errors: string[]
}) {
  const spellByIndex = new Map(spells.map((spell) => [spell.index, spell]))
  const chosenFeatures = plan.features.filter(
    (feature) =>
      !feature.optional || selections.optionalFeatureIds.includes(feature.id),
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StepSection title="Progressão">
        <ReviewLine label="Classe" value={plan.progression.label} />
        <ReviewLine
          label="Nível da classe"
          value={`${plan.currentClassLevel} → ${plan.nextClassLevel}`}
        />
        <ReviewLine
          label="Nível total"
          value={`${plan.currentTotalLevel} → ${plan.nextTotalLevel}`}
        />
        <ReviewLine
          label="Subclasse"
          value={plan.selectedSubclass?.name ?? selections.subclassId ?? "—"}
        />
      </StepSection>

      <StepSection
        title="Pontos de vida"
        description={`Média sugerida: ${plan.averageHpGain}. O ganho já inclui o modificador de Constituição atual.`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
            <Dice6 className="h-5 w-5" />
          </span>
          <label className="grid flex-1 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Ganho de PV
            </span>
            <Input
              type="number"
              min={1}
              value={hpGain}
              onChange={(event) =>
                onHpGainChange(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </label>
        </div>
      </StepSection>

      <StepSection title="Características" className="lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chosenFeatures.map((feature) => (
            <div
              key={feature.id}
              className="rounded-lg border border-border bg-bg-subtle p-3"
            >
              <div className="text-xs font-semibold text-textH">
                {feature.name}
              </div>
              <div className="mt-1 text-[10px] text-textMuted">
                {feature.source}
              </div>
              {feature.choice ? (
                <div className="mt-2 text-xs text-text">
                  {(selections.choices[feature.choice.id] ?? []).join(", ") ||
                    (feature.choice.kind === "asi"
                      ? describeAbilityScore(selections.abilityScore)
                      : "Pendente")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </StepSection>

      {plan.spellRequirements.length ? (
        <StepSection title="Magias escolhidas" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.spellRequirements.map((requirement) => (
              <div
                key={requirement.id}
                className="rounded-lg border border-border bg-bg-subtle p-3"
              >
                <div className="text-xs font-semibold text-textH">
                  {requirement.label}
                </div>
                <div className="mt-2 text-xs leading-5 text-text">
                  {(selections.spellChoices[requirement.id] ?? [])
                    .map((index) => spellByIndex.get(index)?.displayName ?? spellByIndex.get(index)?.name ?? index)
                    .join(", ") || "Nenhuma"}
                </div>
              </div>
            ))}
          </div>
        </StepSection>
      ) : null}

      {errors.length ? (
        <div className="rounded-xl border border-danger bg-dangerBg p-3 text-xs leading-5 text-danger lg:col-span-2">
          <div className="font-semibold">Revise antes de aplicar:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-textH lg:col-span-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          A aplicação atualizará classe, subclasse, PV, dado de vida, habilidades, escolhas, magias, espaços de magia e pontos de feitiçaria em uma única alteração.
        </div>
      )}
    </div>
  )
}

function StepSection({
  title,
  description,
  className = "",
  children,
}: {
  title: string
  description?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-bg p-4 shadow-theme-sm ${className}`}
    >
      <div className="mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-textH">
          <BookOpen className="h-4 w-4 text-accent" />
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-textMuted">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-xs last:border-0">
      <span className="text-textMuted">{label}</span>
      <span className="text-right font-semibold text-textH">{value}</span>
    </div>
  )
}

function getChoiceOptions(
  character: CharacterTemplate,
  choice: LevelChoiceDefinition,
  metamagicOptions: Array<{ value: string; label: string }>,
): Array<{ value: string; label: string }> {
  if (choice.kind === "metamagic") return metamagicOptions

  if (choice.kind === "expertise") {
    return (Object.entries(character.get("sheet").skills) as Array<
      [Skill, "none" | "proficient" | "expertise" | undefined]
    >)
      .filter(([, proficiency]) => proficiency === "proficient")
      .map(([skill]) => ({ value: skill, label: SKILL_LABELS[skill] }))
  }

  return (choice.options ?? []).map((option) => ({
    value: option,
    label: option,
  }))
}

function createDefaultAbilityScore(
  plan: LevelUpPlan,
): AbilityScoreSelection | undefined {
  return plan.features.some((feature) => feature.choice?.kind === "asi")
    ? createEmptyAbilityScore()
    : undefined
}

function createEmptyAbilityScore(): AbilityScoreSelection {
  return {
    mode: "attributes",
    increases: {},
    featName: "",
    featDescription: "",
  }
}

function describeAbilityScore(
  selection: AbilityScoreSelection | undefined,
): string {
  if (!selection) return "Pendente"
  if (selection.mode === "feat") return `Talento: ${selection.featName || "Pendente"}`

  return Object.entries(selection.increases)
    .filter(([, value]) => Number(value) > 0)
    .map(
      ([attribute, value]) =>
        `${ATTRIBUTE_LABELS[attribute as Attribute]} +${value}`,
    )
    .join(", ") || "Pendente"
}

function getStepErrors(
  step: number,
  plan: LevelUpPlan,
  selections: LevelUpSelections,
): string[] {
  if (step === 0) {
    if (plan.nextTotalLevel > 20) return ["O nível total máximo é 20."]
    if (plan.subclassRequired && !selections.subclassId) {
      return ["Escolha uma subclasse."]
    }
    return []
  }

  const all = validateLevelUpSelections(plan, selections)
  if (step === 1) {
    return all.filter(
      (error) =>
        !plan.spellRequirements.some((requirement) =>
          error.startsWith(requirement.label),
        ) &&
        !error.toLowerCase().includes("pontos de vida"),
    )
  }
  if (step === 2) {
    return all.filter((error) =>
      plan.spellRequirements.some((requirement) =>
        error.startsWith(requirement.label),
      ),
    )
  }
  return all
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}
