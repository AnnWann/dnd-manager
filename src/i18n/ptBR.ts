import type { Attribute } from "../models/sheet/Attribute";

export const ABILITY_ORDER: Attribute[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const PT_BR_ABILITY: Record<Attribute, { short: string; long: string }> = {
  str: { short: 'FOR', long: 'Força' },
  dex: { short: 'DES', long: 'Destreza' },
  con: { short: 'CON', long: 'Constituição' },
  int: { short: 'INT', long: 'Inteligência' },
  wis: { short: 'SAB', long: 'Sabedoria' },
  cha: { short: 'CAR', long: 'Carisma' },
}

export function abilityShortPtBr(a: Attribute): string {
  return PT_BR_ABILITY[a]?.short ?? String(a).toUpperCase()
}

export function abilityLongPtBr(a: Attribute): string {
  return PT_BR_ABILITY[a]?.long ?? String(a).toUpperCase()
}
