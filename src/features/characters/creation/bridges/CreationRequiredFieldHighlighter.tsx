import { useEffect, useRef, useState } from "react"

import "../styles/characterCreationMobile.css"
import {
  clearCreationAttemptHighlights,
  findCharacterCreationRoot,
  getCreationNavigationIntent,
  highlightCreationAttempt,
  isAllowedBootstrapNavigation,
  isInternalCreationNavigation,
  navigateRelativeCreationStep,
  validateVisibleCreationStep,
} from "../logic/characterCreationStepValidation"

export function CreationRequiredFieldHighlighter() {
  const [feedback, setFeedback] = useState("")
  const feedbackRef = useRef(feedback)
  feedbackRef.current = feedback

  useEffect(() => {
    const root = findCharacterCreationRoot()
    if (root) root.dataset.characterCreationMobile = "true"

    const clearFeedback = () => {
      if (feedbackRef.current) setFeedback("")
      clearCreationAttemptHighlights()
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest<HTMLButtonElement>("button")
      if (!button) {
        clearFeedback()
        return
      }

      const wizardRoot = findCharacterCreationRoot(button)

      // Shared creation modals are rendered through portals outside the wizard
      // root. Interacting with them is an edit, not a navigation attempt. Any
      // previous validation feedback becomes informationally stale immediately.
      if (!wizardRoot) {
        if (event.isTrusted) clearFeedback()
        return
      }

      if (!event.isTrusted) {
        if (isInternalCreationNavigation(button)) return
        if (isAllowedBootstrapNavigation(wizardRoot, button)) return
        stopNavigation(event)
        return
      }

      const text = button.textContent?.trim() ?? ""
      if (text === "Voltar") {
        clearFeedback()
        stopNavigation(event)
        navigateRelativeCreationStep(wizardRoot, -1)
        return
      }

      const intent = getCreationNavigationIntent(wizardRoot, button)
      if (!intent.forward) {
        clearFeedback()
        return
      }

      const main = wizardRoot.querySelector<HTMLElement>("main")
      if (!main) return

      // Navigation is decided only by this fresh validation result. The
      // feedback state below never controls whether the user can continue.
      const error = validateVisibleCreationStep(main)
      if (!error) {
        clearFeedback()
        if (text === "Continuar") {
          stopNavigation(event)
          navigateRelativeCreationStep(wizardRoot, 1)
        }
        return
      }

      stopNavigation(event)
      setFeedback(error.message)
      highlightCreationAttempt(error.elements)
    }

    document.addEventListener("click", onClick, true)
    document.addEventListener("input", clearFeedback, true)
    document.addEventListener("change", clearFeedback, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("input", clearFeedback, true)
      document.removeEventListener("change", clearFeedback, true)
      clearCreationAttemptHighlights()
      if (root) delete root.dataset.characterCreationMobile
    }
  }, [])

  return feedback ? (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[360] w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-3 py-3 text-sm font-medium text-danger shadow-theme-lg sm:px-4">
      {feedback}
    </div>
  ) : null
}

function stopNavigation(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}
