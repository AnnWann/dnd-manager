import type { Ability, Usage } from "../abilities/Ability"
import type { ActionsPerTurn, ActionType } from "../actions/Actions"
import type { Die, DieSides } from "../dice/Die"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Bonus, Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import type { Magic } from "../magic/Magic"
import type { Slot } from "../magic/spells/LeveledSlots"
import type { Player } from "../player/Player"
import type { Attribute } from "../sheet/Attribute"
import type { HP } from "../sheet/HP"
import type { Sheet } from "../sheet/Sheet"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import { 
  addAbility, 
  getCharacterAbilities, 
  removeAbility, 
  resetAbility, 
  restoreAbility, 
  deactivateAbility, 
  saveAbility, 
  updateAbility, 
  useAbility 
} from "./characterAbilities"
import { 
  addAbilityToEquipment,
  addSpellToEquipment,
  addToPocketItem, 
  equipInventoryItem, 
  getCarryingCapacity, 
  getEncumbranceLimit, 
  getEquipmentAbilities, 
  getEquipmentSpells, 
  getHeavyEncumbranceLimit, 
  getTotalFingers, 
  getUsedArms, 
  getUsedFingers, 
  getWeight, 
  pocketInventoryItem, 
  removeEquipmentAbility, 
  removeEquipmentSpell, 
  removePocketItem, 
  removeRing, 
  removeWeapon, 
  restoreEquipmentAbility, 
  deactivateEquipmentAbility, 
  unequip, 
  unequipArmor, 
  unequipPocketItem, 
  unequipRing, 
  unequipWeapon, 
  updateEquipmentAbility, 
  updateEquipmentSpell, 
  updatePocketItem, 
  updateRing, 
  updateWeapon, 
  useEquipmentAbility, 
  usePocketItem, 
  useRing, 
  useWeapon, 
  wear, 
  wieldPocketWeapon 
} from "./characterEquipment"
import { 
  addInventoryItem, 
  removeInventoryItem, 
  removeInventoryItemFromBagOfHolding,
  sendInventoryItemToBagOfHolding, 
  toggleInventoryItemBagOfHolding, 
  updateInventoryItem 
} from "./characterInventory"
import {
  addSpell,
  ensureMagic,
  getDerivedPactSlots,
  getDerivedSpellSlots,
  getOrCreateMagic,
  getPactSlots,
  getSpellSlots,
  getSpells,
  removeSpell,
  restorePactSlot,
  restoreSpellSlot,
  setSpellPrepared,
  spendPactSlot,
  spendSpellSlot,
  syncMagicWithClasses,
  updateSpell,
  addMetamagic,
  removeMetamagic,
  setSorceryPoints,
  getSorceryPoints,
  spendSorceryPoint,
  restoreSorceryPoint,
  getSpellSource,
} from "./characterMagic"
import {
  applyBonus,
  applyBonuses,
  getAttributeModifier,
  getEffectiveAbilitySaveDc,
  getEffectiveArmorClass,
  getEffectiveAttackBonus,
  getEffectiveAttribute,
  getEffectiveAttributeModifier,
  getEffectiveInitiative,
  getEffectiveMobility,
  getEffectivePassivePerception,
  getEffectiveSaveDc,
  getEffectiveSpellAttackBonus,
  getEffectiveSpellDamageBonus,
  getEffectiveSpellSaveDc,
  getEffectiveStat,
  getEffectiveWeaponAttackBonus,
  getEffectiveWeaponDamageBonus,
  getEquipmentBonuses,
  getEquippedItems,
  getProficiencyBonus,
  getSavingThrowBonus,
  isSavingThrowProficient,
  setSavingThrowProficiency,
  type StatBonusKey,
} from "./characterStats"
import {
  addDeathSaveFailure,
  addDeathSaveSuccess,
  addDice,
  addTemporaryHp,
  getEffectiveMaxHp,
  getEffectiveTemporaryHp,
  heal,
  longRestHp,
  resetDeathSaves,
  restoreAllHitDice,
  restoreHitDie,
  setCurrentHp,
  setMaxHp,
  setTemporaryHp,
  spendHitDie,
  takeDamage,
  withHp,
} from "./characterHp"
import type { ClassName } from "../sheet/Class"
import type { CharacterSpells } from "../magic/spells/CharacterSpells"
import type { MetamagicId } from "../magic/metamagic/Metamagic"
import type { SpellSource } from "../magic/spells/SpellSource"
import type { Proficiency, ProficiencyCategory } from "../sheet/Proficiency"
import { addProficiency, hasProficiency, removeProficiency, updateProficiency } from "./characterProficiencies"
import type { CharacterProfile } from "./characterProfile"

export type CharacterTemplateProps = {
  id: string,
  name: string
  sheet: Sheet
  profile: CharacterProfile
  actionsPerTurn: ActionsPerTurn
  deathSaves?: {
    successes: number
    failures: number
  }
  unique: boolean

  abilities?: Ability[]
  magic?: Magic

  equipment: CharacterEquipment

  inventory: Itemmable[]

  notes: string[]

  owner: Player
  visibility: 'private' | 'party' | 'master'
}


export class CharacterTemplate {

  constructor(private readonly props: CharacterTemplateProps) {}

  get<K extends keyof CharacterTemplateProps>(key: K): CharacterTemplateProps[K] {
    return this.props[key]
  }

  withPatch(patch: Partial<CharacterTemplateProps>): CharacterTemplate {
    return new CharacterTemplate({
      ...this.props,
      ...patch
    })
  }

  static fromJSON(props: Partial<CharacterTemplateProps>): CharacterTemplate {
    return new CharacterTemplate({
      id: props.id ?? crypto.randomUUID(),
      name: props.name ?? "Personagem",
      profile: {
        traits: props.profile?.traits ?? "",
        history: props.profile?.history ?? "",
        physicalAppearance: props.profile?.physicalAppearance ?? "",
        imageUrl: props.profile?.imageUrl,
        relationships: Array.isArray(props.profile?.relationships)
          ? props.profile.relationships
          : [],
      },
      sheet: {
        HP: props.sheet?.HP ?? {
          max: 1,
          current: 1,
          temporary: 0,
          hitDice: {},
        },
        stats: props.sheet?.stats ?? {
          armorClass: 10,
          mobility: 9,
          initiative: 0,
          passive_perception: 10,
        },
        attributes: props.sheet?.attributes ?? {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
        },
        savingThrowProficiencies:
          props.sheet?.savingThrowProficiencies ?? {},
        proficiencies: Array.isArray(props.sheet?.proficiencies)
          ? props.sheet.proficiencies
          : [],
        skills: props.sheet?.skills ?? {},
        race: {
          race: props.sheet?.race?.race ?? "human",
          subrace: props.sheet?.race?.subrace ?? "",
          naturalAbilities: props.sheet?.race?.naturalAbilities ?? [],
          attributeBonus: props.sheet?.race?.attributeBonus ?? {},
          proficiencies: normalizeRaceProficiencies(
            props.sheet?.race?.proficiencies,
          ),
          size: props.sheet?.race?.size ?? "medium",
          speedBonus: props.sheet?.race?.speedBonus ?? 0,
        },
        type: props.sheet?.type ?? "pc",
        arms: props.sheet?.arms ?? 2,
        classes: props.sheet?.classes ?? [],
      },

      actionsPerTurn: props.actionsPerTurn ?? {
        action: 1,
        bonusAction: 1,
        reaction: 1,
        legendaryAction: 0,
        legendaryReaction: 0,
        legendaryResistance: 0,
        interaction: 1,
        free: 999,
      },

      deathSaves: props.deathSaves,
      unique: props.unique ?? true,
      abilities: Array.isArray(props.abilities) ? props.abilities : [],

      magic: props.magic ?? undefined,

      equipment: {
        ...(props.equipment ?? {}),
        rings: props.equipment?.rings ?? [],
        necklaces: props.equipment?.necklaces ?? [],
        weapons: props.equipment?.weapons ?? [],
        heldItems: props.equipment?.heldItems ?? [],
        pockets: props.equipment?.pockets ?? [],
      },

      inventory: props.inventory ?? [],
      notes: props.notes ?? [],
      owner: props.owner ?? {
        id: "",
        name: "",
        role: "player"
      },
      visibility: props.visibility ?? "party",
    })
  }

  toJSON(): CharacterTemplateProps {
    return this.props
  }

  with<K extends keyof CharacterTemplateProps>(key: K, value: CharacterTemplateProps[K]): CharacterTemplate {
    return this.withPatch({ [key]: value } as Pick<CharacterTemplateProps, K>)
  }

  withSheet<K extends keyof Sheet>(key: K, value: Sheet[K]): CharacterTemplate {
    return this.withPatch({
      sheet: {
        ...this.props.sheet,
        [key]: value
      }
    })
  }

  withStat<K extends keyof Sheet['stats']> (
    key: K,
    value: Sheet['stats'][K]
  ): CharacterTemplate {
    return this.withPatch({
    sheet: {
      ...this.props.sheet,
      stats: {
        ...this.props.sheet.stats,
        [key]: value,
      },
    }})
  }

  withAction<K extends ActionType> (
    key: K,
    value: number
  ): CharacterTemplate {
    return this.withPatch({
    actionsPerTurn: {
      ...this.props.actionsPerTurn,
      [key]: value
      },
    })
  }

  getAttributeBonuses(attribute: Attribute): Bonus[] {
    return this.getEquippedItems().flatMap((item) =>
      item.bonuses?.attribute
        ?.filter((entry) => entry.attribute === attribute)
        .map((entry) => entry.bonus) ?? [],
    )
  }

  getAttributeModifierBonuses(attribute: Attribute): Bonus[] {
    return this.getEquippedItems().flatMap((item) =>
      item.bonuses?.attributeModifier
        ?.filter((entry) => entry.attribute === attribute)
        .map((entry) => entry.bonus) ?? [],
    )
  }
  
  /**
   * 
   * CHARACTER ABILITIES
   * 
   */
  addAbility(ability: Ability): CharacterTemplate {return addAbility(this, ability)}
  updateAbility(ability: Ability): CharacterTemplate {return updateAbility(this, ability)}
  removeAbility(abilityId: string): CharacterTemplate {return removeAbility(this, abilityId)}
  saveAbility(ability: Ability): CharacterTemplate {return saveAbility(this, ability)}
  useAbility(abilityId: string): CharacterTemplate {return useAbility(this, abilityId)}
  restoreAbility(abilityId: string): CharacterTemplate {return restoreAbility(this, abilityId)}
  deactivateAbility(abilityId: string): CharacterTemplate {return deactivateAbility(this, abilityId)}
  resetAbility(abilityId: string): CharacterTemplate {return resetAbility(this, abilityId)}
  getCharacterAbilities(): Ability[] {return getCharacterAbilities(this)}
  /*
  *
  * Equipment
  *
  */
  getWeight(): number {return getWeight(this)}
  getCarryingCapacity(): number {return getCarryingCapacity(this)}
  getEncumbranceLimit(): number {return getEncumbranceLimit(this)}
  getHeavyEncumbranceLimit(): number {return getHeavyEncumbranceLimit(this)}
  wear<K extends Exclude<keyof CharacterEquipment, "weapons" | "rings" | "necklaces" | "pockets" | "heldItems">>(slot: K,item: CharacterEquipment[K],): CharacterTemplate {return wear(this, slot, item)}
  equipInventoryItem(itemId: string): CharacterTemplate {return equipInventoryItem(this, itemId)}
  unequip(slot: Exclude<keyof CharacterEquipment, "weapons" | "rings" | "necklaces" | "pockets" | "heldItems">,): CharacterTemplate {return unequip(this, slot)}
  unequipArmor(): CharacterTemplate {return unequipArmor(this)}
  getUsedArms(): number {return getUsedArms(this)}
  useWeapon(weapon: Weapon): CharacterTemplate {return useWeapon(this, weapon)}
  updateWeapon(index: number, weapon: Weapon): CharacterTemplate {return updateWeapon(this, index, weapon)}
  removeWeapon(index: number): CharacterTemplate {return removeWeapon(this, index)}
  unequipWeapon(index: number): CharacterTemplate {return unequipWeapon(this, index)}
  getUsedFingers(): number {return getUsedFingers(this)}
  getTotalFingers(): number {return getTotalFingers(this)}
  useRing(ring: Equipment): CharacterTemplate {return useRing(this, ring)}
  updateRing(index: number, ring: Equipment): CharacterTemplate {return updateRing(this, index, ring)}
  removeRing(index: number): CharacterTemplate {return removeRing(this, index)}
  unequipRing(index: number): CharacterTemplate {return unequipRing(this, index)}
  addToPocketItem(item: Itemmable): CharacterTemplate {return addToPocketItem(this, item)}
  pocketInventoryItem(itemId: string): CharacterTemplate {return pocketInventoryItem(this, itemId)}
  usePocketItem(index: number): CharacterTemplate {return usePocketItem(this, index)}
  updatePocketItem(index: number, item: Itemmable): CharacterTemplate {return updatePocketItem(this, index, item)}
  removePocketItem(index: number): CharacterTemplate {return removePocketItem(this, index)}
  unequipPocketItem(index: number): CharacterTemplate {return unequipPocketItem(this, index)}
  wieldPocketWeapon(index: number): CharacterTemplate {return wieldPocketWeapon(this, index)}
  getEquippedItems(): Equipment[] {return getEquippedItems(this)}
  getEquipmentAbilities(): Ability[] {return getEquipmentAbilities(this)}
  getEquipmentSpells(): {index: string, usage: Usage, sourceItemId: string, sourceItemName: string}[] {return getEquipmentSpells(this)}
  addAbilityToEquipment(itemId: string, ability: Ability): CharacterTemplate {return addAbilityToEquipment(this, itemId, ability)}
  updateEquipmentAbility( itemId: string, ability: Ability): CharacterTemplate {return updateEquipmentAbility(this, itemId, ability)}
  removeEquipmentAbility(itemId: string,abilityId: string): CharacterTemplate {return removeEquipmentAbility(this, itemId, abilityId)}
  addSpellToEquipment(itemId: string,spell: { index: string; usage: Usage }): CharacterTemplate {return addSpellToEquipment(this, itemId, spell)}
  updateEquipmentSpell(itemId: string,spell: { index: string; usage: Usage }): CharacterTemplate {return updateEquipmentSpell(this, itemId, spell)}
  removeEquipmentSpell(itemId: string,spellIndex: string): CharacterTemplate {return removeEquipmentSpell(this, itemId, spellIndex)}
  useEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return useEquipmentAbility(this, itemId, abilityId)}
  restoreEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return restoreEquipmentAbility(this, itemId, abilityId)}
  deactivateEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return deactivateEquipmentAbility(this, itemId, abilityId)}
  /**
   * 
   * INVENTORY
   *  
   */
  addInventoryItem(item: Itemmable): CharacterTemplate {return addInventoryItem(this, item)}
  updateInventoryItem(itemId: string,updater: (item: Itemmable) => Itemmable,): CharacterTemplate {return updateInventoryItem(this, itemId, updater)}
  removeInventoryItem(itemId: string): CharacterTemplate {return removeInventoryItem(this, itemId)}
  sendInventoryItemToBagOfHolding(itemId: string): CharacterTemplate {return sendInventoryItemToBagOfHolding(this, itemId)}
  removeInventoryItemFromBagOfHolding(itemId: string): CharacterTemplate {return removeInventoryItemFromBagOfHolding(this, itemId)}
  toggleInventoryItemBagOfHolding(itemId: string): CharacterTemplate { return toggleInventoryItemBagOfHolding(this, itemId)}
  /**
   * 
   * MAGIC
   *  
   */
  getOrCreateMagic(): Magic {return getOrCreateMagic(this)}
  ensureMagic(): CharacterTemplate {return ensureMagic(this)}
  ggetSpells(): CharacterSpells["knownSpells"] {return getSpells(this)}
  addSpell(spellEntry: CharacterSpells["knownSpells"][number]): CharacterTemplate {return addSpell(this, spellEntry)}
  updateSpell(spellEntry: CharacterSpells["knownSpells"][number]): CharacterTemplate {return updateSpell(this, spellEntry)}
  removeSpell(spellIndex: string): CharacterTemplate {return removeSpell(this, spellIndex)}
  setSpellPrepared(spellIndex: string,prepared: boolean,): CharacterTemplate {return setSpellPrepared(this, spellIndex, prepared)}
  getDerivedSpellSlots(): Partial<Record<MagicCircleLevel, Slot>> {return getDerivedSpellSlots(this)}
  getDerivedPactSlots(): Slot | undefined {return getDerivedPactSlots(this)}
  getSpellSlots(): Partial<Record<MagicCircleLevel, Slot>> {return getSpellSlots(this)}
  getPactSlots(): Slot | undefined {return getPactSlots(this)}
  syncMagicWithClasses(): CharacterTemplate {return syncMagicWithClasses(this)}
  spendSpellSlot(level: MagicCircleLevel): CharacterTemplate {return spendSpellSlot(this, level)}
  restoreSpellSlot(level: MagicCircleLevel): CharacterTemplate {return restoreSpellSlot(this, level)}
  spendPactSlot(): CharacterTemplate {return spendPactSlot(this)}
  restorePactSlot(): CharacterTemplate {return restorePactSlot(this)}
  addMetamagic(metamagicId: MetamagicId): CharacterTemplate {return addMetamagic(this, metamagicId)}
  removeMetamagic(metamagicId: MetamagicId): CharacterTemplate {return removeMetamagic(this, metamagicId)}
  setSorceryPoints(current: number): CharacterTemplate {return setSorceryPoints(this, current)}
  getSorceryPoints() {return getSorceryPoints(this)}
  spendSorceryPoint(): CharacterTemplate {return spendSorceryPoint(this)}
  restoreSorceryPoint(): CharacterTemplate {return restoreSorceryPoint(this)}
  getSpellSource(spellId: string): SpellSource | undefined {return getSpellSource(this, spellId)}
  /**
   * 
   * STATS
   *  
   */
  getProficiencyBonus(): number {return getProficiencyBonus(this)}
  getAttributeModifier(attribute: Attribute): number {return getAttributeModifier(this, attribute)}
  getEffectiveAttribute(attribute: Attribute): number {return getEffectiveAttribute(this, attribute)}
  getEffectiveAttributeModifier(attribute: Attribute): number {return getEffectiveAttributeModifier(this, attribute)}
  getEffectiveStat<K extends keyof Sheet["stats"]>(stat: K,): Sheet["stats"][K] {return getEffectiveStat(this, stat)}
  getEffectiveAttackBonus(baseValue: number): number {return getEffectiveAttackBonus(this, baseValue)}
  getEffectiveSpellAttackBonus(attribute: Attribute, baseValue: number): number {return getEffectiveSpellAttackBonus(this, attribute, baseValue)}
  getEffectiveSpellDamageBonus(attribute: Attribute, baseValue: number): number {return getEffectiveSpellDamageBonus(this, attribute, baseValue)}
  getEffectiveSaveDc(baseValue: number): number {return getEffectiveSaveDc(this, baseValue)}
  getEffectiveSpellSaveDc(attribute: Attribute, baseValue: number): number {return getEffectiveSpellSaveDc(this, attribute, baseValue)}
  getEffectiveAbilitySaveDc(attribute: Attribute, baseValue: number): number {return getEffectiveAbilitySaveDc(this, attribute, baseValue)}
  getEffectiveWeaponAttackBonus(weapon: Weapon,baseValue: number,): number {return getEffectiveWeaponAttackBonus(this, weapon, baseValue)}
  getEffectiveWeaponDamageBonus(weapon: Weapon,baseValue: number,): number {return getEffectiveWeaponDamageBonus(this, weapon, baseValue)}
  getEquipmentBonuses(key: StatBonusKey): Bonus[] {return getEquipmentBonuses(this, key)}
  getEffectiveArmorClass(): number {return getEffectiveArmorClass(this)}
  getEffectiveInitiative(): number {return getEffectiveInitiative(this)}
  getEffectivePassivePerception(): number {return getEffectivePassivePerception(this)}
  getEffectiveMobility(): number {return getEffectiveMobility(this)}
  applyBonus(baseValue: number, bonus: Bonus): number {return applyBonus(baseValue, bonus)}
  applyBonuses(baseValue: number, bonuses: Bonus[]): number {return applyBonuses(baseValue, bonuses)}
  isSavingThrowProficient(attribute: Attribute): boolean {return isSavingThrowProficient(this, attribute)}
  getSavingThrowBonus(attribute: Attribute): number {return getSavingThrowBonus(this, attribute)}
  setSavingThrowProficiency(attribute: Attribute,proficient: boolean): CharacterTemplate {return setSavingThrowProficiency(this,attribute,proficient)}
  /**
   *
   * HP
   *
   */
  withHp<K extends keyof HP>(key: K, value: HP[K]): CharacterTemplate {return withHp(this, key, value)}
  getEffectiveMaxHp(): number {return getEffectiveMaxHp(this)}
  getEffectiveTemporaryHp(): number {return getEffectiveTemporaryHp(this)}
  setCurrentHp(value: number): CharacterTemplate {return setCurrentHp(this, value)}
  setTemporaryHp(value: number): CharacterTemplate {return setTemporaryHp(this, value)}
  setMaxHp(value: number): CharacterTemplate {return setMaxHp(this, value)}
  takeDamage(damage: number): CharacterTemplate {return takeDamage(this, damage)}
  heal(amount: number): CharacterTemplate {return heal(this, amount)}
  addTemporaryHp(amount: number): CharacterTemplate {return addTemporaryHp(this, amount)}
  addDice(die: Die): CharacterTemplate {return addDice(this, die)}
  spendHitDie(side: DieSides): CharacterTemplate {return spendHitDie(this, side)}
  restoreHitDie(side: DieSides): CharacterTemplate {return restoreHitDie(this, side)}
  restoreAllHitDice(): CharacterTemplate {return restoreAllHitDice(this)}
  addDeathSaveSuccess(): CharacterTemplate {return addDeathSaveSuccess(this)}
  addDeathSaveFailure(): CharacterTemplate {return addDeathSaveFailure(this)}
  resetDeathSaves(): CharacterTemplate {return resetDeathSaves(this)}
  longRestHp(): CharacterTemplate {return longRestHp(this)}
    /**
   *
   * PROFICIENCIES
   *
   */
  addProficiency(proficiency: Proficiency): CharacterTemplate { return addProficiency(this, proficiency)}
  updateProficiency( proficiency: Proficiency): CharacterTemplate { return updateProficiency(this, proficiency)}
  removeProficiency(proficiencyId: string): CharacterTemplate {return removeProficiency(this, proficiencyId)}
  hasProficiency(category: ProficiencyCategory,name: string): boolean {return hasProficiency(this, category, name)}

  getClassLevel(className: ClassName): number {
    return (
      this
        .get("sheet")
        .classes
        ?.find((classData) => classData.className === className)
        ?.level ?? 0
    )
  }

  withProfile<K extends keyof CharacterProfile>(
    key: K,
    value: CharacterProfile[K],
  ): CharacterTemplate {
    return this.withPatch({
      profile: {
        ...this.props.profile,
        [key]: value,
      },
    })
  }
}




function normalizeRaceProficiencies(
  value: unknown,
): Proficiency[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          id: crypto.randomUUID(),
          name: entry,
          category: "other" as const,
        }
      }

      if (
        entry &&
        typeof entry === "object" &&
        "id" in entry &&
        "name" in entry &&
        "category" in entry
      ) {
        return entry as Proficiency
      }

      return undefined
    })
    .filter((entry): entry is Proficiency => Boolean(entry))
}