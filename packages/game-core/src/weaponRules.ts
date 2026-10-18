export type WeaponRuleInput = {
  id?: string
  properties?: ReadonlyArray<{ id: string }>
  wieldedTwoHanded?: boolean
  modifierAttribute?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  versatileDamage?: { quantity: number; sides: "d2" | "d3" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100" }
  damage?: { quantity: number; sides: "d2" | "d3" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100" }
}
export type WeaponPropertyId = string
export type WeaponDie = { quantity: number; sides: "d2" | "d3" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100" }
export type Attribute = "str" | "dex" | "con" | "int" | "wis" | "cha"

export function hasWeaponProperty(
  weapon: WeaponRuleInput,
  propertyId: WeaponPropertyId,
): boolean {
  return weapon.properties?.some((property) => property.id === propertyId) ?? false
}

export function isVersatileWeapon(weapon: WeaponRuleInput): boolean {
  return hasWeaponProperty(weapon, "versatile")
}

export function isTwoHandedWeapon(weapon: WeaponRuleInput): boolean {
  return hasWeaponProperty(weapon, "two-handed")
}

export function isWeaponImprovisedGrip(weapon: WeaponRuleInput): boolean {
  return isTwoHandedWeapon(weapon) && weapon.wieldedTwoHanded === false
}

export function getWeaponHandsUsed(weapon: WeaponRuleInput): 1 | 2 {
  if (weapon.wieldedTwoHanded === true) return 2
  if (weapon.wieldedTwoHanded === false) return 1
  return isTwoHandedWeapon(weapon) ? 2 : 1
}

export function getWeaponAttackAttribute(
  weapon: WeaponRuleInput,
): Attribute {
  return isWeaponImprovisedGrip(weapon)
    ? "str"
    : (weapon.modifierAttribute ?? "str")
}

export function getWeaponDamageDie(weapon: WeaponRuleInput): WeaponDie | undefined {
  if (isWeaponImprovisedGrip(weapon)) {
    return { quantity: 1, sides: "d4" }
  }

  if (
    isVersatileWeapon(weapon) &&
    weapon.wieldedTwoHanded &&
    weapon.versatileDamage
  ) {
    return weapon.versatileDamage
  }

  return weapon.damage
}

