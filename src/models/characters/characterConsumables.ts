import type { Ability } from "../abilities/Ability"
import type { CharacterCondition } from "./CharacterCondition"
import {
  getCharacterConditions,
  withCharacterConditions,
} from "./characterConditionStorage"
import type { CharacterTemplate } from "./CharacterTemplate"
import type {
  ConsumableEffect,
  ConsumableItem,
} from "../items/equipment/PocketItem"
import type { Itemmable } from "../items/item"
import { consumeInventoryItem } from "../items/itemConsumption"

const CONSUMABLE_EFFECT_PREFIX = "consumable-effect:"

export function applyConsumableEffect(
  character: CharacterTemplate,
  item: Itemmable,
): CharacterTemplate {
  if (item.kind !== "consumable") return character

  const consumable = item as ConsumableItem
  const effect = consumable.consumptionEffect
  if (!effect) return character

  const abilityId = getConsumableEffectAbilityId(consumable, effect)
  const name = effect.name?.trim() || `Efeito de ${consumable.name || "consumível"}`
  const description =
    effect.description?.trim() || consumable.useText?.trim() || ""
  const previousEffectiveMaxHp = character.getEffectiveMaxHp()
  const previousCurrentHp = character.get("sheet").HP.current

  let next = character.saveAbility(
    createConsumableEffectAbility(consumable, effect, abilityId, name, description),
  )

  if (effect.persistence === "temporary") {
    const condition = createConsumableEffectCondition(
      consumable,
      effect,
      abilityId,
      name,
      description,
    )

    next = withCharacterConditions(next, [
      ...getCharacterConditions(next).filter(
        (current) => current.id !== condition.id,
      ),
      condition,
    ])
  }

  const nextEffectiveMaxHp = next.getEffectiveMaxHp()
  const gainedMaxHp = Math.max(0, nextEffectiveMaxHp - previousEffectiveMaxHp)
  if (gainedMaxHp > 0) {
    next = next.setCurrentHp(previousCurrentHp + gainedMaxHp)
  }

  return next
}

export function consumeCharacterInventoryItem(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const item = character
    .get("inventory")
    .find((current) => current.id === itemId)

  if (!item) return character

  const withEffect = applyConsumableEffect(character, item)
  return withEffect.with(
    "inventory",
    consumeInventoryItem(withEffect.get("inventory"), itemId),
  )
}

function createConsumableEffectAbility(
  item: ConsumableItem,
  effect: ConsumableEffect,
  abilityId: string,
  name: string,
  description: string,
): Ability {
  const permanent = effect.persistence === "permanent"

  return {
    id: abilityId,
    name,
    description,
    kind: "feature",
    category: "general",
    trigger: "always",
    effectPersistence: permanent ? "permanent" : "untilEnd",
    grantedSpells: effect.grantedSpells ?? [],
    bonuses: permanent ? (effect.bonuses ?? {}) : {},
    source: "consumable",
    sourceItemId: item.id,
    sourceItemName: item.name,
  }
}

function createConsumableEffectCondition(
  item: ConsumableItem,
  effect: ConsumableEffect,
  abilityId: string,
  name: string,
  description: string,
): CharacterCondition {
  return {
    id: abilityId,
    name,
    description,
    behavior:
      "Os bônus e as magias concedidas permanecem ativos enquanto esta condição existir.",
    source: `Consumível: ${item.name || "Item sem nome"}`,
    notes: "",
    tags: ["Consumível", "Efeito temporário"],
    bonuses: effect.bonuses ?? {},
    duration: {
      type: "custom",
      customLabel:
        effect.durationText?.trim() || "Até o efeito ser encerrado",
      tickOn: "manual",
      tickOwner: "affected",
      autoRemoveAtZero: false,
    },
    createdAt: new Date().toISOString(),
    sourceAbilityId: abilityId,
    sourceAbilityLocation: "character",
    sourceItemId: item.id,
  }
}

function getConsumableEffectAbilityId(
  item: ConsumableItem,
  effect: ConsumableEffect,
): string {
  const effectId = effect.id?.trim() || item.id
  return `${CONSUMABLE_EFFECT_PREFIX}${effectId}`
}
