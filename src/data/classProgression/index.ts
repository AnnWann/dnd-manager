import type { ClassName } from "../../models/sheet/Class"
import { applyClassProgressionModules } from "./applyClassProgressionModules"
import type { ClassProgressionDefinition } from "./catalog/ClassProgression"
import { CLASS_PROGRESSION_MODULES } from "./registry"

export * from "./applyProgressionAbilityConfig"
export * from "./builders"
export * from "./catalog/ClassProgression"
export * from "./types"
export { CLASS_PROGRESSION_MODULES }

export function applyConfiguredClassProgressions(
  progressions: Record<ClassName, ClassProgressionDefinition>,
): void {
  applyClassProgressionModules(progressions, CLASS_PROGRESSION_MODULES)
}
