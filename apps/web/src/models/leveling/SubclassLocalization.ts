import type { ClassProgressionDefinition } from "../../data/classProgression/types"
import type { ClassName } from "../sheet/Class"

const SUBCLASS_NAMES_BY_ID: Record<string, string> = {
  // Artífice
  alchemist: "Alquimista",
  armorer: "Armeiro",
  artillerist: "Artilheiro",
  "battle-smith": "Ferreiro de Batalha",

  // Bárbaro
  berserker: "Caminho do Berserker",
  "totem-warrior": "Caminho do Guerreiro Totêmico",
  beast: "Caminho da Fera",
  "wild-magic": "Caminho da Magia Selvagem",
  "ancestral-guardian": "Caminho do Guardião Ancestral",
  "storm-herald": "Caminho do Arauto da Tempestade",
  zealot: "Caminho do Fanático",

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
  forge: "Domínio da Forja",
  grave: "Domínio da Sepultura",
  order: "Domínio da Ordem",
  peace: "Domínio da Paz",
  twilight: "Domínio do Crepúsculo",

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
  "arcane-archer": "Arqueiro Arcano",
  cavalier: "Cavaleiro",
  samurai: "Samurai",
  "psi-warrior": "Guerreiro Psiônico",
  "rune-knight": "Cavaleiro Rúnico",

  // Monge
  "open-hand": "Caminho da Mão Aberta",
  shadow: "Caminho das Sombras",
  "four-elements": "Caminho dos Quatro Elementos",
  "drunken-master": "Caminho do Mestre Bêbado",
  kensei: "Caminho do Kensei",
  "sun-soul": "Caminho da Alma Solar",
  "astral-self": "Caminho do Eu Astral",
  mercy: "Caminho da Misericórdia",

  // Paladino
  devotion: "Juramento de Devoção",
  ancients: "Juramento dos Anciões",
  vengeance: "Juramento de Vingança",
  conquest: "Juramento de Conquista",
  redemption: "Juramento de Redenção",
  glory: "Juramento de Glória",
  watchers: "Juramento dos Vigilantes",

  // Patrulheiro
  hunter: "Caçador",
  "beast-master": "Mestre das Feras",
  "gloom-stalker": "Perseguidor Sombrio",
  "horizon-walker": "Andarilho do Horizonte",
  "monster-slayer": "Matador de Monstros",
  "fey-wanderer": "Andarilho Feérico",
  swarmkeeper: "Guardião do Enxame",

  // Ladino
  thief: "Ladrão",
  assassin: "Assassino",
  "arcane-trickster": "Trapaceiro Arcano",
  inquisitive: "Inquisitivo",
  mastermind: "Mente Mestra",
  scout: "Batedor",
  swashbuckler: "Espadachim",
  phantom: "Fantasma",
  soulknife: "Lâmina da Alma",

  // Feiticeiro
  draconic: "Linhagem Dracônica",
  "wild-magic-sorcerer": "Magia Selvagem",
  "divine-soul": "Alma Divina",
  "shadow-magic": "Magia das Sombras",
  "storm-sorcery": "Feitiçaria da Tempestade",
  "aberrant-mind": "Mente Aberrante",
  "clockwork-soul": "Alma Mecânica",

  // Bruxo
  archfey: "O Arquifada",
  fiend: "O Corruptor",
  "great-old-one": "O Grande Antigo",
  celestial: "O Celestial",
  hexblade: "A Lâmina Maldita",
  fathomless: "O Insondável",
  genie: "O Gênio",

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

const SUBCLASS_NAMES_BY_NAME: Record<string, string> = {
  "School of Abjuration": "Escola de Abjuração",
  "School of Conjuration": "Escola de Conjuração",
  "School of Divination": "Escola de Adivinhação",
  "School of Enchantment": "Escola de Encantamento",
  "School of Evocation": "Escola de Evocação",
  "School of Illusion": "Escola de Ilusão",
  "School of Necromancy": "Escola de Necromancia",
  "School of Transmutation": "Escola de Transmutação",
  Bladesinging: "Canto da Lâmina",
  "Order of Scribes": "Ordem dos Escribas",
  "War Magic": "Magia de Guerra",
  "Path of the Ancestral Guardian": "Caminho do Guardião Ancestral",
  "Path of the Storm Herald": "Caminho do Arauto da Tempestade",
  "Path of the Zealot": "Caminho do Fanático",
  "College of Glamour": "Colégio do Glamour",
  "College of Swords": "Colégio das Espadas",
  "College of Whispers": "Colégio dos Sussurros",
  "Circle of Dreams": "Círculo dos Sonhos",
  "Circle of the Shepherd": "Círculo do Pastor",
  "Arcane Archer": "Arqueiro Arcano",
  Cavalier: "Cavaleiro",
  Samurai: "Samurai",
  "Psi Warrior": "Guerreiro Psiônico",
  "Rune Knight": "Cavaleiro Rúnico",
  "Way of the Open Hand": "Caminho da Mão Aberta",
  "Way of Shadow": "Caminho das Sombras",
  "Way of the Four Elements": "Caminho dos Quatro Elementos",
  "Way of the Drunken Master": "Caminho do Mestre Bêbado",
  "Way of the Kensei": "Caminho do Kensei",
  "Way of the Sun Soul": "Caminho da Alma Solar",
  "Way of the Astral Self": "Caminho do Eu Astral",
  "Way of Mercy": "Caminho da Misericórdia",
  "Beast Master": "Mestre das Feras",
  "Gloom Stalker": "Perseguidor Sombrio",
  "Horizon Walker": "Andarilho do Horizonte",
  "Monster Slayer": "Matador de Monstros",
  "Fey Wanderer": "Andarilho Feérico",
  Swarmkeeper: "Guardião do Enxame",
  Inquisitive: "Inquisitivo",
  Mastermind: "Mente Mestra",
  Scout: "Batedor",
  Swashbuckler: "Espadachim",
  Phantom: "Fantasma",
  Soulknife: "Lâmina da Alma",
  "Draconic Bloodline": "Linhagem Dracônica",
  "Wild Magic": "Magia Selvagem",
  "Shadow Magic": "Magia das Sombras",
  "Storm Sorcery": "Feitiçaria da Tempestade",
}

export function localizeRemainingSubclasses(
  progressions: Record<ClassName, ClassProgressionDefinition>,
): void {
  for (const progression of Object.values(progressions)) {
    progression.subclasses = progression.subclasses.map((subclass) => ({
      ...subclass,
      name:
        SUBCLASS_NAMES_BY_ID[subclass.id] ??
        SUBCLASS_NAMES_BY_NAME[subclass.name] ??
        subclass.name,
    }))
  }
}
