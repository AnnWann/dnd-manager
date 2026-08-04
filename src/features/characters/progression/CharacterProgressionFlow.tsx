import type { ComponentProps } from "react"

import { useMagicContext } from "../../../contexts/magicContext"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionMetadata,
} from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getDynamicSubclassSpellGrants,
} from "../../../models/leveling/DynamicSubclassSpellRules"
import {
  createClassEntry,
  normalizeSpellName,
} from "../../../models/leveling/SpellSelectionRules"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { CharacterSpells } from "../../../models/magic/spells/CharacterSpells"
import type { ClassName } from "../../../models/sheet/Class"
import { CharacterProgressionConfigurator } from "./CharacterProgressionConfigurator"

type Props = ComponentProps<typeof CharacterProgressionConfigurator>
type KnownSpell = CharacterSpells["knownSpells"][number]

export function CharacterProgressionFlow({
  onComplete,
  ...props
}: Props) {
  const { spells } = useMagicContext()

  return (
    <CharacterProgressionConfigurator
      {...props}
      onComplete={(character) =>
        onComplete(
          finalizeDynamicSubclassSpells(
            character,
            spells,
            props.mode,
          ),
        )
      }
    />
  )
}

export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
  spells: Spell[],
  mode: "creation" | "level-up",
): CharacterTemplate {
  const magic = character.get("magic")
  if (!magic) return character

  const spellByName = new Map<string, Spell>()
  for (const spell of spells) {
    spellByName.set(normalizeSpellName(spell.name), spell)
    if (spell.displayName?.trim()) {
      spellByName.set(normalizeSpellName(spell.displayName), spell)
    }
  }

  let knownSpells = [...magic.spells.knownSpells]
  const totalLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )

  for (const classEntry of character.get("sheet").classes ?? []) {
    const subclassId = classEntry.subclass?.id
    const grants = getDynamicSubclassSpellGrants(
      character,
      classEntry.className,
      subclassId,
      classEntry.level,
    )
    if (!grants.length) continue

    const event = findLatestProgressionEvent(
      character,
      classEntry.className,
      mode,
    )

    for (const grant of grants) {
      const spell = spellByName.get(normalizeSpellName(grant.spellName))
      if (!spell) continue

      const existingIndex = knownSpells.findIndex(
        (entry) => entry.spells.id === spell.index,
      )

      if (grant.mode === "expanded-list") {
        if (existingIndex >= 0) {
          knownSpells[existingIndex] = markAsExtendedList(
            knownSpells[existingIndex],
            classEntry.className,
          )
        }
        continue
      }

      if (existingIndex >= 0) {
        const existing = knownSpells[existingIndex]
        knownSpells[existingIndex] = {
          ...existing,
          source: {
            ...existing.source,
            extendedList: true,
          },
          spells: {
            ...existing.spells,
            prepared:
              grant.mode === "always-prepared"
                ? true
                : existing.spells.prepared,
          },
        }
        continue
      }

      const acquisition = createCharacterAcquisition({
        eventId: event?.eventId,
        addedAt: event?.addedAt,
        reason:
          mode === "creation" ? "character-creation" : "level-up",
        characterLevel: event?.characterLevel ?? totalLevel,
        className: classEntry.className,
        classLevel: grant.classLevel,
        sourceType: "class",
        sourceId: `${classEntry.className}:${grant.subclassId}`,
        sourceName: grant.sourceName,
      })
      const source = createClassEntry(
        classEntry.className,
        classEntry.level,
      )

      knownSpells.push({
        source: {
          type: "class",
          name: classEntry.className,
          sourceId: classEntry.className,
          attribute: source.castingAttribute ?? "int",
          extendedList: true,
        },
        spells: {
          id: spell.index,
          prepared: grant.mode === "always-prepared",
        },
        acquisition,
      })
    }
  }

  return character.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      knownSpells,
    },
  })
}

function markAsExtendedList(
  entry: KnownSpell,
  className: ClassName,
): KnownSpell {
  if (
    entry.source.type !== "class" ||
    (entry.source.sourceId !== className && entry.source.name !== className)
  ) {
    return entry
  }

  return {
    ...entry,
    source: {
      ...entry.source,
      extendedList: true,
    },
  }
}

function findLatestProgressionEvent(
  character: CharacterTemplate,
  className: ClassName,
  mode: "creation" | "level-up",
): CharacterAcquisitionMetadata | undefined {
  const reason = mode === "creation" ? "character-creation" : "level-up"
  const candidates: CharacterAcquisitionMetadata[] = []

  for (const ability of character.get("abilities") ?? []) {
    if (
      ability.acquisition?.reason === reason &&
      ability.acquisition.className === className
    ) {
      candidates.push(ability.acquisition)
    }
  }

  for (const spell of character.get("magic")?.spells.knownSpells ?? []) {
    if (
      spell.acquisition?.reason === reason &&
      spell.acquisition.className === className
    ) {
      candidates.push(spell.acquisition)
    }
  }

  return candidates.toSorted((left, right) =>
    right.addedAt.localeCompare(left.addedAt),
  )[0]
}
