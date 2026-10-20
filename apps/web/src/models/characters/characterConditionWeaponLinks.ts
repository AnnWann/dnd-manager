import type { CharacterCondition } from "./CharacterCondition"

/** Weapon equipment IDs owned by a condition (including granted abilities). */
export function getConditionWeaponIds(condition: CharacterCondition): string[] {
  const riders = [
    ...(condition.bonuses?.attackRiders ?? []),
    ...(condition.grantedAbilities ?? []).flatMap(ability => ability.bonuses?.attackRiders ?? []),
  ]
  const ids = riders.flatMap(rider => {
    if (rider.weaponId) return [rider.weaponId]
    // Item-granted effects may use the item's own ID implicitly.
    if (rider.weaponSelection === "sourceWeapon" && condition.sourceItemId) return [condition.sourceItemId]
    return []
  })

  return [...new Set(ids)]
}

/** Keep a missing weapon visible so users can identify dangling effects. */
export function getConditionWeaponLabels(
  condition: CharacterCondition,
  weapons: ReadonlyArray<{ id: string; name: string }>,
): Array<{ id: string; label: string; missing: boolean }> {
  return getConditionWeaponIds(condition).map(id => {
    const weapon = weapons.find(candidate => candidate.id === id)
    return {
      id,
      label: weapon?.name?.trim() || "Arma não encontrada",
      missing: !weapon,
    }
  })
}
