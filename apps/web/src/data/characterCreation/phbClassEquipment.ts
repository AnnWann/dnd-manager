import type { ClassName } from "../../models/sheet/Class"
import type {
  ClassEquipmentPreset,
  StartingItemSpec,
} from "./phbClassEquipment.legacy"
import * as legacy from "./phbClassEquipment.legacy"

export type {
  StartingItemCategory,
  StartingItemSpec,
  ClassEquipmentOption,
  ClassEquipmentChoiceGroup,
  StartingGoldFormula,
  ClassEquipmentPreset,
} from "./phbClassEquipment.legacy"

export {
  formatStartingGoldFormula,
  averageStartingGold,
  rollStartingGold,
} from "./phbClassEquipment.legacy"

const CUSTOM_CLASS_RUNTIME_ID = "__custom__"
const CUSTOM_CLASS_EQUIPMENT_PRESET: ClassEquipmentPreset = {
  className: CUSTOM_CLASS_RUNTIME_ID as ClassName,
  fixedItems: [],
  choiceGroups: [],
  startingGold: { dice: 0, sides: 1, multiplier: 1 },
}

export function getPhbClassEquipmentPreset(
  className: ClassName,
): ClassEquipmentPreset {
  if (String(className) === CUSTOM_CLASS_RUNTIME_ID) {
    return CUSTOM_CLASS_EQUIPMENT_PRESET
  }
  return legacy.getPhbClassEquipmentPreset(className)
}

export function getDefaultClassEquipmentSelections(
  className: ClassName,
): Record<string, string> {
  if (String(className) === CUSTOM_CLASS_RUNTIME_ID) return {}
  return legacy.getDefaultClassEquipmentSelections(className)
}

export function getSelectedClassEquipment(
  className: ClassName,
  selections: Record<string, string>,
): StartingItemSpec[] {
  if (String(className) === CUSTOM_CLASS_RUNTIME_ID) return []
  return legacy.getSelectedClassEquipment(className, selections)
}

export function getPhbClassStartingEquipmentText(
  className: ClassName,
): string {
  if (String(className) === CUSTOM_CLASS_RUNTIME_ID) return ""
  return legacy.getPhbClassStartingEquipmentText(className)
}
