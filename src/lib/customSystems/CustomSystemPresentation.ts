import type {
  CustomSystemDefinition,
  CustomSystemPresentationItem,
  CustomSystemPresentationItemKind,
} from '../../models/customSystems/CustomSystemDefinition'

export type ResolvedCustomSystemPresentationItem = CustomSystemPresentationItem & {
  kind: CustomSystemPresentationItemKind
  id: string
  name: string
}

export function presentationKey(kind: CustomSystemPresentationItemKind, id: string): string {
  return `${kind}:${id}`
}

export function listCustomSystemPresentationItems(
  definition: CustomSystemDefinition,
): ResolvedCustomSystemPresentationItem[] {
  const available = [
    ...definition.resources.map((resource) => ({
      key: presentationKey('resource', resource.id),
      kind: 'resource' as const,
      id: resource.id,
      name: resource.name,
    })),
    ...definition.fields.map((field) => ({
      key: presentationKey('field', field.id),
      kind: 'field' as const,
      id: field.id,
      name: field.name,
    })),
    ...definition.abilityTypes.map((ability) => ({
      key: presentationKey('ability', ability.id),
      kind: 'ability' as const,
      id: ability.id,
      name: ability.name,
    })),
  ]

  const byKey = new Map(available.map((item) => [item.key, item]))
  const configured = definition.presentation?.items ?? []
  const seen = new Set<string>()
  const result: ResolvedCustomSystemPresentationItem[] = []

  for (const item of configured) {
    const definitionItem = byKey.get(item.key)
    if (!definitionItem || seen.has(item.key)) continue
    seen.add(item.key)
    result.push({ ...definitionItem, ...item })
  }

  for (const item of available) {
    if (!seen.has(item.key)) result.push(item)
  }

  return result
}

export function setCustomSystemPresentationItems(
  definition: CustomSystemDefinition,
  items: CustomSystemPresentationItem[],
): CustomSystemDefinition {
  return {
    ...definition,
    presentation: { items },
  }
}

export function isPresentationItemVisible(
  item: CustomSystemPresentationItem,
  role: 'player' | 'master',
): boolean {
  return role === 'master' ? item.hiddenForMaster !== true : item.hiddenForPlayer !== true
}
