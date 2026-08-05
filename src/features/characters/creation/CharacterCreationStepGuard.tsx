import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

type Props = {
  externalErrors?: string[]
}

export function CharacterCreationStepGuard({
  externalErrors = [],
}: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let frame = 0

    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
          (entry) => entry.textContent?.trim() === "Criar personagem",
        )
        const root = title?.closest<HTMLElement>(
          ".grid.h-\\[100dvh\\], .grid.min-h-\\[calc\\(100dvh-10rem\\)\\]",
        ) ?? title?.parentElement?.parentElement?.parentElement
        const main = root?.querySelector<HTMLElement>(":scope > main")
        if (!root || !main) {
          setAnchor(null)
          return
        }

        let errorAnchor = main.querySelector<HTMLElement>(
          "[data-creation-step-error-anchor]",
        )
        if (!errorAnchor) {
          errorAnchor = document.createElement("div")
          errorAnchor.dataset.creationStepErrorAnchor = "true"
          main.prepend(errorAnchor)
        }
        setAnchor(errorAnchor)
      })
    }

    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        "button",
      )
      if (!button) return

      const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
        (entry) => entry.textContent?.trim() === "Criar personagem",
      )
      const root = title?.closest<HTMLElement>(
        ".grid.h-\\[100dvh\\], .grid.min-h-\\[calc\\(100dvh-10rem\\)\\]",
      ) ?? title?.parentElement?.parentElement?.parentElement
      if (!root || !root.contains(button)) return

      const headerButtons = Array.from(
        root.querySelectorAll<HTMLButtonElement>(":scope > header button"),
      ).filter((entry) => /^\d+\./.test(entry.textContent?.trim() ?? ""))
      const activeIndex = headerButtons.findIndex(
        (entry) =>
          entry.classList.contains("border-accentBorder") ||
          entry.classList.contains("bg-accentBg"),
      )
      const requestedIndex = headerButtons.indexOf(button)
      const isForwardTab =
        requestedIndex >= 0 && activeIndex >= 0 && requestedIndex > activeIndex
      const isContinue = normalize(button.textContent ?? "").startsWith("continuar")

      if (!isForwardTab && !isContinue) return

      const error = validateVisibleStep(root, externalErrors)
      if (!error) {
        setMessage("")
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setMessage(error)
      root.querySelector<HTMLElement>(":scope > main")?.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener("click", handleClick, true)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("click", handleClick, true)
      document
        .querySelectorAll("[data-creation-step-error-anchor]")
        .forEach((entry) => entry.remove())
    }
  }, [externalErrors])

  if (!anchor || !message) return null

  return createPortal(
    <div className="mb-4 rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
      {message}
    </div>,
    anchor,
  )
}

function validateVisibleStep(
  root: HTMLElement,
  externalErrors: string[],
): string {
  const main = root.querySelector<HTMLElement>(":scope > main")
  if (!main) return ""

  const invalidSection = main.querySelector<HTMLElement>(
    '[data-creation-step-valid="false"]',
  )
  if (invalidSection) {
    return (
      invalidSection.dataset.creationStepError ||
      "Complete todas as escolhas obrigatórias desta etapa."
    )
  }

  const emptyRequiredSelect = Array.from(
    main.querySelectorAll<HTMLSelectElement>("select"),
  ).find((select) => {
    if (select.disabled || select.offsetParent === null) return false
    if (select.value.trim()) return false
    const placeholder = select.options[0]?.textContent ?? ""
    return /selecione|escolha/i.test(placeholder)
  })
  if (emptyRequiredSelect) {
    return "Complete todas as seleções obrigatórias desta etapa."
  }

  const visibleText = main.innerText
  const incompleteCounter = Array.from(
    visibleText.matchAll(/(?:^|\s)(\d+)\s*\/\s*(\d+)(?:\s|$)/g),
  ).find((match) => Number(match[1]) < Number(match[2]))
  if (incompleteCounter) {
    return `Complete as escolhas obrigatórias (${incompleteCounter[1]}/${incompleteCounter[2]}).`
  }

  const unresolvedEquipment = Array.from(
    main.querySelectorAll<HTMLElement>("div"),
  ).find(
    (entry) =>
      entry.offsetParent !== null &&
      normalize(entry.textContent ?? "").includes("nenhuma arma selecionada"),
  )
  if (unresolvedEquipment) {
    return "Escolha uma arma concreta para cada entrada de arma simples ou marcial."
  }

  const contextualError = externalErrors.find(Boolean)
  if (contextualError) return contextualError

  return ""
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
