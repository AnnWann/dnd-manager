import type { CharacterTemplate } from "../../characters/CharacterTemplate"
import { getChannelDivinityPool, spendChannelDivinity } from "../../characters/characterChannelDivinity"
import { getKiPool, spendKi } from "../../characters/characterKi"
import { getSorceryPoints, setSorceryPoints } from "../../characters/characterMagic"
import type { CharacterSpellResourceConfig } from "./CharacterSpells"
import type { Spell, SpellResourceCost, SpellResourceType } from "./Spell"

export const SPELL_RESOURCE_OPTIONS: Array<{ value: SpellResourceType; label: string }> = [
  { value: "ki", label: "Ki" },
  { value: "sorceryPoints", label: "Pontos de magia" },
  { value: "channelDivinity", label: "Canalizar Divindade" },
]

export function spellResourceLabel(resource: SpellResourceType): string {
  return SPELL_RESOURCE_OPTIONS.find((option) => option.value === resource)?.label ?? resource
}

export function getCharacterSpellResourceOverride(
  character: CharacterTemplate,
  spell: Spell,
): CharacterSpellResourceConfig | undefined {
  const overrides = character.get("magic")?.spells.resourceCostOverrides
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, spell.index)) {
    return undefined
  }
  return normalizeOverride(overrides[spell.index])
}

export function getEffectiveSpellResourceOptions(
  character: CharacterTemplate,
  spell: Spell,
): CharacterSpellResourceConfig {
  const override = getCharacterSpellResourceOverride(character, spell)
  if (override) return override

  if (spell.resourceCost) {
    return {
      useSlots: false,
      resources: [normalizeCost(spell.resourceCost)],
    }
  }

  return { useSlots: true, resources: [] }
}

/** Backwards-compatible helper for older call sites that expect a single cost. */
export function getEffectiveSpellResourceCost(
  character: CharacterTemplate,
  spell: Spell,
): SpellResourceCost | undefined {
  const options = getEffectiveSpellResourceOptions(character, spell)
  return options.useSlots ? undefined : options.resources[0]
}

export function setCharacterSpellResourceOverride(
  character: CharacterTemplate,
  spellIndex: string,
  config: CharacterSpellResourceConfig | undefined,
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  const nextOverrides = { ...(magic.spells.resourceCostOverrides ?? {}) }

  if (!config) {
    delete nextOverrides[spellIndex]
  } else {
    nextOverrides[spellIndex] = {
      useSlots: Boolean(config.useSlots),
      resources: dedupeCosts(config.resources),
    }
  }

  return character.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      resourceCostOverrides: nextOverrides,
    },
  })
}

export function getSpellResourceCurrent(
  character: CharacterTemplate,
  resource: SpellResourceType,
): number {
  if (resource === "ki") return getKiPool(character)?.current ?? 0
  if (resource === "channelDivinity") return getChannelDivinityPool(character)?.current ?? 0
  return getSorceryPoints(character).current
}

export function canPaySpellResourceCost(
  character: CharacterTemplate,
  cost: SpellResourceCost | undefined,
): boolean {
  if (!cost) return true
  const amount = normalizeAmount(cost.amount)
  return amount > 0 && getSpellResourceCurrent(character, cost.resource) >= amount
}

export function spendSpellResourceCost(
  character: CharacterTemplate,
  cost: SpellResourceCost,
): CharacterTemplate {
  const amount = normalizeAmount(cost.amount)
  if (amount <= 0 || !canPaySpellResourceCost(character, cost)) return character

  if (cost.resource === "ki") return spendKi(character, amount)
  if (cost.resource === "channelDivinity") {
    let next = character
    for (let index = 0; index < amount; index += 1) next = spendChannelDivinity(next)
    return next
  }

  const points = getSorceryPoints(character)
  return setSorceryPoints(character, points.current - amount)
}

function normalizeOverride(value: unknown): CharacterSpellResourceConfig {
  if (value === null) return { useSlots: true, resources: [] }

  if (Array.isArray(value)) {
    return { useSlots: false, resources: dedupeCosts(value as SpellResourceCost[]) }
  }

  if (value && typeof value === "object" && "useSlots" in value) {
    const candidate = value as CharacterSpellResourceConfig
    return {
      useSlots: Boolean(candidate.useSlots),
      resources: dedupeCosts(Array.isArray(candidate.resources) ? candidate.resources : []),
    }
  }

  if (value && typeof value === "object" && "resource" in value) {
    return { useSlots: false, resources: [normalizeCost(value as SpellResourceCost)] }
  }

  return { useSlots: true, resources: [] }
}

function dedupeCosts(costs: SpellResourceCost[]): SpellResourceCost[] {
  const byResource = new Map<SpellResourceType, SpellResourceCost>()
  for (const cost of costs) {
    if (!cost || !SPELL_RESOURCE_OPTIONS.some((entry) => entry.value === cost.resource)) continue
    byResource.set(cost.resource, normalizeCost(cost))
  }
  return Array.from(byResource.values())
}

function normalizeCost(cost: SpellResourceCost): SpellResourceCost {
  return {
    resource: cost.resource,
    amount: normalizeAmount(cost.amount),
  }
}

function normalizeAmount(value: number): number {
  return Math.max(1, Math.trunc(Number(value) || 1))
}
