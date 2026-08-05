import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Input } from "../../../components/ui/Input"
import { PHB_BACKGROUND_PRESETS } from "../../../data/characterCreation/phbPresets"
import {
  getBackgroundProficiencyChoices,
  type BackgroundProficiencyChoice,
} from "../../../models/characters/BackgroundProficiencyChoice"
import type { Proficiency } from "../../../models/sheet/Proficiency"

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
  const [backgroundId, setBackgroundId] = useState<string | undefined>()
  const [choices, setChoices] = useState<BackgroundProficiencyChoice[]>([])
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
        const presetButtons = Array.from(
          presetSection?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        )
        const selectedButton = presetButtons.find(isSelectedButton)
        const selectedPreset = selectedButton
          ? PHB_BACKGROUND_PRESETS.find((preset) =>
              normalize(selectedButton.textContent ?? "").startsWith(
                normalize(preset.name),
              ),
            )
          : undefined
        const customSelected =
          normalize(selectedButton?.textContent ?? "").startsWith(
            "personalizado",
          ) || selectedPreset?.custom === true

        setPresetLocked(!customSelected)
        setBackgroundId(selectedPreset?.id)

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
    const nextChoices = getBackgroundProficiencyChoices(backgroundId)
    setChoices(nextChoices)
    setValues((current) =>
      Object.fromEntries(
        nextChoices.map((choice) => [
          choice.proficiencyId,
          current[choice.proficiencyId] ?? "",
        ]),
      ),
    )
  }, [backgroundId])

  const valid = choices.every((choice) =>
    values[choice.proficiencyId]?.trim(),
  )
  const duplicateLanguage = choices.some((choice, index) => {
    if (choice.category !== "language") return false
    const value = normalize(values[choice.proficiencyId] ?? "")
    if (!value) return false

    return choices.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.category === "language" &&
        normalize(values[other.proficiencyId] ?? "") === value,
    )
  })
  const fullyValid = valid && !duplicateLanguage

  const override = useMemo<BackgroundChoiceOverride>(
    () => ({
      valid: fullyValid,
      error: !valid
        ? "Complete todas as escolhas obrigatórias do antecedente."
        : duplicateLanguage
          ? "Escolha idiomas diferentes para cada proficiência adicional."
          : undefined,
      apply: (proficiencies) =>
        deduplicate(
          proficiencies.flatMap((entry) => {
            const choice = choices.find(
              (candidate) => candidate.proficiencyId === entry.id,
            )
            if (!choice) return [entry]

            const value = values[choice.proficiencyId]?.trim()
            if (!value) return []

            return [
              {
                ...entry,
                name: value,
                category: choice.category,
                notes: mergeNotes(
                  entry.notes,
                  `Escolha do antecedente que substitui: ${entry.name}.`,
                ),
              },
            ]
          }),
        ),
    }),
    [choices, duplicateLanguage, fullyValid, valid, values],
  )

  useEffect(() => {
    onChange(override)
  }, [onChange, override])

  if (!anchor || !choices.length) return null

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
          Somente proficiências explicitamente marcadas pelo antecedente como
          escolhas aparecem aqui. Proficiências fixas são concedidas sem edição.
        </p>
        {presetLocked ? (
          <p className="mt-1 text-xs text-textMuted">
            As perícias do preset permanecem bloqueadas. Para alterá-las,
            selecione o antecedente personalizado.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const value = values[choice.proficiencyId] ?? ""
          const repeated =
            choice.category === "language" &&
            Boolean(value.trim()) &&
            choices.some(
              (other) =>
                other.proficiencyId !== choice.proficiencyId &&
                other.category === "language" &&
                normalize(values[other.proficiencyId] ?? "") ===
                  normalize(value),
            )
          const invalidAfterAttempt =
            showAttemptError && (!value.trim() || repeated)
          const listId = choice.options?.length
            ? `background-choice-${choice.proficiencyId}`
            : undefined

          return (
            <label
              key={choice.proficiencyId}
              className="grid gap-1 text-xs text-textMuted"
            >
              <span className={invalidAfterAttempt ? "text-danger" : ""}>
                {choice.label} · obrigatório
              </span>
              {listId ? (
                <datalist id={listId}>
                  {choice.options?.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              ) : null}
              <Input
                list={listId}
                value={value}
                className={
                  invalidAfterAttempt ? "border-danger bg-dangerBg" : ""
                }
                placeholder={
                  choice.allowCustom
                    ? "Escolha uma opção ou digite outra"
                    : "Escolha uma opção"
                }
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [choice.proficiencyId]: event.target.value,
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

function isSelectedButton(button: HTMLButtonElement): boolean {
  return (
    button.classList.contains("border-accentBorder") ||
    button.classList.contains("bg-accentBg")
  )
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export type { BackgroundChoiceOverride }
