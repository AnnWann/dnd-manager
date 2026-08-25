import { useEffect } from "react"

import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

const CUSTOM_CLASS_RUNTIME_ID = "__custom__"
const CUSTOM_OPTION_DATASET = "dndCustomClassOption"

type Props = {
  open: boolean
  customName: string
}

/**
 * The integrated creator intentionally keeps its canonical class array limited
 * to official classes. This bridge exposes the runtime custom-class entry in the
 * two class selectors without polluting the shared ClassName registry.
 */
export function CreationCustomClassSelectionBridge({
  open,
  customName,
}: Props) {
  useEffect(() => {
    if (!open) return

    let frame = 0
    let observer: MutationObserver | undefined

    const sync = () => {
      const root = findCharacterCreationRoot()
      const main = root?.querySelector<HTMLElement>("main")
      if (!main) return

      const hasCustomClassPlan = Array.from(
        main.querySelectorAll<HTMLElement>("h2"),
      ).some((heading) =>
        heading.textContent?.trim().startsWith("Classe personalizada "),
      )

      for (const label of Array.from(main.querySelectorAll<HTMLLabelElement>("label"))) {
        const labelText = label.textContent?.trim() ?? ""
        const isPrimary = labelText.startsWith("Classe inicial")
        const isMulticlass = labelText.startsWith("Adicionar multiclasse")
        if (!isPrimary && !isMulticlass) continue

        const select = label.querySelector<HTMLSelectElement>("select")
        if (!select) continue

        cleanRequirementSuffixes(select)

        const existing = Array.from(select.options).find(
          (option) => option.value === CUSTOM_CLASS_RUNTIME_ID,
        )

        if (isMulticlass && hasCustomClassPlan) {
          existing?.remove()
          continue
        }

        const option = existing ?? document.createElement("option")
        const desiredLabel = customName.trim() || "Classe personalizada"
        if (option.value !== CUSTOM_CLASS_RUNTIME_ID) {
          option.value = CUSTOM_CLASS_RUNTIME_ID
        }
        if (option.textContent !== desiredLabel) {
          option.textContent = desiredLabel
        }
        if (option.dataset[CUSTOM_OPTION_DATASET] !== "true") {
          option.dataset[CUSTOM_OPTION_DATASET] = "true"
        }
        if (!existing) select.appendChild(option)

        if (isPrimary && hasCustomClassPlan && select.value !== CUSTOM_CLASS_RUNTIME_ID) {
          select.value = CUSTOM_CLASS_RUNTIME_ID
        }
      }
    }

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        sync()
      })
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0
      sync()
      const root = findCharacterCreationRoot()
      if (!root) return
      observer = new MutationObserver(scheduleSync)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      const root = findCharacterCreationRoot()
      root
        ?.querySelectorAll<HTMLOptionElement>(
          `option[data-${toKebab(CUSTOM_OPTION_DATASET)}="true"]`,
        )
        .forEach((option) => option.remove())
    }
  }, [customName, open])

  return null
}

export const CharacterCreationCustomClassSelectionBridge =
  CreationCustomClassSelectionBridge

function cleanRequirementSuffixes(select: HTMLSelectElement) {
  for (const option of Array.from(select.options)) {
    if (option.value === CUSTOM_CLASS_RUNTIME_ID) continue
    const current = option.textContent ?? ""
    const next = current
      .replace(/\s*·\s*consulte sua refer[eê]ncia\s*$/iu, "")
      .replace(/\s*·\s*$/u, "")
      .trim()
    if (next !== current) option.textContent = next
  }
}

function toKebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
