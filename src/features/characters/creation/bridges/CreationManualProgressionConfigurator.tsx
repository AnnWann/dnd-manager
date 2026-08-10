import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { useMagicContext } from "../../../../contexts/magicContext"
import {
  ALL_CLASS_NAMES,
  getClassProgression,
} from "../../../../data/classProgression"
import {
  PHB_RACE_PRESETS,
  type RacePreset,
} from "../../../../data/characterCreation/phbPresets"
import { formatSigned } from "../../../../lib/formatSigned"
import { newCharacterTemplate } from "../../../../lib/newCharacterTemplate"
import type { Ability } from "../../../../models/abilities/Ability"
import type { CharacterAsi } from "../../../../models/characters/CharacterAsi"
import type { MetamagicId } from "../../../../models/magic/metamagic/Metamagic"
import type { Attribute } from "../../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../../models/sheet/Attribute"
import type { ClassName } from "../../../../models/sheet/Class"
import type { Proficiency } from "../../../../models/sheet/Proficiency"
import { getClassSpellSelectionRule } from "../../../../models/leveling/SpellSelectionRules"
import { isAsiLevel } from "../../../../rules/AsiRules"
import { getInvocationLimit } from "../../../../rules/InvocationRules"
import { getMetamagicLimit } from "../../../../rules/MetamagicsRules"
import { AbilityDialog } from "../../abilities/abilityDialog"
import { ProficiencySelectionModal } from "../../proficiencies/ProficiencySelectionModal"
import { AsiSelectionModal } from "../../progression/AsiSelectionModal"
import { InvocationSelectionModal } from "../../progression/InvocationSelectionModal"
import {
  LevelUpSpellSelectionModal,
  type LevelUpSpellSelection,
  type LevelUpSpellSelectionKind,
} from "../../progression/LevelUpSpellSelectionModal"
import { MetamagicSelectionModal } from "../../progression/MetamagicSelectionModal"
import {
  RacialSpellSelectionModal,
  type RacialSpellSelectionKind,
} from "../../progression/RacialSpellSelectionModal"
import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

const CREATION_OWNER = {
  id: "character-creation",
  name: "Criação de personagem",
  role: "player" as const,
}

const DRAFT_CHARACTER = newCharacterTemplate(
  "__manual_creation_progression__",
  CREATION_OWNER,
)

export type CreationClassConfiguration = {
  level: number
  subclassName: string
  subclassSource: string
  proficiencies: Proficiency[]
  abilities: Ability[]
  spellSelection: LevelUpSpellSelection
  metamagics: MetamagicId[]
  invocations: Ability[]
  asis: CharacterAsi[]
}

export type CreationRaceConfiguration = {
  abilities: Ability[]
  proficiencies: Proficiency[]
  cantrips: string[]
  spells: string[]
  castingAttribute: Attribute
}

type ClassMount = {
  className: ClassName
  level: number
  element: HTMLElement
}

type Props = {
  open: boolean
  classConfigurations: Partial<Record<ClassName, CreationClassConfiguration>>
  onClassChange: (
    className: ClassName,
    configuration: CreationClassConfiguration,
  ) => void
  raceConfiguration: CreationRaceConfiguration
  onRaceChange: (configuration: CreationRaceConfiguration) => void
  selectedRacePresetId: string
  onRacePresetChange: (presetId: string) => void
}

export function CreationManualProgressionConfigurator({
  open,
  classConfigurations,
  onClassChange,
  raceConfiguration,
  onRaceChange,
  selectedRacePresetId,
  onRacePresetChange,
}: Props) {
  const { spells, metamagics } = useMagicContext()
  const [classMounts, setClassMounts] = useState<ClassMount[]>([])
  const [raceConfigurationMount, setRaceConfigurationMount] =
    useState<HTMLElement | null>(null)
  const [racePresetBenefitsMount, setRacePresetBenefitsMount] =
    useState<HTMLElement | null>(null)
  const [abilityEditor, setAbilityEditor] = useState<
    | { source: "class"; className: ClassName; ability: Ability | null }
    | { source: "race"; ability: Ability | null }
    | null
  >(null)
  const [proficiencyEditor, setProficiencyEditor] = useState<
    { source: "class"; className: ClassName } | { source: "race" } | null
  >(null)
  const [spellEditor, setSpellEditor] = useState<
    { className: ClassName; kind: LevelUpSpellSelectionKind } | null
  >(null)
  const [racialSpellEditor, setRacialSpellEditor] =
    useState<RacialSpellSelectionKind | null>(null)
  const [metamagicEditor, setMetamagicEditor] = useState<ClassName | null>(null)
  const [invocationEditor, setInvocationEditor] = useState<ClassName | null>(null)
  const [asiEditor, setAsiEditor] = useState<
    { className: ClassName; classLevel: number } | null
  >(null)

  useEffect(() => {
    if (!open) {
      setClassMounts([])
      setRaceConfigurationMount(null)
      setRacePresetBenefitsMount(null)
      return
    }

    let frame = 0
    let observer: MutationObserver | undefined

    const sync = () => {
      const root = findCharacterCreationRoot()
      const main = root?.querySelector<HTMLElement>("main")
      if (!main) {
        setClassMounts([])
        setRaceConfigurationMount(null)
        setRacePresetBenefitsMount(null)
        return
      }

      const nextClassMounts: ClassMount[] = []
      for (const section of Array.from(main.querySelectorAll<HTMLElement>("section"))) {
        const heading = section.querySelector<HTMLElement>(
          ":scope > div h2, :scope > h2",
        )
        const resolved = resolveClassHeading(heading?.textContent ?? "")
        if (!resolved) continue

        const header = section.querySelector<HTMLElement>(":scope > div")
        if (!header) continue

        let mount = section.querySelector<HTMLElement>(
          `:scope > [data-manual-creation-class="${resolved.className}"]`,
        )
        if (!mount) {
          mount = document.createElement("div")
          mount.dataset.manualCreationClass = resolved.className
          header.insertAdjacentElement("afterend", mount)
        }

        for (const child of Array.from(section.children)) {
          if (!(child instanceof HTMLElement)) continue
          if (child === header || child === mount) continue
          if (!child.dataset.manualCreationPreviousDisplay) {
            child.dataset.manualCreationPreviousDisplay = child.style.display || "__empty__"
          }
          child.style.display = "none"
        }

        nextClassMounts.push({ ...resolved, element: mount })
      }
      setClassMounts(nextClassMounts)

      const raceHeading = Array.from(main.querySelectorAll<HTMLElement>("h2")).find(
        (entry) => entry.textContent?.trim() === "Construir características raciais",
      )
      const raceSection = raceHeading?.closest<HTMLElement>("section")
      if (raceSection) {
        const directChildren = Array.from(raceSection.children).filter(
          (entry): entry is HTMLElement => entry instanceof HTMLElement,
        )
        const editableChildren = directChildren.filter(
          (entry) =>
            /características raciais|proficiências raciais/i.test(
              entry.textContent ?? "",
            ),
        )
        editableChildren.forEach((entry) => {
          if (!entry.dataset.manualCreationPreviousDisplay) {
            entry.dataset.manualCreationPreviousDisplay = entry.style.display || "__empty__"
          }
          entry.style.display = "none"
        })

        let mount = raceSection.querySelector<HTMLElement>(
          ':scope > [data-manual-creation-race="true"]',
        )
        if (!mount) {
          mount = document.createElement("div")
          mount.dataset.manualCreationRace = "true"
          raceSection.append(mount)
        }
        setRaceConfigurationMount(mount)
      } else {
        setRaceConfigurationMount(null)
      }

      const racePresetHeading = Array.from(main.querySelectorAll<HTMLElement>("h2")).find(
        (entry) => entry.textContent?.trim() === "Raça",
      )
      const racePresetSection = racePresetHeading?.closest<HTMLElement>("section")
      if (racePresetSection) {
        let mount = racePresetSection.querySelector<HTMLElement>(
          ':scope > [data-race-preset-benefits="true"]',
        )
        if (!mount) {
          mount = document.createElement("div")
          mount.dataset.racePresetBenefits = "true"
          racePresetSection.append(mount)
        }
        setRacePresetBenefitsMount(mount)

        for (const button of Array.from(
          racePresetSection.querySelectorAll<HTMLButtonElement>("button"),
        )) {
          if (button.dataset.manualRacePresetListener === "true") continue
          const text = button.textContent?.trim() ?? ""
          const preset = PHB_RACE_PRESETS.find((entry) =>
            text.startsWith(entry.name),
          )
          const custom = text.startsWith("Personalizada")
          if (!preset && !custom) continue

          button.dataset.manualRacePresetListener = "true"
          button.addEventListener("click", () =>
            onRacePresetChange(preset?.id ?? "custom"),
          )
        }
      } else {
        setRacePresetBenefitsMount(null)
      }
    }

    frame = window.requestAnimationFrame(() => {
      sync()
      const root = findCharacterCreationRoot()
      if (!root) return
      observer = new MutationObserver(sync)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      const root = findCharacterCreationRoot()
      root
        ?.querySelectorAll<HTMLElement>("[data-manual-creation-previous-display]")
        .forEach((entry) => {
          const previous = entry.dataset.manualCreationPreviousDisplay
          entry.style.display = previous === "__empty__" ? "" : previous ?? ""
          delete entry.dataset.manualCreationPreviousDisplay
        })
      root?.querySelectorAll("[data-manual-creation-class]").forEach((entry) => entry.remove())
      root?.querySelectorAll('[data-manual-creation-race="true"]').forEach((entry) => entry.remove())
      root?.querySelectorAll('[data-race-preset-benefits="true"]').forEach((entry) => entry.remove())
      setClassMounts([])
      setRaceConfigurationMount(null)
      setRacePresetBenefitsMount(null)
    }
  }, [onRacePresetChange, open])

  useEffect(() => {
    for (const mount of classMounts) {
      const current = classConfigurations[mount.className]
      const normalized = normalizeClassConfiguration(
        current ?? createEmptyClassConfiguration(mount.level),
        mount.level,
        spells,
        mount.className,
      )
      if (!sameClassConfiguration(current, normalized)) {
        onClassChange(mount.className, normalized)
      }
    }
  }, [classConfigurations, classMounts, onClassChange, spells])

  const selectedPreset = useMemo(
    () => PHB_RACE_PRESETS.find((entry) => entry.id === selectedRacePresetId),
    [selectedRacePresetId],
  )

  function updateClass(
    className: ClassName,
    updater: (current: CreationClassConfiguration) => CreationClassConfiguration,
  ) {
    const level =
      classMounts.find((entry) => entry.className === className)?.level ??
      classConfigurations[className]?.level ??
      1
    const current =
      classConfigurations[className] ?? createEmptyClassConfiguration(level)
    onClassChange(
      className,
      normalizeClassConfiguration(updater(current), level, spells, className),
    )
  }

  function saveAbility(ability: Ability) {
    if (!abilityEditor) return
    if (abilityEditor.source === "race") {
      const next: Ability = { ...ability, source: "race" }
      onRaceChange({
        ...raceConfiguration,
        abilities: upsertAbility(raceConfiguration.abilities, next),
      })
    } else {
      const next: Ability = { ...ability, source: "class" }
      updateClass(abilityEditor.className, (current) => ({
        ...current,
        abilities: upsertAbility(current.abilities, next),
      }))
    }
    setAbilityEditor(null)
  }

  return (
    <>
      {classMounts.map(({ className, level, element }) => {
        const configuration =
          classConfigurations[className] ?? createEmptyClassConfiguration(level)
        const progression = getClassProgression(className)
        const rule = getClassSpellSelectionRule(
          DRAFT_CHARACTER,
          className,
          level,
          undefined,
        )
        const selectedSpellObjects = configuration.spellSelection.selected
          .map((index) => spells.find((spell) => spell.index === index))
          .filter(Boolean)
        const cantrips = selectedSpellObjects.filter(
          (spell) => spell?.slotLevel === 0,
        ).length
        const leveled = selectedSpellObjects.filter(
          (spell) => (spell?.slotLevel ?? 0) > 0,
        ).length
        const asiLevels = getAsiLevels(className, level)
        const metamagicLimit =
          className === "sorcerer" ? getMetamagicLimit(level) : 0
        const invocationLimit =
          className === "warlock" ? getInvocationLimit(level) : 0

        return createPortal(
          <section className="mt-4 grid gap-4 rounded-xl border border-border bg-bg p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs text-text">
                Subclasse
                <Input
                  value={configuration.subclassName}
                  placeholder="Digite conforme sua referência"
                  onChange={(event) =>
                    updateClass(className, (current) => ({
                      ...current,
                      subclassName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-xs text-text">
                Fonte / livro
                <Input
                  value={configuration.subclassSource}
                  placeholder="Sua referência"
                  onChange={(event) =>
                    updateClass(className, (current) => ({
                      ...current,
                      subclassSource: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <ConfigurationGroup title={progression.label}>
              <ActionCard
                title="Características"
                value={`${configuration.abilities.length} adicionada(s)`}
                action="Adicionar característica"
                onClick={() =>
                  setAbilityEditor({ source: "class", className, ability: null })
                }
              />

              <ActionCard
                title="Proficiências"
                value={formatProficiencyCount(configuration.proficiencies)}
                action="Adicionar proficiência"
                onClick={() =>
                  setProficiencyEditor({ source: "class", className })
                }
              />

              {rule.maxCantrips > 0 ? (
                <ActionCard
                  title="Truques"
                  value={`${cantrips}/${rule.maxCantrips} conhecidos`}
                  action="Escolher truques"
                  onClick={() => setSpellEditor({ className, kind: "cantrip" })}
                />
              ) : null}

              {(rule.mode === "limited-known" || rule.mode === "spellbook") &&
              rule.maxLeveledSpells > 0 ? (
                <ActionCard
                  title={rule.mode === "spellbook" ? "Grimório" : "Magias"}
                  value={`${leveled}/${rule.maxLeveledSpells}`}
                  action={
                    rule.mode === "spellbook"
                      ? "Adicionar ao grimório"
                      : "Escolher magias"
                  }
                  onClick={() => setSpellEditor({ className, kind: "leveled" })}
                />
              ) : null}

              {metamagicLimit > 0 ? (
                <ActionCard
                  title="Metamagias"
                  value={`${configuration.metamagics.length}/${metamagicLimit}`}
                  action="Escolher metamagias"
                  onClick={() => setMetamagicEditor(className)}
                />
              ) : null}

              {invocationLimit > 0 ? (
                <ActionCard
                  title="Evocações"
                  value={`${configuration.invocations.length}/${invocationLimit}`}
                  action="Configurar evocações"
                  onClick={() => setInvocationEditor(className)}
                />
              ) : null}

              {asiLevels.length ? (
                <article className="flex min-h-28 flex-col justify-between gap-3 rounded-xl border border-border bg-bg-subtle p-3">
                  <div>
                    <div className="text-sm font-semibold text-textH">ASI</div>
                    <div className="mt-1 text-xs text-textMuted">
                      {configuration.asis.length}/{asiLevels.length} configurado(s)
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {asiLevels.map((classLevel) => {
                      const configured = configuration.asis.some(
                        (entry) => entry.classLevel === classLevel,
                      )
                      return (
                        <Button
                          key={classLevel}
                          size="sm"
                          variant={configured ? "primary" : "secondary"}
                          onClick={() => setAsiEditor({ className, classLevel })}
                        >
                          Nível {classLevel}
                        </Button>
                      )
                    })}
                  </div>
                </article>
              ) : null}
            </ConfigurationGroup>

            <AbilityEntries
              abilities={configuration.abilities}
              onEdit={(ability) =>
                setAbilityEditor({ source: "class", className, ability })
              }
              onRemove={(abilityId) =>
                updateClass(className, (current) => ({
                  ...current,
                  abilities: current.abilities.filter(
                    (ability) => ability.id !== abilityId,
                  ),
                }))
              }
            />
          </section>,
          element,
          `manual-class-${className}`,
        )
      })}

      {racePresetBenefitsMount
        ? createPortal(
            <RacePresetBenefits preset={selectedPreset} />,
            racePresetBenefitsMount,
          )
        : null}

      {raceConfigurationMount
        ? createPortal(
            <section className="mt-4 grid gap-4 rounded-xl border border-border bg-bg p-4">
              <ConfigurationGroup
                title={selectedPreset?.name ?? "Raça personalizada"}
              >
                <ActionCard
                  title="Características"
                  value={`${raceConfiguration.abilities.length} configurada(s)`}
                  action="Adicionar característica"
                  onClick={() => setAbilityEditor({ source: "race", ability: null })}
                />
                <ActionCard
                  title="Proficiências"
                  value={formatProficiencyCount(raceConfiguration.proficiencies)}
                  action="Adicionar proficiência"
                  onClick={() => setProficiencyEditor({ source: "race" })}
                />
                <ActionCard
                  title="Truques"
                  value={`${raceConfiguration.cantrips.length} adicionado(s)`}
                  action="Adicionar truques"
                  onClick={() => setRacialSpellEditor("cantrip")}
                />
                <ActionCard
                  title="Magias"
                  value={`${raceConfiguration.spells.length} adicionada(s)`}
                  action="Adicionar magias"
                  onClick={() => setRacialSpellEditor("leveled")}
                />
              </ConfigurationGroup>

              <AbilityEntries
                abilities={raceConfiguration.abilities}
                onEdit={(ability) =>
                  setAbilityEditor({ source: "race", ability })
                }
                onRemove={(abilityId) =>
                  onRaceChange({
                    ...raceConfiguration,
                    abilities: raceConfiguration.abilities.filter(
                      (ability) => ability.id !== abilityId,
                    ),
                  })
                }
              />
            </section>,
            raceConfigurationMount,
          )
        : null}

      <AbilityDialog
        open={abilityEditor !== null}
        ability={abilityEditor?.ability ?? null}
        onClose={() => setAbilityEditor(null)}
        onSave={saveAbility}
      />

      <ProficiencySelectionModal
        open={proficiencyEditor !== null}
        proficiencies={
          proficiencyEditor?.source === "race"
            ? raceConfiguration.proficiencies
            : proficiencyEditor?.source === "class"
              ? classConfigurations[proficiencyEditor.className]?.proficiencies ?? []
              : []
        }
        onChange={(next) => {
          if (proficiencyEditor?.source === "race") {
            onRaceChange({ ...raceConfiguration, proficiencies: next })
          } else if (proficiencyEditor?.source === "class") {
            updateClass(proficiencyEditor.className, (current) => ({
              ...current,
              proficiencies: next,
            }))
          }
        }}
        onClose={() => setProficiencyEditor(null)}
        title={
          proficiencyEditor?.source === "race"
            ? "Proficiências raciais"
            : proficiencyEditor?.source === "class"
              ? `Proficiências — ${getClassProgression(proficiencyEditor.className).label}`
              : "Proficiências"
        }
      />

      {spellEditor ? (
        <LevelUpSpellSelectionModal
          open
          kind={spellEditor.kind}
          character={DRAFT_CHARACTER}
          className={spellEditor.className}
          previousLevel={0}
          targetLevel={classConfigurations[spellEditor.className]?.level ?? 1}
          spells={spells}
          selection={
            classConfigurations[spellEditor.className]?.spellSelection ?? {
              selected: [],
              prepared: [],
            }
          }
          onChange={(next) =>
            updateClass(spellEditor.className, (current) => ({
              ...current,
              spellSelection: next,
            }))
          }
          onClose={() => setSpellEditor(null)}
        />
      ) : null}

      <RacialSpellSelectionModal
        open={racialSpellEditor !== null}
        kind={racialSpellEditor ?? "leveled"}
        raceName={selectedPreset?.name ?? "Raça personalizada"}
        spells={spells}
        selected={
          racialSpellEditor === "cantrip"
            ? raceConfiguration.cantrips
            : raceConfiguration.spells
        }
        attribute={raceConfiguration.castingAttribute}
        onAttributeChange={(castingAttribute) =>
          onRaceChange({ ...raceConfiguration, castingAttribute })
        }
        onChange={(next) =>
          onRaceChange(
            racialSpellEditor === "cantrip"
              ? { ...raceConfiguration, cantrips: next }
              : { ...raceConfiguration, spells: next },
          )
        }
        onClose={() => setRacialSpellEditor(null)}
      />

      {metamagicEditor ? (
        <MetamagicSelectionModal
          open
          options={metamagics}
          selected={classConfigurations[metamagicEditor]?.metamagics ?? []}
          originalSelected={[]}
          max={getMetamagicLimit(
            classConfigurations[metamagicEditor]?.level ?? 1,
          )}
          replacementLimit={0}
          onChange={(next) =>
            updateClass(metamagicEditor, (current) => ({
              ...current,
              metamagics: next,
            }))
          }
          onClose={() => setMetamagicEditor(null)}
        />
      ) : null}

      {invocationEditor ? (
        <InvocationSelectionModal
          open
          invocations={classConfigurations[invocationEditor]?.invocations ?? []}
          originalInvocations={[]}
          max={getInvocationLimit(
            classConfigurations[invocationEditor]?.level ?? 1,
          )}
          replacementLimit={0}
          onChange={(next) =>
            updateClass(invocationEditor, (current) => ({
              ...current,
              invocations: next,
            }))
          }
          onClose={() => setInvocationEditor(null)}
        />
      ) : null}

      {asiEditor ? (
        <AsiSelectionModal
          open
          value={
            classConfigurations[asiEditor.className]?.asis.find(
              (entry) => entry.classLevel === asiEditor.classLevel,
            ) ?? null
          }
          className={asiEditor.className}
          classLevel={asiEditor.classLevel}
          onChange={(next) =>
            updateClass(asiEditor.className, (current) => ({
              ...current,
              asis: [
                ...current.asis.filter(
                  (entry) => entry.classLevel !== asiEditor.classLevel,
                ),
                next,
              ],
            }))
          }
          onClose={() => setAsiEditor(null)}
        />
      ) : null}
    </>
  )
}

export function createEmptyClassConfiguration(
  level = 1,
): CreationClassConfiguration {
  return {
    level,
    subclassName: "",
    subclassSource: "",
    proficiencies: [],
    abilities: [],
    spellSelection: { selected: [], prepared: [] },
    metamagics: [],
    invocations: [],
    asis: [],
  }
}

export function createRaceConfigurationFromPreset(
  preset: RacePreset | undefined,
  previous?: CreationRaceConfiguration,
): CreationRaceConfiguration {
  if (!preset) {
    return previous ?? {
      abilities: [],
      proficiencies: [],
      cantrips: [],
      spells: [],
      castingAttribute: "cha",
    }
  }

  return {
    abilities: preset.abilities.map(cloneAbility),
    proficiencies: preset.proficiencies.map((entry) => ({ ...entry })),
    cantrips: [],
    spells: [],
    castingAttribute: previous?.castingAttribute ?? "cha",
  }
}

function normalizeClassConfiguration(
  configuration: CreationClassConfiguration,
  level: number,
  spells: ReturnType<typeof useMagicContext>["spells"],
  className: ClassName,
): CreationClassConfiguration {
  const rule = getClassSpellSelectionRule(
    DRAFT_CHARACTER,
    className,
    level,
    undefined,
  )
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  const selectedCantrips = configuration.spellSelection.selected.filter(
    (index) => byIndex.get(index)?.slotLevel === 0,
  )
  const selectedLeveled = configuration.spellSelection.selected.filter(
    (index) => (byIndex.get(index)?.slotLevel ?? 0) > 0,
  )
  const cantrips = selectedCantrips.slice(0, rule.maxCantrips)
  const leveled =
    rule.mode === "limited-known" || rule.mode === "spellbook"
      ? selectedLeveled.slice(0, rule.maxLeveledSpells)
      : []
  const selected = [...cantrips, ...leveled]

  return {
    ...configuration,
    level,
    spellSelection: {
      selected,
      prepared: configuration.spellSelection.prepared.filter((index) =>
        selected.includes(index),
      ),
    },
    metamagics:
      className === "sorcerer"
        ? configuration.metamagics.slice(0, getMetamagicLimit(level))
        : [],
    invocations:
      className === "warlock"
        ? configuration.invocations.slice(0, getInvocationLimit(level))
        : [],
    asis: configuration.asis.filter(
      (entry) => entry.className === className && entry.classLevel <= level,
    ),
  }
}

function sameClassConfiguration(
  left: CreationClassConfiguration | undefined,
  right: CreationClassConfiguration,
): boolean {
  if (!left) return false
  return JSON.stringify(left) === JSON.stringify(right)
}

function resolveClassHeading(
  text: string,
): { className: ClassName; level: number } | undefined {
  const normalized = text.trim()
  for (const className of ALL_CLASS_NAMES) {
    const label = getClassProgression(className).label
    if (!normalized.startsWith(`${label} `)) continue
    const level = Number(normalized.slice(label.length).trim().split(/\s+/)[0])
    if (!Number.isFinite(level)) return undefined
    return {
      className,
      level: Math.max(1, Math.min(20, Math.trunc(level))),
    }
  }
  return undefined
}

function getAsiLevels(className: ClassName, classLevel: number): number[] {
  return Array.from({ length: classLevel }, (_, index) => index + 1).filter(
    (level) => isAsiLevel(className, level),
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
      <h3 className="text-base font-semibold text-textH">{title}</h3>
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
  abilities,
  onEdit,
  onRemove,
}: {
  abilities: Ability[]
  onEdit: (ability: Ability) => void
  onRemove: (abilityId: string) => void
}) {
  if (!abilities.length) return null
  return (
    <div className="grid gap-2">
      {abilities.map((ability) => (
        <article
          key={ability.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg-subtle p-3"
        >
          <div className="min-w-0">
            <div className="font-medium text-textH">{ability.name}</div>
            {ability.description?.trim() ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                {ability.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(ability)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(ability.id)}
            >
              Remover
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function RacePresetBenefits({ preset }: { preset: RacePreset | undefined }) {
  if (!preset) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-bg-subtle p-4 text-sm text-textMuted">
        Raça personalizada: configure os benefícios manualmente no grupo abaixo.
      </div>
    )
  }

  const attributeBonuses = ATTRIBUTE_KEYS
    .filter((attribute) => (preset.attributeBonus[attribute] ?? 0) !== 0)
    .map(
      (attribute) =>
        `${attributeLabel(attribute)} ${formatSigned(preset.attributeBonus[attribute] ?? 0)}`,
    )

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg-subtle p-4">
      <div className="text-sm font-semibold text-textH">
        O que {preset.name} concede
      </div>
      <div className="mt-3 grid gap-3 text-xs text-text md:grid-cols-2">
        <BenefitRow label="Atributos" value={attributeBonuses.join(" · ") || "Nenhum bônus"} />
        <BenefitRow label="Tamanho" value={formatSize(preset.size)} />
        <BenefitRow
          label="Deslocamento"
          value={
            preset.speedBonus === 0
              ? "Sem ajuste racial"
              : `Ajuste ${formatSigned(preset.speedBonus)} m`
          }
        />
        <BenefitRow
          label="Proficiências"
          value={preset.proficiencies.map((entry) => entry.name).join(", ") || "Nenhuma"}
        />
        <BenefitRow
          label="Características"
          value={preset.abilities.map((entry) => entry.name).join(", ") || "Nenhuma"}
          className="md:col-span-2"
        />
      </div>
    </div>
  )
}

function BenefitRow({
  label,
  value,
  className = "",
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-border bg-bg p-3 ${className}`}>
      <div className="text-[10px] uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 leading-5 text-textH">{value}</div>
    </div>
  )
}

function formatProficiencyCount(proficiencies: Proficiency[]): string {
  const expertise = proficiencies.filter((entry) => entry.expertise).length
  return `${proficiencies.length} adicionada(s)${expertise ? ` · ${expertise} expertise` : ""}`
}

function attributeLabel(attribute: Attribute): string {
  const labels: Record<Attribute, string> = {
    str: "FOR",
    dex: "DES",
    con: "CON",
    int: "INT",
    wis: "SAB",
    cha: "CAR",
  }
  return labels[attribute]
}

function formatSize(size: RacePreset["size"]): string {
  const labels: Record<RacePreset["size"], string> = {
    tiny: "Minúsculo",
    small: "Pequeno",
    medium: "Médio",
    large: "Grande",
    huge: "Enorme",
    gargantuan: "Colossal",
  }
  return labels[size]
}

function upsertAbility(abilities: Ability[], ability: Ability): Ability[] {
  return abilities.some((entry) => entry.id === ability.id)
    ? abilities.map((entry) => (entry.id === ability.id ? ability : entry))
    : [...abilities, ability]
}

function cloneAbility(ability: Ability): Ability {
  return {
    ...ability,
    usage: ability.usage ? { ...ability.usage } : undefined,
    grantedSpells: ability.grantedSpells?.map((entry) => ({ ...entry })),
    grantedProficiencies: ability.grantedProficiencies?.map((entry) => ({
      ...entry,
    })),
    bonuses: ability.bonuses
      ? JSON.parse(JSON.stringify(ability.bonuses))
      : undefined,
  }
}
