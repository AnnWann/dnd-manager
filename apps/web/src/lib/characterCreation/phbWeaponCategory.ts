import type { Itemmable } from "../../models/items/item"

const SIMPLE_WEAPONS = new Set([
  "clava",
  "adaga",
  "clava grande",
  "machadinha",
  "azagaia",
  "martelo leve",
  "maça",
  "bordão",
  "foice curta",
  "lança",
  "besta leve",
  "dardo",
  "arco curto",
  "funda",
])

const MARTIAL_WEAPONS = new Set([
  "machado de batalha",
  "mangual",
  "glaive",
  "machado grande",
  "espada grande",
  "alabarda",
  "lança de cavalaria",
  "espada longa",
  "malho",
  "maça estrela",
  "pique",
  "rapieira",
  "cimitarra",
  "espada curta",
  "tridente",
  "picareta de guerra",
  "martelo de guerra",
  "chicote",
  "zarabatana",
  "besta de mão",
  "besta pesada",
  "arco longo",
  "rede",
])

export type PhbWeaponCategory = "simple" | "martial" | "unknown"

export function getPhbWeaponCategory(item: Itemmable): PhbWeaponCategory {
  const name = normalize(item.name)
  if (SIMPLE_WEAPONS.has(name)) return "simple"
  if (MARTIAL_WEAPONS.has(name)) return "martial"
  return "unknown"
}

export function matchesPhbWeaponCategory(
  item: Itemmable,
  category: Exclude<PhbWeaponCategory, "unknown">,
): boolean {
  return getPhbWeaponCategory(item) === category
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
