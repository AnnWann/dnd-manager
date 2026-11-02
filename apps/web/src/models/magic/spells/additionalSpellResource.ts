import type { Ability } from "../../abilities/Ability"
import { getAbilityUsageMax } from "../../abilities/abilityActivation"
import type { CharacterTemplate } from "../../characters/CharacterTemplate"
import { getCharacterConditions, withCharacterConditions } from "../../characters/characterConditionStorage"
import type { AdditionalSpellResourceCost } from "./SpellGrant"
import type { MagicCircleLevel } from "./spellDefinitions"

type ResourceEntry = { ability: Ability; update: (character: CharacterTemplate, used: number) => CharacterTemplate }

export function validateAdditionalSpellResource(cost: AdditionalSpellResourceCost): string | undefined {
  if (!cost || typeof cost.resourceId !== "string" || !cost.resourceId.trim() || cost.resourceId.length > 200) return "Informe o ID do recurso adicional."
  if (!Number.isSafeInteger(cost.amount) || cost.amount < 1 || cost.amount > 1000) return "O custo adicional deve ser um inteiro entre 1 e 1000."
  return undefined
}

function resourceEntries(character: CharacterTemplate): ResourceEntry[] {
  const result: ResourceEntry[] = []
  for (const ability of character.get("abilities") ?? []) result.push({ ability, update: (c, used) => c.updateAbility({ ...ability, usage: { ...ability.usage!, used } }) })
  for (const ability of character.get("sheet").race.naturalAbilities ?? []) result.push({ ability, update: (c, used) => {
    const race = c.get("sheet").race
    return c.withSheet("race", { ...race, naturalAbilities: race.naturalAbilities.map(a => a.id === ability.id ? { ...a, usage: { ...a.usage!, used } } : a) })
  } })
  const seen = new Set<string>()
  for (const item of [...character.getEquippedItems(), character.get("equipment").shield].filter(Boolean)) {
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    for (const ability of (item as { abilities?: Ability[] }).abilities ?? []) result.push({ ability,
      update: (c, used) => c.updateEquipmentAbility(item.id, { ...ability, usage: { ...ability.usage!, used } }),
    })
  }
  for (const condition of getCharacterConditions(character)) for (const ability of condition.grantedAbilities ?? []) result.push({ ability, update: (c, used) =>
    withCharacterConditions(c, getCharacterConditions(c).map(entry => entry.id === condition.id
      ? { ...entry, grantedAbilities: entry.grantedAbilities?.map(a => a.id === ability.id ? { ...a, usage: { ...a.usage!, used } } : a) } : entry)),
  })
  return result.filter(entry => entry.ability.usage && entry.ability.usage.reset !== "spellSlot")
}

function resolveResource(character: CharacterTemplate, cost: AdditionalSpellResourceCost) {
  const invalid = validateAdditionalSpellResource(cost)
  if (invalid) return { error: invalid }
  const id = cost.resourceId.trim()
  const entries = resourceEntries(character)
  const shared = entries.filter(entry => entry.ability.usage?.sharedResourceId?.trim() === id)
  const direct = entries.filter(entry => entry.ability.id === id)
  if (!shared.length && direct.length !== 1) return { error: `Recurso “${id}” não encontrado ou ambíguo. Use o ID compartilhado ou o ID de uma habilidade com contador.` }
  const sharedId = shared.length ? id : direct[0].ability.usage?.sharedResourceId?.trim()
  const matches = sharedId ? entries.filter(entry => entry.ability.usage?.sharedResourceId?.trim() === sharedId) : direct
  const max = getAbilityUsageMax(character, matches[0].ability.usage!)
  const used = Math.max(...matches.map(entry => Math.max(0, entry.ability.usage!.used)))
  if (!Number.isFinite(used) || max - used < cost.amount) return { error: `Não há usos suficientes no recurso “${id}”.` }
  return { matches, used }
}

export function additionalSpellResourceError(character: CharacterTemplate, cost?: AdditionalSpellResourceCost): string | undefined {
  return cost ? resolveResource(character, cost).error : undefined
}

/** One transaction in the model: all checks happen before either resource is changed. */
export function paySpellSlotAndAdditionalResource(
  character: CharacterTemplate,
  spell: { slotLevel: number },
  cost: AdditionalSpellResourceCost,
  castLevel: number,
  payment: { type: string; pool?: string; level?: number },
): { ok: true; character: CharacterTemplate } | { ok: false; code: string; message: string } {
  const resource = resolveResource(character, cost)
  if (resource.error || !resource.matches) return { ok: false, code: "SPELL_ADDITIONAL_RESOURCE_UNAVAILABLE", message: resource.error! }
  if (!Number.isInteger(castLevel) || castLevel < spell.slotLevel || castLevel > 9) return { ok: false, code: "SPELL_SLOT_PAYMENT_INVALID", message: "Nível de conjuração inválido." }
  let next = character
  if (spell.slotLevel === 0) {
    if (payment.type !== "none" || castLevel !== 0) return { ok: false, code: "SPELL_SLOT_PAYMENT_INVALID", message: "Truques não consomem espaços, mas exigem o recurso adicional." }
  } else {
    if (payment.type !== "slot" || payment.level !== castLevel) return { ok: false, code: "SPELL_SLOT_PAYMENT_REQUIRED", message: "Esta magia exige espaço de magia e o recurso adicional." }
    if (payment.pool === "pact") {
      const pact = character.getPactSlots()
      if (!pact || pact.level !== castLevel || pact.current < 1) return { ok: false, code: "PACT_SLOT_UNAVAILABLE", message: "Espaço de pacto indisponível." }
      next = character.spendPactSlot()
    } else {
      if (payment.pool !== "normal" || (character.getSpellSlots()[castLevel as MagicCircleLevel]?.current ?? 0) < 1) return { ok: false, code: "SPELL_SLOT_UNAVAILABLE", message: "Espaço de magia indisponível." }
      next = character.spendSpellSlot(castLevel as MagicCircleLevel)
    }
  }
  for (const entry of resource.matches) next = entry.update(next, resource.used! + cost.amount)
  return { ok: true, character: next }
}
