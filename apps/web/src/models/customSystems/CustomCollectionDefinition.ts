import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { CustomSystemEditPermission, JsonValue } from "./CustomGenerals"

export interface CustomCollectionDefinition {
  id: string
  name: string
  description?: string
  fields: CustomFieldDefinition[]
  permissions?: {
    create?: CustomSystemEditPermission
    remove?: CustomSystemEditPermission
  }
  display?: {
    titleFieldId?: string
    subtitleFieldIds?: string[]
    badgeFieldIds?: string[]
    layout?: "list" | "cards" | "compact"
  }
  minimumEntries?: number
  maximumEntries?: number
}

export interface CustomCollectionEntry {
  id: string
  values: Record<string, JsonValue>
  createdAt?: string
  updatedAt?: string
}
