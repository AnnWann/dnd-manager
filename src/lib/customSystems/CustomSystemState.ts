import type { CustomAbilityTypeDefinition } from "../../models/customSystems/CustomAbilityDefinition"
import type { CustomFieldDefinition } from "../../models/customSystems/CustomFieldDefinition"
import type { CustomSystemEditPermission, JsonValue } from "../../models/customSystems/CustomGenerals"
import type { CustomResourceDefinition } from "../../models/customSystems/CustomResourceDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomResourceState,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"

export type CustomSystemActor = 'master' | 'owner' | 'automation'

export interface CustomSystemOperationResult<T> {
  value: T
  errors: CustomSystemValidationError[]
}

export interface CustomSystemValidationError {
  code: CustomSystemValidationErrorCode
  message: string
  path?: string
}

export type CustomSystemValidationErrorCode =
  | 'systemMismatch'
  | 'systemDisabled'
  | 'definitionNotFound'
  | 'duplicateId'
  | 'permissionDenied'
  | 'invalidValue'
  | 'requiredValueMissing'
  | 'minimumNotMet'
  | 'maximumExceeded'
  | 'invalidOption'
  | 'resourceUnavailable'
  | 'insufficientResource'

export class CustomSystemOperationError extends Error {
  readonly errors: CustomSystemValidationError[]

  constructor(errors: CustomSystemValidationError[]) {
    super(errors.map((error) => error.message).join('; '))
    this.name = 'CustomSystemOperationError'
    this.errors = errors
  }
}

export function createCharacterCustomSystemState(
  definition: CustomSystemDefinition,
): CharacterCustomSystemState {
  const fields = definition.fields.reduce<Record<string, JsonValue>>((values, field) => {
    if (field.defaultValue !== undefined && field.type !== 'formula') {
      values[field.id] = cloneJsonValue(field.defaultValue)
    }
    return values
  }, {})

  const resources = definition.resources.reduce<Record<string, CustomResourceState>>((values, resource) => {
    values[resource.id] = createResourceState(resource)
    return values
  }, {})

  return {
    systemId: definition.id,
    systemVersion: definition.version,
    enabled: true,
    fields,
    resources,
    abilities: [],
  }
}

export function setCustomSystemEnabled(
  state: CharacterCustomSystemState,
  enabled: boolean,
): CharacterCustomSystemState {
  return { ...state, enabled }
}

export function getCustomFieldValue(
  state: CharacterCustomSystemState,
  fieldId: string,
): JsonValue | undefined {
  return state.fields[fieldId]
}

export function setCustomFieldValue(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  fieldId: string,
  value: JsonValue,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  const field = findFieldDefinition(definition.fields, fieldId)
  assertCanEdit(field.editPermission, actor, `fields.${fieldId}`)
  assertValidFieldValue(field, value, `fields.${fieldId}`)

  return {
    ...state,
    fields: {
      ...state.fields,
      [fieldId]: cloneJsonValue(value),
    },
  }
}

export function removeCustomFieldValue(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  fieldId: string,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  const field = findFieldDefinition(definition.fields, fieldId)
  assertCanEdit(field.editPermission, actor, `fields.${fieldId}`)

  if (field.required) {
    throwOperationError({
      code: 'requiredValueMissing',
      message: `Field "${field.name}" is required and cannot be removed.`,
      path: `fields.${fieldId}`,
    })
  }

  const fields = { ...state.fields }
  delete fields[fieldId]

  return { ...state, fields }
}

export function resetCustomFieldValue(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  fieldId: string,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const field = findFieldDefinition(definition.fields, fieldId)

  if (field.defaultValue === undefined) {
    return removeCustomFieldValue(definition, state, fieldId, actor)
  }

  return setCustomFieldValue(definition, state, fieldId, field.defaultValue, actor)
}

export function getCustomResourceState(
  state: CharacterCustomSystemState,
  resourceId: string,
): CustomResourceState | undefined {
  return state.resources[resourceId]
}

export function setCustomResourceState(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resourceId: string,
  nextResourceState: CustomResourceState,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  const resource = findResourceDefinition(definition.resources, resourceId)
  assertCanEdit(resource.editPermission, actor, `resources.${resourceId}`)
  assertResourceManualAdjustment(resource, actor)

  const normalized = normalizeResourceState(resource, nextResourceState)

  return {
    ...state,
    resources: {
      ...state.resources,
      [resourceId]: normalized,
    },
  }
}

export function setCustomResourceCurrent(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resourceId: string,
  current: number,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const resourceState = requireResourceState(state, resourceId)
  return setCustomResourceState(
    definition,
    state,
    resourceId,
    { ...resourceState, current },
    actor,
  )
}

export function adjustCustomResource(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resourceId: string,
  amount: number,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const resourceState = requireResourceState(state, resourceId)
  return setCustomResourceCurrent(
    definition,
    state,
    resourceId,
    resourceState.current + amount,
    actor,
  )
}

export function setCustomResourceTemporary(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resourceId: string,
  temporary: number | undefined,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const resource = findResourceDefinition(definition.resources, resourceId)
  if (!resource.allowTemporaryValue && temporary !== undefined) {
    throwOperationError({
      code: 'invalidValue',
      message: `Resource "${resource.name}" does not allow temporary values.`,
      path: `resources.${resourceId}.temporary`,
    })
  }

  const resourceState = requireResourceState(state, resourceId)
  return setCustomResourceState(
    definition,
    state,
    resourceId,
    { ...resourceState, temporary },
    actor,
  )
}

export function resetCustomResource(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resourceId: string,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const resource = findResourceDefinition(definition.resources, resourceId)
  return setCustomResourceState(
    definition,
    state,
    resourceId,
    createResourceState(resource),
    actor,
  )
}

export function addCustomAbility(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  ability: CustomAbilityInstance,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  if (actor === 'automation') {
    throwOperationError({
      code: 'permissionDenied',
      message: 'Automations cannot create custom abilities.',
      path: 'abilities',
    })
  }

  if (state.abilities.some((existing) => existing.id === ability.id)) {
    throwOperationError({
      code: 'duplicateId',
      message: `An ability with id "${ability.id}" already exists.`,
      path: `abilities.${ability.id}`,
    })
  }

  const abilityType = findAbilityTypeDefinition(definition.abilityTypes, ability.abilityTypeId)
  assertValidAbilityValues(abilityType, ability.values, ability.id)

  return {
    ...state,
    abilities: [...state.abilities, cloneAbility(ability)],
  }
}

export function createCustomAbility(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityTypeId: string,
  abilityId: string,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const abilityType = findAbilityTypeDefinition(definition.abilityTypes, abilityTypeId)
  const values = abilityType.fields.reduce<Record<string, JsonValue>>((result, field) => {
    if (field.defaultValue !== undefined && field.type !== 'formula') {
      result[field.id] = cloneJsonValue(field.defaultValue)
    }
    return result
  }, {})

  return addCustomAbility(
    definition,
    state,
    {
      id: abilityId,
      abilityTypeId,
      values,
      enabled: true,
      usage: abilityType.activation?.usage
        ? { used: 0, maximum: abilityType.activation.usage.maximum }
        : undefined,
    },
    actor,
  )
}

export function updateCustomAbilityField(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  fieldId: string,
  value: JsonValue,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  const ability = requireAbility(state, abilityId)
  const abilityType = findAbilityTypeDefinition(definition.abilityTypes, ability.abilityTypeId)
  const field = findFieldDefinition(abilityType.fields, fieldId)

  assertCanEdit(field.editPermission, actor, `abilities.${abilityId}.values.${fieldId}`)
  assertValidFieldValue(field, value, `abilities.${abilityId}.values.${fieldId}`)

  return replaceAbility(state, abilityId, {
    ...ability,
    values: {
      ...ability.values,
      [fieldId]: cloneJsonValue(value),
    },
  })
}

export function removeCustomAbility(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)
  requireAbility(state, abilityId)

  if (actor === 'automation') {
    throwOperationError({
      code: 'permissionDenied',
      message: 'Automations cannot remove custom abilities.',
      path: `abilities.${abilityId}`,
    })
  }

  return {
    ...state,
    abilities: state.abilities.filter((ability) => ability.id !== abilityId),
  }
}

export function setCustomAbilityEnabled(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  enabled: boolean,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  if (actor === 'automation') {
    throwOperationError({
      code: 'permissionDenied',
      message: 'Automations cannot manually enable or disable abilities.',
      path: `abilities.${abilityId}.enabled`,
    })
  }

  const ability = requireAbility(state, abilityId)
  return replaceAbility(state, abilityId, { ...ability, enabled })
}

export function setCustomAbilityUsage(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  used: number,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  assertCompatibleSystem(definition, state)
  assertEnabled(state)

  const ability = requireAbility(state, abilityId)
  const abilityType = findAbilityTypeDefinition(definition.abilityTypes, ability.abilityTypeId)
  const usageDefinition = abilityType.activation?.usage

  if (!usageDefinition) {
    throwOperationError({
      code: 'definitionNotFound',
      message: `Ability "${abilityId}" does not define usage limits.`,
      path: `abilities.${abilityId}.usage`,
    })
  }

  if (actor === 'owner' && used < (ability.usage?.used ?? 0)) {
    throwOperationError({
      code: 'permissionDenied',
      message: 'The owner cannot manually restore ability uses.',
      path: `abilities.${abilityId}.usage.used`,
    })
  }

  const maximum = ability.usage?.maximum ?? usageDefinition.maximum
  const normalizedUsed = Math.max(0, maximum === undefined ? used : Math.min(used, maximum))

  return replaceAbility(state, abilityId, {
    ...ability,
    usage: {
      used: normalizedUsed,
      maximum,
    },
  })
}

export function validateCharacterCustomSystemState(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
): CustomSystemValidationError[] {
  const errors: CustomSystemValidationError[] = []

  if (definition.id !== state.systemId) {
    errors.push({
      code: 'systemMismatch',
      message: `State belongs to system "${state.systemId}", not "${definition.id}".`,
      path: 'systemId',
    })
    return errors
  }

  for (const field of definition.fields) {
    const value = state.fields[field.id]
    if (value === undefined) {
      if (field.required && field.type !== 'formula') {
        errors.push({
          code: 'requiredValueMissing',
          message: `Field "${field.name}" is required.`,
          path: `fields.${field.id}`,
        })
      }
      continue
    }

    errors.push(...validateCustomFieldValue(field, value, `fields.${field.id}`))
  }

  for (const resource of definition.resources) {
    const resourceState = state.resources[resource.id]
    if (!resourceState) {
      errors.push({
        code: 'resourceUnavailable',
        message: `Resource "${resource.name}" has no character state.`,
        path: `resources.${resource.id}`,
      })
      continue
    }

    errors.push(...validateResourceState(resource, resourceState))
  }

  const abilityIds = new Set<string>()
  for (const ability of state.abilities) {
    if (abilityIds.has(ability.id)) {
      errors.push({
        code: 'duplicateId',
        message: `Ability id "${ability.id}" is duplicated.`,
        path: `abilities.${ability.id}`,
      })
      continue
    }
    abilityIds.add(ability.id)

    const abilityType = definition.abilityTypes.find((type) => type.id === ability.abilityTypeId)
    if (!abilityType) {
      errors.push({
        code: 'definitionNotFound',
        message: `Ability type "${ability.abilityTypeId}" was not found.`,
        path: `abilities.${ability.id}.abilityTypeId`,
      })
      continue
    }

    for (const field of abilityType.fields) {
      const value = ability.values[field.id]
      if (value === undefined) {
        if (field.required && field.type !== 'formula') {
          errors.push({
            code: 'requiredValueMissing',
            message: `Ability field "${field.name}" is required.`,
            path: `abilities.${ability.id}.values.${field.id}`,
          })
        }
        continue
      }

      errors.push(
        ...validateCustomFieldValue(
          field,
          value,
          `abilities.${ability.id}.values.${field.id}`,
        ),
      )
    }
  }

  return errors
}

export function validateCustomFieldValue(
  field: CustomFieldDefinition,
  value: JsonValue,
  path = field.id,
): CustomSystemValidationError[] {
  const errors: CustomSystemValidationError[] = []

  if (field.type === 'formula') {
    errors.push({
      code: 'permissionDenied',
      message: `Formula field "${field.name}" cannot be assigned directly.`,
      path,
    })
    return errors
  }

  switch (field.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(invalidType(field.name, 'a finite number', path))
      } else {
        if (field.minimum !== undefined && value < field.minimum) {
          errors.push({
            code: 'minimumNotMet',
            message: `Field "${field.name}" must be at least ${field.minimum}.`,
            path,
          })
        }
        if (field.maximum !== undefined && value > field.maximum) {
          errors.push({
            code: 'maximumExceeded',
            message: `Field "${field.name}" cannot exceed ${field.maximum}.`,
            path,
          })
        }
      }
      break

    case 'text':
    case 'richText':
      if (typeof value !== 'string') {
        errors.push(invalidType(field.name, 'text', path))
      } else {
        if (field.minimumLength !== undefined && value.length < field.minimumLength) {
          errors.push({
            code: 'minimumNotMet',
            message: `Field "${field.name}" must contain at least ${field.minimumLength} characters.`,
            path,
          })
        }
        if (field.maximumLength !== undefined && value.length > field.maximumLength) {
          errors.push({
            code: 'maximumExceeded',
            message: `Field "${field.name}" cannot contain more than ${field.maximumLength} characters.`,
            path,
          })
        }
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(invalidType(field.name, 'a boolean', path))
      }
      break

    case 'select':
      if (typeof value !== 'string') {
        errors.push(invalidType(field.name, 'one option value', path))
      } else if (!field.options.some((option) => option.value === value)) {
        errors.push({
          code: 'invalidOption',
          message: `"${value}" is not a valid option for field "${field.name}".`,
          path,
        })
      }
      break

    case 'multiSelect': {
      if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
        errors.push(invalidType(field.name, 'a list of option values', path))
        break
      }

      const selected = value as string[]
      const allowed = new Set(field.options.map((option) => option.value))
      const invalid = selected.find((entry) => !allowed.has(entry))
      if (invalid !== undefined) {
        errors.push({
          code: 'invalidOption',
          message: `"${invalid}" is not a valid option for field "${field.name}".`,
          path,
        })
      }
      if (field.minimumSelections !== undefined && selected.length < field.minimumSelections) {
        errors.push({
          code: 'minimumNotMet',
          message: `Field "${field.name}" requires at least ${field.minimumSelections} selections.`,
          path,
        })
      }
      if (field.maximumSelections !== undefined && selected.length > field.maximumSelections) {
        errors.push({
          code: 'maximumExceeded',
          message: `Field "${field.name}" allows at most ${field.maximumSelections} selections.`,
          path,
        })
      }
      break
    }

    case 'dice':
      if (typeof value !== 'string') {
        errors.push(invalidType(field.name, 'a die value', path))
      } else if (field.allowedDice && !field.allowedDice.includes(value as never)) {
        errors.push({
          code: 'invalidOption',
          message: `"${value}" is not an allowed die for field "${field.name}".`,
          path,
        })
      }
      break

    case 'reference':
      if (field.multiple) {
        if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
          errors.push(invalidType(field.name, 'a list of reference ids', path))
        }
      } else if (typeof value !== 'string') {
        errors.push(invalidType(field.name, 'a reference id', path))
      }
      break
  }

  return errors
}

function createResourceState(resource: CustomResourceDefinition): CustomResourceState {
  const maximum = resource.maximum
  const current = clampResourceValue(
    resource.initialValue ?? resource.minimum ?? 0,
    resource.minimum,
    maximum,
  )

  return {
    current,
    maximum,
    temporary: resource.allowTemporaryValue ? 0 : undefined,
  }
}

function normalizeResourceState(
  definition: CustomResourceDefinition,
  state: CustomResourceState,
): CustomResourceState {
  const maximum = state.maximum ?? definition.maximum
  const minimum = definition.minimum
  const current = clampResourceValue(state.current, minimum, maximum)
  const temporary = definition.allowTemporaryValue
    ? Math.max(0, state.temporary ?? 0)
    : undefined

  return { current, maximum, temporary }
}

function validateResourceState(
  definition: CustomResourceDefinition,
  state: CustomResourceState,
): CustomSystemValidationError[] {
  const errors: CustomSystemValidationError[] = []
  const path = `resources.${definition.id}`

  if (!Number.isFinite(state.current)) {
    errors.push(invalidType(definition.name, 'a finite current value', `${path}.current`))
  }
  if (state.maximum !== undefined && !Number.isFinite(state.maximum)) {
    errors.push(invalidType(definition.name, 'a finite maximum value', `${path}.maximum`))
  }
  if (state.temporary !== undefined && !Number.isFinite(state.temporary)) {
    errors.push(invalidType(definition.name, 'a finite temporary value', `${path}.temporary`))
  }
  if (definition.minimum !== undefined && state.current < definition.minimum) {
    errors.push({
      code: 'minimumNotMet',
      message: `Resource "${definition.name}" cannot be lower than ${definition.minimum}.`,
      path: `${path}.current`,
    })
  }

  const maximum = state.maximum ?? definition.maximum
  if (maximum !== undefined && state.current > maximum) {
    errors.push({
      code: 'maximumExceeded',
      message: `Resource "${definition.name}" cannot exceed ${maximum}.`,
      path: `${path}.current`,
    })
  }

  return errors
}

function assertValidAbilityValues(
  definition: CustomAbilityTypeDefinition,
  values: Record<string, JsonValue>,
  abilityId: string,
): void {
  const errors: CustomSystemValidationError[] = []

  for (const field of definition.fields) {
    const value = values[field.id]
    if (value === undefined) {
      if (field.required && field.type !== 'formula') {
        errors.push({
          code: 'requiredValueMissing',
          message: `Ability field "${field.name}" is required.`,
          path: `abilities.${abilityId}.values.${field.id}`,
        })
      }
      continue
    }

    errors.push(
      ...validateCustomFieldValue(
        field,
        value,
        `abilities.${abilityId}.values.${field.id}`,
      ),
    )
  }

  if (errors.length > 0) {
    throw new CustomSystemOperationError(errors)
  }
}

function assertValidFieldValue(
  field: CustomFieldDefinition,
  value: JsonValue,
  path: string,
): void {
  const errors = validateCustomFieldValue(field, value, path)
  if (errors.length > 0) {
    throw new CustomSystemOperationError(errors)
  }
}

function assertCompatibleSystem(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
): void {
  if (definition.id !== state.systemId) {
    throwOperationError({
      code: 'systemMismatch',
      message: `State belongs to system "${state.systemId}", not "${definition.id}".`,
      path: 'systemId',
    })
  }
}

function assertEnabled(state: CharacterCustomSystemState): void {
  if (!state.enabled) {
    throwOperationError({
      code: 'systemDisabled',
      message: `Custom system "${state.systemId}" is disabled.`,
      path: 'enabled',
    })
  }
}

function assertCanEdit(
  permission: CustomSystemEditPermission | undefined,
  actor: CustomSystemActor,
  path: string,
): void {
  const effectivePermission = permission ?? 'ownerAndMaster'
  const allowed = actor === 'automation'
    || (effectivePermission === 'ownerAndMaster'
      ? actor === 'owner' || actor === 'master'
      : effectivePermission === 'owner'
        ? actor === 'owner'
        : effectivePermission === 'masterOnly'
          ? actor === 'master'
          : false)

  if (!allowed) {
    throwOperationError({
      code: 'permissionDenied',
      message: `Actor "${actor}" cannot edit "${path}".`,
      path,
    })
  }
}

function assertResourceManualAdjustment(
  resource: CustomResourceDefinition,
  actor: CustomSystemActor,
): void {
  if (actor !== 'automation' && resource.allowManualAdjustment === false) {
    throwOperationError({
      code: 'permissionDenied',
      message: `Resource "${resource.name}" cannot be adjusted manually.`,
      path: `resources.${resource.id}`,
    })
  }
}

function findFieldDefinition(
  definitions: CustomFieldDefinition[],
  fieldId: string,
): CustomFieldDefinition {
  const definition = definitions.find((field) => field.id === fieldId)
  if (!definition) {
    throwOperationError({
      code: 'definitionNotFound',
      message: `Field definition "${fieldId}" was not found.`,
      path: `fields.${fieldId}`,
    })
  }
  return definition
}

function findResourceDefinition(
  definitions: CustomResourceDefinition[],
  resourceId: string,
): CustomResourceDefinition {
  const definition = definitions.find((resource) => resource.id === resourceId)
  if (!definition) {
    throwOperationError({
      code: 'definitionNotFound',
      message: `Resource definition "${resourceId}" was not found.`,
      path: `resources.${resourceId}`,
    })
  }
  return definition
}

function findAbilityTypeDefinition(
  definitions: CustomAbilityTypeDefinition[],
  abilityTypeId: string,
): CustomAbilityTypeDefinition {
  const definition = definitions.find((abilityType) => abilityType.id === abilityTypeId)
  if (!definition) {
    throwOperationError({
      code: 'definitionNotFound',
      message: `Ability type definition "${abilityTypeId}" was not found.`,
      path: `abilityTypes.${abilityTypeId}`,
    })
  }
  return definition
}

function requireResourceState(
  state: CharacterCustomSystemState,
  resourceId: string,
): CustomResourceState {
  const resourceState = state.resources[resourceId]
  if (!resourceState) {
    throwOperationError({
      code: 'resourceUnavailable',
      message: `Resource state "${resourceId}" was not found.`,
      path: `resources.${resourceId}`,
    })
  }
  return resourceState
}

function requireAbility(
  state: CharacterCustomSystemState,
  abilityId: string,
): CustomAbilityInstance {
  const ability = state.abilities.find((candidate) => candidate.id === abilityId)
  if (!ability) {
    throwOperationError({
      code: 'definitionNotFound',
      message: `Custom ability "${abilityId}" was not found.`,
      path: `abilities.${abilityId}`,
    })
  }
  return ability
}

function replaceAbility(
  state: CharacterCustomSystemState,
  abilityId: string,
  replacement: CustomAbilityInstance,
): CharacterCustomSystemState {
  return {
    ...state,
    abilities: state.abilities.map((ability) =>
      ability.id === abilityId ? cloneAbility(replacement) : ability,
    ),
  }
}

function cloneAbility(ability: CustomAbilityInstance): CustomAbilityInstance {
  return {
    ...ability,
    values: Object.fromEntries(
      Object.entries(ability.values).map(([key, value]) => [key, cloneJsonValue(value)]),
    ),
    usage: ability.usage ? { ...ability.usage } : undefined,
  }
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry)) as T
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)]),
    ) as T
  }
  return value
}

function clampResourceValue(value: number, minimum?: number, maximum?: number): number {
  const lowerBounded = minimum === undefined ? value : Math.max(value, minimum)
  return maximum === undefined ? lowerBounded : Math.min(lowerBounded, maximum)
}

function invalidType(
  fieldName: string,
  expected: string,
  path: string,
): CustomSystemValidationError {
  return {
    code: 'invalidValue',
    message: `Field "${fieldName}" must contain ${expected}.`,
    path,
  }
}

function throwOperationError(error: CustomSystemValidationError): never {
  throw new CustomSystemOperationError([error])
}