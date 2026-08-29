import type {
  Ability,
  AbilityResourceCostDefinition,
  AbilityResourceSelection,
} from "./Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { getChannelDivinityPool, spendChannelDivinity } from "../characters/characterChannelDivinity"
import {
  getCustomSpellSlotPools,
  spendCustomSpellSlot,
} from "../characters/customClassConfig"
import { getKiPool, spendKi } from "../characters/characterKi"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"

export type AbilityResourcePaymentResult =
  | { ok: true; character: CharacterTemplate; costs: ResolvedAbilityResourceCost[] }
  | { ok: false; character: CharacterTemplate; reason: string }

export type ResolvedAbilityResourceCost = {
  cost: AbilityResourceCostDefinition
  amount: number
  slotLevel?: number
}

export function hasAbilityResourceCosts(ability: Ability): boolean {
  return (ability.resourceCosts ?? []).some((group) => group.costs.some(isConfiguredCost))
}

export function getAbilityActivationLevel(
  ability: Ability,
  selection?: AbilityResourceSelection,
): number | undefined {
  const upcast = ability.resourceUpcast
  if (!upcast?.enabled) return undefined
  const base = normalizeLevel(upcast.baseLevel, 1)
  const maximum = Math.max(base, normalizeLevel(upcast.maximumLevel, 9))
  const requested = selection?.activationLevel ?? base
  if (!Number.isInteger(requested) || requested < base || requested > maximum) return undefined
  return requested
}

export function canPayAbilityResourceCosts(
  character: CharacterTemplate,
  ability: Ability,
  selection?: AbilityResourceSelection,
): { ok: true; costs: ResolvedAbilityResourceCost[] } | { ok: false; reason: string } {
  if (!hasAbilityResourceCosts(ability)) return { ok: true, costs: [] }

  if (ability.resourceUpcast?.enabled && getAbilityActivationLevel(ability, selection) === undefined) {
    return { ok: false, reason: "Escolha um nível de ativação válido para esta habilidade." }
  }

  const plans = buildCandidatePlans(ability, selection)
  if (plans.length === 0) {
    return { ok: false, reason: "A configuração de custos da habilidade não possui uma alternativa válida." }
  }

  for (const plan of plans) {
    const resolved = resolvePlan(ability, plan, selection)
    if (resolved && canAffordPlan(character, resolved)) return { ok: true, costs: resolved }
  }

  return { ok: false, reason: "O personagem não possui recursos suficientes para pagar os custos selecionados." }
}

export function spendAbilityResourceCosts(
  character: CharacterTemplate,
  ability: Ability,
  selection?: AbilityResourceSelection,
): AbilityResourcePaymentResult {
  const validation = canPayAbilityResourceCosts(character, ability, selection)
  if (!validation.ok) return { ok: false, character, reason: validation.reason }

  let next = character
  for (const resolved of validation.costs) {
    next = spendResolvedCost(next, resolved)
  }
  return { ok: true, character: next, costs: validation.costs }
}

export function resolveAbilityResourceCostPreview(
  ability: Ability,
  cost: AbilityResourceCostDefinition,
  selection?: AbilityResourceSelection,
): ResolvedAbilityResourceCost {
  return resolveCost(ability, cost, selection)
}

export function abilityResourceCostLabel(
  cost: AbilityResourceCostDefinition,
  resolved?: Pick<ResolvedAbilityResourceCost, "amount" | "slotLevel">,
): string {
  const amount = resolved?.amount ?? normalizeAmount(cost.amount)
  const level = resolved?.slotLevel ?? cost.slotLevel
  const scale = (cost.amountPerLevel ?? 0) > 0 ? ` (+${Math.floor(cost.amountPerLevel ?? 0)}/nível)` : ""
  switch (cost.kind) {
    case "spellSlot":
      return `${amount} espaço(s) de magia — nível ${normalizeLevel(level, 1)}${scale}`
    case "pactSlot":
      return `${amount} espaço(s) de pacto${level ? ` — nível ${level}` : " — nível atual do pacto"}${scale}`
    case "customSpellSlot":
      return `${amount} espaço(s) de ${cost.poolName?.trim() || cost.poolId?.trim() || "classe customizada"} — nível ${normalizeLevel(level, 1)}${scale}`
    case "ki":
      return `${amount} Ki${scale}`
    case "sorceryPoints":
      return `${amount} ponto(s) de feitiçaria${scale}`
    case "channelDivinity":
      return `${amount} uso(s) de Canalizar Divindade${scale}`
    case "customSystem":
      return `${amount} ${cost.resourceName?.trim() || cost.resourceId?.trim() || "recurso customizado"}${scale}`
  }
}

function buildCandidatePlans(
  ability: Ability,
  selection?: AbilityResourceSelection,
): AbilityResourceCostDefinition[][] {
  let plans: AbilityResourceCostDefinition[][] = [[]]

  for (const group of ability.resourceCosts ?? []) {
    const costs = group.costs.filter(isConfiguredCost)
    if (costs.length === 0) continue

    if (group.mode === "all") {
      plans = plans.map((plan) => [...plan, ...costs])
      continue
    }

    const selectedId = selection?.alternatives?.[group.id]
    const alternatives = selectedId
      ? costs.filter((cost) => cost.id === selectedId)
      : costs
    if (alternatives.length === 0) return []

    plans = plans.flatMap((plan) => alternatives.map((cost) => [...plan, cost]))
  }

  return plans
}

function resolvePlan(
  ability: Ability,
  costs: AbilityResourceCostDefinition[],
  selection?: AbilityResourceSelection,
): ResolvedAbilityResourceCost[] | null {
  if (ability.resourceUpcast?.enabled && getAbilityActivationLevel(ability, selection) === undefined) return null
  return costs.map((cost) => resolveCost(ability, cost, selection))
}

function resolveCost(
  ability: Ability,
  cost: AbilityResourceCostDefinition,
  selection?: AbilityResourceSelection,
): ResolvedAbilityResourceCost {
  const upcast = ability.resourceUpcast
  const activationLevel = upcast?.enabled
    ? getAbilityActivationLevel(ability, selection)
    : undefined
  const baseActivationLevel = upcast?.enabled ? normalizeLevel(upcast.baseLevel, 1) : undefined
  const levelDelta = activationLevel !== undefined && baseActivationLevel !== undefined
    ? activationLevel - baseActivationLevel
    : 0
  const amount = normalizeAmount(cost.amount) + Math.max(0, Math.floor(cost.amountPerLevel ?? 0)) * levelDelta

  if (cost.kind === "pactSlot") {
    return {
      cost,
      amount,
      // Sem upcast, um custo de pacto consome o nível atual do pacto sem exigir configuração estática.
      slotLevel: upcast?.enabled ? activationLevel : undefined,
    }
  }

  if (cost.kind === "spellSlot" || cost.kind === "customSpellSlot") {
    const baseSlotLevel = normalizeLevel(cost.slotLevel, upcast?.baseLevel ?? 1)
    return {
      cost,
      amount,
      slotLevel: normalizeLevel(baseSlotLevel + levelDelta, baseSlotLevel),
    }
  }

  return { cost, amount }
}

function canAffordPlan(character: CharacterTemplate, costs: ResolvedAbilityResourceCost[]): boolean {
  const required = new Map<string, number>()
  for (const resolved of costs) {
    const key = resourceKey(resolved)
    required.set(key, (required.get(key) ?? 0) + resolved.amount)
  }

  for (const [key, amount] of required) {
    if (availableForKey(character, key) < amount) return false
  }
  return true
}

function resourceKey(resolved: ResolvedAbilityResourceCost): string {
  switch (resolved.cost.kind) {
    case "spellSlot": return `spellSlot:${resolved.slotLevel ?? 1}`
    case "pactSlot": return resolved.slotLevel ? `pactSlot:${resolved.slotLevel}` : "pactSlot:any"
    case "customSpellSlot": return `customSpellSlot:${resolved.cost.poolId ?? ""}:${resolved.slotLevel ?? 1}`
    case "ki": return "ki"
    case "sorceryPoints": return "sorceryPoints"
    case "channelDivinity": return "channelDivinity"
    case "customSystem": return `custom:${resolved.cost.systemId ?? ""}:${resolved.cost.resourceId ?? ""}`
  }
}

function availableForKey(character: CharacterTemplate, key: string): number {
  if (key.startsWith("spellSlot:")) {
    const level = Number(key.slice("spellSlot:".length)) as MagicCircleLevel
    return character.getSpellSlots()[level]?.current ?? 0
  }
  if (key.startsWith("pactSlot:")) {
    const pact = character.getPactSlots()
    if (!pact) return 0
    const suffix = key.slice("pactSlot:".length)
    return suffix === "any" || pact.level === Number(suffix) ? pact.current : 0
  }
  if (key.startsWith("customSpellSlot:")) {
    const remainder = key.slice("customSpellSlot:".length)
    const separator = remainder.lastIndexOf(":")
    if (separator < 0) return 0
    const poolId = remainder.slice(0, separator)
    const level = Number(remainder.slice(separator + 1))
    return getCustomSpellSlotPools(character).find((pool) => pool.id === poolId)?.slots[level]?.current ?? 0
  }
  if (key === "ki") return getKiPool(character)?.current ?? 0
  if (key === "sorceryPoints") return character.getSorceryPoints().current
  if (key === "channelDivinity") return getChannelDivinityPool(character)?.current ?? 0
  if (key.startsWith("custom:")) {
    const remainder = key.slice("custom:".length)
    const separator = remainder.indexOf(":")
    if (separator < 0) return 0
    const systemId = remainder.slice(0, separator)
    const resourceId = remainder.slice(separator + 1)
    const state = character.get("sheet").customSystems?.find((entry) => entry.systemId === systemId && entry.enabled)
    return Math.max(0, Number(state?.resources?.[resourceId]?.current ?? 0))
  }
  return 0
}

function spendResolvedCost(
  character: CharacterTemplate,
  resolved: ResolvedAbilityResourceCost,
): CharacterTemplate {
  let next = character
  const amount = resolved.amount

  switch (resolved.cost.kind) {
    case "spellSlot": {
      const level = (resolved.slotLevel ?? 1) as MagicCircleLevel
      for (let index = 0; index < amount; index += 1) next = next.spendSpellSlot(level)
      return next
    }
    case "pactSlot":
      for (let index = 0; index < amount; index += 1) next = next.spendPactSlot()
      return next
    case "customSpellSlot": {
      const poolId = resolved.cost.poolId?.trim()
      const level = resolved.slotLevel ?? 1
      if (!poolId) return next
      for (let index = 0; index < amount; index += 1) next = spendCustomSpellSlot(next, poolId, level)
      return next
    }
    case "ki":
      return spendKi(next, amount)
    case "sorceryPoints":
      return next.setSorceryPoints(next.getSorceryPoints().current - amount)
    case "channelDivinity":
      for (let index = 0; index < amount; index += 1) next = spendChannelDivinity(next)
      return next
    case "customSystem": {
      const systemId = resolved.cost.systemId?.trim()
      const resourceId = resolved.cost.resourceId?.trim()
      if (!systemId || !resourceId) return next
      const states = next.get("sheet").customSystems ?? []
      return next.withSheet("customSystems", states.map((state) =>
        state.systemId === systemId
          ? {
              ...state,
              resources: {
                ...state.resources,
                [resourceId]: {
                  ...state.resources[resourceId],
                  current: Math.max(0, Number(state.resources[resourceId]?.current ?? 0) - amount),
                },
              },
            }
          : state,
      ))
    }
  }
}

function isConfiguredCost(cost: AbilityResourceCostDefinition): boolean {
  if (!cost.id?.trim() || normalizeAmount(cost.amount) <= 0) return false
  if (cost.kind === "customSystem") return Boolean(cost.systemId?.trim() && cost.resourceId?.trim())
  if (cost.kind === "customSpellSlot") return Boolean(cost.poolId?.trim())
  return true
}

function normalizeAmount(value: number | undefined): number {
  return Math.max(1, Math.floor(Number(value) || 1))
}

function normalizeLevel(value: number | undefined, fallback: number): number {
  const normalized = Math.floor(Number(value) || fallback)
  return Math.min(9, Math.max(1, normalized))
}
