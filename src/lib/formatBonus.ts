import type { Bonus } from "../models/items/equipment/EquipmentSlot"

export function formatBonusName(key: string): string {
  switch (key) {
    case "armorClass":
      return "CA"
    case "initiative":
      return "Iniciativa"
    case "maxHp":
      return "HP Máx."
    case "temporaryHp":
      return "HP Temp."
    case "passivePerception":
      return "Percepção"
    case "attackBonus":
      return "Ataque"
    case "speed":
      return "Velocidade"
    case "damageBonus": 
      return "Dano"
    default:
      return key
  }
}

export function formatBonusValue(bonus: Bonus): string {
  switch (bonus.type) {
    case "add":
      return `+${bonus.value}`

    case "sub":
      return `-${bonus.value}`

    case "flat":
      return `${bonus.value}`

    default:
      return String(bonus.value)
  }
}