import { useEffect } from "react"

import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

const INTERNAL_DRAFT_NAME = "__character_creation_draft__"

export function CharacterCreationFlowBootstrap({ open }: { open: boolean }) {
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
      const initialIdentityHeading = Array.from(
        main?.querySelectorAll<HTMLElement>("h2") ?? [],
      ).find((heading) => heading.textContent?.trim() === "Identidade")
      const finalIdentityMounted = Boolean(
        main?.querySelector('[data-character-creation-identity-step="true"]'),
      )

      if (!initialIdentityHeading || finalIdentityMounted) return

      const draftNameInput = main?.querySelector<HTMLInputElement>(
        'input[placeholder="Nome do personagem"]',
      )
      if (!draftNameInput) {
        frame = window.requestAnimationFrame(initialize)
        return
      }

      setNativeInputValue(draftNameInput, INTERNAL_DRAFT_NAME)
      draftNameInput.dispatchEvent(new Event("input", { bubbles: true }))

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
