import type { Ability } from "./Ability"

const STORAGE_KEY = "dnd-manager:ability-defaults:v1"

type StoredAbilityDefault = Omit<Ability, "id"> & {
  sourceAbilityId?: string
}

type AbilityDefaultMap = Record<string, StoredAbilityDefault>

export function getAbilityDefaultKey(ability: Pick<Ability, "name" | "sourceAbilityId">): string {
  if (ability.sourceAbilityId?.trim()) return ability.sourceAbilityId.trim()

  return `name:${ability.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`
}

export function applyAbilityDefault(ability: Ability): Ability {
  const stored = readDefaults()[getAbilityDefaultKey(ability)]
  if (!stored) return ability

  return {
    ...ability,
    ...stored,
    id: ability.id,
    sourceAbilityId: ability.sourceAbilityId ?? stored.sourceAbilityId,
    sourceVersion: ability.sourceVersion ?? stored.sourceVersion,
    customized: true,
    usage:
      ability.usage || stored.usage
        ? {
            ...(stored.usage ?? ability.usage!),
            ...(ability.usage ?? {}),
            used: ability.usage?.used ?? stored.usage?.used ?? 0,
          }
        : undefined,
  }
}

export function saveAbilityDefault(ability: Ability): void {
  const key = getAbilityDefaultKey(ability)
  if (!key || key === "name:") return

  const { id: _id, ...rest } = ability
  const defaults = readDefaults()

  defaults[key] = {
    ...rest,
    customized: true,
    usage: rest.usage
      ? {
          ...rest.usage,
          used: 0,
          cooldownRemaining: undefined,
        }
      : undefined,
  }

  writeDefaults(defaults)
}

function readDefaults(): AbilityDefaultMap {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AbilityDefaultMap)
      : {}
  } catch {
    return {}
  }
}

function writeDefaults(defaults: AbilityDefaultMap): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  } catch {
    // Persistence is best-effort. The character copy still keeps the edit.
  }
}
