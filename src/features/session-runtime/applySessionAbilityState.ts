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

  // Abilities and magic now share the same authoritative character snapshot.
  // Copy the whole magic slice so spell preparation, slots, metamagic and
  // shared class resources cannot diverge between participants.
  const authoritativeMagic = authoritative.get("magic")
  if (authoritativeMagic) next = next.with("magic", authoritativeMagic)

  next = withCharacterAsis(next, getCharacterAsis(authoritative))

  const currentRace = next.get("sheet").race
  const authoritativeRace = authoritative.get("sheet").race
  next = next.withSheet("race", {
    ...currentRace,
    naturalAbilities: authoritativeRace.naturalAbilities ?? currentRace.naturalAbilities,
  })

  // Custom spell-slot pools persist their current value in class levelChoices.
  // Preserve local class identity/levels while copying only the authoritative
  // levelChoices for matching class entries.
  const currentClasses = next.get("sheet").classes ?? []
  const authoritativeClasses = authoritative.get("sheet").classes ?? []
  next = next.withSheet("classes", currentClasses.map((entry, index) => {
    const source = authoritativeClasses[index]
    if (!source || source.className !== entry.className || source.level !== entry.level) return entry
    return { ...entry, levelChoices: source.levelChoices ?? entry.levelChoices }
  }))

  const authoritativeItems = collectEquipmentItems(authoritative)
  next = next.with(
    "equipment",
    mapEquipmentItems(next.get("equipment"), (item) => {
      const source = authoritativeItems.get(item.id)
      if (!source || !("abilities" in source)) return item
      return { ...item, abilities: source.abilities }
    }),
  )

  return next
}

function collectEquipmentItems(character: CharacterTemplate): Map<string, Record<string, any>> {
  const items = new Map<string, Record<string, any>>()
  const equipment = character.get("equipment") as Record<string, any>
  for (const value of Object.values(equipment)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isItem(item)) items.set(item.id, item)
      continue
    }
    if (isItem(value)) items.set(value.id, value)
  }
  return items
}

function mapEquipmentItems<T extends Record<string, any>>(
  equipment: T,
  mapper: (item: Record<string, any>) => Record<string, any>,
): T {
  return Object.fromEntries(Object.entries(equipment).map(([key, value]) => {
    if (Array.isArray(value)) return [key, value.map((item) => isItem(item) ? mapper(item) : item)]
    return [key, isItem(value) ? mapper(value) : value]
  })) as T
}

function isItem(value: unknown): value is Record<string, any> & { id: string } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).id === "string"
}
