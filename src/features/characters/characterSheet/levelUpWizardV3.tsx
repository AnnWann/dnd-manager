import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Dice6,
  GraduationCap,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import { MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import type { Skill } from "../../../models/sheet/Skills"
import { getClassNamePt } from "../../../models/leveling/ClassLocalization"
import {
  EXPANDED_CLASS_PROGRESSIONS,
} from "../../../models/leveling/ExpandedClassProgression"
import type { LevelChoiceDefinition } from "../../../models/leveling/ClassProgression"
import {
  applyLevelUp,
  getLevelUpPlan,
  homebrewMatchesRequirementWithoutClass,
  levelUpRequirementSpellLabel,
  spellMatchesRequirement,
  validateLevelUpSelections,
  type AbilityScoreSelection,
  type ExpandedLevelUpPlan,
  type LevelUpSelections,
  type LevelUpSpellRequirement,
} from "../../../models/leveling/ExpandedLevelUpEngine"
import {
  checkMulticlassRequirements,
  formatClassMulticlassRequirement,
} from "../../../models/leveling/MulticlassRequirements"

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

type Props = {
  open: boolean
  character: CharacterTemplate
  onClose: () => void
  onApply: (character: CharacterTemplate) => void
  lockedClassName?: ClassName
  title?: string
  subtitle?: string
}

export function LevelUpWizardV3({
  open,
  character,
  onClose,
  onApply,
  lockedClassName,
  title = "Subir de nível",
  subtitle,
}: Props) {
  const { spells, metamagics } = useMagicContext()
  const classes = character.get("sheet").classes ?? []
  const initialClass =
    lockedClassName ?? classes[0]?.className ?? "fighter"

  const [step, setStep] = useState(0)
  const [className, setClassName] = useState<ClassName>(initialClass)
  const [subclassId, setSubclassId] = useState<string | undefined>()
  const [optionalFeatureIds, setOptionalFeatureIds] = useState<string[]>([])
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [spellChoices, setSpellChoices] = useState<Record<string, string[]>>({})
  const [hpGain, setHpGain] = useState(1)
  const [abilityScore, setAbilityScore] =
    useState<AbilityScoreSelection | undefined>()
  const [errors, setErrors] = useState<string[]>([])

  const plan = useMemo(
    () => getLevelUpPlan(character, className, subclassId),
    [character, className, subclassId],
  )

  useEffect(() => {
    if (!open) return

    const nextClass =
      lockedClassName ??
      character.get("sheet").classes?.[0]?.className ??
      "fighter"
    const existing = character
      .get("sheet")
      .classes?.find((entry) => entry.className === nextClass)
    const nextPlan = getLevelUpPlan(
      character,
      nextClass,
      existing?.subclass?.id,
    )

    setStep(0)
    setClassName(nextClass)
    setSubclassId(existing?.subclass?.id)
    setOptionalFeatureIds([])
    setChoices({})
    setSpellChoices({})
    setHpGain(nextPlan.averageHpGain)
    setAbilityScore(defaultAbilityScore(nextPlan))
    setErrors([])
  }, [character, lockedClassName, open])

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
  const allErrors = validateLevelUpSelections(plan, selections)
  const stepErrors = errorsForStep(step, plan, selections)

  function changeClass(nextClassName: ClassName) {
    if (lockedClassName && nextClassName !== lockedClassName) return

    const existing = classes.find(
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
    setAbilityScore(defaultAbilityScore(nextPlan))
    setErrors([])
  }

  function changeSubclass(nextSubclassId: string) {
    const nextPlan = getLevelUpPlan(character, className, nextSubclassId)
    setSubclassId(nextSubclassId)
    setChoices({})
    setSpellChoices({})
    setAbilityScore(defaultAbilityScore(nextPlan))
    setErrors([])
  }

  function toggleChoice(
    choiceId: string,
    value: string,
    maximum: number,
  ) {
    setChoices((current) => {
      const selected = current[choiceId] ?? []
      if (selected.includes(value)) {
        return {
          ...current,
          [choiceId]: selected.filter((entry) => entry !== value),
        }
      }
      if (selected.length >= maximum) return current
      return { ...current, [choiceId]: [...selected, value] }
    })
  }

  function toggleSpell(
    requirementId: string,
    spellIndex: string,
    maximum: number,
  ) {
    setSpellChoices((current) => {
      const selected = current[requirementId] ?? []
      if (selected.includes(spellIndex)) {
        return {
          ...current,
          [requirementId]: selected.filter((entry) => entry !== spellIndex),
        }
      }
      if (selected.length >= maximum) return current
      return {
        ...current,
        [requirementId]: [...selected, spellIndex],
      }
    })
  }

  function finish() {
    const validation = validateLevelUpSelections(plan, selections)
    if (validation.length) {
      setErrors(validation)
      return
    }

    try {
      onApply(applyLevelUp(character, plan, selections))
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Não foi possível aplicar o nível.",
      ])
    }
  }

  return (
    <div className="fixed inset-0 z-[13000] flex items-center justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:p-4">
      <div className="grid h-[100dvh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg-elevated shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:rounded-xl sm:border sm:border-border">
        <header className="border-b border-border p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-textH">
                <GraduationCap className="h-5 w-5 text-accent" />
                {title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                {subtitle ??
                  `${character.get("name")} passará do nível total ${plan.currentTotalLevel} para ${plan.nextTotalLevel}.`}
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
              lockedClassName={lockedClassName}
              onClassChange={changeClass}
              onSubclassChange={changeSubclass}
            />
          ) : null}

          {step === 1 ? (
            <FeatureStep
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
              onSetChoice={(choiceId, values) =>
                setChoices((current) => ({
                  ...current,
                  [choiceId]: values,
                }))
              }
              onAbilityScoreChange={setAbilityScore}
            />
          ) : null}

          {step === 2 ? (
            <SpellStep
              character={character}
              plan={plan}
              spells={spells}
              spellChoices={spellChoices}
              onToggleSpell={toggleSpell}
            />
          ) : null}

          {step === 3 ? (
            <ReviewStep
              plan={plan}
              selections={selections}
              hpGain={hpGain}
              spells={spells}
              errors={errors.length ? errors : allErrors}
              onHpGainChange={setHpGain}
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
                disabled={stepErrors.length > 0}
                onClick={() => {
                  setErrors(stepErrors)
                  if (!stepErrors.length) {
                    setStep((current) => current + 1)
                  }
                }}
              >
                Continuar
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={allErrors.length > 0}
                onClick={finish}
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
  lockedClassName,
  onClassChange,
  onSubclassChange,
}: {
  character: CharacterTemplate
  plan: ExpandedLevelUpPlan
  className: ClassName
  subclassId?: string
  lockedClassName?: ClassName
  onClassChange: (className: ClassName) => void
  onSubclassChange: (subclassId: string) => void
}) {
  const classes = character.get("sheet").classes ?? []
  const currentClass = classes.find(
    (entry) => entry.className === className,
  )

  return (
    <div className="grid gap-4">
      <Section
        title="Classe"
        description={
          lockedClassName
            ? "A classe inicial foi definida na criação do personagem."
            : "Avance uma classe atual ou escolha uma nova classe. Uma multiclasse exige os atributos mínimos da classe de destino e de todas as classes atuais."
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(EXPANDED_CLASS_PROGRESSIONS).map((progression) => {
            const existing = classes.find(
              (entry) => entry.className === progression.className,
            )
            const requirement = checkMulticlassRequirements(
              character,
              progression.className,
            )
            const selected = progression.className === className
            const disabled =
              (Boolean(lockedClassName) &&
                progression.className !== lockedClassName) ||
              existing?.level === 20 ||
              (requirement.isMulticlassEntry && !requirement.allowed)

            return (
              <button
                key={progression.className}
                type="button"
                disabled={disabled}
                onClick={() => onClassChange(progression.className)}
                className={
                  selected
                    ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                    : "rounded-xl border border-border bg-bg-subtle p-3 text-left hover:bg-bg disabled:cursor-not-allowed disabled:opacity-45"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-textH">
                    {getClassNamePt(progression.className)}
                  </span>
                  <span className="text-[10px] text-textMuted">
                    {sourceName(progression.source)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {existing
                    ? `Nível ${existing.level} → ${Math.min(20, Number(existing.level) + 1)}`
                    : "Nova classe — nível 1"}
                </div>
                {!existing ? (
                  <div className="mt-1 text-[10px] text-textMuted">
                    Requisito: {formatClassMulticlassRequirement(progression.className)}
                  </div>
                ) : null}
                {requirement.isMulticlassEntry && !requirement.allowed ? (
                  <div className="mt-2 text-[10px] font-semibold text-danger">
                    {requirement.failures
                      .map(
                        (failure) =>
                          `${failure.classLabel}: ${failure.requirement}`,
                      )
                      .join(" • ")}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </Section>

      {plan.nextClassLevel >= plan.progression.subclassLevel ? (
        <Section
          title="Subclasse"
          description={
            currentClass?.subclass
              ? "A subclasse já escolhida permanece vinculada à classe."
              : `A escolha ocorre no nível ${plan.progression.subclassLevel} de ${plan.progression.label}.`
          }
        >
          {currentClass?.subclass ? (
            <div className="rounded-xl border border-accentBorder bg-accentBg p-3">
              <div className="text-sm font-semibold text-textH">
                {plan.selectedSubclass?.name ?? currentClass.subclass.name}
              </div>
              <div className="mt-1 text-xs text-textMuted">
                Fonte: {sourceName(currentClass.subclass.source)}
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
                    {sourceName(subclass.source)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {plan.multiclassRequirements.isMulticlassEntry ? (
        <div
          className={
            plan.multiclassRequirements.allowed
              ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-textH"
              : "rounded-xl border border-danger bg-dangerBg p-3 text-xs leading-5 text-danger"
          }
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {plan.multiclassRequirements.allowed
                ? "Os requisitos de atributo da multiclasse foram atendidos."
                : "A multiclasse está bloqueada pelos seguintes requisitos:"}
              {!plan.multiclassRequirements.allowed ? (
                <ul className="mt-1 list-disc pl-5">
                  {plan.multiclassRequirements.failures.map((failure) => (
                    <li key={failure.className}>
                      {failure.classLabel}: {failure.requirement}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FeatureStep({
  character,
  plan,
  optionalFeatureIds,
  choices,
  abilityScore,
  metamagicOptions,
  onToggleOptional,
  onToggleChoice,
  onSetChoice,
  onAbilityScoreChange,
}: {
  character: CharacterTemplate
  plan: ExpandedLevelUpPlan
  optionalFeatureIds: string[]
  choices: Record<string, string[]>
  abilityScore?: AbilityScoreSelection
  metamagicOptions: Array<{ value: string; label: string }>
  onToggleOptional: (featureId: string) => void
  onToggleChoice: (choiceId: string, value: string, maximum: number) => void
  onSetChoice: (choiceId: string, values: string[]) => void
  onAbilityScoreChange: (selection: AbilityScoreSelection) => void
}) {
  if (!plan.features.length) {
    return (
      <Section title="Características">
        <p className="text-sm text-textMuted">
          Este nível não concede uma nova característica além da progressão de vida, dados de vida e magia.
        </p>
      </Section>
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
                    {sourceName(feature.source)}
                  </span>
                  {feature.optional ? (
                    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                      Opcional
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  {feature.description ||
                    `${plan.progression.label} nível ${plan.nextClassLevel}. Consulte o livro indicado para o texto integral.`}
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
              <div className="mt-4">
                {feature.choice.kind === "asi" ? (
                  <AbilityScoreEditor
                    character={character}
                    value={abilityScore ?? emptyAbilityScore()}
                    onChange={onAbilityScoreChange}
                  />
                ) : (
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
                    onSet={(values) =>
                      onSetChoice(feature.choice!.id, values)
                    }
                  />
                )}
              </div>
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
  onSet,
}: {
  character: CharacterTemplate
  choice: LevelChoiceDefinition
  selected: string[]
  metamagicOptions: Array<{ value: string; label: string }>
  onToggle: (value: string) => void
  onSet: (values: string[]) => void
}) {
  const options = choiceOptions(character, choice, metamagicOptions)
  const previousChoices = new Set(
    character
      .get("sheet")
      .classes?.flatMap((entry) =>
        Object.values(entry.levelChoices ?? {}).flat(),
      ) ?? [],
  )

  if (!options.length && (choice.allowCustom || choice.kind === "expertise")) {
    return (
      <div className="grid gap-2">
        <div className="text-xs font-semibold text-textH">
          {choice.label} ({selected.filter(Boolean).length}/{choice.count})
        </div>
        {Array.from({ length: choice.count }, (_, index) => (
          <Input
            key={index}
            value={selected[index] ?? ""}
            placeholder={`Escolha ${index + 1}`}
            onChange={(event) => {
              const next = Array.from(
                { length: choice.count },
                (_, currentIndex) => selected[currentIndex] ?? "",
              )
              next[index] = event.target.value
              onSet(next.filter((value) => value.trim().length > 0))
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-textH">{choice.label}</div>
        <span className="text-[11px] text-textMuted">
          {selected.length}/{choice.count}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          const alreadyKnown = previousChoices.has(option.value)
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
        <ToggleButton
          active={value.mode === "attributes"}
          onClick={() => onChange({ ...value, mode: "attributes" })}
        >
          Aumentar atributos
        </ToggleButton>
        <ToggleButton
          active={value.mode === "feat"}
          onClick={() => onChange({ ...value, mode: "feat" })}
        >
          Escolher talento
        </ToggleButton>
      </div>

      {value.mode === "attributes" ? (
        <div className="mt-3">
          <div className="mb-2 text-xs text-textMuted">
            Distribua exatamente 2 pontos, respeitando o limite normal de 20. ({distributed}/2)
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ATTRIBUTES.map((attribute) => {
              const current = character.get("sheet").attributes[attribute]
              const increase = value.increases[attribute] ?? 0
              const canIncrease = distributed < 2 && current + increase < 20

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
              placeholder="Nome do talento"
              onChange={(event) =>
                onChange({ ...value, featName: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Escolhas e observações
            </span>
            <Textarea
              rows={3}
              value={value.featDescription}
              placeholder="Registre atributo, magia, perícia ou outra decisão exigida pelo talento."
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

function SpellStep({
  character,
  plan,
  spells,
  spellChoices,
  onToggleSpell,
}: {
  character: CharacterTemplate
  plan: ExpandedLevelUpPlan
  spells: Spell[]
  spellChoices: Record<string, string[]>
  onToggleSpell: (
    requirementId: string,
    spellIndex: string,
    maximum: number,
  ) => void
}) {
  if (!plan.spellRequirements.length) {
    return (
      <Section
        title="Magias"
        description="Os espaços de magia são recalculados automaticamente após a aplicação do nível."
      >
        <p className="text-sm text-textMuted">
          Este nível não exige a escolha de novas magias ou truques.
        </p>
      </Section>
    )
  }

  return (
    <div className="grid gap-4">
      {plan.spellRequirements.map((requirement) => (
        <SpellPicker
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

function SpellPicker({
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
  const [levelFilter, setLevelFilter] = useState("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "official" | "homebrew"
  >("all")
  const [includeUnlistedHomebrew, setIncludeUnlistedHomebrew] =
    useState(true)

  const known = useMemo(
    () =>
      new Set(
        character
          .get("magic")
          ?.spells.knownSpells.map((entry) => entry.spells.id) ?? [],
      ),
    [character],
  )

  const compatible = useMemo(
    () =>
      spells.filter((spell) => {
        const strict = spellMatchesRequirement(
          spell,
          requirement,
          character,
        )
        const manualHomebrew =
          includeUnlistedHomebrew &&
          homebrewMatchesRequirementWithoutClass(
            spell,
            requirement,
            character,
          )

        if (!strict && !manualHomebrew) return false
        if (
          !requirement.existingOnly &&
          known.has(spell.index) &&
          !selected.includes(spell.index)
        ) {
          return false
        }
        return true
      }),
    [
      character,
      includeUnlistedHomebrew,
      known,
      requirement,
      selected,
      spells,
    ],
  )

  const availableLevels = useMemo(
    () =>
      Array.from(new Set(compatible.map((spell) => spell.slotLevel))).sort(
        (left, right) => left - right,
      ),
    [compatible],
  )
  const availableSchools = useMemo(
    () =>
      Array.from(
        new Set(
          compatible
            .map((spell) => String(spell.school).trim())
            .filter(Boolean),
        ),
      ).sort((left, right) =>
        schoolName(left).localeCompare(schoolName(right), "pt-BR"),
      ),
    [compatible],
  )

  const normalizedSearch = normalize(search)
  const visible = compatible
    .filter(
      (spell) =>
        levelFilter === "all" ||
        String(spell.slotLevel) === levelFilter,
    )
    .filter(
      (spell) =>
        schoolFilter === "all" ||
        String(spell.school) === schoolFilter,
    )
    .filter((spell) => {
      if (sourceFilter === "homebrew") return spell.homebrew
      if (sourceFilter === "official") return !spell.homebrew
      return true
    })
    .filter((spell) => {
      if (!normalizedSearch) return true
      return normalize(
        `${spell.displayName ?? spell.name} ${spell.name} ${spell.description ?? ""}`,
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
    <Section
      title={levelUpRequirementSpellLabel(requirement)}
      description={requirement.note}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-textMuted">
          Escolha {requirement.count} magia{requirement.count === 1 ? "" : "s"}. {compatible.length} compatíveis na biblioteca.
        </span>
        <span className="font-semibold text-textH">
          {selected.length}/{requirement.count}
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <label className="relative md:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
          <Input
            className="pl-9"
            value={search}
            placeholder="Buscar magia..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="h-10 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none focus:border-accent"
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
        >
          <option value="all">Todos os níveis</option>
          {availableLevels.map((level) => (
            <option key={level} value={level}>
              {level === 0 ? "Truques" : `${level}º nível`}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none focus:border-accent"
          value={schoolFilter}
          onChange={(event) => setSchoolFilter(event.target.value)}
        >
          <option value="all">Todas as escolas</option>
          {availableSchools.map((school) => (
            <option key={school} value={school}>
              {schoolName(school)}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-xl border border-accentBorder bg-bg px-3 text-sm text-text outline-none focus:border-accent"
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(
              event.target.value as "all" | "official" | "homebrew",
            )
          }
        >
          <option value="all">Oficiais e homebrew</option>
          <option value="official">Somente oficiais</option>
          <option value="homebrew">Somente homebrew</option>
        </select>
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-2.5 text-xs text-text">
        <input
          type="checkbox"
          checked={includeUnlistedHomebrew}
          onChange={(event) =>
            setIncludeUnlistedHomebrew(event.target.checked)
          }
        />
        <span>
          <span className="font-semibold text-textH">
            Incluir homebrew sem classe compatível cadastrada
          </span>
          <span className="mt-0.5 block text-[10px] leading-4 text-textMuted">
            Mantém limites de nível, escola e tipo de magia, mas permite selecionar manualmente uma magia caseira cuja lista de classes esteja vazia ou incompleta.
          </span>
        </span>
      </label>

      <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((spell) => {
          const isSelected = selected.includes(spell.index)
          const disabled =
            !isSelected && selected.length >= requirement.count
          const strict = spellMatchesRequirement(
            spell,
            requirement,
            character,
          )

          return (
            <button
              key={spell.index}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(spell.index)}
              className={
                isSelected
                  ? "rounded-lg border border-accentBorder bg-accentBg p-3 text-left"
                  : "rounded-lg border border-border bg-bg-subtle p-3 text-left hover:bg-bg disabled:opacity-40"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold text-textH">
                  {spell.displayName ?? spell.name}
                </div>
                {spell.homebrew ? (
                  <span className="rounded-full border border-accentBorder px-1.5 py-0.5 text-[8px] font-semibold text-accent">
                    HOMEBREW
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[10px] text-textMuted">
                {spell.slotLevel === 0
                  ? "Truque"
                  : `${spell.slotLevel}º nível`} · {schoolName(String(spell.school))}
              </div>
              {spell.homebrew && !strict ? (
                <div className="mt-1 text-[9px] font-semibold text-warning">
                  Compatibilidade manual de classe
                </div>
              ) : null}
            </button>
          )
        })}
      </div>

      {!visible.length ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
          Nenhuma magia corresponde aos filtros atuais.
        </div>
      ) : null}
    </Section>
  )
}

function ReviewStep({
  plan,
  selections,
  hpGain,
  spells,
  errors,
  onHpGainChange,
}: {
  plan: ExpandedLevelUpPlan
  selections: LevelUpSelections
  hpGain: number
  spells: Spell[]
  errors: string[]
  onHpGainChange: (value: number) => void
}) {
  const spellByIndex = new Map(
    spells.map((spell) => [spell.index, spell]),
  )
  const features = plan.features.filter(
    (feature) =>
      !feature.optional ||
      selections.optionalFeatureIds.includes(feature.id),
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Progressão">
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
          value={plan.selectedSubclass?.name ?? "—"}
        />
      </Section>

      <Section
        title="Pontos de vida"
        description={
          plan.nextTotalLevel === 1
            ? `Primeiro nível: dado de vida máximo mais Constituição. Sugestão: ${plan.averageHpGain}.`
            : `Média do dado de vida mais Constituição. Sugestão: ${plan.averageHpGain}.`
        }
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
            <Dice6 className="h-5 w-5" />
          </span>
          <label className="grid flex-1 gap-1.5">
            <span className="text-xs font-medium text-textH">Ganho de PV</span>
            <Input
              type="number"
              min={1}
              value={hpGain}
              onChange={(event) =>
                onHpGainChange(
                  Math.max(1, Number(event.target.value) || 1),
                )
              }
            />
          </label>
        </div>
      </Section>

      <Section title="Características" className="lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="rounded-lg border border-border bg-bg-subtle p-3"
            >
              <div className="text-xs font-semibold text-textH">
                {feature.name}
              </div>
              <div className="mt-1 text-[10px] text-textMuted">
                {sourceName(feature.source)}
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
      </Section>

      {plan.spellRequirements.length ? (
        <Section title="Magias escolhidas" className="lg:col-span-2">
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
                    .map(
                      (index) =>
                        spellByIndex.get(index)?.displayName ??
                        spellByIndex.get(index)?.name ??
                        index,
                    )
                    .join(", ") || "Nenhuma"}
                </div>
              </div>
            ))}
          </div>
        </Section>
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
          Classe, subclasse, PV, dado de vida, características, escolhas, magias e recursos serão atualizados em uma única alteração.
        </div>
      )}
    </div>
  )
}

function Section({
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

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
          : "rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
      }
    >
      {children}
    </button>
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

function choiceOptions(
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

function defaultAbilityScore(
  plan: ExpandedLevelUpPlan,
): AbilityScoreSelection | undefined {
  return plan.features.some(
    (feature) => feature.choice?.kind === "asi",
  )
    ? emptyAbilityScore()
    : undefined
}

function emptyAbilityScore(): AbilityScoreSelection {
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
  if (selection.mode === "feat") {
    return `Talento: ${selection.featName || "Pendente"}`
  }

  return (
    Object.entries(selection.increases)
      .filter(([, value]) => Number(value) > 0)
      .map(
        ([attribute, value]) =>
          `${ATTRIBUTE_LABELS[attribute as Attribute]} +${value}`,
      )
      .join(", ") || "Pendente"
  )
}

function errorsForStep(
  step: number,
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
): string[] {
  const all = validateLevelUpSelections(plan, selections)

  if (step === 0) {
    return all.filter(
      (error) =>
        error.includes("nível total") ||
        error.includes("nível 20") ||
        error.toLowerCase().includes("subclasse") ||
        error.includes("Multiclasse"),
    )
  }

  if (step === 1) {
    return all.filter(
      (error) =>
        !plan.spellRequirements.some((requirement) =>
          error.startsWith(requirement.label),
        ) &&
        !error.toLowerCase().includes("pontos de vida") &&
        !error.includes("Multiclasse") &&
        !error.toLowerCase().includes("subclasse"),
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function sourceName(source: string): string {
  if (source === "PHB") return "Livro do Jogador"
  if (source === "Tasha") return "Tasha"
  if (source === "Xanathar") return "Xanathar"
  return source
}

function schoolName(school: string): string {
  return MAGIC_SCHOOLS_MAP[school] ?? school
}
