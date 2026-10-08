import type { DamageType } from "../../combat/Damage"
import { getAttackRiderDamageChoices } from "../../combat/AttackRider"
import type { Spell } from "./Spell"
import type { AttackRider } from "../../combat/AttackRider"

/** Canonical rider encoding for official spells not yet present in the legacy compendium JSON.
 * A spell's authored onCastAttackRiders take precedence for campaign overrides.
 */
export function getSpellOnCastAttackRiders(spell: Spell): AttackRider[] {
  if (spell.onCastAttackRiders) return spell.onCastAttackRiders
  switch (spell.index.trim().toLowerCase()) {
    case "hex":
      return [{
        id: "hex-necrotic",
        label: "Hex — dano necrótico",
        scope: "all",
        damage: { dice: "1d6", damageType: "necrotic" },
      }]
    case "hunters-mark":
    case "hunter-s-mark":
      return [{
        id: "hunters-mark-damage",
        label: "Hunter's Mark — dano adicional",
        scope: "weapon",
        damage: { dice: "1d6" },
      }]
    default:
      return []
  }
}

export function getSpellCastDamageChoices(spell: Spell): DamageType[] {
  const riderChoices = getAttackRiderDamageChoices(getSpellOnCastAttackRiders(spell))
  const directChoices = spell.castDamageTypeChoices ?? []
  if (!riderChoices.length) return [...new Set(directChoices)]
  if (!directChoices.length) return riderChoices
  return riderChoices.filter(type => directChoices.includes(type))
}
