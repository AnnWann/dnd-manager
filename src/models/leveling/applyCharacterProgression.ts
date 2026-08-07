import type { Ability } from "../abilities/Ability"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionReason,
} from "../characters/CharacterAcquisition"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { ensureCharacterAcquisitionMetadata } from "../characters/characterAcquisitionMetadata"
import type { MetamagicId } from "../magic/metamagic/Metamagic"
import type { Spell } from "../magic/spells/Spell"
import type { ClassName } from "../sheet/Class"
import type { HP } from "../sheet/HP"
import {
  applyProgressionAbilityTemplate,
  getClassProgression,
  getFeaturesAtLevel,
  type LevelFeatureDefinition,
} from "../../data/classProgression"
import {
  createClassEntry,
  getSubclassSpellGrants,
  normalizeSpellName,
} from "./SpellSelectionRules"

export type ProgressionClassPlan = {
  className: ClassName
  level: number
  previousLevel: number
  subclassId?: string
  levelChoices: Record<string, string[]>
  enabledOptionalFeatureIds: string[]
}

export type ProgressionSpellSelection = {
  className: ClassName
  spellIndexes: string[]
  preparedSpellIndexes: string[]
}

export type ProgressionCustomAbility = {
  ability: Ability
  source: "class" | "race"
  className?: ClassName
  classLevel?: number
}

export type CharacterProgressionApplication = {
  mode: "creation" | "level-up"
  classPlans: ProgressionClassPlan[]
  spellSelections: ProgressionSpellSelection[]
  metamagics: MetamagicId[]
  customAbilities: ProgressionCustomAbility[]
  spells: Spell[]
  advancedClassName?: ClassName
  hpGain?: number
  eventId?: string
  addedAt?: string
}

export function applyCharacterProgression(
  character: CharacterTemplate,
  application: CharacterProgressionApplication,
): CharacterTemplate {
  const eventId = application.eventId ?? crypto.randomUUID()
  const addedAt = application.addedAt ?? new Date().toISOString()
  const reason: CharacterAcquisitionReason =
    application.mode === "creation" ? "character-creation" : "level-up"
  const totalLevel = application.classPlans.reduce(
    (sum, plan) => sum + plan.level,
    0,
  )
  const classLabels = new Map<ClassName, string>(
    application.classPlans.map((plan) => [
      plan.className,
      getClassProgression(plan.className).label,
    ]),
  )

  const classes = application.classPlans.map((plan) => {
    const progression = getClassProgression(plan.className)
    const subclass = progression.subclasses.find(
      (entry) => entry.id === plan.subclassId,
    )

    return {
      ...createClassEntry(plan.className, plan.level),
      subclass: subclass
        ? {
            id: subclass.id,
            name: subclass.name,
            source: subclass.source,
          }
        : undefined,
      levelChoices: compactChoices(plan.levelChoices),
    }
  })

  let updated = character.withSheet("classes", classes)

  if (application.mode === "creation") {
    updated = recalculateCreationHp(updated, application.classPlans)
  } else if (
    application.advancedClassName &&
    application.hpGain !== undefined
  ) {
    updated = addLevelUpHp(
      updated,
      application.advancedClassName,
      application.hpGain,
    )
  }

  const generatedAbilities = buildProgressionAbilities(
    updated,
    application.classPlans,
    application.mode,
    eventId,
    addedAt,
    reason,
  )
  const generatedIds = new Set(generatedAbilities.map((ability) => ability.id))
  const existingAbilities = (updated.get("abilities") ?? []).filter(
    (ability) => !generatedIds.has(ability.id),
  )
  const customClassAbilities = application.customAbilities
    .filter((entry) => entry.source === "class")
    .map((entry) => {
      const className = entry.className ?? application.advancedClassName
      const classPlan = application.classPlans.find(
        (plan) => plan.className === className,
      )

      return stampAbility(entry.ability, {
        eventId,
        addedAt,
        reason,
        characterLevel: totalLevel,
        className,
        classLevel: entry.classLevel ?? classPlan?.level,
        sourceType: "class",
        sourceId: className,
        sourceName: className ? classLabels.get(className) : "Classe",
      })
    })

  updated = updated.with("abilities", [
    ...existingAbilities,
    ...generatedAbilities,
    ...customClassAbilities,
  ])

  const race = updated.get("sheet").race
  const raceName = race.customName?.trim() || race.subrace?.trim() || race.race
  const existingRacialAbilities = (race.naturalAbilities ?? []).map((ability) =>
    ability.acquisition
      ? ability
      : stampAbility(ability, {
          eventId,
          addedAt,
          reason,
          characterLevel: application.mode === "creation" ? 1 : totalLevel,
          sourceType: "race",
          sourceId: String(race.race),
          sourceName: raceName,
        }),
  )
  const customRacialAbilities = application.customAbilities
    .filter((entry) => entry.source === "race")
    .map((entry) =>
      stampAbility(entry.ability, {
        eventId,
        addedAt,
        reason,
        characterLevel: totalLevel,
        className: entry.className,
        classLevel: entry.classLevel,
        sourceType: "race",
        sourceId: String(race.race),
        sourceName: raceName,
      }),
    )

  updated = updated.withSheet("race", {
    ...race,
    naturalAbilities: [
      ...existingRacialAbilities,
      ...customRacialAbilities,
    ],
  })

  updated = applySpellSelections(
    updated,
    application,
    eventId,
    addedAt,
    reason,
    classLabels,
  ).syncMagicWithClasses()

  const currentMagic = updated.get("magic") ?? {
    spells: {
      knownSpells: [],
      slots: {},
      pactSlots: { level: 0, max: 0, current: 0 },
    },
  }
  const sorcererLevel =
    application.classPlans.find((plan) => plan.className === "sorcerer")
      ?.level ?? 0
  const nextSorceryPointMax = sorcererLevel >= 2 ? sorcererLevel : 0
  const previousSorceryPoints =
    character.get("magic")?.metamagic?.sorceryPoints
  const gainedSorceryPoints = Math.max(
    0,
    nextSorceryPointMax - (previousSorceryPoints?.max ?? 0),
  )
  const nextSorceryPointCurrent =
    application.mode === "creation"
      ? nextSorceryPointMax
      : Math.min(
          nextSorceryPointMax,
          (previousSorceryPoints?.current ?? 0) + gainedSorceryPoints,
        )

  updated = updated.with("magic", {
    ...currentMagic,
    metamagic: {
      metamagics: application.metamagics,
      sorceryPoints: {
        max: nextSorceryPointMax,
        current: nextSorceryPointCurrent,
      },
    },
  })

  return ensureCharacterAcquisitionMetadata(updated, {
    eventId,
    addedAt,
    reason,
    characterLevel: totalLevel,
    className: application.advancedClassName,
    classLevel: application.advancedClassName
      ? application.classPlans.find(
          (plan) => plan.className === application.advancedClassName,
        )?.level
      : undefined,
    sourceType:
      application.mode === "creation" ? "characterCreation" : "class",
    sourceName:
      application.mode === "creation"
        ? "Criação de personagem"
        : application.advancedClassName
          ? classLabels.get(application.advancedClassName)
          : "Subida de nível",
  })
}

function buildProgressionAbilities(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
  mode: "creation" | "level-up",
  eventId: string,
  addedAt: string,
  reason: CharacterAcquisitionReason,
): Ability[] {
  const abilities: Ability[] = []
  let previousClassesTotal = 0
  const finalTotal = plans.reduce((sum, entry) => sum + entry.level, 0)
  const characterLevelBefore = getCharacterLevelBeforePlan(plans)

  for (const plan of plans) {
    const progression = getClassProgression(plan.className)
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

        const choices = feature.choice
          ? plan.levelChoices[feature.choice.id] ?? []
          : []
        const characterLevel =
          mode === "creation"
            ? Math.min(finalTotal, previousClassesTotal + level)
            : Math.min(
                finalTotal,
                characterLevelBefore + Math.max(1, level - plan.previousLevel),
              )

        abilities.push(
          featureToAbility(feature, plan, choices, {
            eventId,
            addedAt,
            reason,
            characterLevel,
            className: plan.className,
            classLevel: level,
            sourceType: "class",
            sourceId: plan.subclassId
              ? `${plan.className}:${plan.subclassId}`
              : plan.className,
            sourceName: plan.subclassId
              ? progression.subclasses.find(
                  (entry) => entry.id === plan.subclassId,
                )?.name ?? progression.label
              : progression.label,
          }),
        )
      }
    }

    previousClassesTotal += plan.level
  }

  return abilities
}

function featureToAbility(
  feature: LevelFeatureDefinition,
  plan: ProgressionClassPlan,
  choices: string[],
  acquisitionInput: Parameters<typeof createCharacterAcquisition>[0],
): Ability {
  const choiceText = choices.length
    ? `\n\nEscolhas: ${choices.join(", ")}.`
    : ""
  const fallbackDescription =
    feature.description?.trim() ||
    `Característica de ${getClassProgression(plan.className).label} adquirida no nível ${feature.level}.`
  const configured = applyProgressionAbilityTemplate(
    {
      id: `progression:${plan.className}:${plan.subclassId ?? "base"}:${feature.id}`,
      name: feature.name,
      description: fallbackDescription,
      kind: "feature",
      category: feature.choice?.kind === "asi" ? "feat" : "general",
      source: "class",
    },
    feature.ability,
  )

  return stampAbility(
    {
      ...configured,
      description: `${
        configured.description?.trim() || fallbackDescription
      }${choiceText}`,
    },
    acquisitionInput,
  )
}

function stampAbility(
  ability: Ability,
  acquisitionInput: Parameters<typeof createCharacterAcquisition>[0],
): Ability {
  const acquisition = createCharacterAcquisition(acquisitionInput)

  return {
    ...ability,
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
}

function applySpellSelections(
  character: CharacterTemplate,
  application: CharacterProgressionApplication,
  eventId: string,
  addedAt: string,
  reason: CharacterAcquisitionReason,
  classLabels: Map<ClassName, string>,
): CharacterTemplate {
  const affectedClasses = new Set(
    application.spellSelections.map((selection) => selection.className),
  )
  const currentMagic = character.get("magic") ?? {
    spells: {
      knownSpells: [],
      slots: {},
      pactSlots: { level: 0, max: 0, current: 0 },
    },
  }
  const currentKnownSpells = currentMagic.spells.knownSpells
  const retained = currentKnownSpells.filter(
    (entry) =>
      entry.source.type !== "class" ||
      !affectedClasses.has(
        resolveSpellSourceClass(entry.source.sourceId, entry.source.name),
      ),
  )
  const byIndex = new Map(
    application.spells.map((spell) => [spell.index, spell]),
  )
  const additions = [] as typeof currentKnownSpells

  for (const selection of application.spellSelections) {
    const plan = application.classPlans.find(
      (entry) => entry.className === selection.className,
    )
    if (!plan) continue

    const classAcquisition = createCharacterAcquisition({
      eventId,
      addedAt,
      reason,
      characterLevel: application.classPlans.reduce(
        (sum, entry) => sum + entry.level,
        0,
      ),
      className: selection.className,
      classLevel: plan.level,
      sourceType: "class",
      sourceId: selection.className,
      sourceName: classLabels.get(selection.className),
    })
    const existingForClass = new Map(
      currentKnownSpells
        .filter(
          (entry) =>
            entry.source.type === "class" &&
            resolveSpellSourceClass(
              entry.source.sourceId,
              entry.source.name,
            ) === selection.className,
        )
        .map((entry) => [entry.spells.id, entry]),
    )

    for (const spellIndex of selection.spellIndexes) {
      const spell = byIndex.get(spellIndex)
      if (!spell) continue

      const existing = existingForClass.get(spellIndex)
      additions.push({
        source: {
          ...(existing?.source ?? {}),
          type: "class",
          name: selection.className,
          sourceId: selection.className,
          attribute:
            createClassEntry(selection.className, plan.level)
              .castingAttribute ?? "int",
          extendedList: isExpandedSubclassSpell(
            spell,
            selection.className,
            plan.subclassId,
            plan.level,
          ),
        },
        spells: {
          id: spellIndex,
          prepared: selection.preparedSpellIndexes.includes(spellIndex),
        },
        acquisition: existing?.acquisition ?? classAcquisition,
      })
    }

    for (const grant of getSubclassSpellGrants(
      selection.className,
      plan.subclassId,
      plan.level,
    )) {
      if (grant.mode === "expanded-list") continue

      for (const spellName of grant.spellNames) {
        const spell = application.spells.find(
          (candidate) =>
            normalizeSpellName(candidate.name) ===
              normalizeSpellName(spellName) ||
            normalizeSpellName(candidate.displayName ?? "") ===
              normalizeSpellName(spellName),
        )
        if (!spell) continue

        const alreadyAdded = additions.find(
          (entry) => entry.spells.id === spell.index,
        )
        if (alreadyAdded) {
          if (grant.mode === "always-prepared") {
            alreadyAdded.spells.prepared = true
          }
          continue
        }

        const existing = existingForClass.get(spell.index)
        additions.push({
          source: {
            ...(existing?.source ?? {}),
            type: "class",
            name: selection.className,
            sourceId: selection.className,
            attribute:
              createClassEntry(selection.className, plan.level)
                .castingAttribute ?? "int",
            extendedList: true,
          },
          spells: {
            id: spell.index,
            prepared: grant.mode === "always-prepared",
          },
          acquisition:
            existing?.acquisition ??
            createCharacterAcquisition({
              eventId,
              addedAt,
              reason,
              characterLevel: application.classPlans.reduce(
                (sum, entry) => sum + entry.level,
                0,
              ),
              className: selection.className,
              classLevel: grant.classLevel,
              sourceType: "class",
              sourceId: plan.subclassId
                ? `${selection.className}:${plan.subclassId}`
                : selection.className,
              sourceName: plan.subclassId
                ? getClassProgression(selection.className).subclasses.find(
                    (entry) => entry.id === plan.subclassId,
                  )?.name
                : classLabels.get(selection.className),
            }),
        })
      }
    }
  }

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: uniqueKnownSpells([...retained, ...additions]),
    },
  })
}

function isExpandedSubclassSpell(
  spell: Spell,
  className: ClassName,
  subclassId: string | undefined,
  classLevel: number,
): boolean {
  if (spell.classes.includes(className)) return false

  return getSubclassSpellGrants(className, subclassId, classLevel).some(
    (grant) =>
      grant.mode === "expanded-list" &&
      grant.spellNames.some(
        (name) =>
          normalizeSpellName(name) === normalizeSpellName(spell.name) ||
          normalizeSpellName(name) ===
            normalizeSpellName(spell.displayName ?? ""),
      ),
  )
}

function recalculateCreationHp(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  const conModifier = character.getAttributeModifier("con")
  const hitDice: HP["hitDice"] = {}
  let max = 0
  let firstLevel = true

  for (const plan of plans) {
    const hitDie = getClassProgression(plan.className).hitDie
    const sides = Number(hitDie.slice(1)) || 6
    const currentHitDice = hitDice[hitDie] ?? {
      max: { quantity: 0, sides: hitDie },
      current: { quantity: 0, sides: hitDie },
    }

    hitDice[hitDie] = {
      max: {
        quantity: currentHitDice.max.quantity + plan.level,
        sides: hitDie,
      },
      current: {
        quantity: currentHitDice.current.quantity + plan.level,
        sides: hitDie,
      },
    }

    for (let level = 1; level <= plan.level; level += 1) {
      max += Math.max(
        1,
        (firstLevel ? sides : Math.floor(sides / 2) + 1) + conModifier,
      )
      firstLevel = false
    }
  }

  return character.withSheet("HP", {
    max: Math.max(1, max),
    current: Math.max(1, max),
    temporary: 0,
    hitDice,
  })
}

function addLevelUpHp(
  character: CharacterTemplate,
  className: ClassName,
  hpGain: number,
): CharacterTemplate {
  const hitDie = getClassProgression(className).hitDie
  const hp = character.get("sheet").HP
  const current = hp.hitDice[hitDie] ?? {
    max: { quantity: 0, sides: hitDie },
    current: { quantity: 0, sides: hitDie },
  }

  return character.withSheet("HP", {
    ...hp,
    max: hp.max + Math.max(1, hpGain),
    current: hp.current + Math.max(1, hpGain),
    hitDice: {
      ...hp.hitDice,
      [hitDie]: {
        max: {
          quantity: current.max.quantity + 1,
          sides: hitDie,
        },
        current: {
          quantity: current.current.quantity + 1,
          sides: hitDie,
        },
      },
    },
  })
}

function uniqueKnownSpells<T extends { spells: { id: string } }>(
  entries: T[],
): T[] {
  const seen = new Set<string>()

  return entries.filter((entry) => {
    if (seen.has(entry.spells.id)) return false
    seen.add(entry.spells.id)
    return true
  })
}

function compactChoices(
  choices: Record<string, string[]>,
): Record<string, string[]> | undefined {
  const compact = Object.fromEntries(
    Object.entries(choices).filter(([, values]) => values.length > 0),
  )
  return Object.keys(compact).length ? compact : undefined
}

function resolveSpellSourceClass(
  sourceId: string,
  sourceName: string,
): ClassName {
  const candidate = sourceId || sourceName
  return candidate.split(":")[0] as ClassName
}

function getCharacterLevelBeforePlan(
  plans: ProgressionClassPlan[],
): number {
  const gained = plans.reduce(
    (sum, plan) => sum + Math.max(0, plan.level - plan.previousLevel),
    0,
  )
  const finalTotal = plans.reduce((sum, plan) => sum + plan.level, 0)
  return Math.max(0, finalTotal - gained)
}
