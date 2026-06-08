import type { Ability } from "../abilities/Ability"
import type { ActionsPerTurn, ActionType } from "../actions/Actions"
import type { Die } from "../dice/Die"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Bonus, Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import type { Magic } from "../magic/Magic"
import type { Player } from "../player/Player"
import type { Attribute } from "../sheet/Attribute"
import type { HP } from "../sheet/HP"
import type { Sheet } from "../sheet/Sheet"


export type CharacterTemplateProps = {
  id: string,
  name: string
  sheet: Sheet
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

  private withPatch(patch: Partial<CharacterTemplateProps>): CharacterTemplate {
    return new CharacterTemplate({
      ...this.props,
      ...patch
    })
  }

  private getEquippedItems(): Equipment[] {
    const equipment = this.props.equipment

    return [
      equipment.armor,
      equipment.helmet,
      equipment.gloves,
      equipment.boots,
      ...equipment.rings,
      ...equipment.weapons,
    ].filter((item): item is Equipment => item !== undefined)
  }
  private applyBonus(base: number, bonus: Bonus): number {
    if (bonus.type === "add") return base + bonus.value
    if (bonus.type === "sub") return base - bonus.value
    return bonus.value
  }

  private applyBonuses(base: number, bonuses: Bonus[]): number {
    const flat = bonuses.find((bonus) => bonus.type === "flat")

    if (flat) return flat.value

    return bonuses.reduce(
      (total, bonus) => this.applyBonus(total, bonus),
      base,
    )
  }

  private getEquipmentBonuses(
    key:
      | "armorClass"
      | "initiative"
      | "maxHp"
      | "temporaryHp"
      | "passivePerception"
      | "attackBonus"
      | "speed",
  ): Bonus[] {
    return this.getEquippedItems().flatMap((item) =>
      item.bonuses?.[key] ?? [],
    )
  }

  static fromJSON(props: Partial<CharacterTemplateProps>): CharacterTemplate {
    return new CharacterTemplate({
      id: props.id ?? crypto.randomUUID(),
      name: props.name ?? "Personagem",

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
        skills: props.sheet?.skills ?? {},
        race: props.sheet?.race ?? {
          race: "human",
          naturalAbilities: [],
          subrace: "",
          attributeBonus: {
            str: 0,
            dex: 0,
            con: 0,
            int: 0,
            wis: 0,
            cha: 0,
          },
          proficiencies: [],
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

      equipment: props.equipment ?? {
        rings: [],
        weapons: [],
        pockets: [],
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

  getWeight(): number {
    const equipment = this.props.equipment
    const rings_weight = equipment.rings.reduce((prev, curr) => prev + (curr.weight ?? 0), 0) ?? 0
    const weapons_weight = equipment.weapons.reduce((prev, curr) => prev + (curr.weight ?? 0), 0) ?? 0
    const pocket_weight = equipment.pockets.reduce((prev, curr) => prev + (curr.weight ?? 0), 0) ?? 0

    const equipment_weight =
    (equipment.armor?.weight ?? 0) +
    (equipment.boots?.weight ?? 0) +
    (equipment.gloves?.weight ?? 0) +
    (equipment.helmet?.weight ?? 0) +
    rings_weight +
    weapons_weight +
    pocket_weight

    const inventory = this.props.inventory

    const inventory_weight = inventory.reduce((prev, curr) => prev + (curr.weight ?? 0), 0) ?? 0

    return inventory_weight + equipment_weight
  }
  
  getCarryingCapacity(): number {
    return this.getEffectiveAttribute("str") * 15
  }

  getEncumbranceLimit(): number {
    return this.getEffectiveAttribute("str") * 5
  }

  getHeavyEncumbranceLimit(): number {
    return this.getEffectiveAttribute("str") * 10
  }

  getProficiencyBonus(): number {
    const totalLevel = this.props.sheet.classes?.reduce((prev, curr) => prev + curr.level, 0) ?? 1
    return Math.ceil(totalLevel / 4) + 1
  }

  getAttributeModifier(attribute: Attribute): number {
    return Math.floor((this.props.sheet.attributes[attribute] - 10) / 2)
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

  withHp<K extends keyof HP>(
  key: K,
  value: HP[K],
  ): CharacterTemplate {
    return this.withPatch({
      sheet: {
        ...this.props.sheet,
        HP: {
          ...this.props.sheet.HP,
          [key]: value,
        },
    }})
  }

  addDice(die: Die): CharacterTemplate {
    const currentHitDice = this.props.sheet.HP.hitDice
    const existing = currentHitDice[die.sides]

    return this.withHp("hitDice", {
      ...currentHitDice,
      [die.sides]: {
        max: {
          quantity: (existing?.max.quantity ?? 0) + die.quantity,
          sides: die.sides,
        },
        current: {
          quantity: (existing?.current.quantity ?? 0) + die.quantity,
          sides: die.sides,
        },
      },
    })
  }

  wear<K extends Exclude<keyof CharacterEquipment, 'weapons' | 'rings' | 'pockets'>>(
   slot: K,
   item: CharacterEquipment[K]
  ): CharacterTemplate {
    return this.with('equipment', {
      ...this.props.equipment,
      [slot]: item,
      })
  }


  getUsedArms (): number {
    return this.props.equipment.weapons?.reduce((total, weapon) => total + (weapon.twoHanded ? 2 : 1), 0) ?? 0
  }
  useWeapon(weapon: Weapon): CharacterTemplate {
    const usedArms = this.getUsedArms()
    const neededArms = weapon.twoHanded ? 2 : 1

    if (usedArms + neededArms > this.props.sheet.arms) {
      throw new Error("All hands are occupied")
    }

    return this.with("equipment", {
      ...this.props.equipment,
      weapons: [...this.props.equipment.weapons, weapon],
    })
  }

  updateWeapon(index: number, weapon: Weapon): CharacterTemplate {
    const weapons = [...this.props.equipment.weapons]

    if (!weapons[index]) {
      throw new Error("Weapon not found")
    }

    weapons[index] = weapon

    return this.with("equipment", {
      ...this.props.equipment,
      weapons,
    })
  }

  removeWeapon(index: number): CharacterTemplate {
    return this.with("equipment", {
      ...this.props.equipment,
      weapons: this.props.equipment.weapons.filter((_, i) => i !== index),
    })
  }

  getUsedFingers(): number {
  return this.props.equipment.rings.length
  }

  getTotalFingers(): number {
    return this.props.sheet.arms * 4
  } 

  useRing(ring: Equipment): CharacterTemplate {
    const usedFingers = this.props.equipment.rings?.reduce((total, _) => total + 1, 0) ?? 0
    const totalFingers = this.props.sheet.arms * 4

    if (usedFingers >= totalFingers) {
      throw new Error ('All fingers are occupied')
    }

    return this.with('equipment', {
      ...this.props.equipment,
      rings: [...this.props.equipment.rings, ring]
    })
  }

  updateRing(index: number, ring: Equipment): CharacterTemplate {
    const rings = [...this.props.equipment.rings]

    if (!rings[index]) {
      throw new Error("Weapon not found")
    }

    rings[index] = ring

    return this.with("equipment", {
      ...this.props.equipment,
      rings: rings,
    })
  }

  removeRing(index: number): CharacterTemplate {
    return this.with("equipment", {
      ...this.props.equipment,
      rings: this.props.equipment.rings.filter((_, i) => i !== index),
    })
  }

  pocketInventoryItem(itemId: string): CharacterTemplate {
    const item = this.props.inventory.find((i) => i.id === itemId)

    if (!item) return this

    return this.addToPocketItem(item)
  }

  addToPocketItem(item: Itemmable): CharacterTemplate {
    if (!item.pocketable) {
      throw new Error("Item is not pocketable")
    }

    const usedPockets = this.props.equipment.pockets.length

    if (usedPockets >= 8) {
      throw new Error("All pockets are occupied")
    }

    return this.withPatch({
      inventory: this.props.inventory.filter((i) => i.id !== item.id),
      equipment: {
        ...this.props.equipment,
        pockets: [...this.props.equipment.pockets, item],
      },
    })
  }

  updatePocketItem(index: number, pocket: Itemmable): CharacterTemplate {
    const pockets = [...this.props.equipment.pockets]

    if (!pockets[index]) {
      throw new Error("Weapon not found")
    }

    pockets[index] = pocket

    return this.with("equipment", {
      ...this.props.equipment,
      pockets,
    })
  }

  removePocketItem(index: number): CharacterTemplate {
    return this.with("equipment", {
      ...this.props.equipment,
      pockets: this.props.equipment.pockets.filter((_, i) => i !== index),
    })
  }

  wieldPocketWeapon(index: number): CharacterTemplate {
    const item = this.props.equipment.pockets[index]

    if (!item || item.kind !== "equipment" || item.equipSlot !== "weapon") {
      return this
    }

    const weapon = this.toWeapon(item)

    const pocketsWithoutItem = this.props.equipment.pockets.filter(
      (_, i) => i !== index,
    )

    const neededArms = weapon.twoHanded ? 2 : 1
    const currentWeapons = [...this.props.equipment.weapons]
    const returnedToInventory: Itemmable[] = []

    let usedArms = currentWeapons.reduce(
      (total, currentWeapon) => total + (currentWeapon.twoHanded ? 2 : 1),
      0,
    )

    while (
      usedArms + neededArms > this.props.sheet.arms &&
      currentWeapons.length > 0
    ) {
      const removed = currentWeapons.shift()
      if (!removed) break

      returnedToInventory.push(removed)
      usedArms -= removed.twoHanded ? 2 : 1
    }

    return this.withPatch({
      inventory: [...this.props.inventory, ...returnedToInventory],
      equipment: {
        ...this.props.equipment,
        pockets: pocketsWithoutItem,
        weapons: [...currentWeapons, weapon],
      },
    })
  }

  private toWeapon(item: Itemmable): Weapon {
    return {
      ...item,
      kind: "equipment",
      equippable: true,
      equipSlot: "weapon",
      properties: "properties" in item ? item.properties ?? [] : [],
      twoHanded: "twoHanded" in item ? item.twoHanded ?? false : false,
      damage:
        "damage" in item && item.damage
          ? item.damage
          : {
              quantity: 1,
              sides: "d6",
            },
      modifierAttribute:
        "modifierAttribute" in item && item.modifierAttribute
          ? item.modifierAttribute
          : "str",
      proficient:
        "proficient" in item
          ? item.proficient ?? false
          : false,
    }
  }

  equipInventoryItem(itemId: string): CharacterTemplate {
    const item = this.props.inventory.find((i) => i.id === itemId)

    if (!item || !item.equippable || !item.equipSlot) {
      return this
    }

    const inventoryWithoutItem = this.props.inventory.filter(
      (i) => i.id !== itemId,
    )

    const equipment = this.props.equipment

    if (item.equipSlot === "weapon") {
      const nextWeapon = this.toWeapon(item)
      const neededArms = nextWeapon.twoHanded ? 2 : 1

      const currentWeapons = [...equipment.weapons]
      const returnedToInventory: Itemmable[] = []

      let usedArms = currentWeapons.reduce(
        (total, weapon) => total + (weapon.twoHanded ? 2 : 1),
        0,
      )

      while (usedArms + neededArms > this.props.sheet.arms && currentWeapons.length > 0) {
        const removed = currentWeapons.shift()
        if (!removed) break

        returnedToInventory.push(removed)
        usedArms -= removed.twoHanded ? 2 : 1
      }

      return this.withPatch({
        inventory: [...inventoryWithoutItem, ...returnedToInventory],
        equipment: {
          ...equipment,
          weapons: [...currentWeapons, nextWeapon],
        },
      })
    }

    if (item.equipSlot === "ring") {
      return this.withPatch({
        inventory: inventoryWithoutItem,
        equipment: {
          ...equipment,
          rings: [...equipment.rings, item as Equipment],
        },
      })
    }

    const slot = item.equipSlot

    const previous = equipment[slot]

    return this.withPatch({
      inventory: previous
        ? [...inventoryWithoutItem, previous]
        : inventoryWithoutItem,
      equipment: {
        ...equipment,
        [slot]: item,
      },
    })
  }

  unequipArmor(): CharacterTemplate {
    const armor = this.props.equipment.armor

    if (!armor) return this

    return this.withPatch({
      inventory: [...this.props.inventory, armor],
      equipment: {
        ...this.props.equipment,
        armor: undefined,
      },
    })
  }

  unequipWeapon(index: number): CharacterTemplate {
    const weapon = this.props.equipment.weapons[index]

    if (!weapon) return this

    return this.withPatch({
      inventory: [...this.props.inventory, weapon],
      equipment: {
        ...this.props.equipment,
        weapons: this.props.equipment.weapons.filter(
          (_, i) => i !== index,
        ),
      },
    })
  }
  
  usePocketItem(index: number): CharacterTemplate {
    const item = this.props.equipment.pockets[index]

    if (!item) return this

    if (item.kind !== "consumable" && item.kind !== "throwable") {
      return this
    }

    const nextQuantity = Math.max(0, (item.quantity ?? 1) - 1)

    const nextItem = {
      ...item,
      quantity: nextQuantity,
    }

    const pocketsWithoutItem = this.props.equipment.pockets.filter(
      (_, i) => i !== index,
    )

    if (nextQuantity <= 0) {
      return this.withPatch({
        inventory: [...this.props.inventory, nextItem],
        equipment: {
          ...this.props.equipment,
          pockets: pocketsWithoutItem,
        },
      })
    }

    return this.withPatch({
      equipment: {
        ...this.props.equipment,
        pockets: this.props.equipment.pockets.map((pocketItem, i) =>
          i === index ? nextItem : pocketItem,
        ),
      },
    })
  }

  unequipPocketItem(index: number): CharacterTemplate {
    const item = this.props.equipment.pockets[index]

    if (!item) return this

    return this.withPatch({
      inventory: [...this.props.inventory, item],
      equipment: {
        ...this.props.equipment,
        pockets: this.props.equipment.pockets.filter((_, i) => i !== index),
      },
    })
  }

  unequip<K extends "helmet" | "gloves" | "boots" | "armor">(
    slot: K,
  ): CharacterTemplate {
    const item = this.props.equipment[slot]

    if (!item) return this

    return this.withPatch({
      inventory: [...this.props.inventory, item],
      equipment: {
        ...this.props.equipment,
        [slot]: undefined,
      },
    })
  }

  unequipRing(index: number): CharacterTemplate {
    const ring = this.props.equipment.rings[index]

    if (!ring) return this

    return this.withPatch({
      inventory: [...this.props.inventory, ring],
      equipment: {
        ...this.props.equipment,
        rings: this.props.equipment.rings.filter((_, i) => i !== index),
      },
    })
  }


  addAbility(ability: Ability): CharacterTemplate {
    return this.with("abilities", [
      ...(this.props.abilities ?? []),
      ability,
    ])
  }

  updateAbility(ability: Ability): CharacterTemplate {
    return this.with(
      "abilities",
      (this.props.abilities ?? []).map((a) =>
        a.id === ability.id ? ability : a
      ),
    )
  }

  removeAbility(abilityId: string): CharacterTemplate {
    return this.with(
      "abilities",
      (this.props.abilities ?? []).filter((a) => a.id !== abilityId),
    )
  }

  saveAbility(ability: Ability): CharacterTemplate {
    const exists = (this.props.abilities ?? []).some((a) => a.id === ability.id)

    return exists
      ? this.updateAbility(ability)
      : this.addAbility(ability)
  }

  useAbility(abilityId: string): CharacterTemplate {
    return this.with(
      "abilities",
      (this.props.abilities ?? []).map((a) => {
        if (a.id !== abilityId || !a.usage) return a

        return {
          ...a,
          usage: {
            ...a.usage,
            used: Math.min(a.usage.max, a.usage.used + 1),
          },
        }
      }),
    )
  }

  resetAbility(abilityId: string): CharacterTemplate {
    return this.with(
      "abilities",
      (this.props.abilities ?? []).map((a) => {
        if (a.id !== abilityId || !a.usage) return a

        return {
          ...a,
          usage: {
            ...a.usage,
            used: 0,
            cooldownRemaining: undefined,
          },
        }
      }),
    )
  }

  getEffectiveArmorClass(): number {
    return this.applyBonuses(
      this.props.sheet.stats.armorClass,
      this.getEquipmentBonuses("armorClass"),
    )
  }

  getEffectiveInitiative(): number {
    return this.applyBonuses(
      this.props.sheet.stats.initiative,
      this.getEquipmentBonuses("initiative"),
    )
  }

  getEffectiveMaxHp(): number {
    return this.applyBonuses(
      this.props.sheet.HP.max,
      this.getEquipmentBonuses("maxHp"),
    )
  }

  getEffectiveTemporaryHp(): number {
    return this.applyBonuses(
      this.props.sheet.HP.temporary,
      this.getEquipmentBonuses("temporaryHp"),
    )
  }

  getEffectivePassivePerception(): number {
    return this.applyBonuses(
      this.props.sheet.stats.passive_perception,
      this.getEquipmentBonuses("passivePerception"),
    )
  }

  getEffectiveMobility(): number {
    return this.applyBonuses(
      this.props.sheet.stats.mobility,
      this.getEquipmentBonuses("speed"),
    )
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

  getEffectiveAttribute(attribute: Attribute): number {
    return this.applyBonuses(
      this.props.sheet.attributes[attribute],
      this.getAttributeBonuses(attribute),
    )
  }

  getEffectiveAttributeModifier(attribute: Attribute): number {
    const baseModifier = Math.floor(
      (this.getEffectiveAttribute(attribute) - 10) / 2,
    )

    return this.applyBonuses(
      baseModifier,
      this.getAttributeModifierBonuses(attribute),
    )
  }

  private getWeaponAttackBonuses(weapon: Weapon): Bonus[] {
  const attack = weapon.bonuses?.attack

  if (!attack) return []

  if (attack.type === "always") return [attack.bonus]
  if (attack.type === "equipment") return [attack.bonus]

  return []
  }

  private getWeaponDamageBonuses(weapon: Weapon): Bonus[] {
    const damage = weapon.bonuses?.damage

    if (!damage) return []

    if (damage.type === "always") return [damage.bonus]
    if (damage.type === "equipment") return [damage.bonus]

    return []
  }

  getEffectiveWeaponAttackBonus(
    weapon: Weapon,
    baseAttackBonus = 0,
  ): number {
    return this.applyBonuses(
      baseAttackBonus,
      this.getWeaponAttackBonuses(weapon),
    )
  }

  getEffectiveWeaponDamageBonus(
    weapon: Weapon,
    baseDamageBonus = 0,
  ): number {
    return this.applyBonuses(
      baseDamageBonus,
      this.getWeaponDamageBonuses(weapon),
    )
  }
    
  
}


