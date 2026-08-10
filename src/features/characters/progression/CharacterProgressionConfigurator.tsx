import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  ALL_CLASS_NAMES,
  getClassProgression,
} from "../../../data/classProgression"
import type { Ability } from "../../../models/abilities/Ability"
import { applyManualProficiencies } from "../../../models/characters/applyManualProficiencies"
import {
  getDerivedSorceryPointMaximum,
  getSorceryPointPool,
} from "../../../models/characters/characterSorceryPoints"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import {
  createClassEntry,
  getClassSpellSelectionRule,
  getMetamagicLimit,
  isSpellAllowedForClassSelection,
} from "../../../models/leveling/SpellSelectionRules"
import {
  applyCharacterProgression,
  type ProgressionClassPlan,
  type ProgressionCustomAbility,
  type ProgressionSpellSelection,
} from "../../../models/leveling/applyCharacterProgression"
import { AbilityDialog } from "../abilities/abilityDialog"
import { ProficiencySelectionModal } from "../proficiencies/ProficiencySelectionModal"
import {
  LevelUpSpellSelectionModal,
  type LevelUpSpellSelection,
} from "./LevelUpSpellSelectionModal"
import { MetamagicSelectionModal } from "./MetamagicSelectionModal"

type Props = {
  mode: "creation" | "level-up"
  character: CharacterTemplate
  targetTotalLevel?: number
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

type Step = "classes" | "features" | "spells" | "review"
type HpMode = "average" | "manual" | "rolled"
type AbilitySource = "class" | "race"
type SpellSelectionState = Record<string, LevelUpSpellSelection>

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
  const existingTotal = existingClasses.reduce((sum, entry) => sum + entry.level, 0)
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
    createInitialPlans(mode, character, creationTotal, initialAdvancedClass),
  )
  const [customAbilities, setCustomAbilities] = useState<
    ProgressionCustomAbility[]
  >([])
  const [abilitySource, setAbilitySource] = useState<AbilitySource | null>(null)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [customAbilityClass, setCustomAbilityClass] =
    useState<ClassName>(initialAdvancedClass)
  const [customAbilityLevel, setCustomAbilityLevel] = useState(1)
  const [abilityLevels, setAbilityLevels] = useState<
    Partial<Record<ClassName, number>>
  >({})
  const [spellSelections, setSpellSelections] = useState<SpellSelectionState>(() =>
    createInitialSpellSelections(character, classPlans),
  )
  const [spellQueries, setSpellQueries] = useState<
    Partial<Record<ClassName, string>>
  >({})
  const [levelUpProficiencies, setLevelUpProficiencies] = useState<Proficiency[]>([])
  const [selectedMetamagics, setSelectedMetamagics] = useState<MetamagicId[]>(
    () => character.get("magic")?.metamagic?.metamagics ?? [],
  )
  const [spellModalOpen, setSpellModalOpen] = useState(false)
  const [proficiencyModalOpen, setProficiencyModalOpen] = useState(false)
  const [metamagicModalOpen, setMetamagicModalOpen] = useState(false)
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledDie, setRolledDie] = useState<number | null>(null)
  const [validationMessage, setValidationMessage] = useState("")

  const finalTotal = classPlans.reduce((sum, plan) => sum + plan.level, 0)
  const configuredCharacter = useMemo(
    () => characterWithPlans(character, classPlans),
    [character, classPlans],
  )
  const advancedProgression = getClassProgression(advancedClassName)
  const advancedPlan = classPlans.find(
    (plan) => plan.className === advancedClassName,
  )
  const targetClassLevel = advancedPlan?.level ?? 1
  const previousClassLevel = advancedPlan?.previousLevel ?? 0
  const advancedSpellRule = getClassSpellSelectionRule(
    configuredCharacter,
    advancedClassName,
    targetClassLevel,
    advancedPlan?.subclassId,
  )
  const metamagicLimit =
    advancedClassName === "sorcerer"
      ? getMetamagicLimit(targetClassLevel)
      : 0
  const conModifier = configuredCharacter.getAttributeModifier("con")
  const averageDie =
    Math.floor(Number(advancedProgression.hitDie.slice(1)) / 2) + 1
  const averageHp = Math.max(1, averageDie + conModifier)
  const hpGain =
    hpMode === "manual"
      ? Math.max(1, Math.trunc(Number(manualHp) || 1))
      : hpMode === "rolled"
        ? Math.max(1, (rolledDie ?? averageDie) + conModifier)
        : averageHp
  const expertiseCount = levelUpProficiencies.filter(
    (entry) => entry.expertise,
  ).length
  const levelUpSpellSelection = spellSelections[advancedClassName] ?? {
    selected: [],
    prepared: [],
  }
  const steps: Array<{ id: Step; label: string }> =
    mode === "level-up"
      ? [
          { id: "classes", label: "Classe" },
          { id: "features", label: "Características" },
          { id: "review", label: "Revisão" },
        ]
      : [
          { id: "classes", label: "Classes" },
          { id: "features", label: "Características" },
          { id: "spells", label: "Magias" },
          { id: "review", label: "Revisão" },
        ]

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

  function changeAdvancedClass(className: ClassName) {
    setAdvancedClassName(className)
    if (mode !== "level-up") return

    const nextPlans = createLevelUpPlans(character, className)
    setClassPlans(nextPlans)
    setSpellSelections(createInitialSpellSelections(character, nextPlans))
    setCustomAbilityClass(className)
    setLevelUpProficiencies([])
    setSelectedMetamagics(
      character.get("magic")?.metamagic?.metamagics ?? [],
    )
    setSpellModalOpen(false)
    setProficiencyModalOpen(false)
    setMetamagicModalOpen(false)
    setValidationMessage("")
  }

  function addMulticlass(className: ClassName) {
    if (
      mode !== "creation" ||
      classPlans.some((plan) => plan.className === className)
    ) {
      return
    }
    const donor = classPlans.find((plan) => plan.level > 1)
    if (!donor) return
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

  function openAbilityEditor(
    source: AbilitySource,
    className?: ClassName,
    level?: number,
  ) {
    setAbilitySource(source)
    setEditingAbility(null)
    setCustomAbilityClass(className ?? classPlans[0].className)
    setCustomAbilityLevel(level ?? classPlans[0].level)
  }

  function saveCustomAbility(ability: Ability) {
    if (!abilitySource) return
    const entry: ProgressionCustomAbility = {
      ability,
      source: abilitySource,
      className: abilitySource === "class" ? customAbilityClass : undefined,
      classLevel: abilitySource === "class" ? customAbilityLevel : undefined,
    }
    setCustomAbilities((current) => {
      const exists = current.some(
        (candidate) => candidate.ability.id === ability.id,
      )
      return exists
        ? current.map((candidate) =>
            candidate.ability.id === ability.id ? entry : candidate,
          )
        : [...current, entry]
    })
    setAbilitySource(null)
    setEditingAbility(null)
  }

  function toggleCreationSpell(className: ClassName, spell: Spell) {
    const plan = classPlans.find((entry) => entry.className === className)
    if (!plan) return
    const rule = getClassSpellSelectionRule(
      configuredCharacter,
      className,
      plan.level,
      plan.subclassId,
    )
    const current = spellSelections[className] ?? {
      selected: [],
      prepared: [],
    }
    const selected = current.selected.includes(spell.index)

    if (selected) {
      setSpellSelections((all) => ({
        ...all,
        [className]: {
          selected: current.selected.filter((entry) => entry !== spell.index),
          prepared: current.prepared.filter((entry) => entry !== spell.index),
        },
      }))
      return
    }

    const selectedSpells = resolveSpells(current.selected, spells)
    const selectedCount = selectedSpells.filter(
      (entry) => (entry.slotLevel === 0) === (spell.slotLevel === 0),
    ).length
    const limit =
      spell.slotLevel === 0 ? rule.maxCantrips : rule.maxLeveledSpells
    if (selectedCount >= limit) return

    setSpellSelections((all) => ({
      ...all,
      [className]: {
        selected: [...current.selected, spell.index],
        prepared:
          rule.mode === "prepared" && spell.slotLevel > 0
            ? [...current.prepared, spell.index]
            : current.prepared,
      },
    }))
  }

  function toggleCreationPrepared(className: ClassName, spellIndex: string) {
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

  function confirm() {
    if (mode === "creation" && finalTotal !== creationTotal) {
      setValidationMessage(
        `Distribua exatamente ${creationTotal} níveis entre as classes.`,
      )
      setStep("review")
      return
    }
    if (mode === "level-up" && finalTotal !== existingTotal + 1) {
      setValidationMessage(
        "A subida de nível deve adicionar exatamente um nível total.",
      )
      setStep("review")
      return
    }

    const selections: ProgressionSpellSelection[] = classPlans.map((plan) => ({
      className: plan.className,
      spellIndexes: spellSelections[plan.className]?.selected ?? [],
      preparedSpellIndexes: spellSelections[plan.className]?.prepared ?? [],
    }))

    let updated = applyCharacterProgression(character, {
      mode,
      classPlans,
      spellSelections: selections,
      customAbilities,
      spells,
      advancedClassName: mode === "level-up" ? advancedClassName : undefined,
      hpGain: mode === "level-up" ? hpGain : undefined,
    })

    if (mode === "level-up") {
      updated = applyManualProficiencies(updated, levelUpProficiencies)
      if (advancedClassName === "sorcerer" && metamagicLimit > 0) {
        updated = applyLevelUpMetamagics(
          character,
          updated,
          selectedMetamagics,
          metamagicLimit,
        )
      }
    }

    onComplete(updated)
  }

  function goToNextStep() {
    const currentIndex = steps.findIndex((entry) => entry.id === step)
    const next = steps[Math.min(steps.length - 1, currentIndex + 1)]
    if (next) setStep(next.id)
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-textH">
              {mode === "creation"
                ? "Progressão inicial manual"
                : "Subir de nível manualmente"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-textMuted">
              Use sua própria referência. O aplicativo mantém apenas limites estruturais e não sugere características ou subclasses.
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
        <div className="grid gap-4">
          {mode === "level-up" ? (
            <label className="grid gap-1.5 rounded-xl border border-border bg-bg-subtle p-4 text-xs text-text">
              Classe que recebe o nível
              <Select
                value={advancedClassName}
                onChange={(event) =>
                  changeAdvancedClass(event.target.value as ClassName)
                }
              >
                {ALL_CLASS_NAMES.map((className) => {
                  const current = existingClasses.find(
                    (entry) => entry.className === className,
                  )?.level
                  return (
                    <option key={className} value={className}>
                      {getClassProgression(className).label}{" "}
                      {current ? `${current} → ${current + 1}` : "1 (multiclasse)"}
                    </option>
                  )
                })}
              </Select>
            </label>
          ) : (
            <ManualMulticlassControls
              classPlans={classPlans}
              creationTotal={creationTotal}
              onAdd={addMulticlass}
            />
          )}

          {classPlans.map((plan, index) => (
            <article
              key={plan.className}
              className="grid gap-4 rounded-xl border border-border bg-bg p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-textH">
                    {getClassProgression(plan.className).label} {plan.level}
                  </h2>
                  <p className="mt-1 text-xs text-textMuted">
                    {getClassProgression(plan.className).hitDie} ·{" "}
                    {index === 0 ? "classe inicial" : "multiclasse"}
                  </p>
                </div>
                {mode === "creation" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={plan.level <= 1}
                      onClick={() => shiftClassLevel(plan.className, -1)}
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
                      onClick={() => shiftClassLevel(plan.className, 1)}
                    >
                      + nível
                    </Button>
                    {classPlans.length > 1 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMulticlass(plan.className)}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5 text-xs text-text">
                  Subclasse (manual)
                  <Input
                    value={plan.subclassName ?? ""}
                    placeholder="Digite conforme sua referência"
                    onChange={(event) =>
                      updatePlan(plan.className, (current) => ({
                        ...current,
                        subclassName: event.target.value,
                        subclassId: undefined,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-xs text-text">
                  Fonte / livro (opcional)
                  <Input
                    value={plan.subclassSource ?? ""}
                    placeholder="Sua referência"
                    onChange={(event) =>
                      updatePlan(plan.className, (current) => ({
                        ...current,
                        subclassSource: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </article>
          ))}

          {mode === "level-up" ? (
            <section className="rounded-xl border border-border bg-bg-subtle p-4">
              <h2 className="font-semibold text-textH">Pontos de vida</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={hpMode === "average" ? "primary" : "secondary"}
                  onClick={() => setHpMode("average")}
                >
                  Média (+{averageHp})
                </Button>
                <Button
                  size="sm"
                  variant={hpMode === "manual" ? "primary" : "secondary"}
                  onClick={() => setHpMode("manual")}
                >
                  Manual
                </Button>
                <Button
                  size="sm"
                  variant={hpMode === "rolled" ? "primary" : "secondary"}
                  onClick={() => {
                    const sides =
                      Number(advancedProgression.hitDie.slice(1)) || 6
                    setRolledDie(Math.floor(Math.random() * sides) + 1)
                    setHpMode("rolled")
                  }}
                >
                  Rolar {advancedProgression.hitDie}
                </Button>
              </div>
              {hpMode === "manual" ? (
                <Input
                  className="mt-3 max-w-40"
                  type="number"
                  min={1}
                  value={manualHp}
                  onChange={(event) => setManualHp(event.target.value)}
                />
              ) : null}
              <p className="mt-3 text-xs text-textMuted">
                Ganho aplicado: +{hpGain} PV.
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      {step === "features" ? (
        <div className="grid gap-4">
          <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
            Consulte sua referência e cadastre somente as características recebidas neste nível.
          </div>

          {mode === "level-up" ? (
            <section className="rounded-xl border border-border bg-bg-subtle p-4">
              <div>
                <h2 className="font-semibold text-textH">
                  Configurações desta subida
                </h2>
                <p className="mt-1 text-xs text-textMuted">
                  Magias usam os limites estruturais já calculados. Proficiências e metamagias são adicionadas manualmente.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {advancedSpellRule.mode !== "none" ? (
                  <ActionCard
                    title="Magias"
                    description={`${levelUpSpellSelection.selected.length} selecionada(s) · limite de ${advancedSpellRule.maxCantrips} truques e ${advancedSpellRule.maxLeveledSpells} magias`}
                    buttonLabel="Escolher magias"
                    onClick={() => setSpellModalOpen(true)}
                  />
                ) : null}

                <ActionCard
                  title="Proficiências"
                  description={`${levelUpProficiencies.length} adicionada(s)${expertiseCount ? ` · ${expertiseCount} expertise` : ""}`}
                  buttonLabel="Adicionar proficiência"
                  onClick={() => setProficiencyModalOpen(true)}
                />

                {advancedClassName === "sorcerer" && metamagicLimit > 0 ? (
                  <ActionCard
                    title="Metamagias"
                    description={`${selectedMetamagics.length}/${metamagicLimit} selecionadas`}
                    buttonLabel="Escolher metamagias"
                    onClick={() => setMetamagicModalOpen(true)}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {classPlans.map((plan) => {
            const requestedLevel = Math.max(
              mode === "creation" ? 1 : plan.previousLevel + 1,
              Math.min(
                plan.level,
                abilityLevels[plan.className] ?? plan.level,
              ),
            )
            const entries = customAbilities.filter(
              (entry) =>
                entry.source === "class" &&
                entry.className === plan.className,
            )
            return (
              <section
                key={plan.className}
                className="rounded-xl border border-border bg-bg-subtle p-4"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-textH">
                      {getClassProgression(plan.className).label}
                    </h2>
                    <p className="mt-1 text-xs text-textMuted">
                      Nenhuma característica é adicionada automaticamente.
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="grid gap-1 text-[11px] text-textMuted">
                      Nível da classe
                      <Input
                        className="w-24"
                        type="number"
                        min={
                          mode === "creation" ? 1 : plan.previousLevel + 1
                        }
                        max={plan.level}
                        value={requestedLevel}
                        onChange={(event) =>
                          setAbilityLevels((current) => ({
                            ...current,
                            [plan.className]: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <Button
                      size="sm"
                      onClick={() =>
                        openAbilityEditor(
                          "class",
                          plan.className,
                          requestedLevel,
                        )
                      }
                    >
                      Adicionar característica
                    </Button>
                  </div>
                </div>
                <AbilityEntries
                  entries={entries}
                  onEdit={(entry) => {
                    setAbilitySource(entry.source)
                    setEditingAbility(entry.ability)
                    setCustomAbilityClass(entry.className ?? plan.className)
                    setCustomAbilityLevel(entry.classLevel ?? plan.level)
                  }}
                  onRemove={(id) =>
                    setCustomAbilities((current) =>
                      current.filter((entry) => entry.ability.id !== id),
                    )
                  }
                />
              </section>
            )
          })}

          <section className="rounded-xl border border-border bg-bg-subtle p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-textH">
                  Característica racial manual
                </h2>
                <p className="mt-1 text-xs text-textMuted">
                  Use apenas se uma característica racial for liberada neste nível.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openAbilityEditor("race")}
              >
                Adicionar racial
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {step === "spells" && mode === "creation" ? (
        <ManualSpellsStep
          character={configuredCharacter}
          classPlans={classPlans}
          spells={spells}
          selections={spellSelections}
          queries={spellQueries}
          onQueryChange={(className, value) =>
            setSpellQueries((current) => ({
              ...current,
              [className]: value,
            }))
          }
          onToggleSpell={toggleCreationSpell}
          onTogglePrepared={toggleCreationPrepared}
        />
      ) : null}

      {step === "review" ? (
        <div className="grid gap-4">
          <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-4">
            <Summary
              label="Classes"
              value={classPlans
                .map(
                  (plan) =>
                    `${getClassProgression(plan.className).label} ${plan.level}${plan.subclassName?.trim() ? ` — ${plan.subclassName.trim()}` : ""}`,
                )
                .join(" / ")}
            />
            <Summary
              label="Características adicionadas"
              value={String(customAbilities.length)}
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
            {mode === "level-up" ? (
              <>
                <Summary label="PV ganhos" value={`+${hpGain}`} />
                <Summary
                  label="Proficiências adicionadas"
                  value={`${levelUpProficiencies.length}${expertiseCount ? ` (${expertiseCount} expertise)` : ""}`}
                />
                {advancedClassName === "sorcerer" && metamagicLimit > 0 ? (
                  <Summary
                    label="Metamagias"
                    value={`${selectedMetamagics.length}/${metamagicLimit}`}
                  />
                ) : null}
              </>
            ) : null}
          </section>
          <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
            O aplicativo gravará apenas o que você digitou ou selecionou. Nenhuma característica ou subclasse será inferida a partir da classe.
          </div>
          {validationMessage ? (
            <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
              {validationMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        {step !== "review" ? (
          <Button onClick={goToNextStep}>Continuar</Button>
        ) : (
          <Button onClick={confirm}>
            {mode === "creation"
              ? "Confirmar progressão"
              : "Confirmar subida"}
          </Button>
        )}
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

      <LevelUpSpellSelectionModal
        open={mode === "level-up" && spellModalOpen}
        character={configuredCharacter}
        className={advancedClassName}
        previousLevel={previousClassLevel}
        targetLevel={targetClassLevel}
        subclassId={advancedPlan?.subclassId}
        spells={spells}
        selection={levelUpSpellSelection}
        onChange={(selection) =>
          setSpellSelections((current) => ({
            ...current,
            [advancedClassName]: selection,
          }))
        }
        onClose={() => setSpellModalOpen(false)}
      />

      <ProficiencySelectionModal
        open={mode === "level-up" && proficiencyModalOpen}
        proficiencies={levelUpProficiencies}
        onChange={setLevelUpProficiencies}
        onClose={() => setProficiencyModalOpen(false)}
        title="Proficiências desta subida"
      />

      <MetamagicSelectionModal
        open={mode === "level-up" && metamagicModalOpen}
        options={metamagics}
        selected={selectedMetamagics}
        max={metamagicLimit}
        onChange={setSelectedMetamagics}
        onClose={() => setMetamagicModalOpen(false)}
      />
    </section>
  )
}

function ManualMulticlassControls({
  classPlans,
  creationTotal,
  onAdd,
}: {
  classPlans: ProgressionClassPlan[]
  creationTotal: number
  onAdd: (className: ClassName) => void
}) {
  const available = ALL_CLASS_NAMES.filter(
    (className) =>
      !classPlans.some((plan) => plan.className === className),
  )
  const [value, setValue] = useState<ClassName>(available[0] ?? "fighter")
  const selected = available.includes(value) ? value : available[0]

  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1.5 text-xs text-text">
          Adicionar multiclasse
          <Select
            value={selected ?? ""}
            onChange={(event) => setValue(event.target.value as ClassName)}
          >
            {available.map((className) => (
              <option key={className} value={className}>
                {getClassProgression(className).label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="secondary"
          disabled={
            !selected ||
            classPlans.length >= creationTotal ||
            !classPlans.some((plan) => plan.level > 1)
          }
          onClick={() => selected && onAdd(selected)}
        >
          Adicionar classe
        </Button>
      </div>
      <p className="mt-3 text-xs text-textMuted">
        Requisitos de multiclasse não são validados; consulte sua referência.
      </p>
    </section>
  )
}

function ManualSpellsStep({
  character,
  classPlans,
  spells,
  selections,
  queries,
  onQueryChange,
  onToggleSpell,
  onTogglePrepared,
}: {
  character: CharacterTemplate
  classPlans: ProgressionClassPlan[]
  spells: Spell[]
  selections: SpellSelectionState
  queries: Partial<Record<ClassName, string>>
  onQueryChange: (className: ClassName, value: string) => void
  onToggleSpell: (className: ClassName, spell: Spell) => void
  onTogglePrepared: (className: ClassName, spellIndex: string) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
        O aplicativo limita quantidade e nível máximo. Consulte sua referência para verificar quais magias podem ser escolhidas pela classe.
      </div>
      {classPlans.map((plan) => {
        const rule = getClassSpellSelectionRule(
          character,
          plan.className,
          plan.level,
          plan.subclassId,
        )
        if (rule.mode === "none") return null

        const state = selections[plan.className] ?? {
          selected: [],
          prepared: [],
        }
        const selectedSpells = resolveSpells(state.selected, spells)
        const cantrips = selectedSpells.filter(
          (spell) => spell.slotLevel === 0,
        ).length
        const leveled = selectedSpells.filter(
          (spell) => spell.slotLevel > 0,
        ).length
        const query = normalize(queries[plan.className] ?? "")
        const visible = spells
          .filter((spell) =>
            isSpellAllowedForClassSelection(spell, rule, []),
          )
          .filter(
            (spell) =>
              !query ||
              normalize(
                `${spell.displayName ?? ""} ${spell.name} ${spell.school}`,
              ).includes(query),
          )
          .toSorted(
            (left, right) =>
              left.slotLevel - right.slotLevel ||
              spellName(left).localeCompare(spellName(right), "pt-BR"),
          )

        return (
          <section
            key={plan.className}
            className="rounded-xl border border-border bg-bg-subtle p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-textH">
                  {getClassProgression(plan.className).label}
                </h2>
                <p className="mt-1 text-xs text-textMuted">
                  Truques {cantrips}/{rule.maxCantrips} · Magias {leveled}/
                  {rule.maxLeveledSpells} · nível máximo {rule.maxSpellLevel}
                </p>
              </div>
              <Input
                value={queries[plan.className] ?? ""}
                placeholder="Buscar magia no compêndio"
                onChange={(event) =>
                  onQueryChange(plan.className, event.target.value)
                }
              />
            </div>
            <div className="mt-4 grid max-h-[36rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {visible.map((spell) => {
                const selected = state.selected.includes(spell.index)
                const prepared = state.prepared.includes(spell.index)
                return (
                  <article
                    key={spell.index}
                    className={
                      selected
                        ? "rounded-lg border border-accentBorder bg-accentBg p-3"
                        : "rounded-lg border border-border bg-bg p-3"
                    }
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onToggleSpell(plan.className, spell)}
                    >
                      <div className="font-medium text-textH">
                        {spellName(spell)}
                      </div>
                      <div className="mt-1 text-xs text-textMuted">
                        {spell.slotLevel === 0
                          ? "Truque"
                          : `Nível ${spell.slotLevel}`} · {String(spell.school)}
                      </div>
                    </button>
                    {selected &&
                    rule.mode === "spellbook" &&
                    spell.slotLevel > 0 ? (
                      <label className="mt-3 flex items-center gap-2 text-xs text-text">
                        <input
                          type="checkbox"
                          checked={prepared}
                          onChange={() =>
                            onTogglePrepared(plan.className, spell.index)
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

function ActionCard({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string
  description: string
  buttonLabel: string
  onClick: () => void
}) {
  return (
    <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-bg p-3">
      <div>
        <div className="text-sm font-semibold text-textH">{title}</div>
        <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onClick}>
        {buttonLabel}
      </Button>
    </article>
  )
}

function AbilityEntries({
  entries,
  onEdit,
  onRemove,
}: {
  entries: ProgressionCustomAbility[]
  onEdit: (entry: ProgressionCustomAbility) => void
  onRemove: (abilityId: string) => void
}) {
  if (!entries.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
        Nenhuma característica adicionada.
      </div>
    )
  }

  return (
    <div className="mt-4 grid gap-2">
      {entries.map((entry) => (
        <article
          key={entry.ability.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3"
        >
          <div>
            <div className="font-medium text-textH">{entry.ability.name}</div>
            <div className="mt-1 text-xs text-textMuted">
              Nível de classe {entry.classLevel ?? "—"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(entry)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(entry.ability.id)}
            >
              Remover
            </Button>
          </div>
        </article>
      ))}
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
      existing?.subclass?.name,
      existing?.subclass?.source,
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
      entry.subclass?.name,
      entry.subclass?.source,
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
  subclassName?: string,
  subclassSource?: string,
  levelChoices: Record<string, string[]> = {},
): ProgressionClassPlan {
  return {
    className,
    level: Math.max(1, Math.min(20, Math.trunc(level))),
    previousLevel: Math.max(0, Math.min(20, Math.trunc(previousLevel))),
    subclassId,
    subclassName,
    subclassSource,
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
        String(entry.source.sourceId ?? entry.source.name).split(":")[0] ===
          plan.className,
    )
    result[plan.className] = {
      selected: entries.map((entry) => entry.spells.id),
      prepared: entries
        .filter((entry) => entry.spells.prepared)
        .map((entry) => entry.spells.id),
    }
  }
  return result
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
      const name = plan.subclassName?.trim() || existing?.subclass?.name
      return {
        ...createClassEntry(plan.className, plan.level),
        ...existing,
        level: plan.level as never,
        subclass: name
          ? {
              id: plan.subclassId || existing?.subclass?.id || slug(name),
              name,
              source:
                plan.subclassSource?.trim() ||
                existing?.subclass?.source ||
                "Manual",
            }
          : undefined,
        levelChoices: plan.levelChoices,
      }
    }),
  )
}

function applyLevelUpMetamagics(
  previousCharacter: CharacterTemplate,
  character: CharacterTemplate,
  selected: MetamagicId[],
  maximum: number,
): CharacterTemplate {
  const previousPool = getSorceryPointPool(previousCharacter)
  const spent = Math.max(0, previousPool.max - previousPool.current)
  const ensured = character.ensureMagic()
  const magic = ensured.get("magic")
  if (!magic) return ensured

  const nextMaximum = getDerivedSorceryPointMaximum(ensured)
  return ensured.with("magic", {
    ...magic,
    metamagic: {
      ...magic.metamagic,
      metamagics: selected.slice(0, maximum),
      sorceryPoints: {
        max: nextMaximum,
        current: Math.max(0, nextMaximum - spent),
      },
    },
  })
}

function resolveSpells(indexes: string[], spells: Spell[]): Spell[] {
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  return indexes
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
}

function slug(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3 text-xs">
      <span className="text-textMuted">{label}</span>
      <strong className="text-right text-textH">{value}</strong>
    </div>
  )
}
