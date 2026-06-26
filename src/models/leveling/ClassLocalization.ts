import type { ClassName } from "../sheet/Class"

export const CLASS_NAME_PT: Record<ClassName, string> = {
  artificer: "Artífice",
  barbarian: "Bárbaro",
  bard: "Bardo",
  cleric: "Clérigo",
  druid: "Druida",
  fighter: "Guerreiro",
  monk: "Monge",
  paladin: "Paladino",
  ranger: "Patrulheiro",
  rogue: "Ladino",
  sorcerer: "Feiticeiro",
  warlock: "Bruxo",
  wizard: "Mago",
}

export const SUBCLASS_NAME_PT: Record<string, string> = {
  // Artífice
  alchemist: "Alquimista",
  armorer: "Armeiro",
  artillerist: "Artilheiro",
  "battle-smith": "Ferreiro de Batalha",

  // Bárbaro
  berserker: "Caminho do Berserker",
  "totem-warrior": "Caminho do Guerreiro Totêmico",
  beast: "Caminho da Besta",
  "ancestral-guardian": "Caminho do Guardião Ancestral",
  "storm-herald": "Caminho do Arauto da Tempestade",
  zealot: "Caminho do Zelote",

  // Bardo
  lore: "Colégio do Conhecimento",
  valor: "Colégio da Bravura",
  creation: "Colégio da Criação",
  eloquence: "Colégio da Eloquência",
  glamour: "Colégio do Glamour",
  swords: "Colégio das Espadas",
  whispers: "Colégio dos Sussurros",

  // Clérigo
  knowledge: "Domínio do Conhecimento",
  life: "Domínio da Vida",
  light: "Domínio da Luz",
  nature: "Domínio da Natureza",
  tempest: "Domínio da Tempestade",
  trickery: "Domínio da Trapaça",
  war: "Domínio da Guerra",
  order: "Domínio da Ordem",
  peace: "Domínio da Paz",
  twilight: "Domínio do Crepúsculo",
  forge: "Domínio da Forja",
  grave: "Domínio da Sepultura",

  // Druida
  land: "Círculo da Terra",
  moon: "Círculo da Lua",
  spores: "Círculo dos Esporos",
  stars: "Círculo das Estrelas",
  wildfire: "Círculo do Fogo Selvagem",
  dreams: "Círculo dos Sonhos",
  shepherd: "Círculo do Pastor",

  // Guerreiro
  champion: "Campeão",
  "battle-master": "Mestre de Batalha",
  "eldritch-knight": "Cavaleiro Arcano",
  "psi-warrior": "Guerreiro Psiônico",
  "rune-knight": "Cavaleiro Rúnico",
  "arcane-archer": "Arqueiro Arcano",
  cavalier: "Cavaleiro",
  samurai: "Samurai",

  // Monge
  "open-hand": "Caminho da Mão Aberta",
  shadow: "Caminho das Sombras",
  "four-elements": "Caminho dos Quatro Elementos",
  "astral-self": "Caminho do Eu Astral",
  mercy: "Caminho da Misericórdia",
  "drunken-master": "Caminho do Mestre Bêbado",
  kensei: "Caminho do Kensei",
  "sun-soul": "Caminho da Alma Solar",

  // Paladino
  devotion: "Juramento de Devoção",
  ancients: "Juramento dos Anciões",
  vengeance: "Juramento de Vingança",
  glory: "Juramento da Glória",
  watchers: "Juramento dos Vigilantes",
  conquest: "Juramento da Conquista",
  redemption: "Juramento da Redenção",

  // Patrulheiro
  hunter: "Caçador",
  "beast-master": "Mestre das Feras",
  "fey-wanderer": "Andarilho Feérico",
  swarmkeeper: "Guardião do Enxame",
  "gloom-stalker": "Espreitador Sombrio",
  "horizon-walker": "Andarilho do Horizonte",
  "monster-slayer": "Matador de Monstros",

  // Ladino
  thief: "Ladrão",
  assassin: "Assassino",
  "arcane-trickster": "Trapaceiro Arcano",
  phantom: "Fantasma",
  soulknife: "Lâmina da Alma",
  inquisitive: "Inquisitivo",
  mastermind: "Mentor",
  scout: "Batedor",
  swashbuckler: "Espadachim",

  // Feiticeiro
  draconic: "Linhagem Dracônica",
  "aberrant-mind": "Mente Aberrante",
  "clockwork-soul": "Alma Mecânica",
  "divine-soul": "Alma Divina",
  "shadow-magic": "Magia das Sombras",
  "storm-sorcery": "Feitiçaria da Tempestade",

  // Bruxo
  archfey: "A Arquifada",
  fiend: "O Corruptor",
  "great-old-one": "O Grande Antigo",
  fathomless: "O Insondável",
  genie: "O Gênio",
  celestial: "O Celestial",
  hexblade: "A Lâmina Maldita",

  // Mago
  abjuration: "Escola de Abjuração",
  conjuration: "Escola de Conjuração",
  divination: "Escola de Adivinhação",
  enchantment: "Escola de Encantamento",
  evocation: "Escola de Evocação",
  illusion: "Escola de Ilusão",
  necromancy: "Escola de Necromancia",
  transmutation: "Escola de Transmutação",
  bladesinging: "Canto da Lâmina",
  "order-of-scribes": "Ordem dos Escribas",
  "war-magic": "Magia de Guerra",
}

const CLASS_SPECIFIC_SUBCLASS_NAME_PT: Partial<
  Record<`${ClassName}:${string}`, string>
> = {
  "barbarian:wild-magic": "Caminho da Magia Selvagem",
  "sorcerer:wild-magic": "Magia Selvagem",
}

export function getClassNamePt(className: ClassName): string {
  return CLASS_NAME_PT[className]
}

export function getSubclassNamePt(
  subclassId: string,
  fallback?: string,
  className?: ClassName,
): string {
  const classSpecificName = className
    ? CLASS_SPECIFIC_SUBCLASS_NAME_PT[`${className}:${subclassId}`]
    : undefined

  return classSpecificName ?? SUBCLASS_NAME_PT[subclassId] ?? fallback ?? subclassId
}
