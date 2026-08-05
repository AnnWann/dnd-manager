import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Proficiency } from "../../../models/sheet/Proficiency"

const STANDARD_LANGUAGES = [
  "Comum",
  "Anão",
  "Élfico",
  "Gigante",
  "Gnômico",
  "Goblin",
  "Halfling",
  "Orc",
  "Abissal",
  "Celestial",
  "Dialeto Subterrâneo",
  "Dracônico",
  "Infernal",
  "Primordial",
  "Silvestre",
  "Subcomum",
]

type BackgroundChoiceOverride = {
  valid: boolean
  error?: string
  apply: (proficiencies: Proficiency[]) => Proficiency[]
}

type Props = {
  onChange: (override: BackgroundChoiceOverride | null) => void
  externalError?: string
}

export function CharacterCreationBackgroundChoices({
  onChange,
  externalError,
}: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [prompts, setPrompts] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [presetLocked, setPresetLocked] = useState(true)

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const builderHeading = Array.from(
          document.querySelectorAll<HTMLElement>("h2"),
        ).find(
          (entry) =>
            entry.textContent?.trim() ===
            "Construir características do antecedente",
        )
        const builderSection = builderHeading?.closest<HTMLElement>("section")
        if (!builderSection) {
          setAnchor(null)
          return
        }

        const presetHeading = Array.from(
          document.querySelectorAll<HTMLElement>("h2"),
        ).find((entry) => entry.textContent?.trim() === "Antecedente")
        const presetSection = presetHeading?.closest<HTMLElement>("section")
        const customButton = Array.from(
          presetSection?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        ).find((button) => normalize(button.textContent ?? "").startsWith("personalizado"))
        const customSelected =
          customButton?.classList.contains("border-accentBorder") === true ||
          customButton?.classList.contains("bg-accentBg") === true
        setPresetLocked(!customSelected)

        const skillHeading = Array.from(
          builderSection.querySelectorAll<HTMLElement>("div"),
        ).find((entry) => entry.textContent?.trim() === "Perícias do antecedente")
        const skillContainer = skillHeading?.parentElement
        skillContainer
          ?.querySelectorAll<HTMLButtonElement>("button")
          .forEach((button) => {
            button.disabled = !customSelected
            button.dataset.backgroundPresetSkill = "true"
            button.title = customSelected
              ? ""
              : "As perícias de um antecedente pronto são fixas. Selecione Antecedente personalizado para editá-las."
          })

        const detected = Array.from(
          builderSection.querySelectorAll<HTMLElement>("div,strong,span"),
        )
          .filter((entry) => entry.childElementCount === 0)
          .map((entry) => entry.textContent?.trim() ?? "")
          .filter(isBackgroundChoicePrompt)
        const nextPrompts = Array.from(new Set(detected))
        setPrompts((current) =>
          sameStrings(current, nextPrompts) ? current : nextPrompts,
        )

        let portalAnchor = builderSection.querySelector<HTMLElement>(
          "[data-background-choice-anchor]",
        )
        if (!portalAnchor) {
          portalAnchor = document.createElement("div")
          portalAnchor.dataset.backgroundChoiceAnchor = "true"
          builderSection.append(portalAnchor)
        }
        setAnchor(portalAnchor)
      })
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document
        .querySelectorAll("[data-background-choice-anchor]")
        .forEach((entry) => entry.remove())
      document
        .querySelectorAll<HTMLButtonElement>(
          '[data-background-preset-skill="true"]',
        )
        .forEach((button) => {
          button.disabled = false
          delete button.dataset.backgroundPresetSkill
          button.title = ""
        })
    }
  }, [])

  useEffect(() => {
    setValues((current) =>
      Object.fromEntries(
        prompts.map((prompt) => [prompt, current[prompt] ?? ""]),
      ),
    )
  }, [prompts])

  const valid = prompts.every((prompt) => values[prompt]?.trim())
  const override = useMemo<BackgroundChoiceOverride>(
    () => ({
      valid,
      error: valid
        ? undefined
        : "Escolha todos os idiomas, ferramentas ou outras proficiências adicionais do antecedente.",
      apply: (proficiencies) =>
        deduplicate(
          proficiencies.flatMap((entry) => {
            const prompt = prompts.find(
              (candidate) => normalize(candidate) === normalize(entry.name),
            )
            if (!prompt) return [entry]
            const value = values[prompt]?.trim()
            if (!value) return []
            return [
              {
                ...entry,
                name: value,
                notes: mergeNotes(
                  entry.notes,
                  `Escolha do antecedente que substitui: ${entry.name}.`,
                ),
              },
            ]
          }),
        ),
    }),
    [prompts, valid, values],
  )

  useEffect(() => {
    onChange(override)
    return () => onChange(null)
  }, [onChange, override])

  if (!anchor || !prompts.length) return null

  return createPortal(
    <section
      data-creation-step-valid={valid ? "true" : "false"}
      data-creation-step-error={override.error ?? ""}
      className="mt-4 grid gap-4 rounded-xl border border-warning bg-warningBg p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-textH">
          Escolhas obrigatórias do antecedente
        </h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Marcadores genéricos não são salvos. Cada idioma ou proficiência deve
          ser definido agora.
        </p>
        {presetLocked ? (
          <p className="mt-1 text-xs text-textMuted">
            As perícias do preset permanecem bloqueadas. Para alterá-las,
            selecione o antecedente personalizado.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {prompts.map((prompt) =>
          isLanguagePrompt(prompt) ? (
            <label key={prompt} className="grid gap-1 text-xs text-textMuted">
              {prompt}
              <Select
                value={values[prompt] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [prompt]: event.target.value,
                  }))
                }
              >
                <option value="">Selecione um idioma</option>
                {STANDARD_LANGUAGES.filter(
                  (language) =>
                    !Object.entries(values).some(
                      ([otherPrompt, selected]) =>
                        otherPrompt !== prompt && selected === language,
                    ),
                ).map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <label key={prompt} className="grid gap-1 text-xs text-textMuted">
              {prompt}
              <Input
                value={values[prompt] ?? ""}
                placeholder="Digite a escolha concreta"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [prompt]: event.target.value,
                  }))
                }
              />
            </label>
          ),
        )}
      </div>

      {externalError ? (
        <div className="rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger">
          {externalError}
        </div>
      ) : !valid ? (
        <div className="text-xs font-medium text-danger">
          Complete todas as escolhas antes de continuar.
        </div>
      ) : null}
    </section>,
    anchor,
  )
}

function isBackgroundChoicePrompt(value: string): boolean {
  const normalized = normalize(value)
  return (
    /^idioma adicional \d+$/.test(normalized) ||
    normalized.includes("idioma a escolha") ||
    normalized.includes("ferramenta a escolha") ||
    normalized.includes("instrumento a escolha") ||
    normalized.includes("jogo a escolha") ||
    normalized.includes("veiculo a escolha")
  )
}

function isLanguagePrompt(value: string): boolean {
  return normalize(value).includes("idioma")
}

function deduplicate(entries: Proficiency[]): Proficiency[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.category}:${normalize(entry.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeNotes(current: string | undefined, next: string): string {
  return Array.from(new Set([current?.trim(), next.trim()].filter(Boolean))).join(
    " ",
  )
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => entry === right[index])
  )
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export type { BackgroundChoiceOverride }
