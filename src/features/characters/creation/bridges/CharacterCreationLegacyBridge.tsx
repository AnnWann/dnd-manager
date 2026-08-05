import { useEffect } from "react"

import type { RacialAttributeBonusRule } from "../../../../models/races/CharacterRace"
import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

const LEGACY_DRAFT_NAME = "__character_creation_draft__"

export function CharacterCreationLegacyBridge({ open }: { open: boolean }) {
  useEffect(() => {
    if (!open) return

    let cancelled = false
    let frame = 0

    const initialize = () => {
      if (cancelled) return

      const root = findCharacterCreationRoot()
      const stepButtons = root ? getStepButtons(root) : []
      if (!root || stepButtons.length < 2) {
        frame = window.requestAnimationFrame(initialize)
        return
      }

      stepButtons[0].hidden = true
      renameVisibleSteps(stepButtons)

      const main = root.querySelector<HTMLElement>("main")
      const legacyIdentityHeading = Array.from(
        main?.querySelectorAll<HTMLElement>("h2") ?? [],
      ).find((heading) => heading.textContent?.trim() === "Identidade")
      const finalIdentityMounted = Boolean(
        main?.querySelector('[data-character-creation-identity-step="true"]'),
      )

      if (!legacyIdentityHeading || finalIdentityMounted) return

      const legacyNameInput = main?.querySelector<HTMLInputElement>(
        'input[placeholder="Nome do personagem"]',
      )
      if (!legacyNameInput) {
        frame = window.requestAnimationFrame(initialize)
        return
      }

      setNativeInputValue(legacyNameInput, LEGACY_DRAFT_NAME)
      legacyNameInput.dispatchEvent(new Event("input", { bubbles: true }))

      frame = window.requestAnimationFrame(() => {
        if (!cancelled) stepButtons[1]?.click()
      })
    }

    frame = window.requestAnimationFrame(initialize)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [open])

  return null
}

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

function getStepButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("header button")).filter(
    (button) => /^\d+\./.test(button.textContent?.trim() ?? ""),
  )
}

function renameVisibleSteps(stepButtons: HTMLButtonElement[]) {
  stepButtons.slice(1).forEach((button, index) => {
    const original =
      button.dataset.originalCreationStepLabel || button.textContent?.trim() || ""
    button.dataset.originalCreationStepLabel = original
    const label = original.replace(/^\d+\.\s*/, "")
    button.textContent = `${index + 1}. ${
      label === "Confirmação" ? "Identidade e confirmação" : label
    }`
  })
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set
  setter?.call(input, value)
}
