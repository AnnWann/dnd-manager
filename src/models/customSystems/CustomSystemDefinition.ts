import type { CustomAbilityTypeDefinition } from "./CustomAbilityDefinition"
import type { CustomAutomationDefinition } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { CustomSystemId, CustomSystemVersion, JsonValue } from "./CustomGenerals"
import type { CustomPanelDefinition } from "./CustomPanelDefinition"
import type { CustomResourceDefinition } from "./CustomResourceDefinition"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { ProficiencyCategory } from "../sheet/Proficiency"

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
  automaticInstallation?: CustomSystemAutomaticInstallation
  characterPlacement?: CustomSystemCharacterPlacement
  tags?: string[]
}

export type CustomSystemExistingCharacterTab =
  | 'sheet'
  | 'abilities'
  | 'spellsList'
  | 'equipment'
  | 'inventory'
  | 'race'
  | 'profile'
  | 'proficiencies'

export type CustomSystemCharacterPlacement =
  | {
      mode: 'newTab'
      tabLabel?: string
    }
  | {
      mode: 'existingTab'
      targetTab: CustomSystemExistingCharacterTab
      position: 'before' | 'after'
    }

export interface CustomSystemAutomaticInstallation {
  enabled: boolean
  match: 'all' | 'any'
  requirements: CustomSystemInstallationRequirement[]
  characterPlacement?: CustomSystemCharacterPlacement
}

export type CustomSystemInstallationRequirement =
  | {
      id: string
      type: 'class'
      className: ClassName
      minimumLevel?: number
      subclassName?: string
    }
  | {
      id: string
      type: 'totalLevel'
      minimumLevel: number
    }
  | {
      id: string
      type: 'proficiency'
      proficiencyId?: string
      name?: string
      category?: ProficiencyCategory
    }
  | {
      id: string
      type: 'ability'
      abilityId?: string
      name?: string
      source?: 'character' | 'custom' | 'any'
    }
  | {
      id: string
      type: 'attribute'
      attribute: Attribute
      minimumValue: number
      useModifier?: boolean
    }
  | {
      id: string
      type: 'formula'
      formula: string
    }

export interface CharacterCustomSystemState {
  systemId: CustomSystemId
  systemVersion: CustomSystemVersion
  enabled: boolean
  fields: Record<string, JsonValue>
  resources: Record<string, CustomResourceState>
  abilities: CustomAbilityInstance[]
  installationSource?: 'master' | 'automatic'
}

export interface CustomResourceState {
  current: number
  maximum?: number
  temporary?: number
}

export interface CustomAbilityInstance {
  id: string
  abilityTypeId: string
  predefinedAbilityId?: string
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
