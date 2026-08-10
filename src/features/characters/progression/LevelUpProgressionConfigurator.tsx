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
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import { applyManualProficiencies } from "../../../models/characters/applyManualProficiencies"
import {
  getDerivedSorceryPointMaximum,
  getSorceryPointPool,
} from "../../../models/characters/characterSorceryPoints"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
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
import { getInvocationLimit } from "../../../rules/InvocationRules"
import { AbilityDialog } from "../abilities/abilityDialog"
import { ProficiencySelectionModal } from "../proficiencies/ProficiencySelectionModal"
import { InvocationSelectionModal } from "./InvocationSelectionModal"
import {
  LevelUpSpellSelectionModal,
  type LevelUpSpellSelection,
  type LevelUpSpellSelectionKind,
} from "./LevelUpSpellSelectionModal"
import { MetamagicSelectionModal } from "./MetamagicSelectionModal"

type Props = {
  character: CharacterTemplate
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

type Step = "class" | "configuration" | "review"
type HpMode = "average" | "manual" | "rolled"
type AbilitySource = "class" | "race"

export function LevelUpProgressionConfigurator({
  character,
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
  const initialClass =
    primaryClassName ?? existingClasses[0]?.className ?? "fighter"

  const [step, setStep] = useState<Step>("class")
  const [advancedClassName, setAdvancedClassName] =
    useState<ClassName>(initialClass)
  const [classPlans, setClassPlans] = useState<ProgressionClassPlan[]>(() =>
    createLevelUpPlans(character, initialClass),
  )
  const [customAbilities, setCustomAbilities] = useState<
    ProgressionCustomAbility[]
  >([])
  const [abilitySource, setAbilitySource] = useState<AbilitySource | null>(null)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [proficiencies, setProficiencies] = useState<Proficiency[]>([])
  const [selectedMetamagics, setSelectedMetamagics] = useState<MetamagicId[]>(
    () => character.get("magic")?.metamagic?.metamagics ?? [],
  )
  const [invocations, setInvocations] = useState<Ability[]>(() =>
    collectExistingInvocations(character),
  )
  const [spellSelections, setSpellSelections] = useState<
    Record<string, LevelUpSpellSelection>
  >(() => createInitialSpellSelections(character))
  const [spellModalKind, setSpellModalKind] =
    useState<LevelUpSpellSelectionKind | null>(null)
  const [proficiencyModalOpen, setProficiencyModalOpen] = useState(false)
  const [metamagicModalOpen, setMetamagicModalOpen] = useState(false)
  const [invocationModalOpen, setInvocationModalOpen] = useState(false)
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
  const learnsSpells =
    currentRule.mode === "limited-known" || currentRule.mode === "spellbook"
  const cantripGain = learnsSpells
    ? Math.max(0, currentRule.maxCantrips - (previousRule?.maxCantrips ?? 0))
    : 0
  const leveledSpellGain = learnsSpells
    ? Math.max(
        0,
        currentRule.maxLeveledSpells -
          (previousRule?.maxLeveledSpells ?? 0),
      )
    : 0
  const invocationLimit =
    advancedClassName === "warlock" ? getInvocationLimit(targetClassLevel) : 0
  const metamagicLimit =
    advancedClassName === "sorcerer"
      ? getMetamagicLimit(targetClassLevel)
      : 0
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
  const expertiseCount = proficiencies.filter((entry) => entry.expertise).length

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

  function changeAdvancedClass(className: ClassName) {
    setAdvancedClassName(className)
    setClassPlans(createLevelUpPlans(character, className))
    setCustomAbilities([])
    setProficiencies([])
    setSelectedMetamagics(
      character.get("magic")?.metamagic?.metamagics ?? [],
    )
    setInvocations(collectExistingInvocations(character))
    setSpellSelections(createInitialSpellSelections(character))
    setSpellModalKind(null)
    setMetamagicModalOpen(false)
    setInvocationModalOpen(false)
    setProficiencyModalOpen(false)
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
    const normalized: ProgressionCustomAbility = {
      ability: {
        ...ability,
        category:
          ability.category === "invocation" ? "general" : ability.category,
      },
      source: abilitySource,
      className: abilitySource === "class" ? advancedClassName : undefined,
      classLevel: abilitySource === "class" ? targetClassLevel : undefined,
    }
    setCustomAbilities((current) => {
      const exists = current.some(
        (entry) => entry.ability.id === normalized.ability.id,
      )
      return exists
        ? current.map((entry) =>
            entry.ability.id === normalized.ability.id ? normalized : entry,
          )
        : [...current, normalized]
    })
    setAbilitySource(null)
    setEditingAbility(null)
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
      spellSelections: learnsSpells ? [spellSelection] : [],
      customAbilities,
      spells,
      advancedClassName,
      hpGain,
      eventId,
      addedAt,
    })
    updated = applyManualProficiencies(updated, proficiencies)

    if (advancedClassName === "sorcerer" && metamagicLimit > 0) {
      updated = applyMetamagics(
        character,
        updated,
        selectedMetamagics,
        metamagicLimit,
      )
    }

    if (advancedClassName === "warlock" && invocationLimit > 0) {
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

      {step === "class" ? (
        <div className="grid gap-4">
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

            <ActionCard
              title="Proficiências"
              value={`${proficiencies.length} adicionada(s)${expertiseCount ? ` · ${expertiseCount} expertise` : ""}`}
              action="Adicionar proficiência"
              onClick={() => setProficiencyModalOpen(true)}
            />

            {cantripGain > 0 ? (
              <ActionCard
                title="Truques"
                value={`${selectedCantrips}/${currentRule.maxCantrips} conhecidos · +${cantripGain} neste nível`}
                action="Aprender truques"
                onClick={() => setSpellModalKind("cantrip")}
              />
            ) : null}

            {leveledSpellGain > 0 ? (
              <ActionCard
                title={currentRule.mode === "spellbook" ? "Grimório" : "Magias"}
                value={`${selectedLeveled}/${currentRule.maxLeveledSpells} · +${leveledSpellGain} neste nível`}
                action={
                  currentRule.mode === "spellbook"
                    ? "Adicionar ao grimório"
                    : "Aprender magias"
                }
                onClick={() => setSpellModalKind("leveled")}
              />
            ) : null}

            {advancedClassName === "sorcerer" && metamagicLimit > 0 ? (
              <ActionCard
                title="Metamagias"
                value={`${selectedMetamagics.length}/${metamagicLimit}`}
                action="Escolher metamagias"
                onClick={() => setMetamagicModalOpen(true)}
              />
            ) : null}

            {advancedClassName === "warlock" && invocationLimit > 0 ? (
              <ActionCard
                title="Evocações"
                value={`${invocations.length}/${invocationLimit}`}
                action="Configurar evocações"
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
          <Summary label={`Características de ${raceName}`} value={String(racialAbilities.length)} />
          <Summary label="Proficiências" value={`${proficiencies.length}${expertiseCount ? ` (${expertiseCount} expertise)` : ""}`} />
          {cantripGain > 0 ? (
            <Summary label="Truques conhecidos" value={`${selectedCantrips}/${currentRule.maxCantrips}`} />
          ) : null}
          {leveledSpellGain > 0 ? (
            <Summary label="Magias aprendidas" value={`${selectedLeveled}/${currentRule.maxLeveledSpells}`} />
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
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        {step === "class" ? (
          <Button onClick={() => setStep("configuration")}>Continuar</Button>
        ) : step === "configuration" ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("class")}>
              Voltar
            </Button>
            <Button onClick={() => setStep("review")}>Continuar</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("configuration")}>
              Voltar
            </Button>
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

      <ProficiencySelectionModal
        open={proficiencyModalOpen}
        proficiencies={proficiencies}
        onChange={setProficiencies}
        onClose={() => setProficiencyModalOpen(false)}
        title={`Proficiências — ${progression.label}`}
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

      <MetamagicSelectionModal
        open={metamagicModalOpen}
        options={metamagics}
        selected={selectedMetamagics}
        max={metamagicLimit}
        onChange={setSelectedMetamagics}
        onClose={() => setMetamagicModalOpen(false)}
      />

      <InvocationSelectionModal
        open={invocationModalOpen}
        invocations={invocations}
        max={invocationLimit}
        onChange={setInvocations}
        onClose={() => setInvocationModalOpen(false)}
      />
    </section>
  )
}

function ConfigurationGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
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
  onClick,
}: {
  title: string
  value: string
  action: string
  onClick: () => void
}) {
  return (
    <article className="flex min-h-28 flex-col justify-between gap-3 rounded-xl border border-border bg-bg p-3">
      <div>
        <div className="text-sm font-semibold text-textH">{title}</div>
        <div className="mt-1 text-xs text-textMuted">{value}</div>
      </div>
      <Button size="sm" variant="secondary" onClick={onClick}>
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
  onRemove: (abilityId: string) => void
}) {
  if (!entries.length) return null
  return (
    <div className="grid gap-2">
      {entries.map((entry) => (
        <article
          key={entry.ability.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg p-3"
        >
          <div>
            <div className="font-medium text-textH">{entry.ability.name}</div>
            {entry.ability.description?.trim() ? (
              <div className="mt-1 line-clamp-2 text-xs text-textMuted">
                {entry.ability.description}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(entry)}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(entry.ability.id)}>
              Remover
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function createLevelUpPlans(
  character: CharacterTemplate,
  advancedClassName: ClassName,
): ProgressionClassPlan[] {
  const existing = character.get("sheet").classes ?? []
  const plans = existing.map((entry) => ({
    className: entry.className,
    level: entry.level + (entry.className === advancedClassName ? 1 : 0),
    previousLevel: entry.level,
    subclassId: entry.subclass?.id,
    subclassName: entry.subclass?.name,
    subclassSource: entry.subclass?.source,
    levelChoices: { ...(entry.levelChoices ?? {}) },
    enabledOptionalFeatureIds: [],
  }))

  if (!plans.some((entry) => entry.className === advancedClassName)) {
    plans.push({
      className: advancedClassName,
      level: 1,
      previousLevel: 0,
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
    plans.map((plan) => {
      const existing = character
        .get("sheet")
        .classes?.find((entry) => entry.className === plan.className)
      const subclassName = plan.subclassName?.trim() || existing?.subclass?.name
      return {
        ...createClassEntry(plan.className, plan.level),
        ...existing,
        level: plan.level as never,
        subclass: subclassName
          ? {
              id: plan.subclassId || existing?.subclass?.id || slug(subclassName),
              name: subclassName,
              source:
                plan.subclassSource?.trim() ||
                existing?.subclass?.source ||
                "Manual",
            }
          : undefined,
      }
    }),
  )
}

function createInitialSpellSelections(
  character: CharacterTemplate,
): Record<string, LevelUpSpellSelection> {
  const result: Record<string, LevelUpSpellSelection> = {}
  const entries = character.get("magic")?.spells.knownSpells ?? []
  for (const classData of character.get("sheet").classes ?? []) {
    const classEntries = entries.filter(
      (entry) =>
        entry.source.type === "class" &&
        String(entry.source.sourceId ?? entry.source.name).split(":")[0] ===
          classData.className,
    )
    result[classData.className] = {
      selected: classEntries.map((entry) => entry.spells.id),
      prepared: classEntries
        .filter((entry) => entry.spells.prepared)
        .map((entry) => entry.spells.id),
    }
  }
  return result
}

function collectExistingInvocations(character: CharacterTemplate): Ability[] {
  const byId = new Map<string, Ability>()
  for (const invocation of character.get("magic")?.invocations ?? []) {
    byId.set(invocation.id, { ...invocation, category: "invocation" })
  }
  for (const ability of character.get("abilities") ?? []) {
    if (ability.category === "invocation") byId.set(ability.id, ability)
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
    (character.get("magic")?.invocations ?? []).map((entry) => [entry.id, entry]),
  )
  const normalized = invocations.slice(0, maximum).map((invocation) => {
    const existing = existingById.get(invocation.id)
    const acquisition =
      invocation.acquisition ??
      existing?.acquisition ??
      createCharacterAcquisition({
        eventId,
        addedAt,
        reason: "level-up",
        characterLevel,
        className: "warlock",
        classLevel,
        sourceType: "class",
        sourceId: "warlock",
        sourceName: getClassProgression("warlock").label,
      })
    return {
      ...invocation,
      category: "invocation" as const,
      source: "class",
      acquisition,
      grantedSpells: invocation.grantedSpells?.map((grant) => ({
        ...grant,
        acquisition:
          grant.acquisition ??
          createCharacterAcquisition({
            ...acquisition,
            sourceType: "ability",
            sourceId: invocation.id,
            sourceName: invocation.name,
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
      invocations: normalized,
    })
}

function applyMetamagics(
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

function getMetamagicLimit(level: number): number {
  if (level < 3) return 0
  if (level < 10) return 2
  if (level < 17) return 3
  return 4
}

function resolveSelectedSpells(indexes: string[], spells: Array<{ index: string; slotLevel: number }>) {
  const byId = new Map(spells.map((spell) => [spell.index, spell]))
  return indexes.flatMap((index) => {
    const spell = byId.get(index)
    return spell ? [spell] : []
  })
}

function getRaceName(character: CharacterTemplate): string {
  const race = character.get("sheet").race
  return (
    race.customName?.trim() ||
    race.subrace?.trim() ||
    String(race.race)
      .split("-")
      .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))
      .join(" ")
  )
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
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
