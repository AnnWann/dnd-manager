import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export function CharacterCreationStepGuard() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let frame = 0

    const findRoot = (): HTMLElement | null => {
      const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
        (entry) => entry.textContent?.trim() === "Criar personagem",
      )
      return title?.closest("header")?.parentElement ?? null
    }

    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const root = findRoot()
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
      const root = findRoot()
      if (!button || !root || !root.contains(button)) return

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

      const error = validateVisibleStep(root)
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
  }, [])

  if (!anchor || !message) return null

  return createPortal(
    <div className="mb-4 rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
      {message}
    </div>,
    anchor,
  )
}

function validateVisibleStep(root: HTMLElement): string {
  const main = root.querySelector<HTMLElement>(":scope > main")
  if (!main) return ""

  const identityHeading = Array.from(main.querySelectorAll<HTMLElement>("h2")).find(
    (entry) => entry.textContent?.trim() === "Identidade",
  )
  if (identityHeading) {
    const nameInput = Array.from(main.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "Nome do personagem",
    )
    if (!nameInput?.value.trim()) return "Informe o nome do personagem."
  }

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
    if (select.disabled || select.offsetParent === null || select.value.trim()) {
      return false
    }
    const placeholder = select.options[0]?.textContent ?? ""
    return /selecione|escolha/i.test(placeholder)
  })
  if (emptyRequiredSelect) {
    return "Complete todas as seleções obrigatórias desta etapa."
  }

  const visibleText = main.innerText
  const explicitIncompleteMessage = [
    "complete todas as escolhas acima",
    "complete todas as escolhas antes de continuar",
    "nenhuma arma selecionada",
    "selecione uma subclasse",
  ].find((fragment) => normalize(visibleText).includes(fragment))
  if (explicitIncompleteMessage) {
    return "Complete todas as escolhas obrigatórias desta etapa."
  }

  const incompleteCounter = Array.from(
    visibleText.matchAll(/(?:^|\s)(\d+)\s*\/\s*(\d+)(?:\s|$)/g),
  ).find((match) => Number(match[1]) < Number(match[2]))
  if (incompleteCounter) {
    return `Complete as escolhas obrigatórias (${incompleteCounter[1]}/${incompleteCounter[2]}).`
  }

  const requiredWarning = Array.from(
    main.querySelectorAll<HTMLElement>("section,div"),
  ).find((entry) => {
    if (entry.offsetParent === null) return false
    const text = normalize(entry.textContent ?? "")
    return (
      text.includes("escolha obrigatoria") &&
      (text.includes("nenhuma") || text.includes("complete"))
    )
  })
  if (requiredWarning) {
    return "Complete todas as escolhas obrigatórias desta etapa."
  }

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
