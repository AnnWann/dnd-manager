import { useEffect, useRef, useState } from "react"

import "../styles/characterCreationMobile.css"
import {
  clearCreationAttemptHighlights,
  findCharacterCreationRoot,
  getCreationNavigationIntent,
  highlightCreationAttempt,
  isAllowedBootstrapNavigation,
  validateVisibleCreationStep,
} from "../logic/characterCreationStepValidation"

export function CreationRequiredFieldHighlighter() {
  const [message, setMessage] = useState("")
  const messageRef = useRef(message)
  messageRef.current = message

  useEffect(() => {
    const root = findCharacterCreationRoot()
    if (root) root.dataset.characterCreationMobile = "true"

    const clear = () => {
      if (messageRef.current) setMessage("")
      clearCreationAttemptHighlights()
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest<HTMLButtonElement>("button")
      if (!button) return

      const wizardRoot = findCharacterCreationRoot(button)
      if (!wizardRoot) return

      if (!event.isTrusted) {
        if (isAllowedBootstrapNavigation(wizardRoot, button)) return
        stopNavigation(event)
        return
      }

      const intent = getCreationNavigationIntent(wizardRoot, button)
      if (!intent.forward) {
        clear()
        return
      }

      const main = wizardRoot.querySelector<HTMLElement>("main")
      if (!main) return

      const error = validateVisibleCreationStep(main)
      if (!error) {
        clear()
        return
      }

      stopNavigation(event)
      setMessage(error.message)
      highlightCreationAttempt(error.elements)
    }

    document.addEventListener("click", onClick, true)
    document.addEventListener("input", clear, true)
    document.addEventListener("change", clear, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("input", clear, true)
      document.removeEventListener("change", clear, true)
      clearCreationAttemptHighlights()
      if (root) delete root.dataset.characterCreationMobile
    }
  }, [])

  return message ? (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[360] w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-3 py-3 text-sm font-medium text-danger shadow-theme-lg sm:px-4">
      {message}
    </div>
  ) : null
}

function stopNavigation(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}
