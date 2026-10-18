import { useMemo, useState, type ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  ALL_CLASS_NAMES,
  getClassProgression,
} from "../../../data/classProgression"
import { formatRaceName } from "../../../lib/raceNames"
import type { Ability } from "../../../models/abilities/Ability"
import {
  getCharacterAsis,
  withCharacterAsis,
  type CharacterAsi,
} from "../../../models/characters/CharacterAsi"
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import {
  applyManualProficiencies,
  mergeProficiencies,
} from "../../../models/characters/applyManualProficiencies"
import {
  getDerivedSorceryPointMaximum,
  getSorceryPointPool,
} from "../../../models/characters/characterSorceryPoints"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import {
  applyCharacterProgression,
  type ProgressionClassPlan,
  type ProgressionCustomAbility,
  type ProgressionSpellSelection,
} from "../../../models/leveling/applyCharacterProgression"
import {
  createClassEntry,
  getClassSpellSelectionRule,
} from "../../../models/leveling/SpellSelectionRules"
import { isAsiLevel } from "../../../rules/AsiRules"
import {
  getInvocationLimit,
  getInvocationReplacementLimit,
} from "../../../rules/InvocationRules"
import {
  getMetamagicLimit,
  getMetamagicReplacementLimit,
} from "../../../rules/MetamagicsRules"
import { AbilityDialog } from "../abilities/abilityDialog"
import { ProficiencySelectionModal } from "../proficiencies/ProficiencySelectionModal"
import { AsiSelectionModal } from "./AsiSelectionModal"
import { FeatureReplacementModal } from "./FeatureReplacementModal"
import { InvocationSelectionModal } from "./InvocationSelectionModal"
import {
  LevelUpSpellSelectionModal,
  type LevelUpSpellSelection,
  type LevelUpSpellSelectionKind,
} from "./LevelUpSpellSelectionModal"
import { MetamagicSelectionModal } from "./MetamagicSelectionModal"
import {
  RacialSpellSelectionModal,
  type RacialSpellSelectionKind,
} from "./RacialSpellSelectionModal"

type Props = {
  character: CharacterTemplate
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

type Step = "class" | "configuration" | "review"
type HpMode = "average" | "manual" | "rolled"
type AbilitySource = "class" | "race"
type ProficiencySource = "class" | "race"
type FeatureReplacementSource = "class" | "race"

export function LevelUpProgressionConfigurator({
  character,
  primaryClassName,
  onCancel,
  onComplete,
}: Props) {
  const { spells, metamagics } = useMagicContext()
  const existingClasses = character.get("sheet").classes ?? []
  const existingTotal = existingClasses.reduce((sum, entry) => sum + entry.level, 0)
  const initialClass =
    primaryClassName ?? existingClasses[0]?.className ?? "fighter"
  const originalMetamagics = character.get("magic")?.metamagic?.metamagics ?? []
  const originalInvocations = collectExistingInvocations(character)

  const [step, setStep] = useState<Step>("class")
  const [advancedClassName, setAdvancedClassName] =
    useState<ClassName>(initialClass)
  const [classPlans, setClassPlans] = useState<ProgressionClassPlan[]>(() =>
    createLevelUpPlans(character, initialClass),
  )
  const [customAbilities, setCustomAbilities] = useState<ProgressionCustomAbility[]>([])
  const [abilitySource, setAbilitySource] = useState<AbilitySource | null>(null)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [classProficiencies, setClassProficiencies] = useState<Proficiency[]>([])
  const [racialProficiencies, setRacialProficiencies] = useState<Proficiency[]>([])
  const [proficiencySource, setProficiencySource] =
    useState<ProficiencySource | null>(null)
  const [selectedMetamagics, setSelectedMetamagics] = useState<MetamagicId[]>(
    () => originalMetamagics,
  )
  const [invocations, setInvocations] = useState<Ability[]>(() =>
    originalInvocations,
  )
  const [spellSelections, setSpellSelections] = useState<
    Record<string, LevelUpSpellSelection>
  >(() => createInitialSpellSelections(character))
  const [spellModalKind, setSpellModalKind] =
    useState<LevelUpSpellSelectionKind | null>(null)
  const [racialSpellModalKind, setRacialSpellModalKind] =
    useState<RacialSpellSelectionKind | null>(null)
  const [racialCantrips, setRacialCantrips] = useState<string[]>([])
  const [racialSpells, setRacialSpells] = useState<string[]>([])
  const [racialCastingAttribute, setRacialCastingAttribute] =
    useState<Attribute>("cha")
  const [metamagicModalOpen, setMetamagicModalOpen] = useState(false)
  const [invocationModalOpen, setInvocationModalOpen] = useState(false)
  const [asiModalOpen, setAsiModalOpen] = useState(false)
  const [asiChoice, setAsiChoice] = useState<CharacterAsi | null>(() =>
    findAsiForLevel(character, initialClass, getTargetClassLevel(character, initialClass)),
  )
  const [featureReplacementSource, setFeatureReplacementSource] =
    useState<FeatureReplacementSource | null>(null)
  const [classFeatureReplacements, setClassFeatureReplacements] = useState<
    Record<string, Ability>
  >({})
  const [racialFeatureReplacements, setRacialFeatureReplacements] = useState<
    Record<string, Ability>
  >({})
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledDie, setRolledDie] = useState<number | null>(null)

  const advancedPlan = classPlans.find(
    (plan) => plan.className === advancedClassName,
  )!
  const configuredCharacter = useMemo(
    () => characterWithPlans(character, classPlans),
    [character, classPlans],
  )
  const targetClassLevel = advancedPlan.level
  const previousClassLevel = advancedPlan.previousLevel
  const progression = getClassProgression(advancedClassName)
  const currentRule = getClassSpellSelectionRule(
    configuredCharacter,
    advancedClassName,
    targetClassLevel,
    advancedPlan.subclassId,
  )
  const previousRule = previousClassLevel
    ? getClassSpellSelectionRule(
        character,
        advancedClassName,
        previousClassLevel,
        advancedPlan.subclassId,
      )
    : undefined
  const learnsLeveledSpells =
    currentRule.mode === "limited-known" || currentRule.mode === "spellbook"
  const cantripGain =
    currentRule.mode === "none"
      ? 0
      : Math.max(
          0,
          currentRule.maxCantrips - (previousRule?.maxCantrips ?? 0),
        )
  const leveledSpellGain = learnsLeveledSpells
    ? Math.max(
        0,
        currentRule.maxLeveledSpells -
          (previousRule?.maxLeveledSpells ?? 0),
      )
    : 0
  const spellReplacementLimit = currentRule.swap.leveledKnown
  const invocationLimit =
    advancedClassName === "warlock" ? getInvocationLimit(targetClassLevel) : 0
  const previousInvocationLimit =
    advancedClassName === "warlock" ? getInvocationLimit(previousClassLevel) : 0
  const invocationGain = Math.max(0, invocationLimit - previousInvocationLimit)
  const invocationReplacementLimit =
    advancedClassName === "warlock"
      ? getInvocationReplacementLimit(targetClassLevel)
      : 0
  const metamagicLimit =
    advancedClassName === "sorcerer"
      ? getMetamagicLimit(targetClassLevel)
      : 0
  const previousMetamagicLimit =
    advancedClassName === "sorcerer"
      ? getMetamagicLimit(previousClassLevel)
      : 0
  const metamagicGain = Math.max(0, metamagicLimit - previousMetamagicLimit)
  const metamagicReplacementLimit =
    advancedClassName === "sorcerer"
      ? getMetamagicReplacementLimit(targetClassLevel)
      : 0
  const asiEligible = isAsiLevel(advancedClassName, targetClassLevel)
  const selection = spellSelections[advancedClassName] ?? {
    selected: [],
    prepared: [],
  }
  const selectedSpellObjects = resolveSelectedSpells(selection.selected, spells)
  const selectedCantrips = selectedSpellObjects.filter(
    (spell) => spell.slotLevel === 0,
  ).length
  const selectedLeveled = selectedSpellObjects.filter(
    (spell) => spell.slotLevel > 0,
  ).length
  const classExpertiseCount = classProficiencies.filter(
    (entry) => entry.expertise,
  ).length
  const racialExpertiseCount = racialProficiencies.filter(
    (entry) => entry.expertise,
  ).length

  const conModifier = configuredCharacter.getAttributeModifier("con")
  const hitDieSides = Number(progression.hitDie.slice(1)) || 6
  const averageDie = Math.floor(hitDieSides / 2) + 1
  const averageHp = Math.max(1, averageDie + conModifier)
  const hpGain =
    hpMode === "manual"
      ? Math.max(1, Math.trunc(Number(manualHp) || 1))
      : hpMode === "rolled"
        ? Math.max(1, (rolledDie ?? averageDie) + conModifier)
        : averageHp

  const raceName = getRaceName(character)
  const classAbilities = customAbilities.filter(
    (entry) => entry.source === "class",
  )
  const racialAbilities = customAbilities.filter(
    (entry) => entry.source === "race",
  )
  const replaceableClassFeatures = getReplaceableClassFeatures(
    character,
    advancedClassName,
  )
  const replaceableRacialFeatures = getReplaceableRacialFeatures(character)
  const canManageLeveledSpells =
    leveledSpellGain > 0 ||
    (spellReplacementLimit > 0 && selectedLeveled > 0)
  const canManageMetamagics =
    metamagicGain > 0 || metamagicReplacementLimit > 0
  const canManageInvocations =
    invocationGain > 0 || invocationReplacementLimit > 0

  function changeAdvancedClass(className: ClassName) {
    const plans = createLevelUpPlans(character, className)
    const nextLevel = plans.find((plan) => plan.className === className)?.level ?? 1
    setAdvancedClassName(className)
    setClassPlans(plans)
    setCustomAbilities([])
    setClassProficiencies([])
    setRacialProficiencies([])
    setSelectedMetamagics(
      character.get("magic")?.metamagic?.metamagics ?? [],
    )
    setInvocations(collectExistingInvocations(character))
    setSpellSelections(createInitialSpellSelections(character))
    setRacialCantrips([])
    setRacialSpells([])
    setAsiChoice(findAsiForLevel(character, className, nextLevel))
    setClassFeatureReplacements({})
    setRacialFeatureReplacements({})
    setFeatureReplacementSource(null)
    setSpellModalKind(null)
    setRacialSpellModalKind(null)
    setMetamagicModalOpen(false)
    setInvocationModalOpen(false)
    setProficiencySource(null)
    setAsiModalOpen(false)
  }

  function updateAdvancedPlan(
    updater: (plan: ProgressionClassPlan) => ProgressionClassPlan,
  ) {
    setClassPlans((current) =>
      current.map((plan) =>
        plan.className === advancedClassName ? updater(plan) : plan,
      ),
    )
  }

  function openAbility(source: AbilitySource, ability: Ability | null = null) {
    setAbilitySource(source)
    setEditingAbility(ability)
  }

  function saveAbility(ability: Ability) {
    if (!abilitySource) return
    const entry: ProgressionCustomAbility = {
      ability: {
        ...ability,
        category: ability.category === "feat" ? "general" : ability.category,
        source: abilitySource,
      },
      source: abilitySource,
      className: abilitySource === "class" ? advancedClassName : undefined,
      classLevel: abilitySource === "class" ? targetClassLevel : undefined,
    }
    setCustomAbilities((current) => {
      const exists = current.some(
        (candidate) => candidate.ability.id === entry.ability.id,
      )
      return exists
        ? current.map((candidate) =>
            candidate.ability.id === entry.ability.id ? entry : candidate,
          )
        : [...current, entry]
    })
    setAbilitySource(null)
    setEditingAbility(null)
  }

  function setFeatureReplacement(
    source: FeatureReplacementSource,
    originalId: string,
    replacement: Ability | null,
  ) {
    const setter =
      source === "class"
        ? setClassFeatureReplacements
        : setRacialFeatureReplacements
    setter((current) => {
      const next = { ...current }
      if (replacement) next[originalId] = replacement
      else delete next[originalId]
      return next
    })
  }

  function confirm() {
    const eventId = crypto.randomUUID()
    const addedAt = new Date().toISOString()
    const spellSelection: ProgressionSpellSelection = {
      className: advancedClassName,
      spellIndexes: selection.selected,
      preparedSpellIndexes: selection.prepared,
    }

    let updated = applyCharacterProgression(character, {
      mode: "level-up",
      classPlans,
      spellSelections: learnsLeveledSpells ? [spellSelection] : [],
      customAbilities,
      spells,
      advancedClassName,
      hpGain,
      eventId,
      addedAt,
    })

    updated = applyFeatureReplacements(
      updated,
      classFeatureReplacements,
      "class",
      eventId,
      addedAt,
      existingTotal + 1,
      advancedClassName,
      targetClassLevel,
      progression.label,
    )
    updated = applyFeatureReplacements(
      updated,
      racialFeatureReplacements,
      "race",
      eventId,
      addedAt,
      existingTotal + 1,
      undefined,
      undefined,
      raceName,
    )

    updated = applyManualProficiencies(updated, classProficiencies)
    updated = applyRacialProficiencies(updated, racialProficiencies)

    if (currentRule.mode === "prepared" && currentRule.maxCantrips > 0) {
      updated = applyPreparedCasterCantrips(
        updated,
        advancedClassName,
        targetClassLevel,
        selection,
        spells,
        eventId,
        addedAt,
        existingTotal + 1,
      )
    }

    if (advancedClassName === "sorcerer") {
      updated = applyMetamagics(
        character,
        updated,
        selectedMetamagics,
        metamagicLimit,
      )
    }

    if (advancedClassName === "warlock") {
      updated = applyInvocations(
        updated,
        invocations,
        invocationLimit,
        eventId,
        addedAt,
        existingTotal + 1,
        targetClassLevel,
      )
    }

    if (asiEligible && asiChoice) {
      updated = applyAsi(
        updated,
        asiChoice,
        eventId,
        addedAt,
        existingTotal + 1,
      )
    }

    updated = applyRacialSpells(
      updated,
      [...racialCantrips, ...racialSpells],
      racialCastingAttribute,
      spells,
      eventId,
      addedAt,
      existingTotal + 1,
      raceName,
    )

    onComplete(updated)
  }

  const steps: Array<{ id: Step; label: string }> = [
    { id: "class", label: "Classe" },
    { id: "configuration", label: "Configuração" },
    { id: "review", label: "Revisão" },
  ]

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="border-b border-border pb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-textH">Subir de nível</h1>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
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

      {step === "class" ? (
        <div className="grid gap-4">
          <label className="grid gap-1.5 rounded-xl border border-border bg-bg-subtle p-4 text-xs text-text">
            Classe que recebe o nível
            <Select
              value={advancedClassName}
              onChange={(event) => changeAdvancedClass(event.target.value as ClassName)}
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

          <section className="grid gap-3 rounded-xl border border-border bg-bg p-4">
            <h2 className="font-semibold text-textH">
              {progression.label} {targetClassLevel}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs text-text">
                Subclasse
                <Input
                  value={advancedPlan.subclassName ?? ""}
                  onChange={(event) =>
                    updateAdvancedPlan((plan) => ({
                      ...plan,
                      subclassName: event.target.value,
                      subclassId: undefined,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-xs text-text">
                Fonte / livro
                <Input
                  value={advancedPlan.subclassSource ?? ""}
                  onChange={(event) =>
                    updateAdvancedPlan((plan) => ({
                      ...plan,
                      subclassSource: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </section>

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
                  setRolledDie(Math.floor(Math.random() * hitDieSides) + 1)
                  setHpMode("rolled")
                }}
              >
                Rolar {progression.hitDie}
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
            <div className="mt-3 text-xs text-textMuted">+{hpGain} PV</div>
          </section>
        </div>
      ) : null}

      {step === "configuration" ? (
        <div className="grid gap-4">
          <ConfigurationGroup title={progression.label}>
            <ActionCard
              title="Características"
              value={`${classAbilities.length} adicionada(s)`}
              action="Adicionar característica"
              onClick={() => openAbility("class")}
            />

            {replaceableClassFeatures.length ? (
              <ActionCard
                title="Substituir característica"
                value={`${Object.keys(classFeatureReplacements).length} substituição(ões)`}
                action="Escolher característica"
                onClick={() => setFeatureReplacementSource("class")}
              />
            ) : null}

            <ActionCard
              title="Proficiências"
              value={`${classProficiencies.length} adicionada(s)${classExpertiseCount ? ` · ${classExpertiseCount} expertise` : ""}`}
              action="Adicionar proficiência"
              onClick={() => setProficiencySource("class")}
            />

            {asiEligible ? (
              <ActionCard
                title="ASI"
                value={formatAsi(asiChoice)}
                action="Configurar ASI"
                onClick={() => setAsiModalOpen(true)}
              />
            ) : null}

            {cantripGain > 0 ? (
              <ActionCard
                title="Truques"
                value={`${selectedCantrips}/${currentRule.maxCantrips} conhecidos · +${cantripGain} neste nível`}
                action="Aprender truques"
                onClick={() => setSpellModalKind("cantrip")}
              />
            ) : null}

            {canManageLeveledSpells ? (
              <ActionCard
                title={currentRule.mode === "spellbook" ? "Grimório" : "Magias"}
                value={formatSpellChangeSummary(
                  selectedLeveled,
                  currentRule.maxLeveledSpells,
                  leveledSpellGain,
                  spellReplacementLimit,
                )}
                action={getSpellActionLabel(
                  currentRule.mode,
                  leveledSpellGain,
                  spellReplacementLimit,
                )}
                onClick={() => setSpellModalKind("leveled")}
              />
            ) : null}

            {advancedClassName === "sorcerer" && metamagicLimit > 0 ? (
              <ActionCard
                title="Metamagias"
                value={formatReplacementSummary(
                  selectedMetamagics.length,
                  metamagicLimit,
                  metamagicGain,
                  metamagicReplacementLimit,
                )}
                action={
                  metamagicGain > 0
                    ? metamagicReplacementLimit > 0
                      ? "Adicionar / substituir metamagia"
                      : "Escolher metamagias"
                    : metamagicReplacementLimit > 0
                      ? "Substituir metamagia"
                      : "Sem alteração neste nível"
                }
                disabled={!canManageMetamagics}
                onClick={() => setMetamagicModalOpen(true)}
              />
            ) : null}

            {advancedClassName === "warlock" && invocationLimit > 0 ? (
              <ActionCard
                title="Evocações"
                value={formatReplacementSummary(
                  invocations.length,
                  invocationLimit,
                  invocationGain,
                  invocationReplacementLimit,
                )}
                action={
                  invocationGain > 0
                    ? invocationReplacementLimit > 0
                      ? "Adicionar / substituir evocação"
                      : "Adicionar evocações"
                    : invocationReplacementLimit > 0
                      ? "Substituir evocação"
                      : "Sem alteração neste nível"
                }
                disabled={!canManageInvocations}
                onClick={() => setInvocationModalOpen(true)}
              />
            ) : null}
          </ConfigurationGroup>

          <AbilityEntries
            entries={classAbilities}
            onEdit={(entry) => openAbility("class", entry.ability)}
            onRemove={(id) =>
              setCustomAbilities((current) =>
                current.filter((entry) => entry.ability.id !== id),
              )
            }
          />

          <ConfigurationGroup title={raceName}>
            <ActionCard
              title="Características"
              value={`${racialAbilities.length} adicionada(s)`}
              action="Adicionar característica"
              onClick={() => openAbility("race")}
            />

            {replaceableRacialFeatures.length ? (
              <ActionCard
                title="Substituir característica"
                value={`${Object.keys(racialFeatureReplacements).length} substituição(ões)`}
                action="Escolher característica"
                onClick={() => setFeatureReplacementSource("race")}
              />
            ) : null}

            <ActionCard
              title="Proficiências"
              value={`${racialProficiencies.length} adicionada(s)${racialExpertiseCount ? ` · ${racialExpertiseCount} expertise` : ""}`}
              action="Adicionar proficiência"
              onClick={() => setProficiencySource("race")}
            />

            <ActionCard
              title="Truques"
              value={`${racialCantrips.length} adicionado(s)`}
              action="Adicionar truques"
              onClick={() => setRacialSpellModalKind("cantrip")}
            />

            <ActionCard
              title="Magias"
              value={`${racialSpells.length} adicionada(s)`}
              action="Adicionar magias"
              onClick={() => setRacialSpellModalKind("leveled")}
            />
          </ConfigurationGroup>

          <AbilityEntries
            entries={racialAbilities}
            onEdit={(entry) => openAbility("race", entry.ability)}
            onRemove={(id) =>
              setCustomAbilities((current) =>
                current.filter((entry) => entry.ability.id !== id),
              )
            }
          />
        </div>
      ) : null}

      {step === "review" ? (
        <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-4">
          <Summary label="Classe" value={`${progression.label} ${targetClassLevel}`} />
          <Summary label="PV" value={`+${hpGain}`} />
          <Summary label="Características de classe" value={String(classAbilities.length)} />
          {Object.keys(classFeatureReplacements).length ? (
            <Summary
              label="Características de classe substituídas"
              value={String(Object.keys(classFeatureReplacements).length)}
            />
          ) : null}
          <Summary label={`Características de ${raceName}`} value={String(racialAbilities.length)} />
          {Object.keys(racialFeatureReplacements).length ? (
            <Summary
              label={`Características de ${raceName} substituídas`}
              value={String(Object.keys(racialFeatureReplacements).length)}
            />
          ) : null}
          <Summary
            label="Proficiências de classe"
            value={`${classProficiencies.length}${classExpertiseCount ? ` (${classExpertiseCount} expertise)` : ""}`}
          />
          <Summary
            label={`Proficiências de ${raceName}`}
            value={`${racialProficiencies.length}${racialExpertiseCount ? ` (${racialExpertiseCount} expertise)` : ""}`}
          />
          {asiEligible ? <Summary label="ASI" value={formatAsi(asiChoice)} /> : null}
          {cantripGain > 0 ? (
            <Summary label="Truques conhecidos" value={`${selectedCantrips}/${currentRule.maxCantrips}`} />
          ) : null}
          {canManageLeveledSpells ? (
            <Summary
              label={currentRule.mode === "spellbook" ? "Magias no grimório" : "Magias conhecidas"}
              value={`${selectedLeveled}/${currentRule.maxLeveledSpells}`}
            />
          ) : null}
          {racialCantrips.length ? (
            <Summary label="Truques raciais adicionados" value={String(racialCantrips.length)} />
          ) : null}
          {racialSpells.length ? (
            <Summary label="Magias raciais adicionadas" value={String(racialSpells.length)} />
          ) : null}
          {advancedClassName === "sorcerer" && metamagicLimit > 0 ? (
            <Summary label="Metamagias" value={`${selectedMetamagics.length}/${metamagicLimit}`} />
          ) : null}
          {advancedClassName === "warlock" && invocationLimit > 0 ? (
            <Summary label="Evocações" value={`${invocations.length}/${invocationLimit}`} />
          ) : null}
        </section>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        {step === "class" ? (
          <Button onClick={() => setStep("configuration")}>Continuar</Button>
        ) : step === "configuration" ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("class")}>Voltar</Button>
            <Button onClick={() => setStep("review")}>Continuar</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("configuration")}>Voltar</Button>
            <Button onClick={confirm}>Confirmar subida</Button>
          </div>
        )}
      </footer>

      <AbilityDialog
        open={abilitySource !== null}
        ability={editingAbility}
        onClose={() => {
          setAbilitySource(null)
          setEditingAbility(null)
        }}
        onSave={saveAbility}
      />

      <FeatureReplacementModal
        open={featureReplacementSource !== null}
        title={
          featureReplacementSource === "race"
            ? `Substituir característica — ${raceName}`
            : `Substituir característica — ${progression.label}`
        }
        features={
          featureReplacementSource === "race"
            ? replaceableRacialFeatures
            : replaceableClassFeatures
        }
        replacements={
          featureReplacementSource === "race"
            ? racialFeatureReplacements
            : classFeatureReplacements
        }
        onReplace={(originalId, replacement) =>
          setFeatureReplacement(
            featureReplacementSource ?? "class",
            originalId,
            replacement,
          )
        }
        onClose={() => setFeatureReplacementSource(null)}
      />

      <ProficiencySelectionModal
        open={proficiencySource !== null}
        proficiencies={
          proficiencySource === "race" ? racialProficiencies : classProficiencies
        }
        onChange={(next) => {
          if (proficiencySource === "race") setRacialProficiencies(next)
          else setClassProficiencies(next)
        }}
        onClose={() => setProficiencySource(null)}
        title={
          proficiencySource === "race"
            ? `Proficiências — ${raceName}`
            : `Proficiências — ${progression.label}`
        }
      />

      <LevelUpSpellSelectionModal
        open={spellModalKind !== null}
        kind={spellModalKind ?? "leveled"}
        character={configuredCharacter}
        className={advancedClassName}
        previousLevel={previousClassLevel}
        targetLevel={targetClassLevel}
        subclassId={advancedPlan.subclassId}
        spells={spells}
        selection={selection}
        onChange={(next) =>
          setSpellSelections((current) => ({
            ...current,
            [advancedClassName]: next,
          }))
        }
        onClose={() => setSpellModalKind(null)}
      />

      <RacialSpellSelectionModal
        open={racialSpellModalKind !== null}
        kind={racialSpellModalKind ?? "leveled"}
        raceName={raceName}
        spells={spells}
        selected={
          racialSpellModalKind === "cantrip" ? racialCantrips : racialSpells
        }
        attribute={racialCastingAttribute}
        onAttributeChange={setRacialCastingAttribute}
        onChange={(next) => {
          if (racialSpellModalKind === "cantrip") setRacialCantrips(next)
          else setRacialSpells(next)
        }}
        onClose={() => setRacialSpellModalKind(null)}
      />

      <MetamagicSelectionModal
        open={metamagicModalOpen}
        options={metamagics}
        selected={selectedMetamagics}
        originalSelected={originalMetamagics}
        max={metamagicLimit}
        replacementLimit={metamagicReplacementLimit}
        onChange={setSelectedMetamagics}
        onClose={() => setMetamagicModalOpen(false)}
      />

      <InvocationSelectionModal
        open={invocationModalOpen}
        invocations={invocations}
        originalInvocations={originalInvocations}
        max={invocationLimit}
        replacementLimit={invocationReplacementLimit}
        onChange={setInvocations}
        onClose={() => setInvocationModalOpen(false)}
      />

      <AsiSelectionModal
        open={asiModalOpen}
        value={asiChoice}
        className={advancedClassName}
        classLevel={targetClassLevel}
        onChange={setAsiChoice}
        onClose={() => setAsiModalOpen(false)}
      />
    </section>
  )
}

function ConfigurationGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <h2 className="text-lg font-semibold text-textH">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

function ActionCard({
  title,
  value,
  action,
  disabled = false,
  onClick,
}: {
  title: string
  value: string
  action: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <article className="flex min-h-28 flex-col justify-between gap-3 rounded-xl border border-border bg-bg p-3">
      <div>
        <div className="text-sm font-semibold text-textH">{title}</div>
        <div className="mt-1 text-xs text-textMuted">{value}</div>
      </div>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={onClick}>
        {action}
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
  onRemove: (id: string) => void
}) {
  if (!entries.length) return null
  return (
    <div className="grid gap-2">
      {entries.map((entry) => (
        <article
          key={entry.ability.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg p-3"
        >
          <div className="min-w-0">
            <div className="font-medium text-textH">{entry.ability.name}</div>
            {entry.ability.description?.trim() ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                {entry.ability.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(entry)}>Editar</Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(entry.ability.id)}>Remover</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-textMuted">{label}</span>
      <strong className="text-right text-textH">{value}</strong>
    </div>
  )
}

function createLevelUpPlans(
  character: CharacterTemplate,
  advancedClassName: ClassName,
): ProgressionClassPlan[] {
  const existing = character.get("sheet").classes ?? []
  const hasClass = existing.some((entry) => entry.className === advancedClassName)
  const plans: ProgressionClassPlan[] = existing.map((entry) => ({
    className: entry.className,
    previousLevel: entry.level,
    level: entry.level + (entry.className === advancedClassName ? 1 : 0),
    subclassId: entry.subclass?.id,
    subclassName: entry.subclass?.name,
    subclassSource: entry.subclass?.source,
    levelChoices: entry.levelChoices ?? {},
    enabledOptionalFeatureIds: [],
  }))

  if (!hasClass) {
    plans.push({
      className: advancedClassName,
      previousLevel: 0,
      level: 1,
      levelChoices: {},
      enabledOptionalFeatureIds: [],
    })
  }
  return plans
}

function characterWithPlans(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  return character.withSheet(
    "classes",
    plans.map((plan) => ({
      ...createClassEntry(plan.className, plan.level),
      subclass: plan.subclassName?.trim()
        ? {
            id: plan.subclassId ?? slug(plan.subclassName),
            name: plan.subclassName,
            source: plan.subclassSource?.trim() || "Manual",
          }
        : undefined,
      levelChoices: plan.levelChoices,
    })),
  )
}

function createInitialSpellSelections(
  character: CharacterTemplate,
): Record<string, LevelUpSpellSelection> {
  const selections: Record<string, LevelUpSpellSelection> = {}
  for (const classEntry of character.get("sheet").classes ?? []) {
    selections[classEntry.className] = { selected: [], prepared: [] }
  }

  for (const entry of character.get("magic")?.spells.knownSpells ?? []) {
    if (entry.source.type !== "class") continue
    const className = resolveSourceClass(entry.source.sourceId, entry.source.name)
    if (!ALL_CLASS_NAMES.includes(className)) continue
    const selection = selections[className] ?? { selected: [], prepared: [] }
    if (!selection.selected.includes(entry.spells.id)) {
      selection.selected.push(entry.spells.id)
    }
    if (entry.spells.prepared && !selection.prepared.includes(entry.spells.id)) {
      selection.prepared.push(entry.spells.id)
    }
    selections[className] = selection
  }
  return selections
}

function resolveSourceClass(sourceId: string | undefined, sourceName: string): ClassName {
  return String(sourceId ?? sourceName).split(":")[0] as ClassName
}

function resolveSelectedSpells(indexes: string[], spells: Spell[]): Spell[] {
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  return indexes
    .map((index) => byIndex.get(index))
    .filter((spell): spell is Spell => Boolean(spell))
}

function applyPreparedCasterCantrips(
  character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
  selection: LevelUpSpellSelection,
  spells: Spell[],
  eventId: string,
  addedAt: string,
  characterLevel: number,
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  const selectedCantrips = selection.selected.filter(
    (index) => byIndex.get(index)?.slotLevel === 0,
  )
  const retained = magic.spells.knownSpells.filter((entry) => {
    if (entry.source.type !== "class") return true
    if (resolveSourceClass(entry.source.sourceId, entry.source.name) !== className) {
      return true
    }
    return byIndex.get(entry.spells.id)?.slotLevel !== 0
  })
  const classEntry = createClassEntry(className, classLevel)
  const acquisition = createCharacterAcquisition({
    eventId,
    addedAt,
    reason: "level-up",
    characterLevel,
    className,
    classLevel,
    sourceType: "class",
    sourceId: className,
    sourceName: getClassProgression(className).label,
  })
  const additions = selectedCantrips.map((index) => ({
    source: {
      type: "class" as const,
      name: className,
      sourceId: className,
      attribute: classEntry.castingAttribute ?? "int",
    },
    spells: { id: index, prepared: true },
    acquisition,
  }))

  return character.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      knownSpells: uniqueKnownSpells([...retained, ...additions]),
    },
  })
}

function applyRacialProficiencies(
  character: CharacterTemplate,
  additions: Proficiency[],
): CharacterTemplate {
  if (!additions.length) return character
  const applied = applyManualProficiencies(character, additions)
  const race = applied.get("sheet").race
  return applied.withSheet("race", {
    ...race,
    proficiencies: mergeProficiencies(race.proficiencies ?? [], additions),
  })
}

function applyRacialSpells(
  character: CharacterTemplate,
  indexes: string[],
  attribute: Attribute,
  spells: Spell[],
  eventId: string,
  addedAt: string,
  characterLevel: number,
  raceName: string,
): CharacterTemplate {
  if (!indexes.length) return character
  const knownIndexes = new Set(spells.map((spell) => spell.index))
  const magic = character.getOrCreateMagic()
  const race = character.get("sheet").race
  const sourceId = `race:${String(race.race)}`
  const acquisition = createCharacterAcquisition({
    eventId,
    addedAt,
    reason: "level-up",
    characterLevel,
    sourceType: "race",
    sourceId,
    sourceName: raceName,
  })
  const additions = indexes
    .filter((index) => knownIndexes.has(index))
    .map((index) => ({
      source: {
        type: "race" as const,
        name: raceName,
        sourceId,
        attribute,
      },
      spells: { id: index, prepared: true },
      acquisition,
    }))

  return character.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      knownSpells: uniqueKnownSpells([
        ...magic.spells.knownSpells,
        ...additions,
      ]),
    },
  })
}

function applyMetamagics(
  previousCharacter: CharacterTemplate,
  character: CharacterTemplate,
  selected: MetamagicId[],
  maxMetamagics: number,
): CharacterTemplate {
  const previousPool = getSorceryPointPool(previousCharacter)
  const spent = Math.max(0, previousPool.max - previousPool.current)
  const magic = character.getOrCreateMagic()
  const maximumPoints = getDerivedSorceryPointMaximum(character)
  return character.with("magic", {
    ...magic,
    metamagic: {
      ...magic.metamagic,
      metamagics: Array.from(new Set(selected)).slice(0, maxMetamagics),
      sorceryPoints: {
        max: maximumPoints,
        current: Math.max(0, maximumPoints - spent),
      },
    },
  })
}

function collectExistingInvocations(character: CharacterTemplate): Ability[] {
  const byId = new Map<string, Ability>()
  for (const ability of character.get("magic")?.invocations ?? []) {
    byId.set(ability.id, { ...ability, category: "invocation" })
  }
  for (const ability of character.get("abilities") ?? []) {
    if (ability.category === "invocation") {
      byId.set(ability.id, { ...ability, category: "invocation" })
    }
  }
  return Array.from(byId.values())
}

function applyInvocations(
  character: CharacterTemplate,
  invocations: Ability[],
  maximum: number,
  eventId: string,
  addedAt: string,
  characterLevel: number,
  classLevel: number,
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  const existingById = new Map(
    collectExistingInvocations(character).map((ability) => [ability.id, ability]),
  )
  const next = invocations.slice(0, maximum).map((ability) => {
    const previous = existingById.get(ability.id)
    const acquisition =
      previous?.acquisition ??
      createCharacterAcquisition({
        eventId,
        addedAt,
        reason: "level-up",
        characterLevel,
        className: "warlock",
        classLevel,
        sourceType: "class",
        sourceId: "warlock:invocation",
        sourceName: "Evocação",
      })
    return {
      ...ability,
      category: "invocation" as const,
      source: "class",
      acquisition,
      grantedSpells: ability.grantedSpells?.map((grant) => ({
        ...grant,
        acquisition:
          grant.acquisition ??
          createCharacterAcquisition({
            ...acquisition,
            sourceType: "ability",
            sourceId: ability.id,
            sourceName: ability.name,
          }),
      })),
    }
  })

  return character
    .with(
      "abilities",
      (character.get("abilities") ?? []).filter(
        (ability) => ability.category !== "invocation",
      ),
    )
    .with("magic", {
      ...magic,
      invocations: next,
    })
}

function applyAsi(
  character: CharacterTemplate,
  choice: CharacterAsi,
  eventId: string,
  addedAt: string,
  characterLevel: number,
): CharacterTemplate {
  const existingAsis = getCharacterAsis(character)
  const previous = existingAsis.find(
    (entry) =>
      entry.className === choice.className &&
      entry.classLevel === choice.classLevel,
  )

  const acquisition =
    previous?.acquisition ??
    createCharacterAcquisition({
      eventId,
      addedAt,
      reason: "level-up",
      characterLevel,
      className: choice.className,
      classLevel: choice.classLevel,
      sourceType: "class",
      sourceId: `${choice.className}:asi:${choice.classLevel}`,
      sourceName: `${getClassProgression(choice.className).label} — ASI`,
    })
  const featAcquisition = choice.ability
    ? choice.ability.acquisition ??
      createCharacterAcquisition({
        ...acquisition,
        sourceType: "feat",
        sourceId: choice.id,
        sourceName: choice.ability.name,
      })
    : undefined
  const normalizedChoice: CharacterAsi = {
    ...choice,
    acquisition,
    ability: choice.ability
      ? {
          ...choice.ability,
          category: "feat",
          source: "asi",
          acquisition: featAcquisition,
          grantedSpells: choice.ability.grantedSpells?.map((grant) => ({
            ...grant,
            acquisition:
              grant.acquisition ??
              (featAcquisition
                ? createCharacterAcquisition({
                    ...featAcquisition,
                    sourceType: "ability",
                    sourceId: choice.ability!.id,
                    sourceName: choice.ability!.name,
                  })
                : undefined),
          })),
        }
      : undefined,
  }
  const nextAsis = [
    ...existingAsis.filter(
      (entry) =>
        !(
          entry.className === choice.className &&
          entry.classLevel === choice.classLevel
        ),
    ),
    normalizedChoice,
  ]

  return withCharacterAsis(character, nextAsis)
}

function applyFeatureReplacements(
  character: CharacterTemplate,
  replacements: Record<string, Ability>,
  source: FeatureReplacementSource,
  eventId: string,
  addedAt: string,
  characterLevel: number,
  className: ClassName | undefined,
  classLevel: number | undefined,
  sourceName: string,
): CharacterTemplate {
  if (!Object.keys(replacements).length) return character

  const stampReplacement = (originalId: string, replacement: Ability): Ability => {
    const acquisition = createCharacterAcquisition({
      eventId,
      addedAt,
      reason: "level-up",
      characterLevel,
      className,
      classLevel,
      sourceType: source,
      sourceId: source === "class" ? className : String(character.get("sheet").race.race),
      sourceName,
      notes: `Substitui a característica ${originalId}`,
    })

    return {
      ...replacement,
      source,
      category:
        replacement.category === "feat" || replacement.category === "invocation"
          ? "general"
          : replacement.category,
      originalAbilityId: originalId,
      acquisition,
      grantedSpells: replacement.grantedSpells?.map((grant) => ({
        ...grant,
        acquisition:
          grant.acquisition ??
          createCharacterAcquisition({
            ...acquisition,
            sourceType: "ability",
            sourceId: replacement.id,
            sourceName: replacement.name,
          }),
      })),
    }
  }

  if (source === "race") {
    const race = character.get("sheet").race
    return character.withSheet("race", {
      ...race,
      naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
        const replacement = replacements[ability.id]
        return replacement ? stampReplacement(ability.id, replacement) : ability
      }),
    })
  }

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) => {
      const replacement = replacements[ability.id]
      return replacement ? stampReplacement(ability.id, replacement) : ability
    }),
  )
}

function getReplaceableClassFeatures(
  character: CharacterTemplate,
  className: ClassName,
): Ability[] {
  return (character.get("abilities") ?? []).filter((ability) => {
    if (ability.category === "feat" || ability.category === "invocation") return false
    if (ability.source === "equipment" || ability.source === "race") return false

    if (ability.acquisition?.sourceType === "class") {
      return !ability.acquisition.className || ability.acquisition.className === className
    }

    return ability.source === "class"
  })
}

function getReplaceableRacialFeatures(character: CharacterTemplate): Ability[] {
  return (character.get("sheet").race.naturalAbilities ?? []).filter(
    (ability) => ability.category !== "feat" && ability.category !== "invocation",
  )
}

function findAsiForLevel(
  character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
): CharacterAsi | null {
  return (
    getCharacterAsis(character).find(
      (entry) =>
        entry.className === className && entry.classLevel === classLevel,
    ) ?? null
  )
}

function formatAsi(asi: CharacterAsi | null): string {
  if (!asi) return "Não configurado"
  if (asi.kind === "feat") return asi.ability?.name ?? "Talento"
  if (asi.kind === "half-feat") {
    return `${asi.ability?.name ?? "Meio talento"} · ${formatIncreases(asi.increases)}`
  }
  return formatIncreases(asi.increases)
}

function formatIncreases(
  increases: Partial<Record<Attribute, number>>,
): string {
  const labels: Record<Attribute, string> = {
    str: "FOR",
    dex: "DES",
    con: "CON",
    int: "INT",
    wis: "SAB",
    cha: "CAR",
  }
  const parts = ATTRIBUTE_KEYS
    .filter((attribute) => (increases[attribute] ?? 0) > 0)
    .map((attribute) => `+${increases[attribute]} ${labels[attribute]}`)
  return parts.join(" / ") || "Talento"
}

function formatSpellChangeSummary(
  current: number,
  maximum: number,
  gained: number,
  replacementLimit: number,
): string {
  const parts = [`${current}/${maximum}`]
  if (gained > 0) parts.push(`+${gained} neste nível`)
  if (replacementLimit > 0) parts.push(`até ${replacementLimit} substituição`)
  return parts.join(" · ")
}

function formatReplacementSummary(
  current: number,
  maximum: number,
  gained: number,
  replacementLimit: number,
): string {
  const parts = [`${current}/${maximum}`]
  if (gained > 0) parts.push(`+${gained} de capacidade`)
  if (replacementLimit > 0) parts.push(`${replacementLimit} substituição disponível`)
  return parts.join(" · ")
}

function getSpellActionLabel(
  mode: ReturnType<typeof getClassSpellSelectionRule>["mode"],
  gained: number,
  replacementLimit: number,
): string {
  if (mode === "spellbook") return "Adicionar ao grimório"
  if (gained > 0 && replacementLimit > 0) return "Aprender / substituir magias"
  if (gained > 0) return "Aprender magias"
  return "Substituir magia"
}

function getRaceName(character: CharacterTemplate): string {
  const race = character.get("sheet").race
  return (
    race.customName?.trim() ||
    race.subrace?.trim() ||
    formatRaceName(race.race)
  )
}

function getTargetClassLevel(
  character: CharacterTemplate,
  className: ClassName,
): number {
  return (
    character.get("sheet").classes?.find((entry) => entry.className === className)
      ?.level ?? 0
  ) + 1
}

function uniqueKnownSpells<
  T extends {
    spells: { id: string }
    source: { type: string; sourceId?: string }
  },
>(entries: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const entry of entries) {
    const key = `${entry.source.type}:${entry.source.sourceId ?? ""}:${entry.spells.id}`
    byKey.set(key, entry)
  }
  return Array.from(byKey.values())
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}