import type { AppStateV1 } from "./remoteState"

const COUNTER_FIELDS = new Set([
  "quantity",
  "remainingSupplyUnits",
  "used",
  "current",
  "successes",
  "failures",
])

export function mergeAppStates(
  base: AppStateV1,
  local: AppStateV1,
  remote: AppStateV1,
): AppStateV1 {
  const merged = mergeValue(base, local, remote, []) as AppStateV1

  return {
    ...merged,
    version: 1,
    // The selected character is a local UI preference, not shared campaign data.
    activeCharacterId: local.activeCharacterId,
  }
}

function mergeValue(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string[],
): unknown {
  if (deepEqual(local, base)) return clone(remote)
  if (deepEqual(remote, base)) return clone(local)
  if (deepEqual(local, remote)) return clone(local)

  const field = path[path.length - 1]
  if (
    COUNTER_FIELDS.has(field ?? "") &&
    isFiniteNumber(base) &&
    isFiniteNumber(local) &&
    isFiniteNumber(remote)
  ) {
    return Math.max(0, base + (local - base) + (remote - base))
  }

  if (
    (base === undefined || isPlainObject(base)) &&
    isPlainObject(local) &&
    isPlainObject(remote)
  ) {
    const baseObject = isPlainObject(base) ? base : {}
    const result: Record<string, unknown> = {}
    const keys = new Set([
      ...Object.keys(baseObject),
      ...Object.keys(local),
      ...Object.keys(remote),
    ])

    for (const key of keys) {
      result[key] = mergeValue(
        baseObject[key],
        local[key],
        remote[key],
        [...path, key],
      )
    }

    return result
  }

  if (
    (base === undefined || Array.isArray(base)) &&
    Array.isArray(local) &&
    Array.isArray(remote)
  ) {
    return mergeArrays(
      Array.isArray(base) ? base : [],
      local,
      remote,
      path,
    )
  }

  // A real same-field conflict cannot be resolved without domain intent.
  // Prefer the local value while unrelated remote fields are preserved above.
  return clone(local)
}

function mergeArrays(
  base: unknown[],
  local: unknown[],
  remote: unknown[],
  path: string[],
): unknown[] {
  const identity = resolveIdentity(base, local, remote)
  if (identity) {
    return mergeEntityArrays(base, local, remote, identity, path)
  }

  if (arePrimitiveArrays(base, local, remote)) {
    return mergePrimitiveArrays(base, local, remote)
  }

  return clone(local) as unknown[]
}

function mergeEntityArrays(
  base: unknown[],
  local: unknown[],
  remote: unknown[],
  identity: (value: unknown) => string,
  path: string[],
): unknown[] {
  const baseMap = new Map(base.map((value) => [identity(value), value]))
  const localMap = new Map(local.map((value) => [identity(value), value]))
  const remoteMap = new Map(remote.map((value) => [identity(value), value]))
  const orderedKeys = unique([
    ...remote.map(identity),
    ...local.map(identity),
    ...base.map(identity),
  ])
  const result: unknown[] = []

  for (const key of orderedKeys) {
    const hasBase = baseMap.has(key)
    const hasLocal = localMap.has(key)
    const hasRemote = remoteMap.has(key)
    const baseValue = baseMap.get(key)
    const localValue = localMap.get(key)
    const remoteValue = remoteMap.get(key)

    if (!hasBase) {
      if (hasLocal && hasRemote) {
        result.push(
          mergeValue(undefined, localValue, remoteValue, [...path, key]),
        )
      } else if (hasLocal) {
        result.push(clone(localValue))
      } else if (hasRemote) {
        result.push(clone(remoteValue))
      }
      continue
    }

    if (!hasLocal && !hasRemote) continue

    if (!hasLocal) {
      // A deletion wins only when the other client did not modify the entity.
      if (!deepEqual(remoteValue, baseValue)) result.push(clone(remoteValue))
      continue
    }

    if (!hasRemote) {
      if (!deepEqual(localValue, baseValue)) result.push(clone(localValue))
      continue
    }

    result.push(
      mergeValue(baseValue, localValue, remoteValue, [...path, key]),
    )
  }

  return result
}

function mergePrimitiveArrays(
  base: unknown[],
  local: unknown[],
  remote: unknown[],
): unknown[] {
  const baseKeys = new Set(base.map(stableKey))
  const localKeys = new Set(local.map(stableKey))
  const remoteKeys = new Set(remote.map(stableKey))
  const result: unknown[] = []

  for (const value of base) {
    const key = stableKey(value)
    if (localKeys.has(key) && remoteKeys.has(key)) result.push(clone(value))
  }

  for (const value of [...remote, ...local]) {
    const key = stableKey(value)
    if (baseKeys.has(key)) continue
    if (!result.some((entry) => stableKey(entry) === key)) {
      result.push(clone(value))
    }
  }

  return result
}

function resolveIdentity(
  ...arrays: unknown[][]
): ((value: unknown) => string) | undefined {
  const populatedArrays = arrays.filter((array) => array.length > 0)
  if (
    populatedArrays.length === 0 ||
    !populatedArrays.every((array) => array.every(isPlainObject))
  ) {
    return undefined
  }

  const candidates: Array<(value: Record<string, unknown>) => string> = [
    (value) => stringKey("id", value.id),
    (value) => stringKey("index", value.index),
    (value) => stringKey("className", value.className),
    (value) => compositeKey("category:name", value.category, value.name),
    (value) => compositeKey("attribute:type", value.attribute, value.type),
    (value) => compositeKey("source:index", value.sourceItemId, value.index),
  ]

  for (const candidate of candidates) {
    const validForEveryVersion = populatedArrays.every((array) => {
      const keys = array.map((value) =>
        candidate(value as Record<string, unknown>),
      )

      return keys.every(Boolean) && keys.length === new Set(keys).size
    })

    if (validForEveryVersion) {
      return (value) => candidate(value as Record<string, unknown>)
    }
  }

  return undefined
}

function stringKey(prefix: string, value: unknown): string {
  return typeof value === "string" && value.trim()
    ? `${prefix}:${value.trim()}`
    : ""
}

function compositeKey(prefix: string, ...values: unknown[]): string {
  if (!values.every((value) => typeof value === "string" && value.trim())) {
    return ""
  }

  return `${prefix}:${values.map((value) => String(value).trim()).join(":")}`
}

function arePrimitiveArrays(...arrays: unknown[][]): boolean {
  return arrays.flat().every(
    (value) =>
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean",
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  return stableKey(left) === stableKey(right)
}

function stableKey(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])]),
  )
}

function clone<T>(value: T): T {
  if (value === undefined) return value

  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
