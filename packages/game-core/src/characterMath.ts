/** Pure D&D numeric ability and proficiency calculations. */
export function proficiencyBonus(totalLevel: number): number {
  return Math.ceil(totalLevel / 4) + 1
}
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}
