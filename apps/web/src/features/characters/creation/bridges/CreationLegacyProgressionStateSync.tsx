import { useEffect } from "react"

import { useMagicContext } from "../../../../contexts/magicContext"
import type { CreationProgressionConfiguration } from "../creationProgressionConfiguration"
import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

type Props = {
  open: boolean
  value: CreationProgressionConfiguration
}

/**
 * Transitional compatibility for validation that still lives inside the old
 * integrated creation wizard. The visible controls are the shared level-up
 * modals; this component mirrors only the values that the legacy validator
 * still reads and can be deleted with that validator later.
 */
export function CreationLegacyProgressionStateSync({ open, value }: Props) {
  const { metamagics } = useMagicContext()
  const selected = value.classes.sorcerer?.metamagics ?? []
  const selectionKey = selected.toSorted().join("|")

  useEffect(() => {
    if (!open) return

    let frame = 0
    let observer: MutationObserver | undefined
    let syncing = false

    const sync = () => {
      if (syncing) return
      const root = findCharacterCreationRoot()
      const main = root?.querySelector<HTMLElement>("main")
      const heading = Array.from(main?.querySelectorAll<HTMLElement>("h2") ?? [])
        .find((entry) => entry.textContent?.trim() === "Metamagia")
      const section = heading?.closest<HTMLElement>("section")
      if (!section) return

      syncing = true
      try {
        for (const option of metamagics) {
          const button = Array.from(
            section.querySelectorAll<HTMLButtonElement>("button"),
          ).find((entry) =>
            entry.textContent?.trim().startsWith(option.name),
          )
          if (!button) continue

          const visuallySelected =
            button.className.includes("border-accentBorder") &&
            button.className.includes("bg-accentBg")
          const shouldBeSelected = selected.includes(option.id)
          if (visuallySelected !== shouldBeSelected) button.click()
        }
      } finally {
        syncing = false
      }
    }

    frame = window.requestAnimationFrame(() => {
      sync()
      const root = findCharacterCreationRoot()
      if (!root) return
      observer = new MutationObserver(sync)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [metamagics, open, selectionKey])

  return null
}
