import type { ClassName } from "../../../models/sheet/Class"

const CLASS_STARTING_EQUIPMENT: Record<ClassName, string[]> = {
  barbarian: [
    "Machado grande",
    "Machadinha ×2",
    "Pacote de explorador",
    "Azagaia ×4",
  ],
  bard: [
    "Rapieira",
    "Pacote de diplomata",
    "Alaúde",
    "Armadura de couro",
    "Adaga",
  ],
  cleric: [
    "Maça",
    "Cota de escamas",
    "Besta leve",
    "Virote ×20",
    "Pacote de sacerdote",
    "Escudo",
    "Símbolo sagrado",
  ],
  druid: [
    "Escudo de madeira",
    "Cimitarra",
    "Armadura de couro",
    "Pacote de explorador",
    "Foco druídico",
  ],
  fighter: [
    "Cota de malha",
    "Espada longa",
    "Escudo",
    "Besta leve",
    "Virote ×20",
    "Pacote de aventureiro",
  ],
  monk: [
    "Espada curta",
    "Pacote de aventureiro",
    "Dardo ×10",
  ],
  paladin: [
    "Espada longa",
    "Escudo",
    "Azagaia ×5",
    "Pacote de sacerdote",
    "Cota de malha",
    "Símbolo sagrado",
  ],
  ranger: [
    "Cota de escamas",
    "Espada curta ×2",
    "Pacote de aventureiro",
    "Arco longo",
    "Flecha ×20",
  ],
  rogue: [
    "Rapieira",
    "Arco curto",
    "Flecha ×20",
    "Pacote de assaltante",
    "Armadura de couro",
    "Adaga ×2",
    "Ferramentas de ladrão",
  ],
  sorcerer: [
    "Besta leve",
    "Virote ×20",
    "Bolsa de componentes",
    "Pacote de aventureiro",
    "Adaga ×2",
  ],
  warlock: [
    "Besta leve",
    "Virote ×20",
    "Bolsa de componentes",
    "Pacote de estudioso",
    "Armadura de couro",
    "Arma simples",
    "Adaga ×2",
  ],
  wizard: [
    "Bordão",
    "Bolsa de componentes",
    "Pacote de estudioso",
    "Grimório",
  ],
}

export function getPhbClassStartingEquipment(className: ClassName): string[] {
  return [...CLASS_STARTING_EQUIPMENT[className]]
}

export function getPhbClassStartingEquipmentText(className: ClassName): string {
  return getPhbClassStartingEquipment(className).join("\n")
}
