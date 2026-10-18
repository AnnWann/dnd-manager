import type { DamageType } from "./damage.ts"
type Attribute = "str" | "dex" | "con" | "int" | "wis" | "cha"
/** Additional attack effects supplied by equipment, abilities or active conditions. */
export type AttackRider = {
  id: string
  label: string
  /** 'all' covers weapon, unarmed and spell attacks. */
  scope: "all" | "weapon" | "unarmed" | "spell"
  /** Restrict an effect to one weapon (e.g. Elemental Cleaver). */
  weaponId?: string
  /** Select an equipped weapon when activating a stance or elemental infusion. */
  weaponSelection?: "onActivation" | "sourceWeapon"
  /** Restrict a mark to the selected combatant, never to all opponents. */
  targetEntryId?: string
  /** A marked target is chosen when the spell is cast. */
  targetSelection?: "onCast"
  /** Rolled once per successful hit; its type is independent of the base damage. */
  damage?: { dice: string; damageType?: DamageType }
  /** When present, a player must choose one of these types at activation/cast. */
  damageTypeChoices?: DamageType[]
  /** Changes only the base weapon damage packet, not other typed riders. */
  replaceWeaponDamageType?: DamageType
  /** How to determine the base weapon's damage type. Defaults to the legacy fixed value. */
  weaponDamageTypeMode?: "fixed" | "selected" | "extra"
  /** Effective attack and damage modifier when this effect is active. */
  weaponAttackAttribute?: Attribute | "spellcasting" | "selected"
  /** Atributo selecionado na ativação, sem substituir a configuração reutilizável. */
  selectedWeaponAttribute?: Attribute
  /** Optional spellcasting class; otherwise uses the character's best casting attribute. */
  weaponSpellcastingClass?: string
  /** Temporary weapon properties, without mutating the saved inventory item. */
  addThrown?: boolean
  thrownNormalRange?: number
  thrownLongRange?: number
  returnsAfterThrow?: boolean
}

export type AttackRiderContext = {
  scope: "weapon" | "unarmed" | "spell"
  weaponId?: string
  targetEntryId?: string
}

export type ParsedRiderDice = { quantity: number; sides: number; flat: number }

/** Bounded numeric parser; never evaluate player-supplied expressions on the server. */
export function parseAttackRiderDice(dice: string): ParsedRiderDice | undefined {
  const value = dice.trim().replace(/\s+/g, "").toLowerCase()
  const match = /^(\d{1,2})d(4|6|8|10|12|20)([+-]\d{1,3})?$/.exec(value)
  if (!match) return undefined
  const quantity = Number(match[1])
  const flat = Number(match[3] ?? 0)
  if (quantity < 1 || quantity > 20 || Math.abs(flat) > 100) return undefined
  return { quantity, sides: Number(match[2]), flat }
}

export function getWeaponRiderTransformation(riders: readonly AttackRider[]) {
  const replacement = [...riders].reverse()
    .map(rider => rider.weaponDamageTypeMode === "extra"
      ? rider.damage?.damageType
      : rider.replaceWeaponDamageType)
    .find((type): type is DamageType => Boolean(type))
  const thrown = riders.some(rider => rider.addThrown)
  const returnAfterThrow = riders.some(rider => rider.returnsAfterThrow)
  const throwing = riders.find(rider => rider.addThrown && rider.thrownNormalRange && rider.thrownLongRange)
  return {
    damageType: replacement,
    thrown,
    thrownNormalRange: throwing?.thrownNormalRange,
    thrownLongRange: throwing?.thrownLongRange,
    returnsAfterThrow: returnAfterThrow,
  }
}

/** Store the selected attribute in the active instance while keeping the original rule. */
export function resolveAttackRiderAttributeSelection(riders: readonly AttackRider[], attribute?: Attribute): AttackRider[] {
  return riders.map(rider => rider.weaponAttackAttribute === "selected"
    ? { ...rider, selectedWeaponAttribute: attribute }
    : rider)
}

/** One choice can power all selectable riders on the same activation. */
export function getAttackRiderDamageChoices(riders: readonly AttackRider[]): DamageType[] {
  const groups = riders.map(rider => rider.damageTypeChoices ?? []).filter(group => group.length)
  if (!groups.length) return []
  return [...new Set(groups[0])].filter(type => groups.every(group => group.includes(type)))
}

export function resolveAttackRiderDamageChoice(
  riders: readonly AttackRider[],
  chosenType?: DamageType,
): AttackRider[] {
  const allowed = getAttackRiderDamageChoices(riders)
  if (allowed.length && (!chosenType || !allowed.includes(chosenType))) {
    throw new Error("Escolha um tipo de dano permitido para este efeito.")
  }
  return riders.map(rider => {
    // Existing saved riders with a fixed replacement and choices previously
    // followed the selected type. Preserve that behavior when no mode was saved.
    const mode = rider.weaponDamageTypeMode
      ?? (rider.replaceWeaponDamageType && rider.damageTypeChoices?.length ? "selected" : "fixed")
    const chooseExtra = Boolean(rider.damageTypeChoices?.length && chosenType)
    const chooseWeapon = mode === "selected" && Boolean(chosenType)
    if (!chooseExtra && !chooseWeapon) return rider
    return {
      ...rider,
      damage: chooseExtra && rider.damage
        ? { ...rider.damage, damageType: chosenType }
        : rider.damage,
      replaceWeaponDamageType: chooseWeapon ? chosenType : rider.replaceWeaponDamageType,
    }
  })
}

