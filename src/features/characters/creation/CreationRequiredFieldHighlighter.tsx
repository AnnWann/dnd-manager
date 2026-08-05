import { useEffect, useRef, useState } from "react"

const PREPARED_FULL_LIST_CLASSES = new Set([
  "Artífice",
  "Clérigo",
  "Druida",
  "Paladino",
])

export function CreationRequiredFieldHighlighter() {
  const [message, setMessage] = useState("")
  const messageRef = useRef(message)
  messageRef.current = message

  useEffect(() => {
    const clear = () => {
      if (messageRef.current) setMessage("")
      clearAttemptHighlights()
    }

    const onInput = () => clear()
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>("button")
      if (!button) return

      const root = findWizardRoot(button)
      if (!root) return

      const intent = getNavigationIntent(root, button)
      if (!intent.forward) {
        clear()
        return
      }

      const main = root.querySelector<HTMLElement>("main")
      if (!main) return
      const error = validateVisibleStep(main)
      if (!error) {
        clear()
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setMessage(error.message)
      highlight(error.elements)
    }

    document.addEventListener("click", onClick, true)
    document.addEventListener("input", onInput, true)
    document.addEventListener("change", onInput, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("input", onInput, true)
      document.removeEventListener("change", onInput, true)
      clearAttemptHighlights()
    }
  }, [])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[360] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm font-medium text-danger shadow-theme-lg">
      {message}
    </div>
  )
}

type ValidationResult = {
  message: string
  elements: HTMLElement[]
}

function validateVisibleStep(main: HTMLElement): ValidationResult | null {
  const invalidOriginSection = Array.from(
    main.querySelectorAll<HTMLElement>('[data-creation-step-valid="false"]'),
  )[0]
  if (invalidOriginSection) {
    const message =
      invalidOriginSection.dataset.creationStepError?.trim() ||
      "Complete todas as escolhas obrigatórias antes de continuar."
    return {
      message,
      elements: collectMissingFields(invalidOriginSection).length
        ? collectMissingFields(invalidOriginSection)
        : [invalidOriginSection],
    }
  }

  const equipmentSection = main.querySelector<HTMLElement>(
    '[data-stable-class-equipment-v2="true"]',
  )
  if (
    equipmentSection &&
    equipmentSection.classList.contains("border-danger")
  ) {
    return {
      message:
        "Escolha uma arma concreta para cada entrada de arma simples ou marcial antes de continuar.",
      elements: [equipmentSection],
    }
  }

  const classesHeading = Array.from(main.querySelectorAll<HTMLElement>("h2"))
    .find((heading) =>
      /classe inicial e distribuição de níveis/i.test(
        heading.textContent?.trim() ?? "",
      ),
    )
  if (classesHeading) return validateClassesStep(main)

  return null
}

function validateClassesStep(main: HTMLElement): ValidationResult | null {
  const emptySubclass = Array.from(main.querySelectorAll<HTMLSelectElement>("select"))
    .find(
      (select) =>
        Array.from(select.options).some((option) =>
          option.textContent?.includes("Selecione uma subclasse"),
        ) && !select.value,
    )
  if (emptySubclass) {
    return {
      message: "Selecione todas as subclasses obrigatórias antes de continuar.",
      elements: [emptySubclass],
    }
  }

  const proficiencyCounters = Array.from(
    main.querySelectorAll<HTMLElement>("div,strong,span"),
  )
    .filter((element) => element.childElementCount === 0)
    .map((element) => ({
      element,
      match: element.textContent?.match(
        /Escolha\s+\d+\s+perícias?\s*\((\d+)\/(\d+)\)/i,
      ),
    }))
    .filter(
      (entry): entry is { element: HTMLElement; match: RegExpMatchArray } =>
        Boolean(entry.match),
    )
  const incompleteProficiency = proficiencyCounters.find(
    ({ match }) => Number(match[1]) < Number(match[2]),
  )
  if (incompleteProficiency) {
    return {
      message: "Escolha todas as perícias obrigatórias de cada classe.",
      elements: [
        incompleteProficiency.element.closest<HTMLElement>("details") ||
          incompleteProficiency.element,
      ],
    }
  }

  const emptyClassChoice = Array.from(main.querySelectorAll<HTMLInputElement>("input"))
    .find((input) => {
      const label = input.closest("label")?.textContent ?? ""
      return (
        /ferramenta|instrumento/i.test(label) &&
        !input.value.trim() &&
        !/buscar magia/i.test(input.placeholder)
      )
    })
  if (emptyClassChoice) {
    return {
      message: "Complete todas as escolhas obrigatórias de proficiência da classe.",
      elements: [emptyClassChoice],
    }
  }

  const featureChoiceError = findIncompleteFeatureChoice(main)
  if (featureChoiceError) return featureChoiceError

  const spellError = validateSpellSelections(main)
  if (spellError) return spellError

  const metamagicHeading = Array.from(main.querySelectorAll<HTMLElement>("h2"))
    .find((heading) => heading.textContent?.trim() === "Metamagia")
  if (metamagicHeading) {
    const section = metamagicHeading.closest<HTMLElement>("section")
    const description = section?.querySelector("p")?.textContent ?? ""
    const required = Number(description.match(/Escolha\s+(\d+)/i)?.[1] ?? 0)
    const selected = section?.querySelectorAll("button.bg-accentBg").length ?? 0
    if (required > 0 && selected < required) {
      return {
        message: `Escolha exatamente ${required} opções de Metamagia.`,
        elements: section ? [section] : [],
      }
    }
  }

  return null
}

function findIncompleteFeatureChoice(main: HTMLElement): ValidationResult | null {
  const labels = Array.from(main.querySelectorAll<HTMLElement>("div"))
    .filter((element) => element.childElementCount === 0)
    .map((element) => ({
      element,
      match: element.textContent?.match(/·\s*escolha\s+(\d+)\s*$/i),
    }))
    .filter(
      (entry): entry is { element: HTMLElement; match: RegExpMatchArray } =>
        Boolean(entry.match),
    )

  for (const { element, match } of labels) {
    const container = element.parentElement
    if (!container) continue
    const required = Number(match[1])
    const selectedButtons = container.querySelectorAll("button.bg-accentBg").length
    const customValue = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).some((input) => input.value.trim())
    if (selectedButtons + (customValue ? 1 : 0) < required) {
      return {
        message: `Complete a escolha obrigatória “${
          element.textContent?.split("·")[0]?.trim() || "da característica"
        }”.`,
        elements: [container],
      }
    }
  }

  return null
}

function validateSpellSelections(main: HTMLElement): ValidationResult | null {
  const summaries = Array.from(main.querySelectorAll<HTMLElement>("summary"))
    .filter((summary) =>
      summary.textContent?.includes("Selecionar e ler magias de"),
    )

  for (const summary of summaries) {
    const text = summary.textContent ?? ""
    const className =
      text.match(/magias de\s+(.+?)\s+·/i)?.[1]?.trim() ?? ""
    const cantrips = text.match(/truques\s+(\d+)\/(\d+)/i)
    const leveled = text.match(/magias\s+(\d+)\/(\d+)/i)
    const selectedCantrips = Number(cantrips?.[1] ?? 0)
    const requiredCantrips = Number(cantrips?.[2] ?? 0)
    const selectedLeveled = Number(leveled?.[1] ?? 0)
    const requiredLeveled = Number(leveled?.[2] ?? 0)

    if (selectedCantrips < requiredCantrips) {
      return {
        message: `Escolha ${requiredCantrips} truques de ${className} antes de continuar.`,
        elements: [summary.closest<HTMLElement>("details") || summary],
      }
    }

    if (
      !PREPARED_FULL_LIST_CLASSES.has(className) &&
      selectedLeveled < requiredLeveled
    ) {
      const label =
        className === "Mago" ? "magias para o grimório" : "magias conhecidas"
      return {
        message: `Escolha ${requiredLeveled} ${label} de ${className} antes de continuar.`,
        elements: [summary.closest<HTMLElement>("details") || summary],
      }
    }
  }

  return null
}

function findWizardRoot(element: Element): HTMLElement | null {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1"))
    .find((heading) => heading.textContent?.trim() === "Criar personagem")
  const root = title?.closest<HTMLElement>("div.grid")
  return root && root.contains(element) ? root : null
}

function getNavigationIntent(root: HTMLElement, button: HTMLButtonElement) {
  const text = button.textContent?.trim() ?? ""
  if (text === "Continuar") return { forward: true }
  const steps = getStepButtons(root)
  const clicked = steps.indexOf(button)
  const current = steps.findIndex((entry) =>
    entry.classList.contains("bg-accentBg"),
  )
  return { forward: clicked > current }
}

function getStepButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("header button"))
    .filter((button) => /^\d+\./.test(button.textContent?.trim() ?? ""))
}

function collectMissingFields(root: HTMLElement): HTMLElement[] {
  const fields = Array.from(
    root.querySelectorAll<HTMLElement>("input,select,textarea"),
  ).filter((field) => {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      return !field.disabled && !field.value.trim()
    }
    return false
  })
  return fields
}

function highlight(elements: HTMLElement[]) {
  clearAttemptHighlights()
  for (const element of elements) {
    element.dataset.creationAttemptInvalid = "true"
    element.classList.add("border-danger", "bg-dangerBg")
    const inputs = element.matches("input,select,textarea")
      ? [element]
      : Array.from(element.querySelectorAll<HTMLElement>("input,select,textarea"))
    for (const input of inputs) input.setAttribute("aria-invalid", "true")
  }
  elements[0]?.scrollIntoView({ behavior: "smooth", block: "center" })
}

function clearAttemptHighlights() {
  document
    .querySelectorAll<HTMLElement>('[data-creation-attempt-invalid="true"]')
    .forEach((element) => {
      delete element.dataset.creationAttemptInvalid
      element.classList.remove("border-danger", "bg-dangerBg")
      if (element.getAttribute("aria-invalid") === "true") {
        element.removeAttribute("aria-invalid")
      }
      element
        .querySelectorAll<HTMLElement>('[aria-invalid="true"]')
        .forEach((input) => input.removeAttribute("aria-invalid"))
    })
}
