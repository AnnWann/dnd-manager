import { useEffect } from "react"

const REQUIRED_SECTION_TITLES = [
  "escolhas obrigatorias",
  "escolhas raciais obrigatorias",
  "escolhas obrigatorias do antecedente",
]

export function CreationRequiredFieldHighlighter() {
  useEffect(() => {
    let frame = 0

    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(highlightRequiredFields)
    }

    apply()
    const onInteraction = () => apply()
    document.addEventListener("input", onInteraction, true)
    document.addEventListener("change", onInteraction, true)
    document.addEventListener("click", onInteraction, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("input", onInteraction, true)
      document.removeEventListener("change", onInteraction, true)
      document.removeEventListener("click", onInteraction, true)
      document
        .querySelectorAll<HTMLElement>("[data-creation-required-highlight]")
        .forEach(clearHighlight)
    }
  }, [])

  return null
}

function highlightRequiredFields() {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
    (entry) => entry.textContent?.trim() === "Criar personagem",
  )
  const root = title?.closest("header")?.parentElement
  if (!(root instanceof HTMLElement)) return

  root
    .querySelectorAll<HTMLElement>("[data-creation-required-highlight]")
    .forEach(clearHighlight)

  root.querySelectorAll<HTMLElement>("section").forEach((section) => {
    const heading = section.querySelector<HTMLElement>("h2,h3")
    const titleText = normalize(heading?.textContent ?? "")
    if (
      !REQUIRED_SECTION_TITLES.some((candidate) =>
        titleText.includes(candidate),
      )
    ) {
      return
    }

    section
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")
      .forEach((field) => {
        if (field.disabled || field.type === "hidden") return
        const missing = !String(field.value ?? "").trim()
        if (!missing) return

        field.dataset.creationRequiredHighlight = "true"
        field.setAttribute("aria-invalid", "true")
        field.classList.add("border-danger", "bg-dangerBg")
        const label = field.closest<HTMLElement>("label")
        label?.classList.add("text-danger")
        if (label) label.dataset.creationRequiredHighlight = "true"
      })
  })
}

function clearHighlight(element: HTMLElement) {
  delete element.dataset.creationRequiredHighlight
  element.removeAttribute("aria-invalid")
  element.classList.remove("border-danger", "bg-dangerBg", "text-danger")
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
