import type { RacialAttributeBonusRule } from "../../../../models/races/CharacterRace"
import { findCharacterCreationRoot } from "./characterCreationStepValidation"

export function readSelectedRacialBonusRule(): RacialAttributeBonusRule {
  const root = findCharacterCreationRoot()
  const buttons = Array.from(
    root?.querySelectorAll<HTMLButtonElement>("button") ?? [],
  )
  const selected = buttons.find(
    (button) =>
      button.classList.contains("bg-accentBg") &&
      [
        "Predefinidos",
        "+1 / +1",
        "Móveis +2 / +1",
        "Móveis +1 / +1 / +1",
        "Personalizados",
      ].includes(button.textContent?.trim() ?? ""),
  )

  switch (selected?.textContent?.trim()) {
    case "+1 / +1":
      return "variant-1-1"
    case "Móveis +2 / +1":
      return "flexible-2-1"
    case "Móveis +1 / +1 / +1":
      return "flexible-1-1-1"
    case "Personalizados":
      return "custom"
    default:
      return "fixed"
  }
}
