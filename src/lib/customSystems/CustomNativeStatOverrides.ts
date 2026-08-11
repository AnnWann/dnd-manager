import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CharacterCustomSystemState,
  CustomNativeStatTarget,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import { evaluateCustomFormula } from "./CustomFormulaEngineWithCharacter"

export type CustomSystemDefinitionResolver = (
  systemId: string,
) => CustomSystemDefinition | undefined

let resolveDefinition: CustomSystemDefinitionResolver = () => undefined
let evaluatingOverride = false

export function configureCustomNativeStatOverrides(
  resolver: CustomSystemDefinitionResolver,
): void {
  resolveDefinition = resolver
}

export function getCustomNativeStatOverride(
  character: CharacterTemplate,
  target: CustomNativeStatTarget,
): number | undefined {
  if (evaluatingOverride) return undefined

  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const candidates = states.flatMap((state) => {
    if (state.enabled === false) return []
    const definition = resolveDefinition(state.systemId)
    if (!definition) return []

    return (definition.nativeStatOverrides ?? [])
      .filter(
        (override) =>
          override.enabled !== false &&
          override.target === target &&
          override.formula.trim(),
      )
      .map((override) => ({ definition, state, override }))
  })

  candidates.sort((left, right) => {
    const priorityDifference =
      (right.override.priority ?? 0) - (left.override.priority ?? 0)
    if (priorityDifference) return priorityDifference
    return left.definition.id.localeCompare(right.definition.id)
  })

  evaluatingOverride = true
  try {
    for (const candidate of candidates) {
      const result = evaluateCustomFormula(
        candidate.override.formula,
        candidate.definition,
        candidate.state,
        character,
      )
      if (
        result.ok &&
        typeof result.value === "number" &&
        Number.isFinite(result.value)
      ) {
        return result.value
      }
    }
  } finally {
    evaluatingOverride = false
  }

  return undefined
}
