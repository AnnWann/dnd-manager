import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

type BonusMode = "fixed" | "variant" | "flex21" | "flex111" | "custom"
type ScoreMode = "standard" | "roll" | "point-buy"

type AbilityScoreOverride = {
  attributes: Record<Attribute, number>
  racialBonuses: Partial<Record<Attribute, number>>
}

type Props = {
  onChange: (override: AbilityScoreOverride | null) => void
}

export function CharacterCreationAbilityScoreRules({ onChange }: Props) {
  const [raceAnchor, setRaceAnchor] = useState<HTMLElement | null>(null)
  const [attributeAnchor, setAttributeAnchor] = useState<HTMLElement | null>(null)
  const [raceInputs, setRaceInputs] = useState<Record<Attribute, HTMLInputElement> | null>(null)
  const [attributeInputs, setAttributeInputs] = useState<Record<Attribute, HTMLInputElement> | null>(null)
  const [raceName, setRaceName] = useState("")
  const [racialBonuses, setRacialBonuses] = useState<Partial<Record<Attribute, number>>>({})
  const [attributes, setAttributes] = useState<Record<Attribute, number>>({
    str: 15,
    dex: 14,
    con: 13,
    int: 12,
    wis: 10,
    cha: 8,
  })

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const raceHeading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
          (entry) => entry.textContent?.trim() === "Construir características raciais",
        )
        const raceSection = raceHeading?.closest<HTMLElement>("section")
        if (raceSection) {
          const inputs = findLabeledInputs(raceSection, "Bônus de")
          if (inputs) {
            const nameInput = Array.from(raceSection.querySelectorAll<HTMLInputElement>("input")).find(
              (input) => input.closest("label")?.textContent?.includes("Nome da raça"),
            )
            const nextName = nameInput?.value ?? ""
            if (nextName && nextName !== raceName) {
              setRaceName(nextName)
              const current = readValues(inputs)
              setRacialBonuses(current)
            }
            const grid = inputs.str.closest("div")?.parentElement
            if (grid instanceof HTMLElement) grid.style.display = "none"
            let anchor = raceSection.querySelector<HTMLElement>("[data-racial-bonus-rules-anchor]")
            if (!anchor) {
              anchor = document.createElement("div")
              anchor.dataset.racialBonusRulesAnchor = "true"
              grid?.parentElement?.insertBefore(anchor, grid.nextSibling)
            }
            setRaceInputs(inputs)
            setRaceAnchor(anchor)
          }
        } else {
          setRaceAnchor(null)
        }

        const attributeHeading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
          (entry) => entry.textContent?.trim() === "Atributos",
        )
        const attributeSection = attributeHeading?.closest<HTMLElement>("section")
        if (attributeSection) {
          const inputs = findAttributeInputs(attributeSection)
          if (inputs) {
            const cardGrid = inputs.str.closest("article")?.parentElement
            if (cardGrid instanceof HTMLElement) cardGrid.style.display = "none"
            const recommendedButton = Array.from(attributeSection.querySelectorAll<HTMLButtonElement>("button")).find(
              (button) => button.textContent?.includes("atributos recomendados"),
            )
            if (recommendedButton) recommendedButton.style.display = "none"
            let anchor = attributeSection.querySelector<HTMLElement>("[data-ability-score-rules-anchor]")
            if (!anchor) {
              anchor = document.createElement("div")
              anchor.dataset.abilityScoreRulesAnchor = "true"
              attributeHeading?.parentElement?.insertBefore(anchor, attributeHeading.nextSibling)
            }
            setAttributeInputs(inputs)
            setAttributeAnchor(anchor)
          }
        } else {
          setAttributeAnchor(null)
        }
      })
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.querySelectorAll<HTMLElement>("[data-racial-bonus-rules-anchor], [data-ability-score-rules-anchor]").forEach((entry) => entry.remove())
    }
  }, [raceName])

  useEffect(() => {
    if (!raceInputs) return
    writeValues(raceInputs, racialBonuses)
  }, [raceInputs, racialBonuses])

  useEffect(() => {
    if (!attributeInputs) return
    writeValues(attributeInputs, attributes)
  }, [attributeInputs, attributes])

  useEffect(() => {
    onChange({ attributes, racialBonuses })
    return () => onChange(null)
  }, [attributes, onChange, racialBonuses])

  return (
    <>
      {raceAnchor
        ? createPortal(
            <RacialBonusRules
              raceName={raceName}
              initial={racialBonuses}
              onChange={setRacialBonuses}
            />,
            raceAnchor,
          )
        : null}
      {attributeAnchor
        ? createPortal(
            <AbilityScoreRules
              values={attributes}
              racialBonuses={racialBonuses}
              onChange={setAttributes}
            />,
            attributeAnchor,
          )
        : null}
    </>
  )
}

function RacialBonusRules({
  raceName,
  initial,
  onChange,
}: {
  raceName: string
  initial: Partial<Record<Attribute, number>>
  onChange: (value: Partial<Record<Attribute, number>>) => void
}) {
  const inferred = inferBonusMode(raceName, initial)
  const [mode, setMode] = useState<BonusMode>(inferred)
  const [fixed] = useState({ ...initial })
  const [first, setFirst] = useState<Attribute>("str")
  const [second, setSecond] = useState<Attribute>("dex")
  const [third, setThird] = useState<Attribute>("con")
  const [custom, setCustom] = useState<Partial<Record<Attribute, number>>>({ ...initial })

  useEffect(() => {
    if (mode === "fixed") onChange({ ...fixed })
    if (mode === "variant") onChange(distribute([[first, 1], [second, 1]]))
    if (mode === "flex21") onChange(distribute([[first, 2], [second, 1]]))
    if (mode === "flex111") onChange(distribute([[first, 1], [second, 1], [third, 1]]))
    if (mode === "custom") onChange({ ...custom })
  }, [custom, first, fixed, mode, onChange, second, third])

  return (
    <section className="mt-4 grid gap-4 rounded-xl border border-border bg-bg p-4">
      <div>
        <h3 className="text-sm font-semibold text-textH">Regra de bônus raciais</h3>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Escolha os bônus fixos da raça ou uma distribuição móvel. Atributos repetidos não são permitidos nas distribuições móveis.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <ModeButton active={mode === "fixed"} label="Predefinidos" onClick={() => setMode("fixed")} />
        <ModeButton active={mode === "variant"} label="+1 / +1" onClick={() => setMode("variant")} />
        <ModeButton active={mode === "flex21"} label="Móveis +2 / +1" onClick={() => setMode("flex21")} />
        <ModeButton active={mode === "flex111"} label="Móveis +1 / +1 / +1" onClick={() => setMode("flex111")} />
        <ModeButton active={mode === "custom"} label="Personalizados" onClick={() => setMode("custom")} />
      </div>

      {mode === "variant" || mode === "flex21" || mode === "flex111" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <AttributeSelect label={mode === "flex21" ? "Bônus +2" : "Primeiro +1"} value={first} onChange={setFirst} />
          <AttributeSelect label="Segundo +1" value={second} onChange={setSecond} blocked={[first]} />
          {mode === "flex111" ? (
            <AttributeSelect label="Terceiro +1" value={third} onChange={setThird} blocked={[first, second]} />
          ) : null}
        </div>
      ) : null}

      {mode === "custom" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <label key={attribute} className="grid gap-1 text-xs text-textMuted">
              {ATTRIBUTE_LABELS[attribute]}
              <Input
                type="number"
                min={0}
                max={4}
                value={custom[attribute] ?? 0}
                onChange={(event) =>
                  setCustom((current) => ({
                    ...current,
                    [attribute]: Math.max(0, Math.min(4, Math.trunc(Number(event.target.value) || 0))),
                  }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function AbilityScoreRules({
  values,
  racialBonuses,
  onChange,
}: {
  values: Record<Attribute, number>
  racialBonuses: Partial<Record<Attribute, number>>
  onChange: (value: Record<Attribute, number>) => void
}) {
  const [mode, setMode] = useState<ScoreMode>("standard")
  const [rolled, setRolled] = useState<number[]>(() => rollAbilityScores())
  const [assignment, setAssignment] = useState<Record<Attribute, number>>({
    str: 0,
    dex: 1,
    con: 2,
    int: 3,
    wis: 4,
    cha: 5,
  })
  const [pointBuy, setPointBuy] = useState<Record<Attribute, number>>({
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
  })

  useEffect(() => {
    if (mode === "standard") {
      onChange(mapPool(STANDARD_ARRAY, assignment))
    } else if (mode === "roll") {
      onChange(mapPool(rolled, assignment))
    } else {
      onChange(pointBuy)
    }
  }, [assignment, mode, onChange, pointBuy, rolled])

  const spent = ATTRIBUTE_KEYS.reduce((sum, attribute) => sum + POINT_BUY_COST[pointBuy[attribute]], 0)

  return (
    <section className="mt-4 grid gap-4 rounded-xl border border-border bg-bg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-textH">Método de atributos</h3>
          <p className="mt-1 text-xs text-textMuted">Escolha matriz padrão, rolagem 4d6 descartando o menor ou compra por 27 pontos.</p>
        </div>
        {mode === "roll" ? (
          <Button variant="secondary" onClick={() => setRolled(rollAbilityScores())}>Rolar novamente</Button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ModeButton active={mode === "standard"} label="Matriz padrão" onClick={() => setMode("standard")} />
        <ModeButton active={mode === "roll"} label="Rolagem" onClick={() => setMode("roll")} />
        <ModeButton active={mode === "point-buy"} label="Compra por pontos" onClick={() => setMode("point-buy")} />
      </div>

      {mode === "point-buy" ? (
        <div>
          <div className={spent > 27 ? "mb-3 rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger" : "mb-3 rounded-lg border border-accentBorder bg-accentBg p-3 text-xs text-textH"}>
            Pontos gastos: {spent}/27 · restantes: {27 - spent}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ATTRIBUTE_KEYS.map((attribute) => (
              <ScoreCard key={attribute} attribute={attribute} base={pointBuy[attribute]} bonus={racialBonuses[attribute] ?? 0}>
                <Select
                  value={pointBuy[attribute]}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    const nextSpent = spent - POINT_BUY_COST[pointBuy[attribute]] + POINT_BUY_COST[next]
                    if (nextSpent > 27) return
                    setPointBuy((current) => ({ ...current, [attribute]: next }))
                  }}
                >
                  {Object.keys(POINT_BUY_COST).map((entry) => (
                    <option key={entry} value={entry}>{entry} ({POINT_BUY_COST[Number(entry)]} pts)</option>
                  ))}
                </Select>
              </ScoreCard>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ATTRIBUTE_KEYS.map((attribute) => {
            const pool = mode === "standard" ? STANDARD_ARRAY : rolled
            return (
              <ScoreCard key={attribute} attribute={attribute} base={pool[assignment[attribute]]} bonus={racialBonuses[attribute] ?? 0}>
                <Select
                  value={assignment[attribute]}
                  onChange={(event) => {
                    const nextIndex = Number(event.target.value)
                    setAssignment((current) => swapAssignment(current, attribute, nextIndex))
                  }}
                >
                  {pool.map((score, index) => (
                    <option key={`${score}:${index}`} value={index}>{score}</option>
                  ))}
                </Select>
              </ScoreCard>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ScoreCard({
  attribute,
  base,
  bonus,
  children,
}: {
  attribute: Attribute
  base: number
  bonus: number
  children: React.ReactNode
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="font-semibold text-textH">{ATTRIBUTE_LABELS[attribute]}</div>
      <div className="mt-1 text-xs text-textMuted">Base {base} + raça {bonus} = {base + bonus}</div>
      <div className="mt-3">{children}</div>
    </article>
  )
}

function AttributeSelect({
  label,
  value,
  onChange,
  blocked = [],
}: {
  label: string
  value: Attribute
  onChange: (value: Attribute) => void
  blocked?: Attribute[]
}) {
  return (
    <label className="grid gap-1 text-xs text-textMuted">
      {label}
      <Select value={value} onChange={(event) => onChange(event.target.value as Attribute)}>
        {ATTRIBUTE_KEYS.map((attribute) => (
          <option key={attribute} value={attribute} disabled={blocked.includes(attribute)}>
            {ATTRIBUTE_LABELS[attribute]}
          </option>
        ))}
      </Select>
    </label>
  )
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left text-sm font-semibold text-textH"
        : "rounded-xl border border-border bg-bg-subtle p-3 text-left text-sm text-textMuted hover:border-accentBorder"}
    >
      {label}
    </button>
  )
}

function findLabeledInputs(root: HTMLElement, prefix: string): Record<Attribute, HTMLInputElement> | null {
  const result = {} as Record<Attribute, HTMLInputElement>
  for (const attribute of ATTRIBUTE_KEYS) {
    const label = Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find((entry) =>
      entry.textContent?.includes(`${prefix} ${ATTRIBUTE_LABELS[attribute]}`),
    )
    const input = label?.querySelector<HTMLInputElement>("input")
    if (!input) return null
    result[attribute] = input
  }
  return result
}

function findAttributeInputs(root: HTMLElement): Record<Attribute, HTMLInputElement> | null {
  const result = {} as Record<Attribute, HTMLInputElement>
  for (const attribute of ATTRIBUTE_KEYS) {
    const article = Array.from(root.querySelectorAll<HTMLElement>("article")).find((entry) =>
      entry.querySelector("strong")?.textContent?.trim() === ATTRIBUTE_LABELS[attribute],
    )
    const input = article?.querySelector<HTMLInputElement>('input[type="number"]')
    if (!input) return null
    result[attribute] = input
  }
  return result
}

function readValues(inputs: Record<Attribute, HTMLInputElement>): Partial<Record<Attribute, number>> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((attribute) => [attribute, Number(inputs[attribute].value) || 0]))
}

function writeValues(
  inputs: Record<Attribute, HTMLInputElement>,
  values: Partial<Record<Attribute, number>>,
) {
  for (const attribute of ATTRIBUTE_KEYS) {
    setNativeInputValue(inputs[attribute], String(values[attribute] ?? 0))
  }
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  if (input.value === value) return
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

function inferBonusMode(
  raceName: string,
  bonuses: Partial<Record<Attribute, number>>,
): BonusMode {
  const values = ATTRIBUTE_KEYS.map((attribute) => bonuses[attribute] ?? 0).filter(Boolean).sort((a, b) => b - a)
  const normalized = raceName.toLocaleLowerCase("pt-BR")
  if (normalized.includes("variante")) return "variant"
  if (values.join(",") === "2,1") return "fixed"
  if (values.join(",") === "1,1,1") return "flex111"
  return "fixed"
}

function distribute(entries: Array<[Attribute, number]>): Partial<Record<Attribute, number>> {
  const result: Partial<Record<Attribute, number>> = {}
  for (const [attribute, value] of entries) {
    if (result[attribute]) continue
    result[attribute] = value
  }
  return result
}

function rollAbilityScores(): number[] {
  return Array.from({ length: 6 }, () => {
    const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => a - b)
    return dice.slice(1).reduce((sum, value) => sum + value, 0)
  }).sort((a, b) => b - a)
}

function mapPool(pool: number[], assignment: Record<Attribute, number>): Record<Attribute, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((attribute) => [attribute, pool[assignment[attribute]]])) as Record<Attribute, number>
}

function swapAssignment(
  current: Record<Attribute, number>,
  attribute: Attribute,
  nextIndex: number,
): Record<Attribute, number> {
  const other = ATTRIBUTE_KEYS.find((entry) => current[entry] === nextIndex)
  if (!other || other === attribute) return { ...current, [attribute]: nextIndex }
  return {
    ...current,
    [other]: current[attribute],
    [attribute]: nextIndex,
  }
}

export type { AbilityScoreOverride }
