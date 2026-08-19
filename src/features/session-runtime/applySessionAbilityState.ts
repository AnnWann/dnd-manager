import { getCharacterAsis, withCharacterAsis } from "../../models/characters/CharacterAsi"
import { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { SessionAbilityState } from "./abilitySessionProtocol"

/**
 * Applies only the slices owned by the ability runtime.
 *
 * The ability server stores a full character snapshot so it can evaluate the
 * existing domain rules, but the client must not replace the whole session
 * character with that snapshot: inventory, spells and other tabs are still
 * being migrated independently. This projection deliberately copies only
 * mutable ability state and resource pools touched by ability activation.
 */
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

  let next = character.with(
    "abilities",
    authoritative.get("abilities") ?? [],
  )

  const currentMagic = next.get("magic")
  const authoritativeMagic = authoritative.get("magic")
  if (currentMagic || authoritativeMagic) {
    const base = next.getOrCreateMagic()
    next = next.with("magic", {
      ...base,
      invocations: authoritativeMagic?.invocations ?? base.invocations,
      channelDivinity:
        authoritativeMagic?.channelDivinity ?? base.channelDivinity,
      ki: authoritativeMagic?.ki ?? base.ki,
    })
  }

  next = withCharacterAsis(next, getCharacterAsis(authoritative))

  const currentRace = next.get("sheet").race
  const authoritativeRace = authoritative.get("sheet").race
  next = next.withSheet("race", {
    ...currentRace,
    naturalAbilities:
      authoritativeRace.naturalAbilities ?? currentRace.naturalAbilities,
  })

  const authoritativeItems = collectEquipmentItems(authoritative)
  next = next.with(
    "equipment",
    mapEquipmentItems(next.get("equipment"), (item) => {
      const source = authoritativeItems.get(item.id)
      if (!source || !("abilities" in source)) return item
      return {
        ...item,
        abilities: source.abilities,
      }
    }),
  )

  return next
}

function collectEquipmentItems(
  character: CharacterTemplate,
): Map<string, Record<string, any>> {
  const items = new Map<string, Record<string, any>>()
  const equipment = character.get("equipment") as Record<string, any>

  for (const value of Object.values(equipment)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isItem(item)) items.set(item.id, item)
      }
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
  return Object.fromEntries(
    Object.entries(equipment).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.map((item) => isItem(item) ? mapper(item) : item)]
      }
      return [key, isItem(value) ? mapper(value) : value]
    }),
  ) as T
}

function isItem(value: unknown): value is Record<string, any> & { id: string } {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).id === "string"
}
