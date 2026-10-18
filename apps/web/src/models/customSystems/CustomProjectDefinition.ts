import type { CustomAbilityRollDefinition } from "./CustomAbilityDefinition"
import type { CustomCondition, CustomSystemEventType } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { JsonValue } from "./CustomGenerals"

/**
 * Generic long-running activity supplied by a custom system.
 *
 * The engine deliberately knows nothing about crafting. A project can represent
 * crafting, research, training, construction, rituals, travel preparation, etc.
 */
export interface CustomProjectDefinition {
  id: string
  name: string
  description?: string
  enabled?: boolean
  /** Extra per-project data the user fills when an instance is created. */
  fields?: CustomFieldDefinition[]
  /** Base amount of work. A formula can derive it from character/system data. */
  work: CustomProjectWorkDefinition
  /** Event that attempts to advance the project. */
  trigger: CustomProjectTriggerDefinition
  /** Optional gates checked before a trigger is processed. */
  requirements?: CustomProjectRequirementDefinition[]
  /** Optional inventory behavior. Useful for crafting without making projects crafting-specific. */
  inventory?: CustomProjectInventoryDefinition
}

export interface CustomProjectWorkDefinition {
  total?: number
  totalFormula?: string
  minimumProgress?: number
  maximumProgressFormula?: string
}

export interface CustomProjectTriggerDefinition {
  event: CustomSystemEventType
  roll?: CustomAbilityRollDefinition
  /** DC used when the roll itself does not provide one. */
  dc?: number
  dcFormula?: string
  outcomes: {
    criticalFailure: CustomProjectOutcomeDefinition
    failure: CustomProjectOutcomeDefinition
    success: CustomProjectOutcomeDefinition
    criticalSuccess: CustomProjectOutcomeDefinition
  }
}

export interface CustomProjectOutcomeDefinition {
  progress: number
  progressFormula?: string
  label?: string
}

export type CustomProjectRequirementDefinition =
  | {
      id: string
      type: "condition"
      condition: CustomCondition
      description?: string
    }
  | {
      id: string
      type: "inventoryAccess"
      location: "party" | "character" | "ground"
      description?: string
    }
  | {
      id: string
      type: "projectField"
      fieldId: string
      operator: "equals" | "notEquals" | "isTruthy" | "isFalsy"
      value?: JsonValue
      description?: string
    }

export interface CustomProjectInventoryDefinition {
  /** Inputs are selected from inventory when the instance is created. */
  allowInputs?: boolean
  /** Prevent selected stacks/quantities from being committed to another project. */
  reserveInputs?: boolean
  /** Consume reserved inputs only when the project completes. */
  consumeInputsOnCompletion?: boolean
  /** Return/release reserved inputs if the project is cancelled. */
  releaseInputsOnCancellation?: boolean
  /** Allow an item template/result to be attached to the project instance. */
  allowOutput?: boolean
}

export interface CustomProjectItemReservation {
  itemId: string
  quantity: number
  location: "party" | "character" | "ground"
  characterId?: string
}

export interface CustomProjectInstance {
  id: string
  definitionId: string
  name?: string
  status: "active" | "paused" | "completed" | "cancelled"
  progress: number
  totalWork: number
  values?: Record<string, JsonValue>
  inputs?: CustomProjectItemReservation[]
  /** Opaque result data; the owning custom system decides how to interpret it. */
  output?: Record<string, JsonValue>
  createdAt?: string
  completedAt?: string
  lastProcessedAt?: string
}
