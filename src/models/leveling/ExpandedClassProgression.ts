import {
  applyConfiguredClassProgressions,
  CLASS_PROGRESSIONS,
  getCantripsKnownAtLevel,
  getClassProgression,
  getFeaturesAtLevel,
  type ClassProgressionDefinition,
} from "../../data/classProgression"
import type { ClassName } from "../sheet/Class"
import { applyAdditionalProgressionLocalization } from "./ProgressionAdditionalLocalization"
import { localizeProgressionDefinitions } from "./ProgressionLocalization"
import { localizeRemainingSubclasses } from "./SubclassLocalization"

let expanded = false

function ensureExpandedProgressions(): void {
  if (expanded) return
  expanded = true

  applyConfiguredClassProgressions(CLASS_PROGRESSIONS)
  localizeProgressionDefinitions(CLASS_PROGRESSIONS)
  applyAdditionalProgressionLocalization(CLASS_PROGRESSIONS)
  localizeRemainingSubclasses(CLASS_PROGRESSIONS)
}

ensureExpandedProgressions()

export const EXPANDED_CLASS_PROGRESSIONS: Record<
  ClassName,
  ClassProgressionDefinition
> = CLASS_PROGRESSIONS

export function getExpandedClassProgression(
  className: ClassName,
): ClassProgressionDefinition {
  ensureExpandedProgressions()
  return getClassProgression(className)
}

export function getExpandedFeaturesAtLevel(
  className: ClassName,
  level: number,
  subclassId?: string,
) {
  ensureExpandedProgressions()
  return getFeaturesAtLevel(className, level, subclassId)
}

export function getExpandedCantripsKnownAtLevel(
  className: ClassName,
  level: number,
): number {
  ensureExpandedProgressions()
  return getCantripsKnownAtLevel(className, level)
}
