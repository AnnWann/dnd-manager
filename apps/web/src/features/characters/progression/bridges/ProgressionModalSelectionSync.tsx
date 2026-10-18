import { useEffect } from "react"

const SELECTED_CLASSES = ["border-accentBorder", "bg-accentBg"]
const UNSELECTED_CLASSES = ["border-border", "bg-bg"]

export function ProgressionModalSelectionSync() {
  useEffect(() => {
    if (typeof document === "undefined") return

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const modal = target.closest<HTMLElement>(
        "[data-progression-feature-modal]",
      )
      if (!modal) return

      const button = target.closest<HTMLButtonElement>("main section button")
      if (!button || button.disabled) return

      const section = button.closest<HTMLElement>("section")
      if (!section) return

      const instruction = Array.from(section.querySelectorAll("p")).find((entry) =>
        /^Escolha\s+\d+/i.test(entry.textContent?.trim() ?? ""),
      )
      if (!instruction) return

      const count = Math.max(
        1,
        Number(instruction.textContent?.match(/Escolha\s+(\d+)/i)?.[1]) || 1,
      )
      const options = Array.from(
        section.querySelectorAll<HTMLButtonElement>("button"),
      ).filter(
        (entry) =>
          entry !== button &&
          !entry.closest("header, footer") &&
          entry.querySelector("strong"),
      )
      const allOptions = [button, ...options]
      const wasSelected = isSelected(button)

      if (count === 1) {
        for (const option of allOptions) setSelected(option, option === button)
        return
      }

      const selectedCount = allOptions.filter(isSelected).length
      if (!wasSelected && selectedCount >= count) return
      setSelected(button, !wasSelected)
    }

    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  return null
}

function isSelected(button: HTMLButtonElement): boolean {
  return (
    button.classList.contains("border-accentBorder") ||
    button.classList.contains("bg-accentBg") ||
    button.getAttribute("aria-pressed") === "true"
  )
}

function setSelected(button: HTMLButtonElement, selected: boolean) {
  for (const className of selected ? UNSELECTED_CLASSES : SELECTED_CLASSES) {
    button.classList.remove(className)
  }
  for (const className of selected ? SELECTED_CLASSES : UNSELECTED_CLASSES) {
    button.classList.add(className)
  }
  button.setAttribute("aria-pressed", selected ? "true" : "false")
}
