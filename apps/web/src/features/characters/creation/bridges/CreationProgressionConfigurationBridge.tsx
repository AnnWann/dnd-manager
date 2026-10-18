import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../../components/ui/Button"
import { useMagicContext } from "../../../../contexts/magicContext"
import {
  ALL_CLASS_NAMES,
  getClassProgression,
} from "../../../../data/classProgression"
import { PHB_RACE_PRESETS } from "../../../../data/characterCreation/phbPresets"
import {
  RACIAL_SPELLCASTING_PRESETS,
  type RacialSpellcastingPreset,
} from "../../../../data/characterCreation/racialSpellcastingPresets"
import { newCharacterTemplate } from "../../../../lib/newCharacterTemplate"
import type { Ability } from "../../../../models/abilities/Ability"
import type { CharacterAsi } from "../../../../models/characters/CharacterAsi"
import {
  getCustomClassConfig,
  isCustomClassName,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../../models/characters/customClassConfig"
import type { Attribute } from "../../../../models/sheet/Attribute"
import type { ClassName } from "../../../../models/sheet/Class"
import type { Proficiency } from "../../../../models/sheet/Proficiency"
import {
  createClassEntry,
  getClassSpellSelectionRule,
} from "../../../../models/leveling/SpellSelectionRules"
import { isAsiLevel } from "../../../../rules/AsiRules"
import { getInvocationLimit } from "../../../../rules/InvocationRules"
import { getMetamagicLimit } from "../../../../rules/MetamagicsRules"
import { AbilityDialog } from "../../abilities/abilityDialog"
import { ProficiencySelectionModal } from "../../proficiencies/ProficiencySelectionModal"
import { AsiSelectionModal } from "../../progression/AsiSelectionModal"
import { InvocationSelectionModal } from "../../progression/InvocationSelectionModal"
import {
  LevelUpSpellSelectionModal,
  type LevelUpSpellSelectionKind,
} from "../../progression/LevelUpSpellSelectionModal"
import { MetamagicSelectionModal } from "../../progression/MetamagicSelectionModal"
import {
  RacialSpellSelectionModal,
  type RacialSpellSelectionKind,
} from "../../progression/RacialSpellSelectionModal"
import {
  getCreationClassConfiguration,
  type CreationProgressionConfiguration,
} from "../creationProgressionConfiguration"
import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

type Props = {
  open: boolean
  value: CreationProgressionConfiguration
  customClassConfigs?: Record<string, CustomClassRuntimeConfig>
  onChange: (value: CreationProgressionConfiguration) => void
}

type ClassMount = {
  className: ClassName
  level: number
  element: HTMLElement
}

type RaceMount = {
  name: string
  presetId: string
  editable: boolean
  spellcasting?: RacialSpellcastingPreset
  element: HTMLElement
}

type AbilityTarget =
  | { source: "class"; className: ClassName; ability: Ability | null }
  | { source: "race"; ability: Ability | null }
  | null

type ProficiencyTarget = ClassName | "race" | null

type ClassSpellTarget = {
  className: ClassName
  kind: LevelUpSpellSelectionKind
} | null

type RacialSpellTarget = RacialSpellSelectionKind | null

type AsiTarget = {
  className: ClassName
  level: number
} | null

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

export function CreationProgressionConfigurationBridge({
  open,
  value,
  customClassConfigs = {},
  onChange,
}: Props) {
  const { spells, metamagics } = useMagicContext()
  const [classMounts, setClassMounts] = useState<ClassMount[]>([])
  const [raceMount, setRaceMount] = useState<RaceMount | null>(null)
  const [abilityTarget, setAbilityTarget] = useState<AbilityTarget>(null)
  const [proficiencyTarget, setProficiencyTarget] =
    useState<ProficiencyTarget>(null)
  const [classSpellTarget, setClassSpellTarget] =
    useState<ClassSpellTarget>(null)
  const [racialSpellTarget, setRacialSpellTarget] =
    useState<RacialSpellTarget>(null)
  const [metamagicClass, setMetamagicClass] = useState<ClassName | null>(null)
  const [invocationClass, setInvocationClass] = useState<ClassName | null>(null)
  const [asiTarget, setAsiTarget] = useState<AsiTarget>(null)

  const classSignature = classMounts
    .map((entry) => `${entry.className}:${entry.level}`)
    .sort()
    .join("|")
  const previewCharacter = useMemo(() => {
    const owner = { id: "creation-preview", name: "Criação", role: "player" as const }
    const base = newCharacterTemplate("Rascunho", owner).withSheet(
      "classes",
      classMounts.map((entry) => createClassEntry(entry.className, entry.level)),
    )
    return classMounts.reduce((current, entry) => {
      if (!isCustomClassName(entry.className)) return current
      const config = customClassConfigs[String(entry.className)]
      return config
        ? updateCustomClassConfig(current, config, entry.className)
        : current
    }, base)
  }, [classSignature, customClassConfigs])

  useEffect(() => {
    if (!open) {
      setClassMounts([])
      setRaceMount(null)
      return
    }

    let frame = 0
    let observer: MutationObserver | undefined

    const sync = () => {
      const root = findCharacterCreationRoot()
      const main = root?.querySelector<HTMLElement>("main")
      if (!main) {
        setClassMounts((current) => (current.length ? [] : current))
        setRaceMount((current) => (current ? null : current))
        return
      }

      annotateRacePresetBenefits(main)
      const nextClassMounts: ClassMount[] = []
      let nextRaceMount: RaceMount | null = null

      for (const section of Array.from(main.querySelectorAll<HTMLElement>("section"))) {
        const heading = section.querySelector<HTMLElement>(":scope > div h2, :scope > h2")
        const datasetClassName = section.dataset.creationClassName as ClassName | undefined
        const datasetLevel = Number(section.dataset.creationClassLevel)
        const parsedClass =
          datasetClassName && Number.isFinite(datasetLevel) && datasetLevel > 0
            ? { className: datasetClassName, level: datasetLevel }
            : parseClassHeading(heading?.textContent ?? "")
        if (parsedClass) {
          hideLegacyClassConfiguration(section)
          let mount = section.querySelector<HTMLElement>(
            `:scope > [data-creation-progression-class="${parsedClass.className}"]`,
          )
          if (!mount) {
            mount = document.createElement("div")
            mount.dataset.creationProgressionClass = parsedClass.className
            const subclassMount = section.querySelector<HTMLElement>(
              `:scope > [data-manual-subclass-for="${parsedClass.className}"]`,
            )
            if (subclassMount) subclassMount.insertAdjacentElement("afterend", mount)
            else section.firstElementChild?.insertAdjacentElement("afterend", mount)
          }
          nextClassMounts.push({ ...parsedClass, element: mount })
        }
      }

      const raceDetails = main.querySelector<HTMLElement>(
        '[data-character-creation-race-details="true"]',
      )
      const raceSection = raceDetails?.querySelector<HTMLElement>(":scope > section")
      const presetId = raceDetails?.dataset.racePresetId ?? ""
      const editable = presetId === "custom"
      const spellcasting = RACIAL_SPELLCASTING_PRESETS[presetId]

      if (raceDetails && raceSection && (editable || spellcasting)) {
        if (editable) hideLegacyRaceConfiguration(raceSection)
        let mount = raceSection.querySelector<HTMLElement>(
          ':scope > [data-creation-progression-race="true"]',
        )
        if (!mount) {
          mount = document.createElement("div")
          mount.dataset.creationProgressionRace = "true"
          raceSection.appendChild(mount)
        }
        nextRaceMount = {
          name:
            raceDetails.dataset.raceName?.trim() ||
            resolveRaceName(raceSection),
          presetId,
          editable,
          spellcasting,
          element: mount,
        }
      }

      hideLegacyMetamagicSection(main)
      setClassMounts((current) =>
        sameClassMounts(current, nextClassMounts) ? current : nextClassMounts,
      )
      setRaceMount((current) =>
        sameRaceMount(current, nextRaceMount) ? current : nextRaceMount,
      )
    }

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        sync()
      })
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0
      sync()
      const root = findCharacterCreationRoot()
      if (!root) return
      observer = new MutationObserver(scheduleSync)
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-race-preset-id", "data-race-name"],
      })
    })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      const root = findCharacterCreationRoot()
      root
        ?.querySelectorAll(
          "[data-creation-progression-class], [data-creation-progression-race]",
        )
        .forEach((element) => element.remove())
      setClassMounts([])
      setRaceMount(null)
    }
  }, [open])

  function updateClass(
    className: ClassName,
    updater: (
      current: ReturnType<typeof getCreationClassConfiguration>,
    ) => ReturnType<typeof getCreationClassConfiguration>,
  ) {
    const current = getCreationClassConfiguration(value, className)
    onChange({
      ...value,
      classes: {
        ...value.classes,
        [className]: updater(current),
      },
    })
  }

  function saveFeature(ability: Ability) {
    if (!abilityTarget) return
    const normalized: Ability = {
      ...ability,
      kind: "feature",
      category:
        ability.category === "feat" || ability.category === "invocation"
          ? "general"
          : ability.category,
      source: abilityTarget.source,
    }

    if (abilityTarget.source === "race") {
      const abilities = upsertAbility(value.race.abilities, normalized)
      onChange({ ...value, race: { ...value.race, abilities } })
    } else {
      updateClass(abilityTarget.className, (current) => ({
        ...current,
        abilities: upsertAbility(current.abilities, normalized),
      }))
    }
    setAbilityTarget(null)
  }

  const activeClassSpellMount = classSpellTarget
    ? classMounts.find((entry) => entry.className === classSpellTarget.className)
    : undefined
  const activeClassSpellConfiguration = classSpellTarget
    ? getCreationClassConfiguration(value, classSpellTarget.className)
    : undefined
  const activeMetamagicMount = metamagicClass
    ? classMounts.find((entry) => entry.className === metamagicClass)
    : undefined
  const activeInvocationMount = invocationClass
    ? classMounts.find((entry) => entry.className === invocationClass)
    : undefined
  const activeAsiConfiguration = asiTarget
    ? getCreationClassConfiguration(value, asiTarget.className).asis.find(
        (entry) => entry.classLevel === asiTarget.level,
      ) ?? null
    : null

  return (
    <>
      {classMounts.map((mount) =>
        createPortal(
          <ClassConfigurationPanel
            key={`${mount.className}:${mount.level}`}
            className={mount.className}
            level={mount.level}
            character={previewCharacter}
            configuration={getCreationClassConfiguration(value, mount.className)}
            spells={spells}
            onAddFeature={() =>
              setAbilityTarget({
                source: "class",
                className: mount.className,
                ability: null,
              })
            }
            onEditFeature={(ability) =>
              setAbilityTarget({
                source: "class",
                className: mount.className,
                ability,
              })
            }
            onRemoveFeature={(abilityId) =>
              updateClass(mount.className, (current) => ({
                ...current,
                abilities: current.abilities.filter(
                  (entry) => entry.id !== abilityId,
                ),
              }))
            }
            onOpenProficiencies={() => setProficiencyTarget(mount.className)}
            onOpenCantrips={() =>
              setClassSpellTarget({
                className: mount.className,
                kind: "cantrip",
              })
            }
            onOpenSpells={() =>
              setClassSpellTarget({
                className: mount.className,
                kind: "leveled",
              })
            }
            onOpenMetamagics={() => setMetamagicClass(mount.className)}
            onOpenInvocations={() => setInvocationClass(mount.className)}
            onOpenAsi={(level) =>
              setAsiTarget({ className: mount.className, level })
            }
          />,
          mount.element,
          `${mount.className}:${mount.level}`,
        ),
      )}

      {raceMount
        ? createPortal(
            <RaceConfigurationPanel
              raceName={raceMount.name}
              editable={raceMount.editable}
              guidance={raceMount.spellcasting?.guidance}
              configuration={value.race}
              onAddFeature={() =>
                setAbilityTarget({ source: "race", ability: null })
              }
              onEditFeature={(ability) =>
                setAbilityTarget({ source: "race", ability })
              }
              onRemoveFeature={(abilityId) =>
                onChange({
                  ...value,
                  race: {
                    ...value.race,
                    abilities: value.race.abilities.filter(
                      (entry) => entry.id !== abilityId,
                    ),
                  },
                })
              }
              onOpenProficiencies={() => setProficiencyTarget("race")}
              onOpenCantrips={() => setRacialSpellTarget("cantrip")}
              onOpenSpells={() => setRacialSpellTarget("leveled")}
            />,
            raceMount.element,
            "race-configuration",
          )
        : null}

      <AbilityDialog
        open={abilityTarget !== null}
        ability={abilityTarget?.ability ?? null}
        title={
          abilityTarget?.ability
            ? "Editar característica"
            : "Adicionar característica"
        }
        onClose={() => setAbilityTarget(null)}
        onSave={saveFeature}
      />

      <ProficiencySelectionModal
        open={proficiencyTarget !== null}
        proficiencies={
          proficiencyTarget === "race"
            ? value.race.proficiencies
            : proficiencyTarget
              ? getCreationClassConfiguration(value, proficiencyTarget)
                  .proficiencies
              : []
        }
        title={
          proficiencyTarget === "race"
            ? "Proficiências raciais"
            : "Proficiências da classe"
        }
        description="Adicione as proficiências concedidas pela sua referência. Perícias podem ser marcadas como expertise."
        onChange={(proficiencies: Proficiency[]) => {
          if (proficiencyTarget === "race") {
            onChange({
              ...value,
              race: { ...value.race, proficiencies },
            })
          } else if (proficiencyTarget) {
            updateClass(proficiencyTarget, (current) => ({
              ...current,
              proficiencies,
            }))
          }
        }}
        onClose={() => setProficiencyTarget(null)}
      />

      {classSpellTarget && activeClassSpellMount && activeClassSpellConfiguration ? (
        <LevelUpSpellSelectionModal
          open
          kind={classSpellTarget.kind}
          character={previewCharacter}
          className={classSpellTarget.className}
          previousLevel={0}
          targetLevel={activeClassSpellMount.level}
          spells={spells}
          selection={activeClassSpellConfiguration.spells}
          onChange={(selection) =>
            updateClass(classSpellTarget.className, (current) => ({
              ...current,
              spells: selection,
            }))
          }
          onClose={() => setClassSpellTarget(null)}
        />
      ) : null}

      {raceMount && racialSpellTarget ? (
        <RacialSpellSelectionModal
          open
          kind={racialSpellTarget}
          raceName={raceMount.name}
          spells={spells}
          selected={
            racialSpellTarget === "cantrip"
              ? value.race.cantrips
              : value.race.spells
          }
          attribute={value.race.castingAttribute}
          onAttributeChange={(castingAttribute) =>
            onChange({
              ...value,
              race: { ...value.race, castingAttribute },
            })
          }
          onChange={(selected) =>
            onChange({
              ...value,
              race: {
                ...value.race,
                [racialSpellTarget === "cantrip" ? "cantrips" : "spells"]:
                  selected,
              },
            })
          }
          onClose={() => setRacialSpellTarget(null)}
        />
      ) : null}

      {metamagicClass && activeMetamagicMount ? (
        <MetamagicSelectionModal
          open
          options={metamagics}
          selected={
            getCreationClassConfiguration(value, metamagicClass).metamagics
          }
          max={getMetamagicLimit(activeMetamagicMount.level)}
          onChange={(selected) =>
            updateClass(metamagicClass, (current) => ({
              ...current,
              metamagics: selected,
            }))
          }
          onClose={() => setMetamagicClass(null)}
        />
      ) : null}

      {invocationClass && activeInvocationMount ? (
        <InvocationSelectionModal
          open
          invocations={
            getCreationClassConfiguration(value, invocationClass).invocations
          }
          max={getInvocationLimit(activeInvocationMount.level)}
          onChange={(invocations) =>
            updateClass(invocationClass, (current) => ({
              ...current,
              invocations,
            }))
          }
          onClose={() => setInvocationClass(null)}
        />
      ) : null}

      {asiTarget ? (
        <AsiSelectionModal
          open
          value={activeAsiConfiguration}
          className={asiTarget.className}
          classLevel={asiTarget.level}
          onChange={(asi: CharacterAsi) =>
            updateClass(asiTarget.className, (current) => ({
              ...current,
              asis: upsertAsi(current.asis, asi),
            }))
          }
          onClose={() => setAsiTarget(null)}
        />
      ) : null}
    </>
  )
}

function ClassConfigurationPanel({
  className,
  level,
  character,
  configuration,
  spells,
  onAddFeature,
  onEditFeature,
  onRemoveFeature,
  onOpenProficiencies,
  onOpenCantrips,
  onOpenSpells,
  onOpenMetamagics,
  onOpenInvocations,
  onOpenAsi,
}: {
  className: ClassName
  level: number
  character: ReturnType<typeof newCharacterTemplate>
  configuration: ReturnType<typeof getCreationClassConfiguration>
  spells: ReturnType<typeof useMagicContext>["spells"]
  onAddFeature: () => void
  onEditFeature: (ability: Ability) => void
  onRemoveFeature: (abilityId: string) => void
  onOpenProficiencies: () => void
  onOpenCantrips: () => void
  onOpenSpells: () => void
  onOpenMetamagics: () => void
  onOpenInvocations: () => void
  onOpenAsi: (level: number) => void
}) {
  const rule = getClassSpellSelectionRule(character, className, level)
  const cantrips = resolveSpellCount(configuration.spells.selected, spells, 0)
  const leveled = resolveSpellCount(configuration.spells.selected, spells, 1)
  const metamagicLimit = className === "sorcerer" ? getMetamagicLimit(level) : 0
  const invocationLimit = className === "warlock" ? getInvocationLimit(level) : 0
  const customClassConfig = isCustomClassName(className)
    ? getCustomClassConfig(character, className)
    : undefined
  const asiLevels = Array.from({ length: level }, (_, index) => index + 1).filter(
    (candidate) =>
      customClassConfig
        ? customClassConfig.asiLevels.includes(candidate)
        : isAsiLevel(className, candidate),
  )

  return (
    <div className="mt-4 grid gap-3 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          title="Características"
          value={`${configuration.abilities.length} configurada(s)`}
          action="Adicionar característica"
          onClick={onAddFeature}
        />
        <ActionCard
          title="Proficiências"
          value={`${configuration.proficiencies.length} adicionada(s)${configuration.proficiencies.some((entry) => entry.expertise) ? " · expertise" : ""}`}
          action="Adicionar proficiência"
          onClick={onOpenProficiencies}
        />

        {rule.maxCantrips > 0 ? (
          <ActionCard
            title="Truques"
            value={`${cantrips}/${rule.maxCantrips}`}
            action="Escolher truques"
            onClick={onOpenCantrips}
          />
        ) : null}

        {(rule.mode === "limited-known" || rule.mode === "spellbook") &&
        rule.maxLeveledSpells > 0 ? (
          <ActionCard
            title={rule.mode === "spellbook" ? "Grimório" : "Magias"}
            value={`${leveled}/${rule.maxLeveledSpells}`}
            action={rule.mode === "spellbook" ? "Adicionar ao grimório" : "Escolher magias"}
            onClick={onOpenSpells}
          />
        ) : null}

        {metamagicLimit > 0 ? (
          <ActionCard
            title="Metamagias"
            value={`${configuration.metamagics.length}/${metamagicLimit}`}
            action="Escolher metamagias"
            onClick={onOpenMetamagics}
          />
        ) : null}

        {invocationLimit > 0 ? (
          <ActionCard
            title="Evocações"
            value={`${configuration.invocations.length}/${invocationLimit}`}
            action="Configurar evocações"
            onClick={onOpenInvocations}
          />
        ) : null}
      </div>

      {asiLevels.length ? (
        <div className="grid gap-2 rounded-xl border border-border bg-bg p-3">
          <div className="text-xs font-semibold text-textH">ASI / talentos</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {asiLevels.map((asiLevel) => {
              const asi = configuration.asis.find(
                (entry) => entry.classLevel === asiLevel,
              )
              return (
                <ActionCard
                  key={asiLevel}
                  title={`Nível ${asiLevel}`}
                  value={asi ? describeAsi(asi) : "Não configurado"}
                  action={asi ? "Editar ASI" : "Configurar ASI"}
                  onClick={() => onOpenAsi(asiLevel)}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      <ConfiguredFeatures
        abilities={configuration.abilities}
        onEdit={onEditFeature}
        onRemove={onRemoveFeature}
      />
    </div>
  )
}

function RaceConfigurationPanel({
  raceName,
  editable,
  guidance,
  configuration,
  onAddFeature,
  onEditFeature,
  onRemoveFeature,
  onOpenProficiencies,
  onOpenCantrips,
  onOpenSpells,
}: {
  raceName: string
  editable: boolean
  guidance?: string
  configuration: CreationProgressionConfiguration["race"]
  onAddFeature: () => void
  onEditFeature: (ability: Ability) => void
  onRemoveFeature: (abilityId: string) => void
  onOpenProficiencies: () => void
  onOpenCantrips: () => void
  onOpenSpells: () => void
}) {
  return (
    <div className="mt-4 grid gap-3 border-t border-border pt-4">
      <h3 className="font-semibold text-textH">
        {editable ? raceName || "Raça" : `Magia racial — ${raceName}`}
      </h3>
      {guidance ? (
        <div className="rounded-lg border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-text">
          {guidance}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {editable ? (
          <>
            <ActionCard
              title="Características"
              value={`${configuration.abilities.length} adicionada(s)`}
              action="Adicionar característica"
              onClick={onAddFeature}
            />
            <ActionCard
              title="Proficiências"
              value={`${configuration.proficiencies.length} adicionada(s)${configuration.proficiencies.some((entry) => entry.expertise) ? " · expertise" : ""}`}
              action="Adicionar proficiência"
              onClick={onOpenProficiencies}
            />
          </>
        ) : null}
        <ActionCard
          title="Truques"
          value={`${configuration.cantrips.length} selecionado(s)`}
          action="Adicionar truques"
          onClick={onOpenCantrips}
        />
        <ActionCard
          title="Magias"
          value={`${configuration.spells.length} selecionada(s)`}
          action="Adicionar magias"
          onClick={onOpenSpells}
        />
      </div>

      {editable ? (
        <ConfiguredFeatures
          abilities={configuration.abilities}
          onEdit={onEditFeature}
          onRemove={onRemoveFeature}
        />
      ) : null}
    </div>
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
    <article className="grid gap-3 rounded-xl border border-border bg-bg p-3">
      <div>
        <div className="text-xs font-semibold text-textH">{title}</div>
        <div className="mt-1 text-[11px] leading-4 text-textMuted">{value}</div>
      </div>
      <Button size="sm" variant="secondary" onClick={onClick}>
        {action}
      </Button>
    </article>
  )
}

function ConfiguredFeatures({
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
          className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-border bg-bg p-3"
        >
          <div className="min-w-0">
            <div className="break-words text-sm font-medium text-textH">
              {ability.name}
            </div>
            {ability.description?.trim() ? (
              <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-textMuted [overflow-wrap:anywhere]">
                {ability.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(ability)}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(ability.id)}>
              Remover
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function parseClassHeading(
  text: string,
): { className: ClassName; level: number } | undefined {
  const normalized = text.trim()
  for (const className of ALL_CLASS_NAMES) {
    const label = getClassProgression(className).label
    if (!normalized.startsWith(label)) continue
    const suffix = normalized.slice(label.length).trim()
    const level = Number(
      suffix.match(/^(?:—\s*)?(?:nível\s*)?(\d+)/i)?.[1],
    )
    if (Number.isFinite(level) && level > 0) return { className, level }
  }
  return undefined
}

function resolveRaceName(section: HTMLElement): string {
  const firstInput = section.querySelector<HTMLInputElement>('input:not([type="number"])')
  return firstInput?.value.trim() || "Raça personalizada"
}

function hideLegacyClassConfiguration(section: HTMLElement) {
  for (const details of Array.from(section.querySelectorAll<HTMLDetailsElement>("details"))) {
    const summary = details.querySelector("summary")?.textContent?.trim() ?? ""
    if (
      summary.startsWith("Proficiências concedidas") ||
      summary.startsWith("Características dos níveis") ||
      summary.startsWith("Ler detalhes das magias concedidas") ||
      summary.startsWith("Selecionar e ler magias")
    ) {
      details.hidden = true
    }
  }

  hideSectionByExactText(section, "Características personalizadas desta classe")
}

function hideLegacyRaceConfiguration(section: HTMLElement) {
  hideSectionByExactText(section, "Características raciais")
  const proficiencyTitle = Array.from(section.querySelectorAll<HTMLElement>("*"))
    .find((element) => element.textContent?.trim() === "Proficiências raciais")
  const wrapper = proficiencyTitle?.closest<HTMLElement>(".mt-4")
  if (wrapper) wrapper.hidden = true
}

function hideSectionByExactText(root: HTMLElement, text: string) {
  const label = Array.from(root.querySelectorAll<HTMLElement>("*"))
    .find((element) => element.textContent?.trim() === text)
  const section = label?.closest<HTMLElement>("section")
  if (section && section !== root) section.hidden = true
}

function hideLegacyMetamagicSection(main: HTMLElement) {
  const heading = Array.from(main.querySelectorAll<HTMLElement>("h2"))
    .find((element) => element.textContent?.trim() === "Metamagia")
  const section = heading?.closest<HTMLElement>("section")
  if (section) section.hidden = true
}

function annotateRacePresetBenefits(main: HTMLElement) {
  const raceHeading = Array.from(main.querySelectorAll<HTMLElement>("h2"))
    .find((entry) => entry.textContent?.trim() === "Raça")
  const raceSection = raceHeading?.closest<HTMLElement>("section")
  if (!raceSection) return

  for (const preset of PHB_RACE_PRESETS) {
    const button = Array.from(raceSection.querySelectorAll<HTMLButtonElement>("button"))
      .find((entry) =>
        entry.querySelector("strong")?.textContent?.trim() === preset.name,
      )
    if (!button) continue

    let explanation = button.querySelector<HTMLElement>(
      '[data-race-preset-benefits="true"]',
    )
    if (!explanation) {
      explanation = document.createElement("span")
      explanation.dataset.racePresetBenefits = "true"
      explanation.className =
        "mt-3 block border-t border-border pt-2 text-[10px] leading-4 text-text"
      button.appendChild(explanation)
    }
    const nextText = `Você recebe: ${describeRacePreset(preset)}`
    if (explanation.textContent !== nextText) explanation.textContent = nextText
  }
}

function sameClassMounts(current: ClassMount[], next: ClassMount[]): boolean {
  return (
    current.length === next.length &&
    current.every((entry, index) => {
      const candidate = next[index]
      return (
        candidate?.className === entry.className &&
        candidate.level === entry.level &&
        candidate.element === entry.element
      )
    })
  )
}

function sameRaceMount(current: RaceMount | null, next: RaceMount | null): boolean {
  if (!current || !next) return current === next
  return (
    current.name === next.name &&
    current.presetId === next.presetId &&
    current.editable === next.editable &&
    current.element === next.element
  )
}

function describeRacePreset(preset: (typeof PHB_RACE_PRESETS)[number]): string {
  const attributes = Object.entries(preset.attributeBonus)
    .filter(([, amount]) => (amount ?? 0) !== 0)
    .map(
      ([attribute, amount]) =>
        `${ATTRIBUTE_LABELS[attribute as Attribute]} ${Number(amount) > 0 ? "+" : ""}${amount}`,
    )
  const abilities = preset.abilities.map((ability) => ability.name)
  const proficiencies = preset.proficiencies.map((entry) => entry.name)
  const spellcasting = RACIAL_SPELLCASTING_PRESETS[preset.id]
  return [
    attributes.length ? `atributos ${attributes.join(", ")}` : "sem bônus de atributo",
    abilities.length
      ? `características ${abilities.join(", ")}`
      : "nenhuma característica automática",
    proficiencies.length
      ? `proficiências ${proficiencies.join(", ")}`
      : "nenhuma proficiência automática",
    spellcasting
      ? "magia racial configurada manualmente conforme a referência e o nível"
      : "sem configuração estrutural de magia racial",
  ].join("; ")
}

function upsertAbility(abilities: Ability[], ability: Ability): Ability[] {
  return abilities.some((entry) => entry.id === ability.id)
    ? abilities.map((entry) => (entry.id === ability.id ? ability : entry))
    : [...abilities, ability]
}

function upsertAsi(asis: CharacterAsi[], asi: CharacterAsi): CharacterAsi[] {
  return asis.some(
    (entry) =>
      entry.className === asi.className && entry.classLevel === asi.classLevel,
  )
    ? asis.map((entry) =>
        entry.className === asi.className && entry.classLevel === asi.classLevel
          ? asi
          : entry,
      )
    : [...asis, asi]
}

function resolveSpellCount(
  selected: string[],
  spells: ReturnType<typeof useMagicContext>["spells"],
  minimumLevel: number,
): number {
  const byIndex = new Map(spells.map((spell) => [spell.index, spell]))
  return selected.filter((index) => {
    const spell = byIndex.get(index)
    if (!spell) return false
    return minimumLevel === 0 ? spell.slotLevel === 0 : spell.slotLevel > 0
  }).length
}

function describeAsi(asi: CharacterAsi): string {
  if (asi.kind === "feat") return asi.ability?.name ?? "Talento"
  if (asi.kind === "half-feat") {
    const increase = Object.entries(asi.increases)[0]
    return `${asi.ability?.name ?? "Meio talento"}${increase ? ` · +1 ${ATTRIBUTE_LABELS[increase[0] as Attribute]}` : ""}`
  }
  return Object.entries(asi.increases)
    .map(
      ([attribute, amount]) =>
        `+${amount ?? 0} ${ATTRIBUTE_LABELS[attribute as Attribute]}`,
    )
    .join(" / ")
}
