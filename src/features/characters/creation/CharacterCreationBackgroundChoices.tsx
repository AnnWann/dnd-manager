import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Input } from "../../../components/ui/Input"
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
        ).find((button) =>
          normalize(button.textContent ?? "").startsWith("personalizado"),
        )
        const customSelected =
          customButton?.classList.contains("border-accentBorder") === true ||
          customButton?.classList.contains("bg-accentBg") === true

        setPresetLocked(!customSelected)

        const skillHeading = Array.from(
          builderSection.querySelectorAll<HTMLElement>("div"),
        ).find(
          (entry) => entry.textContent?.trim() === "Perícias do antecedente",
        )
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
  const duplicateLanguage = prompts.some((prompt, index) => {
    if (!isLanguagePrompt(prompt)) return false
    const value = normalize(values[prompt] ?? "")
    if (!value) return false

    return prompts.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        isLanguagePrompt(other) &&
        normalize(values[other] ?? "") === value,
    )
  })
  const fullyValid = valid && !duplicateLanguage

  const override = useMemo<BackgroundChoiceOverride>(
    () => ({
      valid: fullyValid,
      error: !valid
        ? "Escolha todos os idiomas, ferramentas ou outras proficiências adicionais do antecedente."
        : duplicateLanguage
          ? "Escolha idiomas diferentes para cada proficiência adicional."
          : undefined,
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
    [duplicateLanguage, fullyValid, prompts, valid, values],
  )

  useEffect(() => {
    onChange(override)
  }, [onChange, override])

  if (!anchor || !prompts.length) return null

  const showAttemptError = Boolean(externalError)

  return createPortal(
    <section
      data-creation-step-valid={fullyValid ? "true" : "false"}
      data-creation-step-error={override.error ?? ""}
      className={
        showAttemptError
          ? "mt-4 grid gap-4 rounded-xl border border-danger bg-dangerBg p-4"
          : "mt-4 grid gap-4 rounded-xl border border-border bg-bg-subtle p-4"
      }
    >
      <div>
        <h3 className="text-sm font-semibold text-textH">
          Escolhas obrigatórias do antecedente
        </h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Escolha uma opção padrão ou digite livremente um idioma ou proficiência.
          Marcadores genéricos não serão salvos.
        </p>
        {presetLocked ? (
          <p className="mt-1 text-xs text-textMuted">
            As perícias do preset permanecem bloqueadas. Para alterá-las,
            selecione o antecedente personalizado.
          </p>
        ) : null}
      </div>

      <datalist id="character-creation-standard-languages">
        {STANDARD_LANGUAGES.map((language) => (
          <option key={language} value={language} />
        ))}
      </datalist>

      <div className="grid gap-3 sm:grid-cols-2">
        {prompts.map((prompt) => {
          const value = values[prompt] ?? ""
          const repeated =
            isLanguagePrompt(prompt) &&
            Boolean(value.trim()) &&
            prompts.some(
              (other) =>
                other !== prompt &&
                isLanguagePrompt(other) &&
                normalize(values[other] ?? "") === normalize(value),
            )
          const invalidAfterAttempt =
            showAttemptError && (!value.trim() || repeated)

          return (
            <label key={prompt} className="grid gap-1 text-xs text-textMuted">
              <span className={invalidAfterAttempt ? "text-danger" : ""}>
                {prompt} · obrigatório
              </span>
              <Input
                list={
                  isLanguagePrompt(prompt)
                    ? "character-creation-standard-languages"
                    : undefined
                }
                value={value}
                className={
                  invalidAfterAttempt ? "border-danger bg-dangerBg" : ""
                }
                placeholder={
                  isLanguagePrompt(prompt)
                    ? "Escolha um idioma ou digite outro"
                    : "Escolha uma opção ou digite a proficiência"
                }
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [prompt]: event.target.value,
                  }))
                }
              />
            </label>
          )
        })}
      </div>

      {showAttemptError ? (
        <div className="rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger">
          {externalError}
        </div>
      ) : null}
    </section>,
    anchor,
  )
}

function isBackgroundChoicePrompt(value: string): boolean {
  const normalized = normalize(value)

  return (
    /^(?:um |uma )?idioma adicional(?: \d+)?$/.test(normalized) ||
    /^(?:um |uma )?idioma(?: adicional)? a escolha$/.test(normalized) ||
    /^(?:uma )?ferramenta(?: de artesao)?(?: adicional)?(?: a escolha)?$/.test(
      normalized,
    ) ||
    /^(?:um )?instrumento(?: musical)?(?: adicional)?(?: a escolha)?$/.test(
      normalized,
    ) ||
    /^(?:um )?(?:conjunto de )?jogo(?: adicional)?(?: a escolha)?$/.test(
      normalized,
    ) ||
    /^(?:um |uma )?veiculo(?: adicional)?(?: a escolha)?$/.test(normalized) ||
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
