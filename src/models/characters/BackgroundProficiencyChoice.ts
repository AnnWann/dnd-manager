import type { ProficiencyCategory } from "../sheet/Proficiency"

export type BackgroundProficiencyChoice = {
  proficiencyId: string
  category: ProficiencyCategory
  label: string
  options?: string[]
  allowCustom: boolean
}

const STANDARD_LANGUAGES = [
  "Comum",
  "Anão",
  "Élfico",
  "Gigante",
  "Gnômico",
  "Goblin",
  "Halfling",
  "Orc",
  "Abissal",
  "Celestial",
  "Dialeto Subterrâneo",
  "Dracônico",
  "Infernal",
  "Primordial",
  "Silvestre",
  "Subcomum",
]

const choice = (
  proficiencyId: string,
  category: ProficiencyCategory,
  label: string,
  options?: string[],
): BackgroundProficiencyChoice => ({
  proficiencyId: `phb-${proficiencyId}`,
  category,
  label,
  options,
  allowCustom: true,
})

export const BACKGROUND_PROFICIENCY_CHOICES: Record<
  string,
  BackgroundProficiencyChoice[]
> = {
  acolyte: [
    choice("acolyte-language-1", "language", "Idioma adicional 1", STANDARD_LANGUAGES),
    choice("acolyte-language-2", "language", "Idioma adicional 2", STANDARD_LANGUAGES),
  ],
  criminal: [
    choice("criminal-game", "game", "Conjunto de jogo"),
  ],
  entertainer: [
    choice("entertainer-instrument", "instrument", "Instrumento musical"),
  ],
  "folk-hero": [
    choice("folk-artisan", "tool", "Ferramenta de artesão"),
  ],
  "guild-artisan": [
    choice("guild-tool", "tool", "Ferramenta de artesão"),
    choice("guild-language", "language", "Idioma adicional", STANDARD_LANGUAGES),
  ],
  hermit: [
    choice("hermit-language", "language", "Idioma adicional", STANDARD_LANGUAGES),
  ],
  noble: [
    choice("noble-game", "game", "Conjunto de jogo"),
    choice("noble-language", "language", "Idioma adicional", STANDARD_LANGUAGES),
  ],
  outlander: [
    choice("outlander-instrument", "instrument", "Instrumento musical"),
    choice("outlander-language", "language", "Idioma adicional", STANDARD_LANGUAGES),
  ],
  sage: [
    choice("sage-language-1", "language", "Idioma adicional 1", STANDARD_LANGUAGES),
    choice("sage-language-2", "language", "Idioma adicional 2", STANDARD_LANGUAGES),
  ],
  soldier: [
    choice("soldier-game", "game", "Conjunto de jogo"),
  ],
}

export function getBackgroundProficiencyChoices(
  backgroundId: string | undefined,
): BackgroundProficiencyChoice[] {
  if (!backgroundId) return []
  return BACKGROUND_PROFICIENCY_CHOICES[backgroundId] ?? []
}
