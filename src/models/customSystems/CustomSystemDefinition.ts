import type { AbilityActionKind } from "../abilities/Ability"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { ProficiencyCategory } from "../sheet/Proficiency"
import type {
  CustomAbilityConditionChangeDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomAbilityRollDefinition,
  CustomAbilityTypeDefinition,
} from "./CustomAbilityDefinition"
import type { CustomAutomationDefinition } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type {
  CustomSystemId,
  CustomSystemVersion,
  FormulaExpression,
  JsonValue,
} from "./CustomGenerals"
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
  /** Fórmulas que substituem cálculos derivados já existentes na ficha. */
  nativeStatOverrides?: CustomNativeStatOverrideDefinition[]
  /** Botões de ação independentes de uma habilidade adquirida. */
  actions?: CustomSystemActionDefinition[]
  /** Sobrescritas das ações padrão da ficha enquanto o sistema estiver ativo. */
  standardActionOverrides?: CustomStandardActionOverrideDefinition[]
  /** Mantém regras, recursos e automações ativos, mas não renderiza o sistema na ficha. */
  hiddenFromSheet?: boolean
  automaticInstallation?: CustomSystemAutomaticInstallation
  characterPlacement?: CustomSystemCharacterPlacement
  presentation?: CustomSystemPresentationDefinition
  tags?: string[]
}

export type CustomNativeStatTarget =
  | "armorClass"
  | "initiative"
  | "mobility"
  | "passivePerception"

export interface CustomNativeStatOverrideDefinition {
  id: string
  target: CustomNativeStatTarget
  formula: FormulaExpression
  /** Maior prioridade vence quando mais de um sistema substitui o mesmo cálculo. */
  priority?: number
  enabled?: boolean
}

export interface CustomSystemActionDefinition {
  id: string
  name: string
  description?: string
  actionKind: AbilityActionKind
  enabled?: boolean
  /** Rolagem opcional resolvida antes dos efeitos; o resultado fica disponível como `roll.value`. */
  roll?: CustomAbilityRollDefinition
  resourceChanges?: CustomAbilityResourceChangeDefinition[]
  conditionChanges?: CustomSystemConditionChangeDefinition[]
  /** Exposição opcional desta ação como automação de alvos na iniciativa do mestre. */
  initiative?: CustomSystemInitiativeActionDefinition
}

export interface CustomSystemInitiativeActionDefinition {
  enabled: boolean
  label?: string
  targetSide?: "any" | "ally" | "enemy" | "neutral"
  minimumTargets?: number
  maximumTargets?: number
}

export interface CustomStandardActionOverrideDefinition {
  id: string
  actionId: string
  actionKind?: AbilityActionKind
  description?: string
  enabled?: boolean
}

export type CustomSystemConditionChangeDefinition = CustomAbilityConditionChangeDefinition

export interface CustomSystemPresentationDefinition {
  items: CustomSystemPresentationItem[]
}

export interface CustomSystemPresentationItem {
  key: string
  hiddenForPlayer?: boolean
  hiddenForMaster?: boolean
}

export type CustomSystemPresentationItemKind = "field" | "resource" | "ability"

export type CustomSystemExistingCharacterTab =
  | "sheet"
  | "abilities"
  | "spellsList"
  | "equipment"
  | "inventory"
  | "race"
  | "profile"
  | "proficiencies"

export type CustomSystemPlacementReference =
  | { type: "standardTab"; tab: CustomSystemExistingCharacterTab }
  | { type: "system"; systemId: string }

export type CustomSystemEmbeddedReference =
  | { type: "content" }
  | { type: "system"; systemId: string }

export type CustomSystemCharacterPlacement =
  | {
      /** Mantém o sistema ativo, mas não renderiza seu conteúdo em nenhuma aba. */
      mode: "none"
    }
  | {
      mode: "newTab"
      tabLabel?: string
      reference?: CustomSystemPlacementReference
      position?: "before" | "after"
      /** @deprecated Compatibility with definitions created before system anchors. */
      relativeToTab?: CustomSystemExistingCharacterTab
    }
  | {
      mode: "existingTab"
      targetTab: CustomSystemExistingCharacterTab
      position: "before" | "after"
      reference?: CustomSystemEmbeddedReference
    }

export interface CustomSystemAutomaticInstallation {
  enabled: boolean
  match: "all" | "any"
  requirements: CustomSystemInstallationRequirement[]
  characterPlacement?: CustomSystemCharacterPlacement
}

export type CustomSystemInstallationRequirement =
  | {
      id: string
      type: "class"
      className: ClassName
      minimumLevel?: number
      subclassName?: string
    }
  | {
      id: string
      type: "totalLevel"
      minimumLevel: number
    }
  | {
      id: string
      type: "proficiency"
      proficiencyId?: string
      name?: string
      category?: ProficiencyCategory
    }
  | {
      id: string
      type: "ability"
      abilityId?: string
      name?: string
      source?: "character" | "custom" | "any"
    }
  | {
      id: string
      type: "attribute"
      attribute: Attribute
      minimumValue: number
      useModifier?: boolean
    }
  | {
      id: string
      type: "formula"
      formula: string
    }

export interface CharacterCustomSystemState {
  systemId: CustomSystemId
  systemVersion: CustomSystemVersion
  enabled: boolean
  fields: Record<string, JsonValue>
  resources: Record<string, CustomResourceState>
  abilities: CustomAbilityInstance[]
  /** Exceções de aquisição/preparo definidas pelo mestre para este personagem. */
  abilityAcquisitionExceptions?: Record<string, CustomAbilityAcquisitionExceptionState>
  installationSource?: "master" | "automatic"
}

export interface CustomAbilityAcquisitionExceptionState {
  /** Preset de exceção aplicado; valores manuais podem limpar esta referência. */
  presetId?: string
  /** Substitui a fórmula de limite definida pelo sistema apenas neste personagem. */
  learnedLimitFormulaOverride?: FormulaExpression
  preparedLimitFormulaOverride?: FormulaExpression
  /** Espaços adicionais além do limite fixo/fórmula. */
  extraLearnedSlots?: number
  extraPreparedSlots?: number
  /** Habilidades que não consomem o limite normal. */
  alwaysLearnedAbilityIds?: string[]
  alwaysPreparedAbilityIds?: string[]
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
  learned?: boolean
  prepared?: boolean
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
  | { type: "campaign" }
  | { type: "character"; characterId: string }
  | { type: "template"; templateId: string }
  | { type: "class"; classId: string }
  | { type: "tag"; tag: string }

export interface InstalledCustomSystem {
  systemId: CustomSystemId
  installedVersion: CustomSystemVersion
  enabled: boolean
  updateMode: CustomSystemUpdateMode
  configuration?: Record<string, JsonValue>
}

export type CustomSystemUpdateMode = "automatic" | "askMaster" | "lockedVersion"
