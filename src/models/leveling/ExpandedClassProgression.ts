import {
  CLASS_PROGRESSIONS,
  getCantripsKnownAtLevel,
  getClassProgression,
  getFeaturesAtLevel,
  type ClassProgressionDefinition,
} from "./ClassProgression"
import { applyAdditionalProgressionLocalization } from "./ProgressionAdditionalLocalization"
import { localizeProgressionDefinitions } from "./ProgressionLocalization"
import { XANATHAR_SUBCLASSES } from "./XanatharSubclasses"
import type { ClassName } from "../sheet/Class"

let expanded = false

function ensureExpandedProgressions(): void {
  if (expanded) return
  expanded = true

  for (const [rawClassName, additions] of Object.entries(
    XANATHAR_SUBCLASSES,
  )) {
    const className = rawClassName as ClassName
    const progression = CLASS_PROGRESSIONS[className]
    if (!progression || !additions?.length) continue

    const existingIds = new Set(
      progression.subclasses.map((subclass) => subclass.id),
    )

    progression.subclasses = [
      ...progression.subclasses,
      ...additions.filter((subclass) => !existingIds.has(subclass.id)),
    ]
  }

  localizeProgressionDefinitions(CLASS_PROGRESSIONS)
  applyAdditionalProgressionLocalization(CLASS_PROGRESSIONS)
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
