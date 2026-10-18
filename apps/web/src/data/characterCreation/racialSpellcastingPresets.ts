import type { Attribute } from "../../models/sheet/Attribute"

export type RacialSpellcastingPreset = {
  defaultAttribute: Attribute
  guidance: string
}

/**
 * Structural metadata only. Spell names are deliberately not bundled here:
 * players select the spells granted by their own reference as their character
 * reaches the appropriate level.
 */
export const RACIAL_SPELLCASTING_PRESETS: Partial<
  Record<string, RacialSpellcastingPreset>
> = {
  "high-elf": {
    defaultAttribute: "int",
    guidance:
      "Este preset concede magia racial. Consulte sua referência e selecione o truque concedido pela raça.",
  },
  drow: {
    defaultAttribute: "cha",
    guidance:
      "Este preset possui progressão de magia racial. Consulte sua referência e adicione as magias liberadas para o nível atual do personagem.",
  },
  "forest-gnome": {
    defaultAttribute: "int",
    guidance:
      "Este preset concede magia racial. Consulte sua referência e selecione a magia ou truque correspondente.",
  },
  tiefling: {
    defaultAttribute: "cha",
    guidance:
      "Este preset possui progressão de magia racial. Consulte sua referência e adicione as magias liberadas para o nível atual do personagem.",
  },
}
