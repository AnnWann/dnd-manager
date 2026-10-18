import { useEffect } from "react"

import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

const INTERNAL_DRAFT_NAME = "__character_creation_draft__"

/**
 * The integrated wizard still owns the underlying React step indexes. The
 * identity bootstrap step stays internal, while the visible creation flow puts
 * character level first so racial and class choices can use that context.
 */
const VISIBLE_STEP_ORDER = [4, 1, 2, 3, 5, 6, 7, 8] as const

export function CharacterCreationFlowBootstrap({ open }: { open: boolean }) {
  useEffect(() => {
    if (!open) return

    let cancelled = false
    let frame = 0

    const initialize = () => {
      if (cancelled) return

      const root = findCharacterCreationRoot()
      const stepButtons = root ? getStepButtons(root) : []
      if (!root || stepButtons.length < 5) {
        frame = window.requestAnimationFrame(initialize)
        return
      }

      configureVisibleSteps(stepButtons)

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
        if (cancelled) return
        clickInternalStep(stepButtons[VISIBLE_STEP_ORDER[0]])
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

function configureVisibleSteps(stepButtons: HTMLButtonElement[]) {
  stepButtons.forEach((button, originalIndex) => {
    button.dataset.creationStepIndex = String(originalIndex)
    if (!button.dataset.originalCreationStepLabel) {
      button.dataset.originalCreationStepLabel = button.textContent?.trim() || ""
    }
  })

  stepButtons[0].hidden = true

  VISIBLE_STEP_ORDER.forEach((originalIndex, visibleIndex) => {
    const button = stepButtons[originalIndex]
    if (!button) return

    button.hidden = false
    button.dataset.creationVisibleOrder = String(visibleIndex)
    button.style.order = String(visibleIndex)

    const original = button.dataset.originalCreationStepLabel ?? ""
    const label = original.replace(/^\d+\.\s*/, "")
    button.textContent = `${visibleIndex + 1}. ${
      label === "Confirmação" ? "Identidade e confirmação" : label
    }`
  })
}

function clickInternalStep(button: HTMLButtonElement | undefined) {
  if (!button) return
  button.dataset.creationInternalNavigation = "true"
  try {
    button.click()
  } finally {
    delete button.dataset.creationInternalNavigation
  }
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set
  setter?.call(input, value)
}
