import type { AttackRider } from "../../../../web/src/models/combat/AttackRider"
import { parseAttackRiderDice } from "../../../../web/src/models/combat/AttackRider"
import type { SessionResolvedDamageRoll } from "../../../../web/src/shared/session-runtime/diceRollProtocol"

export function rollAttackRiderDamages(
  riders: readonly AttackRider[],
  critical: boolean,
  inheritedDamageType?: string,
): SessionResolvedDamageRoll[] {
  const seen = new Set<string>()
  return riders.flatMap(rider => {
    if (!rider.damage) return []
    // Protect the authoritative dice roller even when the caller or an
    // older persisted session projects the same effect more than once.
    // Do not merge genuinely separate riders with different IDs.
    const key = `${rider.id}:${rider.weaponId ?? "*"}:${rider.targetEntryId ?? "*"}`
    if (seen.has(key)) return []
    seen.add(key)
    const parsed = parseAttackRiderDice(rider.damage.dice)
    if (!parsed) return []
    const quantity = parsed.quantity * (critical ? 2 : 1)
    const rolls = Array.from({ length: quantity }, () => rollDie(parsed.sides))
    return [{
      label: rider.label || "Dano adicional",
      damageType: rider.damage.damageType ?? inheritedDamageType,
      magical: rider.damage.magical ?? riders.some(entry => entry.treatWeaponAsMagical),
      ignoreResistance: rider.damage.ignoreResistance,
      groups: [{ quantity, sides: parsed.sides, rolls }],
      modifier: parsed.flat,
      total: rolls.reduce((sum, value) => sum + value, 0) + parsed.flat,
      critical,
    }]
  })
}

function rollDie(sides: number): number {
  const range = 0x1_0000_0000
  const limit = range - (range % sides)
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return (buffer[0] % sides) + 1
}
