import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { SKILL_LABELS } from "../../../data/characterCreation/phbPresets"
import { STANDARD_LANGUAGES } from "../../../models/characters/BackgroundProficiencyChoice"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import {
  readCharacterCreationDraftSection,
  writeCharacterCreationDraftSection,
} from "./characterCreationDraftCache"

type GenericRacialChoiceOverride = {
  valid: boolean
  error?: string
  apply: (proficiencies: Proficiency[]) => {
    proficiencies: Proficiency[]
    skills: Skill[]
  }
}

type GenericRacialChoiceDraft = {
  raceName: string
  values: Record<string, string>
}

type Props = {
  draftId: string
  onChange: (override: GenericRacialChoiceOverride | null) => void
  externalError?: string
}

export function CharacterCreationGenericRacialChoices({
  draftId,
  onChange,
  externalError,
}: Props) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const initialDraft = useMemo(
    () =>
      readCharacterCreationDraftSection<GenericRacialChoiceDraft>(
        draftId,
        "racial-generic-choices",
      ),
    [draftId],
  )
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [prompts, setPrompts] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>(
    initialDraft?.values ?? {},
  )
  const [raceName, setRaceName] = useState(initialDraft?.raceName ?? "")

  useEffect(() => {
    writeCharacterCreationDraftSection(draftId, "racial-generic-choices", {
      raceName,
      values,
    } satisfies GenericRacialChoiceDraft)
  }, [draftId, raceName, values])

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const section = document.querySelector<HTMLElement>(
          '[data-character-creation-race-details="true"]',
        )
        if (!section) {
          setAnchor((current) => (current === null ? current : null))
          setPrompts((current) => (current.length ? [] : current))
          return
        }
        const nextRaceName = section.dataset.raceName ?? ""
        if (nextRaceName !== raceName) {
          setRaceName(nextRaceName)
          setValues({})
        }

        const detected = Array.from(
          section.querySelectorAll<HTMLElement>("div,span,strong"),
        )
          .map((entry) =>
            entry.childElementCount === 0
              ? entry.textContent?.trim() ?? ""
              : "",
          )
          .filter(isChoiceLabel)
          .filter((entry) => !isHandledBySpecificRace(entry, nextRaceName))
        const nextPrompts = Array.from(new Set(detected))
        setPrompts((current) =>
          sameStrings(current, nextPrompts) ? current : nextPrompts,
        )

        let portalAnchor = section.querySelector<HTMLElement>(
          "[data-generic-racial-choice-anchor]",
        )
        if (!portalAnchor) {
          portalAnchor = document.createElement("div")
          portalAnchor.dataset.genericRacialChoiceAnchor = "true"
          section.append(portalAnchor)
        }
        setAnchor((current) =>
          current === portalAnchor ? current : portalAnchor,
        )
      })
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document
        .querySelectorAll("[data-generic-racial-choice-anchor]")
        .forEach((entry) => entry.remove())
    }
  }, [raceName])

  const valid = prompts.every((prompt) => values[prompt]?.trim())
  const override = useMemo<GenericRacialChoiceOverride>(
    () => ({
      valid,
      error: valid
        ? undefined
        : "Complete as proficiências raciais marcadas como escolha obrigatória.",
      apply: (proficiencies) => {
        const skills: Skill[] = []
        const next = proficiencies.flatMap((entry) => {
          const prompt = prompts.find(
            (candidate) => normalize(candidate) === normalize(entry.name),
          )
          if (!prompt) return [entry]
          const value = values[prompt]?.trim()
          if (!value) return []
          if (entry.category === "skill") {
            const skill = value as Skill
            skills.push(skill)
            return [
              {
                ...entry,
                name: SKILL_LABELS[skill],
                notes: `Escolha racial que substitui: ${entry.name}.`,
              },
            ]
          }
          return [
            {
              ...entry,
              name: value,
              notes: `Escolha racial que substitui: ${entry.name}.`,
            },
          ]
        })
        return {
          proficiencies: deduplicate(next),
          skills: Array.from(new Set(skills)),
        }
      },
    }),
    [prompts, valid, values],
  )

  useEffect(() => {
    onChangeRef.current(override)
  }, [override])

  useEffect(() => {
    return () => onChangeRef.current(null)
  }, [])

  if (!anchor || !prompts.length) return null

  return createPortal(
    <section className="mt-4 grid gap-4 rounded-xl border border-warning bg-warningBg p-4">
      <div>
        <h3 className="text-sm font-semibold text-textH">
          Outras escolhas raciais obrigatórias
        </h3>
        <p className="mt-1 text-xs text-textMuted">
          Cada marcador genérico precisa ser substituído por uma proficiência concreta.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {prompts.map((prompt) => {
          const normalizedPrompt = normalize(prompt)
          if (normalizedPrompt.includes("pericia")) {
            return (
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
                  <option value="">Selecione uma perícia</option>
                  {Object.entries(SKILL_LABELS).map(([skill, label]) => (
                    <option key={skill} value={skill}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
            )
          }

          if (normalizedPrompt.includes("idioma")) {
            const listId = `racial-language-${normalizedPrompt.replace(/\s+/g, "-")}`
            return (
              <label key={prompt} className="grid gap-1 text-xs text-textMuted">
                {prompt}
                <datalist id={listId}>
                  {STANDARD_LANGUAGES.map((language) => (
                    <option key={language} value={language} />
                  ))}
                </datalist>
                <Input
                  list={listId}
                  value={values[prompt] ?? ""}
                  placeholder="Escolha um idioma ou digite outro"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [prompt]: event.target.value,
                    }))
                  }
                />
              </label>
            )
          }

          return (
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
          )
        })}
      </div>
      {externalError ? (
        <div className="rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger">
          {externalError}
        </div>
      ) : !valid ? (
        <div className="text-xs font-medium text-danger">
          Complete todas as escolhas acima.
        </div>
      ) : null}
    </section>,
    anchor,
  )
}

function isChoiceLabel(value: string): boolean {
  const normalized = normalize(value)
  return (
    normalized.includes("a escolha") ||
    normalized.startsWith("uma pericia") ||
    normalized.startsWith("duas pericias")
  )
}

function isHandledBySpecificRace(prompt: string, raceName: string): boolean {
  const race = normalize(raceName)
  const value = normalize(prompt)
  if (race.includes("humano variante") && value.includes("pericia")) return true
  if (race.includes("meio elfo") && value.includes("pericia")) return true
  return false
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

export type { GenericRacialChoiceOverride }
