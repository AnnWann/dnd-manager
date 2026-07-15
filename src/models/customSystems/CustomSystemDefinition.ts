import type { CustomAbilityTypeDefinition } from "./CustomAbilityDefinition"
import type { CustomAutomationDefinition } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { CustomSystemId, CustomSystemVersion, JsonValue } from "./CustomGenerals"
import type { CustomPanelDefinition } from "./CustomPanelDefinition"
import type { CustomResourceDefinition } from "./CustomResourceDefinition"


export interface CustomSystemDefinition {
  id: CustomSystemId
  name: string
  description?: string
  icon?: string
  version: CustomSystemVersion
  fields: CustomFieldDefinition[]
  resources: CustomResourceDefinition[]
  abilityTypes: CustomAbilityTypeDefinition[]
  panels: CustomPanelDefinition[]
  automations: CustomAutomationDefinition[]
  tags?: string[]
}

export interface CharacterCustomSystemState {
  systemId: CustomSystemId
  systemVersion: CustomSystemVersion
  enabled: boolean
  fields: Record<string, JsonValue>
  resources: Record<string, CustomResourceState>
  abilities: CustomAbilityInstance[]
}

export interface CustomResourceState {
  current: number
  maximum?: number
  temporary?: number
}

export interface CustomAbilityInstance {
  id: string
  abilityTypeId: string
  values: Record<string, JsonValue>
  usage?: CustomAbilityUsageState
  enabled?: boolean
}

export interface CustomAbilityUsageState {
  used: number
  maximum?: number
}

export interface CustomSystemAssignment {
  systemId: CustomSystemId
  target: CustomSystemAssignmentTarget
}

export type CustomSystemAssignmentTarget =
  | { type: 'campaign' }
  | { type: 'character'; characterId: string }
  | { type: 'template'; templateId: string }
  | { type: 'class'; classId: string }
  | { type: 'tag'; tag: string }

export interface InstalledCustomSystem {
  systemId: CustomSystemId
  installedVersion: CustomSystemVersion
  enabled: boolean
  updateMode: CustomSystemUpdateMode
  configuration?: Record<string, JsonValue>
}

export type CustomSystemUpdateMode = 'automatic' | 'askMaster' | 'lockedVersion'
