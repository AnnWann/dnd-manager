import type { Ability } from "../abilities/Ability"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionReason,
} from "../characters/CharacterAcquisition"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { ensureCharacterAcquisitionMetadata } from "../characters/characterAcquisitionMetadata"
import {
  getDerivedSorceryPointMaximum,
  getSorceryPointPool,
} from "../characters/characterSorceryPoints"
import type { MetamagicId } from "../magic/metamagic/Metamagic"
import type { Spell } from "../magic/spells/Spell"
import type { ClassName } from "../sheet/Class"
import type { HP } from "../sheet/HP"
import { getClassProgression } from "../../data/classProgression"
import { createClassEntry } from "./SpellSelectionRules"

export type ProgressionClassPlan = {
  className: ClassName
  level: number
  previousLevel: number
  subclassId?: string
  subclassName?: string
  subclassSource?: string
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
  /** User-selected metamagics. The application never infers which options to take. */
  metamagics?: MetamagicId[]
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

  const previousClasses = character.get("sheet").classes ?? []
  const classes = application.classPlans.map((plan) => {
    const previous = previousClasses.find(
      (entry) => entry.className === plan.className,
    )
    const subclassName = plan.subclassName?.trim() || previous?.subclass?.name
    const subclassSource =
      plan.subclassSource?.trim() || previous?.subclass?.source || "Manual"
    const subclassId =
      plan.subclassId || previous?.subclass?.id || slug(subclassName ?? "")

    return {
      ...createClassEntry(plan.className, plan.level),
      subclass: subclassName
        ? {
            id: subclassId || slug(subclassName),
            name: subclassName,
            source: subclassSource,
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
  const customClassIds = new Set(
    customClassAbilities.map((ability) => ability.id),
  )
  updated = updated.with("abilities", [
    ...(updated.get("abilities") ?? []).filter(
      (ability) => !customClassIds.has(ability.id),
    ),
    ...customClassAbilities,
  ])

  const race = updated.get("sheet").race
  const raceName = race.customName?.trim() || race.subrace?.trim() || race.race
  const customRacialAbilities = application.customAbilities
    .filter((entry) => entry.source === "race")
    .map((entry) =>
      stampAbility(entry.ability, {
        eventId,
        addedAt,
        reason,
        characterLevel: totalLevel,
        sourceType: "race",
        sourceId: String(race.race),
        sourceName: raceName,
      }),
    )
  if (customRacialAbilities.length) {
    const customIds = new Set(customRacialAbilities.map((ability) => ability.id))
    updated = updated.withSheet("race", {
      ...race,
      naturalAbilities: [
        ...(race.naturalAbilities ?? []).filter(
          (ability) => !customIds.has(ability.id),
        ),
        ...customRacialAbilities,
      ],
    })
  }

  if (application.spellSelections.length) {
    updated = applyManualSpellSelections(
      updated,
      application,
      eventId,
      addedAt,
      reason,
      classLabels,
    )
  }
  updated = updated.syncMagicWithClasses()

  if (application.metamagics !== undefined) {
    updated = applyManualMetamagics(
      character,
      updated,
      application.metamagics,
    )
  }

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

function applyManualSpellSelections(
  character: CharacterTemplate,
  application: CharacterProgressionApplication,
  eventId: string,
  addedAt: string,
  reason: CharacterAcquisitionReason,
  classLabels: Map<ClassName, string>,
): CharacterTemplate {
  const byIndex = new Map(
    application.spells.map((spell) => [spell.index, spell]),
  )
  const selections = application.spellSelections.flatMap((selection) => {
    const plan = application.classPlans.find(
      (entry) => entry.className === selection.className,
    )
    if (!plan) return []

    const knownMode = createClassEntry(
      selection.className,
      plan.level,
    ).knownSpells?.mode

    if (
      knownMode !== "limited" &&
      knownMode !== "spellbook" &&
      knownMode !== "prepared-only"
    ) {
      return []
    }

    return [{ selection, plan, knownMode }]
  })

  if (!selections.length) return character

  const currentMagic = character.get("magic") ?? {
    spells: {
      knownSpells: [],
      slots: {},
      pactSlots: { level: 0, max: 0, current: 0 },
    },
  }
  const selectionByClass = new Map(
    selections.map((entry) => [entry.selection.className, entry]),
  )
  const retained = currentMagic.spells.knownSpells.filter((entry) => {
    if (entry.source.type !== "class") return true

    const className = resolveSpellSourceClass(
      entry.source.sourceId,
      entry.source.name,
    )
    const selectedClass = selectionByClass.get(className)
    if (!selectedClass) return true

    if (selectedClass.knownMode !== "prepared-only") {
      return false
    }

    // Prepared casters only replace their learned cantrips here. Their leveled
    // class list/preparation state is managed separately and must survive.
    return byIndex.get(entry.spells.id)?.slotLevel !== 0
  })
  const additions = [] as typeof currentMagic.spells.knownSpells

  for (const { selection, plan, knownMode } of selections) {
    const existingForClass = new Map(
      currentMagic.spells.knownSpells
        .filter(
          (entry) =>
            entry.source.type === "class" &&
            resolveSpellSourceClass(entry.source.sourceId, entry.source.name) ===
              selection.className,
        )
        .map((entry) => [entry.spells.id, entry]),
    )
    const classEntry = createClassEntry(selection.className, plan.level)
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

    for (const spellIndex of selection.spellIndexes) {
      const spell = byIndex.get(spellIndex)
      if (!spell) continue
      if (knownMode === "prepared-only" && spell.slotLevel !== 0) continue

      const existing = existingForClass.get(spellIndex)
      additions.push({
        source: {
          ...(existing?.source ?? {}),
          type: "class",
          name: selection.className,
          sourceId: selection.className,
          attribute: classEntry.castingAttribute ?? "int",
          extendedList: existing?.source.extendedList ?? false,
        },
        spells: {
          id: spellIndex,
          prepared:
            knownMode === "prepared-only" && spell.slotLevel === 0
              ? true
              : existing?.spells.prepared ??
                selection.preparedSpellIndexes.includes(spellIndex),
        },
        acquisition: existing?.acquisition ?? classAcquisition,
      })
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

function applyManualMetamagics(
  previousCharacter: CharacterTemplate,
  character: CharacterTemplate,
  metamagics: MetamagicId[],
): CharacterTemplate {
  const previousPool = getSorceryPointPool(previousCharacter)
  const spentPoints = Math.max(0, previousPool.max - previousPool.current)
  const ensured = character.ensureMagic()
  const magic = ensured.get("magic")
  if (!magic) return ensured

  const max = getDerivedSorceryPointMaximum(ensured)
  return ensured.with("magic", {
    ...magic,
    metamagic: {
      ...magic.metamagic,
      metamagics: Array.from(new Set(metamagics)),
      sorceryPoints: {
        max,
        current: Math.max(0, max - spentPoints),
      },
    },
  })
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
  const hp = character.get("sheet").HP
  const hitDie = getClassProgression(className).hitDie
  const currentHitDice = hp.hitDice[hitDie] ?? {
    max: { quantity: 0, sides: hitDie },
    current: { quantity: 0, sides: hitDie },
  }
  const gain = Math.max(1, Math.trunc(hpGain))
  return character.withSheet("HP", {
    ...hp,
    max: hp.max + gain,
    current: hp.current + gain,
    hitDice: {
      ...hp.hitDice,
      [hitDie]: {
        max: {
          quantity: currentHitDice.max.quantity + 1,
          sides: hitDie,
        },
        current: {
          quantity: currentHitDice.current.quantity + 1,
          sides: hitDie,
        },
      },
    },
  })
}

function compactChoices(
  choices: Record<string, string[]>,
): Record<string, string[]> | undefined {
  const entries = Object.entries(choices).filter(([, values]) => values.length)
  return entries.length ? Object.fromEntries(entries) : undefined
}

function resolveSpellSourceClass(
  sourceId: string | undefined,
  sourceName: string,
): ClassName {
  const raw = String(sourceId ?? sourceName)
  return raw.split(":")[0] as ClassName
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
