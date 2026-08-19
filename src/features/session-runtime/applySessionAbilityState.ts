import { getCharacterAsis, withCharacterAsis } from "../../models/characters/CharacterAsi"
import { CharacterTemplate } from "../../models/characters/CharacterTemplate"
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

  // Abilities, magic and equipment now share the same authoritative snapshot.
  const authoritativeMagic = authoritative.get("magic")
  if (authoritativeMagic) next = next.with("magic", authoritativeMagic)

  next = next.with("equipment", authoritative.get("equipment"))
  // Equipment operations can move items back into character inventory. Keep
  // both slices from the same revision so an unequip cannot render halfway.
  next = next.with("inventory", authoritative.get("inventory"))

  next = withCharacterAsis(next, getCharacterAsis(authoritative))

  const currentRace = next.get("sheet").race
  const authoritativeRace = authoritative.get("sheet").race
  next = next.withSheet("race", {
    ...currentRace,
    naturalAbilities: authoritativeRace.naturalAbilities ?? currentRace.naturalAbilities,
  })

  // Custom spell-slot pools persist their current value in class levelChoices.
  const currentClasses = next.get("sheet").classes ?? []
  const authoritativeClasses = authoritative.get("sheet").classes ?? []
  next = next.withSheet("classes", currentClasses.map((entry, index) => {
    const source = authoritativeClasses[index]
    if (!source || source.className !== entry.className || source.level !== entry.level) return entry
    return { ...entry, levelChoices: source.levelChoices ?? entry.levelChoices }
  }))

  return next
}
