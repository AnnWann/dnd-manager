import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Select } from "../../../components/ui/Select"
import { SKILL_LABELS } from "../../../data/characterCreation/phbPresets"
import type { Ability } from "../../../models/abilities/Ability"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import { AbilityDialog } from "../abilities/abilityDialog"
import {
  readCharacterCreationDraftSection,
  writeCharacterCreationDraftSection,
} from "./characterCreationDraftCache"

const DRACONIC_ANCESTRIES = [
  ["Preto", "ácido"],
  ["Azul", "elétrico"],
  ["Latão", "fogo"],
  ["Bronze", "elétrico"],
  ["Cobre", "ácido"],
  ["Ouro", "fogo"],
  ["Verde", "veneno"],
  ["Vermelho", "fogo"],
  ["Prata", "frio"],
  ["Branco", "frio"],
] as const

type RacialChoicesDraft = {
  raceName: string
  racePresetId?: string
  skillOne: Skill
  skillTwo: Skill
  featAbility?: Ability
  /** Legacy draft fields kept only so older cached feats can still migrate. */
  featName?: string
  customFeatName?: string
  customFeatDescription?: string
  cantripIndex?: string
  ancestry: string
}

type Override = {
  valid: boolean
  error?: string
  apply: (abilities: Ability[], proficiencies: Proficiency[]) => {
    abilities: Ability[]
    proficiencies: Proficiency[]
    skills: Skill[]
  }
}

type Props = {
  draftId: string
  onChange: (override: Override | null) => void
  externalError?: string
}

export function CharacterCreationRacialChoices({
  draftId,
  onChange,
  externalError,
}: Props) {
  const initialDraft = useMemo(
    () =>
      readCharacterCreationDraftSection<RacialChoicesDraft>(
        draftId,
        "racial-required-choices",
      ),
    [draftId],
  )
  const initialFeatAbility = useMemo(
    () => initialDraft?.featAbility ?? migrateLegacyFeat(initialDraft),
    [initialDraft],
  )
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [raceName, setRaceName] = useState(initialDraft?.raceName ?? "")
  const [racePresetId, setRacePresetId] = useState(
    initialDraft?.racePresetId ?? "",
  )
  const [skillOne, setSkillOne] = useState<Skill>(
    initialDraft?.skillOne ?? "perception",
  )
  const [skillTwo, setSkillTwo] = useState<Skill>(
    initialDraft?.skillTwo ?? "stealth",
  )
  const [featAbility, setFeatAbility] = useState<Ability | undefined>(
    initialFeatAbility,
  )
  const [featDialogOpen, setFeatDialogOpen] = useState(false)
  const [ancestry, setAncestry] = useState(initialDraft?.ancestry ?? "")

  useEffect(() => {
    writeCharacterCreationDraftSection(draftId, "racial-required-choices", {
      raceName,
      racePresetId,
      skillOne,
      skillTwo,
      featAbility,
      ancestry,
    } satisfies RacialChoicesDraft)
  }, [
    ancestry,
    draftId,
    featAbility,
    raceName,
    racePresetId,
    skillOne,
    skillTwo,
  ])

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const section = document.querySelector<HTMLElement>(
          '[data-character-creation-race-details="true"]',
        )
        if (!section) {
          setAnchor(null)
          return
        }
        const nextRaceName = section.dataset.raceName ?? ""
        const nextPresetId = section.dataset.racePresetId ?? ""
        const presetChanged = Boolean(racePresetId) && nextPresetId !== racePresetId
        if (nextRaceName !== raceName || presetChanged) {
          setRaceName(nextRaceName)
          setFeatAbility(undefined)
          setFeatDialogOpen(false)
          setAncestry("")
        }
        if (nextPresetId !== racePresetId) setRacePresetId(nextPresetId)
        let portalAnchor = section.querySelector<HTMLElement>(
          "[data-racial-choice-anchor]",
        )
        if (!portalAnchor) {
          portalAnchor = document.createElement("div")
          portalAnchor.dataset.racialChoiceAnchor = "true"
          section.append(portalAnchor)
        }
        setAnchor(portalAnchor)
      })
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document
        .querySelectorAll("[data-racial-choice-anchor]")
        .forEach((entry) => entry.remove())
    }
  }, [raceName, racePresetId])

  const normalizedRace = normalize(raceName)
  const usesPresetSpecificChoices = racePresetId !== "custom"
  const variantHuman =
    usesPresetSpecificChoices && normalizedRace.includes("humano variante")
  const halfElf =
    usesPresetSpecificChoices && normalizedRace.includes("meio elfo")
  const dragonborn =
    usesPresetSpecificChoices && normalizedRace.includes("draconato")
  const needsChoice = variantHuman || halfElf || dragonborn
  const valid =
    (!variantHuman || Boolean(featAbility?.name.trim() && skillOne)) &&
    (!halfElf || Boolean(skillOne && skillTwo && skillOne !== skillTwo)) &&
    (!dragonborn || Boolean(ancestry))

  useEffect(() => {
    const error = valid
      ? undefined
      : "Complete todas as escolhas obrigatórias da raça antes de criar o personagem."
    onChange({
      valid,
      error,
      apply: (abilities, proficiencies) => {
        let nextAbilities = abilities.map((ability) => ({ ...ability }))
        const nextProficiencies = proficiencies.map((entry) => ({ ...entry }))
        const skills: Skill[] = []

        if (variantHuman) {
          nextAbilities = nextAbilities.filter(
            (ability) => !normalize(ability.name).includes("talento inicial"),
          )
          if (featAbility) {
            nextAbilities.push({
              ...featAbility,
              kind: "feature",
              category: "feat",
              source: "race",
            })
          }
          skills.push(skillOne)
        }

        if (halfElf) {
          skills.push(skillOne, skillTwo)
        }

        if (dragonborn) {
          const selected = DRACONIC_ANCESTRIES.find(([name]) => name === ancestry)
          const damage = selected?.[1] ?? "elemental"
          nextAbilities = nextAbilities.map((ability) => {
            const name = normalize(ability.name)
            if (name.includes("ancestral draconico")) {
              return {
                ...ability,
                name: `Ancestral Dracônico: ${ancestry}`,
                description: `A linhagem dracônica escolhida é ${ancestry}, associada a dano de ${damage}.`,
              }
            }
            if (name.includes("arma de sopro")) {
              return {
                ...ability,
                description: `Expele energia de ${damage} conforme a forma e a salvaguarda da linhagem ${ancestry}.`,
              }
            }
            if (name.includes("resistencia draconica")) {
              return {
                ...ability,
                description: `Possui resistência a dano de ${damage}, concedida pela linhagem ${ancestry}.`,
              }
            }
            return ability
          })
        }

        for (const skill of Array.from(new Set(skills))) {
          nextProficiencies.push({
            id: `racial-skill-${skill}`,
            name: SKILL_LABELS[skill],
            category: "skill",
            notes: "Perícia escolhida durante a criação da raça.",
          })
        }

        return {
          abilities: deduplicateAbilities(nextAbilities),
          proficiencies: deduplicateProficiencies(nextProficiencies),
          skills: Array.from(new Set(skills)),
        }
      },
    })
    return () => onChange(null)
  }, [
    ancestry,
    featAbility,
    halfElf,
    dragonborn,
    onChange,
    skillOne,
    skillTwo,
    valid,
    variantHuman,
  ])

  if (!anchor || !needsChoice) return null

  return (
    <>
      {createPortal(
        <section className="mt-4 grid gap-4 rounded-xl border border-warning bg-warningBg p-4">
          <div>
            <h3 className="text-sm font-semibold text-textH">
              Escolhas raciais obrigatórias
            </h3>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Estas escolhas substituem os marcadores genéricos e serão gravadas como características e proficiências concretas.
            </p>
          </div>

          {variantHuman || halfElf ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SkillSelect
                label={halfElf ? "Primeira perícia" : "Perícia adicional"}
                value={skillOne}
                onChange={setSkillOne}
              />
              {halfElf ? (
                <SkillSelect
                  label="Segunda perícia"
                  value={skillTwo}
                  onChange={setSkillTwo}
                  blocked={[skillOne]}
                />
              ) : null}
            </div>
          ) : null}

          {variantHuman ? (
            <section className="grid gap-3 rounded-xl border border-border bg-bg p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-textH">
                    Talento inicial
                  </div>
                  <div className="mt-1 text-[11px] text-textMuted">
                    Configure o talento como uma Ability completa.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setFeatDialogOpen(true)}
                >
                  {featAbility ? "Editar talento" : "Adicionar talento"}
                </Button>
              </div>
              {featAbility ? (
                <div className="rounded-lg border border-border bg-bg-subtle p-3">
                  <div className="text-sm font-medium text-textH">
                    {featAbility.name}
                  </div>
                  {featAbility.description?.trim() ? (
                    <p className="mt-1 line-clamp-3 break-words text-xs leading-5 text-textMuted [overflow-wrap:anywhere]">
                      {featAbility.description}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-danger">
                  Adicione o talento concedido por esta raça.
                </div>
              )}
            </section>
          ) : null}

          {dragonborn ? (
            <label className="grid gap-1 text-xs text-textMuted">
              Ancestral dracônico
              <Select
                value={ancestry}
                onChange={(event) => setAncestry(event.target.value)}
              >
                <option value="">Selecione uma linhagem</option>
                {DRACONIC_ANCESTRIES.map(([name, damage]) => (
                  <option key={name} value={name}>
                    {name} · {damage}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          {externalError ? (
            <div className="rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger">
              {externalError}
            </div>
          ) : !valid ? (
            <div className="text-xs font-medium text-danger">
              Complete todas as escolhas obrigatórias.
            </div>
          ) : null}
        </section>,
        anchor,
      )}

      <AbilityDialog
        open={featDialogOpen}
        ability={featAbility ?? null}
        title={featAbility ? "Editar talento racial" : "Adicionar talento racial"}
        fixedCategory="feat"
        onClose={() => setFeatDialogOpen(false)}
        onSave={(ability) => {
          setFeatAbility({
            ...ability,
            kind: "feature",
            category: "feat",
            source: "race",
          })
          setFeatDialogOpen(false)
        }}
      />
    </>
  )
}

function SkillSelect({
  label,
  value,
  onChange,
  blocked = [],
}: {
  label: string
  value: Skill
  onChange: (value: Skill) => void
  blocked?: Skill[]
}) {
  return (
    <label className="grid gap-1 text-xs text-textMuted">
      {label}
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value as Skill)}
      >
        {Object.entries(SKILL_LABELS).map(([skill, name]) => (
          <option
            key={skill}
            value={skill}
            disabled={blocked.includes(skill as Skill)}
          >
            {name}
          </option>
        ))}
      </Select>
    </label>
  )
}

function migrateLegacyFeat(
  draft: RacialChoicesDraft | undefined,
): Ability | undefined {
  const name =
    draft?.featName === "custom"
      ? draft.customFeatName?.trim()
      : draft?.featName?.trim()
  if (!name) return undefined
  return {
    id: `racial-feat-${slug(name)}`,
    name,
    description:
      draft?.customFeatDescription?.trim() ||
      "Talento racial configurado durante a criação do personagem.",
    kind: "feature",
    category: "feat",
    source: "race",
  }
}

function deduplicateAbilities(abilities: Ability[]): Ability[] {
  const seen = new Set<string>()
  return abilities.filter(
    (entry) => !seen.has(entry.id) && Boolean(seen.add(entry.id)),
  )
}

function deduplicateProficiencies(entries: Proficiency[]): Proficiency[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.category}:${normalize(entry.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function slug(value: string): string {
  return normalize(value).replace(/\s+/g, "-") || "feat"
}

export type { Override as RacialChoiceOverride }
