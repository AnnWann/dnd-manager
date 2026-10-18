import { getCharacterAsis, withCharacterAsis } from "../../models/characters/CharacterAsi"
import { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import { isCustomClassEntry } from "../../models/characters/customClassConfig"
import type { SessionAbilityState } from "./abilitySessionProtocol"

/** Applies the slices already owned by authoritative session runtimes. */
export function applySessionAbilityState(
  character: CharacterTemplate,
  state?: SessionAbilityState,
): CharacterTemplate {
  if (!state?.initialized) return character

  let authoritative: CharacterTemplate
  try {
    authoritative = CharacterTemplate.fromJSON(state.character)
  } catch {
    return character
  }

  let next = character.with("abilities", authoritative.get("abilities") ?? [])

  // These tabs share the same authoritative character snapshot.
  const authoritativeMagic = authoritative.get("magic")
  if (authoritativeMagic) next = next.with("magic", authoritativeMagic)

  next = next.with("equipment", authoritative.get("equipment"))
  next = next.with("inventory", authoritative.get("inventory"))
  next = next.with("profile", authoritative.get("profile"))
  next = next.withSheet("proficiencies", authoritative.get("sheet").proficiencies ?? [])
  next = next.withSheet("race", authoritative.get("sheet").race)

  next = withCharacterAsis(next, getCharacterAsis(authoritative))

  // A lifecycle resync (notably level up) owns the class roster and its
  // progression state. Keep durable official class definitions where possible,
  // but project the authoritative level/subclass/choices so the session sheet
  // reflects the level-up immediately. Authoritative-only entries also need to
  // appear so multiclass additions are not lost.
  const currentClasses = next.get("sheet").classes ?? []
  const authoritativeClasses = authoritative.get("sheet").classes ?? []
  next = next.withSheet("classes", authoritativeClasses.map((source, index) => {
    const indexed = currentClasses[index]
    const entry = indexed?.className === source.className
      ? indexed
      : currentClasses.find((candidate) => candidate.className === source.className)

    if (!entry) return source

    if (isCustomClassEntry(entry) || isCustomClassEntry(source)) {
      return {
        ...entry,
        ...source,
        levelChoices: {
          ...(entry.levelChoices ?? {}),
          ...(source.levelChoices ?? {}),
        },
      }
    }

    return {
      ...entry,
      level: source.level,
      subclass: source.subclass ?? entry.subclass,
      levelChoices: source.levelChoices ?? entry.levelChoices,
    }
  }))

  return next
}
