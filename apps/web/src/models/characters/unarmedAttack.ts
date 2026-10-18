import type { Die } from "../dice/Die"
import type { Attribute } from "../sheet/Attribute"
import type { Weapon } from "../items/equipment/Weapon"
import type { CharacterTemplate } from "./CharacterTemplate"

export type UnarmedAttackProfile = {
  attribute: Attribute
  attack: number
  damageBonus: number
  damageDie?: Die
  monkLevel: number
}

const UNARMED_DAMAGE_PROXY: Weapon = {
  id: "unarmed-strike",
  name: "Ataque desarmado",
  desc: "",
  notes: "",
  quantity: 1,
  weight: 0,
  pocketable: false,
  kind: "equipment",
  equippable: true,
  equipSlot: "weapon",
  properties: [],
  damage: { quantity: 1, sides: "d4" },
  modifierAttribute: "str",
  proficient: false,
}

export function getUnarmedAttackProfile(
  character: CharacterTemplate,
): UnarmedAttackProfile {
  const monkLevel = character.getClassLevel("monk")
  const strengthModifier = character.getEffectiveAttributeModifier("str")
  const dexterityModifier = character.getEffectiveAttributeModifier("dex")
  const attribute: Attribute =
    monkLevel > 0 && dexterityModifier > strengthModifier ? "dex" : "str"
  const modifier = character.getEffectiveAttributeModifier(attribute)
  const attack = character.getEffectiveAttackBonus(
    modifier + character.getProficiencyBonus(),
  )
  const damageBonus = character.getEffectiveWeaponDamageBonus(
    {
      ...UNARMED_DAMAGE_PROXY,
      modifierAttribute: attribute,
    },
    modifier,
  )

  return {
    attribute,
    attack,
    damageBonus,
    damageDie: monkLevel > 0 ? getMonkMartialArtsDie(monkLevel) : undefined,
    monkLevel,
  }
}

export function formatUnarmedDamage(
  profile: UnarmedAttackProfile,
): string {
  const base = profile.damageDie
    ? `${profile.damageDie.quantity}${profile.damageDie.sides}`
    : "1"

  if (profile.damageBonus === 0) return base
  return `${base} ${profile.damageBonus > 0 ? "+" : "-"} ${Math.abs(profile.damageBonus)}`
}

export function getMonkMartialArtsDie(level: number): Die {
  if (level >= 17) return { quantity: 1, sides: "d10" }
  if (level >= 11) return { quantity: 1, sides: "d8" }
  if (level >= 5) return { quantity: 1, sides: "d6" }
  return { quantity: 1, sides: "d4" }
}
