import type { ClassProgressionDefinition } from "../../models/leveling/ClassProgression"
import type { ClassName } from "../../models/sheet/Class"
import { applyClassProgressionModules } from "./applyClassProgressionModules"
import { CLASS_PROGRESSION_MODULES } from "./registry"

export * from "./applyProgressionAbilityConfig"
export * from "./builders"
export * from "./types"
export { CLASS_PROGRESSION_MODULES }

export function applyConfiguredClassProgressions(
  progressions: Record<ClassName, ClassProgressionDefinition>,
): void {
  applyClassProgressionModules(progressions, CLASS_PROGRESSION_MODULES)
}
