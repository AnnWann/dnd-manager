export type CreationStepValidationResult = {
  message: string
  elements: HTMLElement[]
}

export function validateVisibleCreationStep(
  main: HTMLElement,
): CreationStepValidationResult | null {
  const invalidOriginSection = main.querySelector<HTMLElement>(
    '[data-creation-step-valid="false"]',
  )
  if (invalidOriginSection) {
    const message =
      invalidOriginSection.dataset.creationStepError?.trim() ||
      "Complete todas as escolhas obrigatórias antes de continuar."
    const missingFields = collectMissingFields(invalidOriginSection)
    return {
      message,
      elements: missingFields.length ? missingFields : [invalidOriginSection],
    }
  }

  const hasProgressionConfiguration = Boolean(
    main.querySelector('[data-creation-progression-class]'),
  )

  return hasProgressionConfiguration
    ? validateProgressionConfiguration(main)
    : null
}

export function findCharacterCreationRoot(
  element?: Element,
): HTMLElement | null {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
    (heading) => heading.textContent?.trim() === "Criar personagem",
  )
  const root = title?.closest<HTMLElement>("div.grid") ?? null
  if (!element) return root
  return root && root.contains(element) ? root : null
}

export function getCreationNavigationIntent(
  root: HTMLElement,
  button: HTMLButtonElement,
): { forward: boolean } {
  const text = button.textContent?.trim() ?? ""
  if (text === "Continuar") return { forward: true }

  const steps = getStepButtons(root)
  const clicked = steps.indexOf(button)
  const current = steps.findIndex((entry) =>
    entry.classList.contains("bg-accentBg"),
  )
  return { forward: clicked > current }
}

export function isAllowedBootstrapNavigation(
  root: HTMLElement,
  button: HTMLButtonElement,
): boolean {
  const isStepButton = /^\d+\./.test(button.textContent?.trim() ?? "")
  if (!isStepButton) return false

  const main = root.querySelector<HTMLElement>("main")
  const initialIdentityVisible = Boolean(
    main &&
      Array.from(main.querySelectorAll<HTMLElement>("h2")).some(
        (heading) => heading.textContent?.trim() === "Identidade",
      ) &&
      !main.querySelector('[data-character-creation-identity-step="true"]'),
  )
  const targetsRace = /raça/i.test(button.textContent?.trim() ?? "")
  return initialIdentityVisible && targetsRace
}

export function highlightCreationAttempt(elements: HTMLElement[]) {
  clearCreationAttemptHighlights()

  for (const element of elements) {
    element.dataset.creationAttemptInvalid = "true"
    element.classList.add("border-danger", "bg-dangerBg")
    const inputs = element.matches("input,select,textarea")
      ? [element]
      : Array.from(
          element.querySelectorAll<HTMLElement>("input,select,textarea"),
        )
    for (const input of inputs) input.setAttribute("aria-invalid", "true")
  }

  elements[0]?.scrollIntoView({ behavior: "smooth", block: "center" })
}

export function clearCreationAttemptHighlights() {
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

function validateProgressionConfiguration(
  main: HTMLElement,
): CreationStepValidationResult | null {
  const mounts = Array.from(
    main.querySelectorAll<HTMLElement>('[data-creation-progression-class]'),
  )

  for (const mount of mounts) {
    const classLabel = resolveClassLabel(mount)
    const cards = Array.from(mount.querySelectorAll<HTMLElement>("article"))

    for (const card of cards) {
      const parsed = readRequiredActionCard(card)
      if (!parsed || parsed.selected >= parsed.required) continue

      return {
        message: progressionRequirementMessage(
          parsed.title,
          parsed.required,
          classLabel,
        ),
        elements: [card],
      }
    }
  }

  return null
}

function readRequiredActionCard(
  card: HTMLElement,
): { title: string; selected: number; required: number } | null {
  const button = card.querySelector<HTMLButtonElement>(":scope > button")
  if (!button) return null

  const summary = card.querySelector<HTMLElement>(":scope > div")
  const title = summary?.children[0]?.textContent?.trim() ?? ""
  if (
    title !== "Truques" &&
    title !== "Magias" &&
    title !== "Grimório" &&
    title !== "Metamagias" &&
    title !== "Evocações"
  ) {
    return null
  }

  const value = summary?.children[1]?.textContent?.trim() ?? ""
  const count = value.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!count) return null

  return {
    title,
    selected: Number(count[1]),
    required: Number(count[2]),
  }
}

function progressionRequirementMessage(
  title: string,
  required: number,
  classLabel: string,
): string {
  switch (title) {
    case "Truques":
      return `Escolha ${required} truques de ${classLabel} antes de continuar.`
    case "Grimório":
      return `Adicione ${required} magias ao grimório de ${classLabel} antes de continuar.`
    case "Magias":
      return `Escolha ${required} magias de ${classLabel} antes de continuar.`
    case "Metamagias":
      return `Escolha ${required} opções de Metamagia antes de continuar.`
    case "Evocações":
      return `Configure ${required} evocações de ${classLabel} antes de continuar.`
    default:
      return "Complete todas as escolhas obrigatórias antes de continuar."
  }
}

function resolveClassLabel(mount: HTMLElement): string {
  const section = mount.closest<HTMLElement>("section")
  const heading = section?.querySelector<HTMLElement>(":scope > div h2, :scope > h2")
  const raw = heading?.textContent?.trim() ?? "classe"
  return raw.replace(/\s+\d+.*$/, "").trim() || "classe"
}

function getStepButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("header button")).filter(
    (button) => /^\d+\./.test(button.textContent?.trim() ?? ""),
  )
}

function collectMissingFields(root: HTMLElement): HTMLElement[] {
  return Array.from(
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
}
