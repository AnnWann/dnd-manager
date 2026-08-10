import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import { SKILL_LABELS } from "../../../data/characterCreation/phbPresets"
import type { Ability } from "../../../models/abilities/Ability"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
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

const DEFAULT_FEATS = [
  ["Alerta", "Recebe treinamento excepcional para reagir rapidamente e evitar ser surpreendido."],
  ["Atirador de Elite", "Aprimora ataques com armas à distância e permite assumir penalidade para causar dano adicional."],
  ["Conjurador de Guerra", "Aprimora concentração, componentes somáticos e conjuração em ataques de oportunidade."],
  ["Durável", "Aumenta Constituição e melhora a recuperação com Dados de Vida."],
  ["Especialista em Perícia", "Concede uma perícia, especialização e aumento de atributo conforme a regra do talento."],
  ["Grande Mestre de Armas", "Aprimora ataques com armas pesadas e concede ataque adicional em determinadas situações."],
  ["Iniciado em Magia", "Concede truques e uma magia de 1º nível de uma lista escolhida."],
  ["Líder Inspirador", "Permite conceder pontos de vida temporários após um discurso inspirador."],
  ["Móvel", "Aumenta deslocamento e facilita reposicionamento após ataques corpo a corpo."],
  ["Resiliente", "Aumenta um atributo e concede proficiência na salvaguarda correspondente."],
  ["Sentinela", "Aprimora ataques de oportunidade e controle de inimigos próximos."],
  ["Sortudo", "Concede pontos de sorte para repetir jogadas importantes."],
] as const

type RacialChoicesDraft = {
  raceName: string
  skillOne: Skill
  skillTwo: Skill
  featName: string
  customFeatName: string
  customFeatDescription: string
  cantripIndex: string
  ancestry: string
  genericChoices: Record<string, string>
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
  const { spells } = useMagicContext()
  const initialDraft = useMemo(
    () =>
      readCharacterCreationDraftSection<RacialChoicesDraft>(
        draftId,
        "racial-required-choices",
      ),
    [draftId],
  )
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [raceName, setRaceName] = useState(initialDraft?.raceName ?? "")
  const [skillOne, setSkillOne] = useState<Skill>(
    initialDraft?.skillOne ?? "perception",
  )
  const [skillTwo, setSkillTwo] = useState<Skill>(
    initialDraft?.skillTwo ?? "stealth",
  )
  const [featName, setFeatName] = useState(initialDraft?.featName ?? "")
  const [customFeatName, setCustomFeatName] = useState(
    initialDraft?.customFeatName ?? "",
  )
  const [customFeatDescription, setCustomFeatDescription] = useState(
    initialDraft?.customFeatDescription ?? "",
  )
  const [cantripIndex, setCantripIndex] = useState(
    initialDraft?.cantripIndex ?? "",
  )
  const [ancestry, setAncestry] = useState(initialDraft?.ancestry ?? "")
  const [genericChoices, setGenericChoices] = useState<Record<string, string>>(
    initialDraft?.genericChoices ?? {},
  )

  useEffect(() => {
    writeCharacterCreationDraftSection(draftId, "racial-required-choices", {
      raceName,
      skillOne,
      skillTwo,
      featName,
      customFeatName,
      customFeatDescription,
      cantripIndex,
      ancestry,
      genericChoices,
    } satisfies RacialChoicesDraft)
  }, [
    ancestry,
    cantripIndex,
    customFeatDescription,
    customFeatName,
    draftId,
    featName,
    genericChoices,
    raceName,
    skillOne,
    skillTwo,
  ])

  const wizardCantrips = useMemo(
    () =>
      spells
        .filter((spell) => spell.slotLevel === 0 && spell.classes.includes("wizard"))
        .toSorted((left, right) => spellLabel(left).localeCompare(spellLabel(right), "pt-BR")),
    [spells],
  )

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
          (entry) => entry.textContent?.trim() === "Construir características raciais",
        )
        const section = heading?.closest<HTMLElement>("section")
        if (!section) {
          setAnchor(null)
          return
        }
        const nameInput = Array.from(section.querySelectorAll<HTMLInputElement>("input")).find(
          (input) => input.closest("label")?.textContent?.includes("Nome da raça"),
        )
        if (nameInput?.value && nameInput.value !== raceName) {
          setRaceName(nameInput.value)
          setFeatName("")
          setCustomFeatName("")
          setCustomFeatDescription("")
          setCantripIndex("")
          setAncestry("")
          setGenericChoices({})
        }
        let portalAnchor = section.querySelector<HTMLElement>("[data-racial-choice-anchor]")
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
      document.querySelectorAll("[data-racial-choice-anchor]").forEach((entry) => entry.remove())
    }
  }, [raceName])

  const normalizedRace = normalize(raceName)
  const variantHuman = normalizedRace.includes("humano variante")
  const halfElf = normalizedRace.includes("meio elfo")
  const highElf = normalizedRace.includes("alto elfo")
  const dragonborn = normalizedRace.includes("draconato")
  const feat = featName === "custom" ? customFeatName.trim() : featName
  const needsChoice = variantHuman || halfElf || highElf || dragonborn
  const valid =
    (!variantHuman || Boolean(feat && skillOne)) &&
    (!halfElf || Boolean(skillOne && skillTwo && skillOne !== skillTwo)) &&
    (!highElf || Boolean(cantripIndex)) &&
    (!dragonborn || Boolean(ancestry)) &&
    Object.values(genericChoices).every((value) => value.trim().length > 0)

  useEffect(() => {
    const error = valid
      ? undefined
      : "Complete todas as escolhas obrigatórias da raça antes de criar o personagem."
    onChange({
      valid,
      error,
      apply: (abilities, proficiencies) => {
        let nextAbilities = abilities.map((ability) => ({ ...ability }))
        let nextProficiencies = proficiencies.map((entry) => ({ ...entry }))
        const skills: Skill[] = []

        if (variantHuman) {
          nextAbilities = nextAbilities.filter(
            (ability) => !normalize(ability.name).includes("talento inicial"),
          )
          nextAbilities.push({
            id: `racial-feat-${slug(feat)}`,
            name: feat,
            description:
              featName === "custom"
                ? customFeatDescription.trim() || "Talento racial personalizado."
                : DEFAULT_FEATS.find(([name]) => name === feat)?.[1] ?? "Talento inicial do Humano Variante.",
            kind: "feature",
            category: "feat",
            source: "race",
          })
          skills.push(skillOne)
        }

        if (halfElf) {
          skills.push(skillOne, skillTwo)
        }

        if (highElf) {
          const cantrip = spells.find((spell) => spell.index === cantripIndex)
          nextAbilities = nextAbilities.map((ability) =>
            normalize(ability.name).includes("truque de alto elfo")
              ? {
                  ...ability,
                  name: cantrip ? `Truque de Alto Elfo: ${spellLabel(cantrip)}` : ability.name,
                  description: cantrip?.description || ability.description,
                  grantedSpells: cantrip
                    ? [{ index: cantrip.index, castingMode: "known", attribute: "int" }]
                    : ability.grantedSpells,
                }
              : ability,
          )
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

        let genericIndex = 0
        nextProficiencies = nextProficiencies.flatMap((entry) => {
          if (!isChoiceProficiency(entry.name)) return [entry]
          if (entry.category === "skill") return []
          const choice = genericChoices[String(genericIndex++)]?.trim()
          return choice ? [{ ...entry, name: choice, notes: `Escolha racial que substitui: ${entry.name}.` }] : []
        })

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
  }, [ancestry, cantripIndex, customFeatDescription, feat, featName, genericChoices, halfElf, highElf, dragonborn, onChange, skillOne, skillTwo, spells, valid, variantHuman])

  if (!anchor || !needsChoice) return null

  return createPortal(
    <section className="mt-4 grid gap-4 rounded-xl border border-warning bg-warningBg p-4">
      <div>
        <h3 className="text-sm font-semibold text-textH">Escolhas raciais obrigatórias</h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Estas escolhas substituem os marcadores genéricos e serão gravadas como características e proficiências concretas.
        </p>
      </div>

      {variantHuman || halfElf ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SkillSelect label={halfElf ? "Primeira perícia" : "Perícia adicional"} value={skillOne} onChange={setSkillOne} />
          {halfElf ? <SkillSelect label="Segunda perícia" value={skillTwo} onChange={setSkillTwo} blocked={[skillOne]} /> : null}
        </div>
      ) : null}

      {variantHuman ? (
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs text-textMuted">
            Talento inicial
            <Select value={featName} onChange={(event) => setFeatName(event.target.value)}>
              <option value="">Selecione um talento</option>
              {DEFAULT_FEATS.map(([name]) => <option key={name} value={name}>{name}</option>)}
              <option value="custom">Talento personalizado</option>
            </Select>
          </label>
          {featName === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-textMuted">
                Nome do talento
                <Input value={customFeatName} onChange={(event) => setCustomFeatName(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-textMuted">
                Descrição
                <Input value={customFeatDescription} onChange={(event) => setCustomFeatDescription(event.target.value)} />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {highElf ? (
        <label className="grid gap-1 text-xs text-textMuted">
          Truque de Mago
          <Select value={cantripIndex} onChange={(event) => setCantripIndex(event.target.value)}>
            <option value="">Selecione um truque</option>
            {wizardCantrips.map((spell) => <option key={spell.index} value={spell.index}>{spellLabel(spell)}</option>)}
          </Select>
        </label>
      ) : null}

      {dragonborn ? (
        <label className="grid gap-1 text-xs text-textMuted">
          Ancestral dracônico
          <Select value={ancestry} onChange={(event) => setAncestry(event.target.value)}>
            <option value="">Selecione uma linhagem</option>
            {DRACONIC_ANCESTRIES.map(([name, damage]) => <option key={name} value={name}>{name} · {damage}</option>)}
          </Select>
        </label>
      ) : null}

      {externalError ? (
        <div className="rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger">{externalError}</div>
      ) : !valid ? (
        <div className="text-xs font-medium text-danger">Complete todas as escolhas obrigatórias.</div>
      ) : null}
    </section>,
    anchor,
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
      <Select value={value} onChange={(event) => onChange(event.target.value as Skill)}>
        {Object.entries(SKILL_LABELS).map(([skill, name]) => (
          <option key={skill} value={skill} disabled={blocked.includes(skill as Skill)}>{name}</option>
        ))}
      </Select>
    </label>
  )
}

function isChoiceProficiency(name: string): boolean {
  const value = normalize(name)
  return value.includes("a escolha") || value.startsWith("uma pericia") || value.startsWith("duas pericias")
}

function deduplicateAbilities(abilities: Ability[]): Ability[] {
  const seen = new Set<string>()
  return abilities.filter((entry) => !seen.has(entry.id) && Boolean(seen.add(entry.id)))
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

function spellLabel(spell: { name: string; displayName?: string }): string {
  return spell.displayName?.trim() || spell.name
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
