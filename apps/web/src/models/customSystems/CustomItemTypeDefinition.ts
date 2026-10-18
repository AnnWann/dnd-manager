import type { CustomFieldDefinition } from "./CustomFieldDefinition"

export interface CustomSystemItemTypeDefinition {
  id: string
  name: string
  description?: string
  fields: CustomFieldDefinition[]
}
