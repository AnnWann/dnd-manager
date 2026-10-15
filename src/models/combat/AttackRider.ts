import type { DamageType } from "./Damage"
import type { Attribute } from "../sheet/Attribute"
import { getWeaponAttackAttribute, isWeaponImprovisedGrip, type Weapon } from "../items/equipment/Weapon"
import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { getCharacterConditions } from "../characters/characterConditionStorage"
import { getActiveAbilities, getEquippedItems } from "../characters/characterStats"
import { isAbilityBenefitsActive } from "../abilities/abilityActivation"

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

/** Keep an item's own enchantment on the weapon granting it. */
function bindSourceWeapon(riders: readonly AttackRider[] | undefined, sourceItemId?: string): AttackRider[] {
  return (riders ?? []).map(rider => rider.weaponSelection === "sourceWeapon"
    ? { ...rider, weaponId: sourceItemId }
    : rider)
}

function defaultCastingAttribute(className: string): Attribute | undefined {
  if (["wizard", "artificer", "fighter", "rogue"].includes(className)) return "int"
  if (["cleric", "druid", "ranger"].includes(className)) return "wis"
  if (["bard", "paladin", "sorcerer", "warlock"].includes(className)) return "cha"
  return undefined
}

/** Effective modifier attribute shared by sheet previews and server rolls. */
export function getCharacterWeaponAttackAttribute(character: CharacterTemplate, weapon: Weapon): Attribute {
  const original = getWeaponAttackAttribute(weapon)
  if (isWeaponImprovisedGrip(weapon)) return original
  const override = getActiveAttackRiders(character, { scope: "weapon", weaponId: weapon.id })
    .filter(rider => rider.weaponAttackAttribute)
    .at(-1)
  if (!override?.weaponAttackAttribute) return original
  if (override.weaponAttackAttribute === "selected") return override.selectedWeaponAttribute ?? original
  if (override.weaponAttackAttribute !== "spellcasting") return override.weaponAttackAttribute
  const options = (character.get("sheet").classes ?? [])
    .filter(entry => !override.weaponSpellcastingClass || entry.className === override.weaponSpellcastingClass)
    .map(entry => entry.castingAttribute ?? defaultCastingAttribute(entry.className))
    .filter((attribute): attribute is Attribute => Boolean(attribute))
  if (!options.length) return original
  return options.reduce((best, attribute) =>
    character.getEffectiveAttributeModifier(attribute) > character.getEffectiveAttributeModifier(best)
      ? attribute : best)
}

/** No target supplied means a target-specific mark cannot trigger. */
export function getActiveAttackRiders(character: CharacterTemplate, context: AttackRiderContext): AttackRider[] {
  const activeConditions = getCharacterConditions(character)
    .filter(condition => condition.duration.remaining !== 0 || !["rounds", "turns", "minutes", "hours", "days"].includes(condition.duration.type))
  const equipped = getEquippedItems(character)
  const equipmentAbilities = new Set(equipped.flatMap(item => item.abilities ?? []))
  const riders: AttackRider[] = [
    ...equipped.flatMap(item => [
      ...bindSourceWeapon(item.bonuses?.attackRiders, item.id),
      ...(item.abilities ?? []).filter(isAbilityBenefitsActive)
        .flatMap(ability => bindSourceWeapon(ability.bonuses?.attackRiders, item.id)),
    ]),
    ...getActiveAbilities(character)
      .filter(ability => !equipmentAbilities.has(ability))
      .flatMap(ability => bindSourceWeapon(ability.bonuses?.attackRiders)),
    ...activeConditions.flatMap(condition => [
      ...bindSourceWeapon(condition.bonuses?.attackRiders, condition.sourceItemId),
      ...(condition.grantedAbilities ?? []).filter(isAbilityBenefitsActive)
        .flatMap(ability => bindSourceWeapon(ability.bonuses?.attackRiders, condition.sourceItemId)),
    ]),
  ]
  return riders
    .filter(rider => rider.scope === "all" || rider.scope === context.scope)
    .filter(rider => !rider.weaponSelection || Boolean(rider.weaponId))
    .filter(rider => !rider.weaponId || (context.scope === "weapon" && rider.weaponId === context.weaponId))
    .filter(rider => !rider.targetEntryId || rider.targetEntryId === context.targetEntryId)
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

/** Selection is requested for the active option only, not unrelated choices. */
export function abilityRequiresWeaponAttributeSelection(ability: Ability, optionId?: string): boolean {
  const option = ability.activationOptions?.find(candidate => candidate.id === optionId)
  const granted = option?.abilities ?? (option?.ability ? [option.ability] : [])
  return [
    ...(ability.bonuses?.attackRiders ?? []),
    ...granted.flatMap(child => child.bonuses?.attackRiders ?? []),
  ].some(rider => rider.scope === "weapon" && rider.weaponAttackAttribute === "selected")
}

/** Store the selected attribute in the active instance while keeping the original rule. */
export function resolveAttackRiderAttributeSelection(riders: readonly AttackRider[], attribute?: Attribute): AttackRider[] {
  return riders.map(rider => rider.weaponAttackAttribute === "selected"
    ? { ...rider, selectedWeaponAttribute: attribute }
    : rider)
}

export function optionRequiresWeaponSelection(ability: Ability, optionId?: string): boolean {
  const option = ability.activationOptions?.find(candidate => candidate.id === optionId)
  if (!option) return false
  return (option.abilities ?? (option.ability ? [option.ability] : [])).some(granted =>
    (granted.bonuses?.attackRiders ?? []).some(rider => rider.weaponSelection === "onActivation"),
  )
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

export function getAbilityAttackRiderDamageChoices(ability: Ability, optionId?: string): DamageType[] {
  const option = ability.activationOptions?.find(entry => entry.id === optionId)
  const granted = option?.abilities ?? (option?.ability ? [option.ability] : [])
  return getAttackRiderDamageChoices([
    ...(ability.bonuses?.attackRiders ?? []),
    ...granted.flatMap(entry => entry.bonuses?.attackRiders ?? []),
  ])
}
