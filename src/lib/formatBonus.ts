import type { Bonus } from "../models/items/equipment/EquipmentSlot"
import type { Skill } from "../models/sheet/Skills"

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
      return "Percepção Passiva"
    case "attackBonus":
      return "Ataque geral"
    case "generalTestBonus":
      return "Testes gerais"
    case "abilityCheckBonus":
      return "Testes de habilidade"
    case "abilityCheckAttributeBonus":
      return "Testes de habilidade por atributo"
    case "skillCheckBonus":
      return "Teste de perícia"
    case "savingThrowBonus":
      return "Resistência geral"
    case "savingThrowAttributeBonus":
      return "Resistência por atributo"
    case "weaponAttackBonus":
      return "Ataque com arma"
    case "spellAttackBonus":
      return "Ataque mágico"
    case "weaponDamageBonus":
      return "Dano com arma"
    case "spellDamageBonus":
      return "Dano mágico"
    case "saveDcBonus":
      return "CD geral"
    case "spellSaveDcBonus":
      return "CD de magia"
    case "abilitySaveDcBonus":
      return "CD de habilidade"
    case "speed":
      return "Velocidade"
    case "damageBonus":
      return "Dano geral"
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

export function formatSkillName(skill: Skill): string {
  const labels: Record<Skill, string> = {
    acrobatics: "Acrobacia",
    arcana: "Arcanismo",
    athletics: "Atletismo",
    animalHandling: "Lidar com Animais",
    performance: "Atuação",
    deception: "Blefe",
    stealth: "Furtividade",
    history: "História",
    intimidation: "Intimidação",
    insight: "Intuição",
    investigation: "Investigação",
    medicine: "Medicina",
    nature: "Natureza",
    perception: "Percepção",
    persuasion: "Persuasão",
    sleightOfHand: "Prestidigitação",
    religion: "Religião",
    survival: "Sobrevivência",
  }
  return labels[skill]
}
