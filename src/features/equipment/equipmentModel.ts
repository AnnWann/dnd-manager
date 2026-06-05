import type { EquipmentSlot } from '../../models/types'

export function normalizeSlot(slot?: EquipmentSlot): EquipmentSlot {
  return {
    name: slot?.name ?? '',
    bonuses: {
      armorClass: Number(slot?.bonuses?.armorClass ?? 0),
      initiative: Number(slot?.bonuses?.initiative ?? 0),
      initiativeBonus: Number(slot?.bonuses?.initiativeBonus ?? 0),
      maxHp: Number(slot?.bonuses?.maxHp ?? 0),
      currentHp: Number(slot?.bonuses?.currentHp ?? 0),
      temporaryHp: Number(slot?.bonuses?.temporaryHp ?? 0),
      passivePerception: Number(slot?.bonuses?.passivePerception ?? 0),
      attackBonus: Number(slot?.bonuses?.attackBonus ?? 0),
      mobility: Number(slot?.bonuses?.mobility ?? 0),
    },
    armorType: slot?.armorType === 'light' || slot?.armorType === 'medium' || slot?.armorType === 'heavy' ? slot.armorType : 'none',
    armorClassMode: slot?.armorClassMode === 'base' ? 'base' : 'bonus',
    twoHanded: Boolean(slot?.twoHanded),
    notes: slot?.notes ?? '',
  }
}

export function slotIsFilled(slot: EquipmentSlot): boolean {
  return slot.name.trim().length > 0
}

export function weaponCost(slot: EquipmentSlot): number {
  if (!slotIsFilled(slot)) return 0
  return slot.twoHanded ? 2 : 1
}

export function enforceWeaponCapacity(slots: EquipmentSlot[], limbCount: number): EquipmentSlot[] {
  let remaining = Math.max(0, limbCount)
  return slots.map((slot) => {
    const normalized = normalizeSlot(slot)
    const cost = weaponCost(normalized)
    if (cost === 0) return normalized
    if (cost <= remaining) {
      remaining -= cost
      return normalized
    }
    return normalizeSlot({ ...normalized, name: '' })
  })
}

export function slotBonusSummary(slot: EquipmentSlot): string {
  const b = slot.bonuses
  const isArmorSlot = slot.armorClassMode === 'base' || slot.armorType === 'light' || slot.armorType === 'medium' || slot.armorType === 'heavy'
  if (!isArmorSlot) return `CA ${b?.armorClass ?? 0} • Atk ${b?.attackBonus ?? 0} • Mob ${b?.mobility ?? 0}`

  const armorMode = slot.armorClassMode === 'base' ? 'Base' : 'Bônus'
  const armorType = slot.armorType === 'light' ? 'Leve' : slot.armorType === 'medium' ? 'Média' : slot.armorType === 'heavy' ? 'Pesada' : 'Sem armadura'
  return `CA ${armorMode} ${b?.armorClass ?? 0} • ${armorType} • Atk ${b?.attackBonus ?? 0} • Mob ${b?.mobility ?? 0}`
}
