import type { Die } from "../../dice/Die"
import type { Attribute } from "../../sheet/Attribute"
import type { Equipment } from "./EquipmentSlot"

export type Weapon = Equipment & {
  /** A arma exige duas mãos para usar suas estatísticas normais. */
  twoHanded?: boolean
  /** Estado atual de empunhadura para armas versáteis ou de duas mãos. */
  wieldedTwoHanded?: boolean
  /** Dado usado quando uma arma versátil é empunhada com duas mãos. */
  versatileDamage?: Die
  properties: WeaponProperty[]
  damage: Die
  modifierAttribute: Attribute
  proficient: boolean
}

export type WeaponProperty = {
  id: WeaponPropertyId
  name: string
  desc: string
}

export type WeaponPropertyId =
  | "ammunition"
  | "finesse"
  | "heavy"
  | "light"
  | "loading"
  | "range"
  | "reach"
  | "special"
  | "thrown"
  | "two-handed"
  | "versatile"
  | "improvised-weapons"
  | "silvered-weapons"
  | "special-weapons"
  | "lance"
  | "net"

export function hasWeaponProperty(
  weapon: Partial<Weapon>,
  propertyId: WeaponPropertyId,
): boolean {
  return weapon.properties?.some((property) => property.id === propertyId) ?? false
}

export function isVersatileWeapon(weapon: Partial<Weapon>): boolean {
  return hasWeaponProperty(weapon, "versatile") || Boolean(weapon.versatileDamage)
}

export function isWeaponImprovisedGrip(weapon: Partial<Weapon>): boolean {
  return weapon.twoHanded === true && weapon.wieldedTwoHanded === false
}

export function getWeaponHandsUsed(weapon: Partial<Weapon>): 1 | 2 {
  if (weapon.twoHanded) {
    return weapon.wieldedTwoHanded === false ? 1 : 2
  }
  if (isVersatileWeapon(weapon) && weapon.wieldedTwoHanded) return 2
  return 1
}

export function getWeaponAttackAttribute(
  weapon: Partial<Weapon>,
): Attribute {
  return isWeaponImprovisedGrip(weapon)
    ? "str"
    : (weapon.modifierAttribute ?? "str")
}

export function getWeaponDamageDie(weapon: Partial<Weapon>): Die | undefined {
  if (isWeaponImprovisedGrip(weapon)) {
    return { quantity: 1, sides: "d4" }
  }

  if (
    isVersatileWeapon(weapon) &&
    weapon.wieldedTwoHanded &&
    weapon.versatileDamage
  ) {
    return weapon.versatileDamage
  }

  return weapon.damage
}

export const WEAPON_PROPERTIES: Record<WeaponPropertyId, WeaponProperty> = {
  ammunition: {
    id: "ammunition",
    name: "Munição",
    desc: "Você precisa de munição para realizar ataques com esta arma. Sacar munição faz parte do ataque. Após o combate, é possível recuperar metade das munições gastas que puderem ser encontradas.",
  },

  finesse: {
    id: "finesse",
    name: "Acuidade",
    desc: "Você pode usar Força ou Destreza para as jogadas de ataque e dano com esta arma. Deve usar o mesmo atributo para ambas as jogadas.",
  },

  heavy: {
    id: "heavy",
    name: "Pesada",
    desc: "Criaturas Pequenas possuem desvantagem nas jogadas de ataque com armas pesadas devido ao tamanho e peso da arma.",
  },

  light: {
    id: "light",
    name: "Leve",
    desc: "Esta arma é ideal para combate com duas armas. Você pode usá-la para realizar ataques com a ação bônus quando empunhar outra arma leve na mão principal.",
  },

  loading: {
    id: "loading",
    name: "Recarga",
    desc: "Devido ao tempo necessário para recarregar esta arma, você só pode dispará-la uma vez por ação, ação bônus ou reação, independentemente do número de ataques que possua.",
  },

  range: {
    id: "range",
    name: "Alcance",
    desc: "Uma arma à distância possui dois alcances: normal e longo. Ataques além do alcance normal sofrem desvantagem. Não é possível atacar além do alcance longo.",
  },

  reach: {
    id: "reach",
    name: "Alcance Estendido",
    desc: "Esta arma aumenta seu alcance em 1,5 metro para ataques corpo a corpo e ataques de oportunidade.",
  },

  special: {
    id: "special",
    name: "Especial",
    desc: "Esta arma possui regras específicas descritas em sua entrada.",
  },

  thrown: {
    id: "thrown",
    name: "Arremesso",
    desc: "Você pode arremessar esta arma para realizar um ataque à distância. Se a arma for corpo a corpo, utiliza o mesmo atributo normalmente usado em combate corpo a corpo.",
  },

  "two-handed": {
    id: "two-handed",
    name: "Duas Mãos",
    desc: "Esta arma exige duas mãos para usar suas estatísticas normais. Com apenas uma mão, ela conta como arma improvisada: ataque com Força e dano 1d4 + Força.",
  },

  versatile: {
    id: "versatile",
    name: "Versátil",
    desc: "Esta arma pode ser usada com uma ou duas mãos. Quando empunhada com duas mãos, utiliza o dado de dano alternativo indicado pela arma.",
  },

  "improvised-weapons": {
    id: "improvised-weapons",
    name: "Armas Improvisadas",
    desc: "Objetos que não foram feitos para combate podem ser usados como armas improvisadas. O mestre determina o dano apropriado; na ausência de uma arma semelhante, o dano padrão é 1d4.",
  },

  "silvered-weapons": {
    id: "silvered-weapons",
    name: "Armas Prateadas",
    desc: "Uma arma prateada pode superar resistências ou imunidades de certas criaturas que são vulneráveis apenas a armas feitas ou revestidas com prata.",
  },

  "special-weapons": {
    id: "special-weapons",
    name: "Armas Especiais",
    desc: "Algumas armas possuem regras únicas que não são cobertas apenas por suas propriedades. Consulte a descrição específica da arma.",
  },

  lance: {
    id: "lance",
    name: "Lança de Cavalaria",
    desc: "Você sofre desvantagem ao atacar um alvo a até 1,5 metro de distância. Quando estiver montado, pode empunhar esta arma com apenas uma mão.",
  },

  net: {
    id: "net",
    name: "Rede",
    desc: "Uma criatura Grande ou menor atingida por uma rede fica Restrita até ser libertada. Uma criatura pode usar sua ação para realizar um teste de Força CD 10 e se libertar, ou causar 5 pontos de dano cortante à rede (CA 10) para destruí-la. Ao usar uma rede, você só pode realizar um único ataque independentemente do número de ataques que possua.",
  },
}
