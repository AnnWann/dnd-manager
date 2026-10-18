import type { Ability } from "../../../models/abilities/Ability"
import {
  withCharacterAsis,
  type CharacterAsi,
} from "../../../models/characters/CharacterAsi"
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import {
  applyManualProficiencies,
  mergeProficiencies,
} from "../../../models/characters/applyManualProficiencies"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { ClassName } from "../../../models/sheet/Class"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import {
  applyCharacterProgression,
  type ProgressionClassPlan,
  type ProgressionCustomAbility,
  type ProgressionSpellSelection,
} from "../../../models/leveling/applyCharacterProgression"
import type { LevelUpSpellSelection } from "../progression/LevelUpSpellSelectionModal"

export type CreationClassConfiguration = {
  abilities: Ability[]
  proficiencies: Proficiency[]
  spells: LevelUpSpellSelection
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

export type CreationProgressionConfiguration = {
  classes: Partial<Record<ClassName, CreationClassConfiguration>>
  race: CreationRaceConfiguration
}

export function createEmptyCreationProgressionConfiguration(): CreationProgressionConfiguration {
  return {
    classes: {},
    race: {
      abilities: [],
      proficiencies: [],
      cantrips: [],
      spells: [],
      castingAttribute: "cha",
    },
  }
}

export function getCreationClassConfiguration(
  value: CreationProgressionConfiguration,
  className: ClassName,
): CreationClassConfiguration {
  return value.classes[className] ?? {
    abilities: [],
    proficiencies: [],
    spells: { selected: [], prepared: [] },
    metamagics: [],
    invocations: [],
    asis: [],
  }
}

export function applyCreationProgressionConfiguration(
  character: CharacterTemplate,
  configuration: CreationProgressionConfiguration,
  spells: Spell[],
): CharacterTemplate {
  const classes = character.get("sheet").classes ?? []
  const classPlans: ProgressionClassPlan[] = classes.map((entry) => ({
    className: entry.className,
    level: entry.level,
    previousLevel: 0,
    subclassId: entry.subclass?.id,
    subclassName: entry.subclass?.name,
    subclassSource: entry.subclass?.source,
    levelChoices: entry.levelChoices ?? {},
    enabledOptionalFeatureIds: [],
  }))

  const customAbilities: ProgressionCustomAbility[] = []
  const spellSelections: ProgressionSpellSelection[] = []
  const metamagics: MetamagicId[] = []

  for (const plan of classPlans) {
    const classConfiguration = configuration.classes[plan.className]
    if (!classConfiguration) continue

    customAbilities.push(
      ...classConfiguration.abilities.map((ability) => ({
        ability: normalizeFeatureAbility(ability, "class"),
        source: "class" as const,
        className: plan.className,
        classLevel: plan.level,
      })),
    )
    spellSelections.push({
      className: plan.className,
      spellIndexes: classConfiguration.spells.selected,
      preparedSpellIndexes: classConfiguration.spells.prepared,
    })
    if (plan.className === "sorcerer") {
      metamagics.push(...classConfiguration.metamagics)
    }
  }

  customAbilities.push(
    ...configuration.race.abilities.map((ability) => ({
      ability: normalizeFeatureAbility(ability, "race"),
      source: "race" as const,
    })),
  )

  let updated = applyCharacterProgression(character, {
    mode: "creation",
    classPlans,
    spellSelections,
    metamagics: metamagics.length ? Array.from(new Set(metamagics)) : undefined,
    customAbilities,
    spells,
    advancedClassName: classPlans[0]?.className,
  })

  const classProficiencies = classPlans.flatMap(
    (plan) => configuration.classes[plan.className]?.proficiencies ?? [],
  )
  updated = applyManualProficiencies(updated, classProficiencies)
  updated = applyRacialConfiguration(updated, configuration.race, spells)
  updated = applyInvocations(updated, configuration, classPlans)
  updated = applyAsis(updated, configuration, classPlans)
  updated = normalizeRacialFeatureKinds(updated)

  return updated
}

function applyRacialConfiguration(
  character: CharacterTemplate,
  configuration: CreationRaceConfiguration,
  spells: Spell[],
): CharacterTemplate {
  let updated = applyManualProficiencies(character, configuration.proficiencies)
  const sheet = updated.get("sheet")
  updated = updated.withSheet("race", {
    ...sheet.race,
    proficiencies: mergeProficiencies(
      sheet.race.proficiencies ?? [],
      configuration.proficiencies,
    ),
  })

  const selectedSpellIndexes = Array.from(
    new Set([...configuration.cantrips, ...configuration.spells]),
  )
  if (!selectedSpellIndexes.length) return updated

  const available = new Set(spells.map((spell) => spell.index))
  const magic = updated.getOrCreateMagic()
  const race = updated.get("sheet").race
  const raceName =
    race.customName?.trim() || race.subrace?.trim() || String(race.race)
  const acquisition = createCharacterAcquisition({
    reason: "character-creation",
    characterLevel: (updated.get("sheet").classes ?? []).reduce(
      (total, entry) => total + entry.level,
      0,
    ),
    sourceType: "race",
    sourceId: String(race.race),
    sourceName: raceName,
  })
  const retained = magic.spells.knownSpells.filter(
    (entry) => entry.source.type !== "race",
  )
  const racialEntries = selectedSpellIndexes
    .filter((index) => available.has(index))
    .map((index) => ({
      source: {
        type: "race" as const,
        name: raceName,
        sourceId: `race:${String(race.race)}`,
        attribute: configuration.castingAttribute,
      },
      spells: {
        id: index,
        prepared: true,
      },
      acquisition,
    }))

  return updated.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      knownSpells: [...retained, ...racialEntries],
    },
  })
}

function applyInvocations(
  character: CharacterTemplate,
  configuration: CreationProgressionConfiguration,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  const warlock = plans.find((plan) => plan.className === "warlock")
  if (!warlock) return character
  const invocations = configuration.classes.warlock?.invocations
  if (!invocations) return character

  const magic = character.getOrCreateMagic()
  return character.with("magic", {
    ...magic,
    invocations: invocations.map((ability) => ({
      ...ability,
      kind: ability.kind === "passive" ? "feature" : ability.kind,
      category: "invocation",
      source: "class",
    })),
  })
}

function applyAsis(
  character: CharacterTemplate,
  configuration: CreationProgressionConfiguration,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  const allowed = new Set(plans.map((plan) => plan.className))
  const asis = plans.flatMap((plan) =>
    (configuration.classes[plan.className]?.asis ?? []).filter(
      (entry) => allowed.has(entry.className) && entry.classLevel <= plan.level,
    ),
  )
  return asis.length ? withCharacterAsis(character, asis) : character
}

function normalizeRacialFeatureKinds(
  character: CharacterTemplate,
): CharacterTemplate {
  const race = character.get("sheet").race
  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((ability) =>
      normalizeFeatureAbility(ability, "race"),
    ),
  })
}

function normalizeFeatureAbility(
  ability: Ability,
  source: "class" | "race",
): Ability {
  return {
    ...ability,
    kind: ability.kind === "passive" ? "feature" : ability.kind || "feature",
    category:
      ability.category === "feat" || ability.category === "invocation"
        ? "general"
        : ability.category,
    source,
  }
}
