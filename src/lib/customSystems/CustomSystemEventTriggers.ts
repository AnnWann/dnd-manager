import type { Trigger } from "../../models/abilities/Ability"
import type { CustomSystemEventType } from "../../models/customSystems/CustomAutomationDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"

/**
 * Events in this set are not derivable from authoritative sheet state alone.
 * They represent something that happened at the physical table (for example,
 * the result of an attack roll) and therefore must come from an explicit
 * ability activation on the character sheet.
 */
export type ExplicitTableEvent = Extract<
  CustomSystemEventType,
  "attackHit" | "criticalHit"
>

export function resolveExplicitTableEventsForAbility(
  definitions: CustomSystemDefinition[],
  states: CharacterCustomSystemState[],
  systemId: string,
  abilityId: string,
): ExplicitTableEvent[] {
  const definition = definitions.find((entry) => entry.id === systemId)
  const state = states.find((entry) => entry.systemId === systemId)
  const ability = state?.abilities.find((entry) => entry.id === abilityId)
  if (!definition || !ability) return []

  const type = definition.abilityTypes.find(
    (entry) => entry.id === ability.abilityTypeId,
  )
  if (!type) return []

  const preset = ability.predefinedAbilityId
    ? type.predefinedAbilities?.find(
        (entry) => entry.id === ability.predefinedAbilityId,
      )
    : undefined

  const trigger = resolveEffectiveTrigger(
    ability,
    preset?.activation?.triggerFieldId ?? type.activation?.triggerFieldId,
    preset?.activation?.trigger ?? type.activation?.trigger,
  )

  return eventsForTrigger(trigger)
}

function resolveEffectiveTrigger(
  ability: CustomAbilityInstance,
  triggerFieldId: string | undefined,
  fallback: Trigger | undefined,
): Trigger | undefined {
  if (triggerFieldId) {
    const value = ability.values[triggerFieldId]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return fallback
}

function eventsForTrigger(trigger: Trigger | undefined): ExplicitTableEvent[] {
  if (trigger === "onHit") return ["attackHit"]
  if (trigger === "onCrit") return ["attackHit", "criticalHit"]
  return []
}
