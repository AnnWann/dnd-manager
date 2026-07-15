export type CustomSystemId = string
export type CustomSystemVersion = number

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type CustomSystemEditPermission =
  | 'masterOnly'
  | 'owner'
  | 'ownerAndMaster'
  | 'automaticOnly'

  export type FormulaExpression = string

  export type CustomReferenceTarget =
  | 'ability'
  | 'character'
  | 'class'
  | 'item'
  | 'magic'
  | 'resource'
  | 'systemAbility'

  export type CustomDie = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'