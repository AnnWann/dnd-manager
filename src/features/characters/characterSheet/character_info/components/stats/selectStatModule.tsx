import { useEffect, useState } from "react"

import { Input } from "../../../../../../components/ui/Input"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import {
  getCalculatedArmorClass,
  getCalculatedInitiative,
  getCalculatedMobility,
  getCalculatedPassivePerception,
  getStatAdjustment,
  getStatAdjustmentKey,
  type CalculatedStatKey,
} from "../../../../../../models/characters/characterStats"

type Props = {
  name: string
  statKey: CalculatedStatKey
  getValue: (character: CharacterTemplate) => number
  getCalculatedValue?: (character: CharacterTemplate) => number
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
  fallback?: number
  readOnly?: boolean
}

export function SelectStatModule({
  name,
  statKey,
  getValue,
  getCalculatedValue,
  character,
  updateCharacter,
  fallback = 0,
  readOnly = false,
}: Props) {
  const effectiveValue = finiteOr(getValue(character), fallback)
  const adjustmentKey = getStatAdjustmentKey(statKey)
  const adjustment = getStatAdjustment(character, adjustmentKey)
  const calculate = getCalculatedValue ?? ((current: CharacterTemplate) =>
    getDefaultCalculatedValue(current, statKey))
  const calculatedValue = finiteOr(calculate(character), fallback)
  const [draft, setDraft] = useState(String(effectiveValue))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(String(effectiveValue))
  }, [editing, effectiveValue])

  function commitDraft() {
    setEditing(false)

    const desiredValue = Number(draft.replace(",", "."))
    if (!Number.isFinite(desiredValue)) {
      setDraft(String(effectiveValue))
      return
    }

    updateCharacter(character.get("id"), (current) => {
      const currentCalculated = finiteOr(calculate(current), fallback)
      const nextAdjustment = cleanNumber(desiredValue - currentCalculated)

      return current.withStat(adjustmentKey, nextAdjustment)
    })
  }

  function clearAdjustment() {
    setEditing(false)
    updateCharacter(character.get("id"), (current) =>
      current.withStat(adjustmentKey, 0),
    )
  }

  return (
    <div className="min-w-0">
      <label className="text-xs text-text">{name}</label>

      <Input
        type="number"
        step="any"
        className="mt-1 text-center"
        value={draft}
        readOnly={readOnly}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }

          if (event.key === "Escape") {
            setDraft(String(effectiveValue))
            event.currentTarget.blur()
          }
        }}
      />

      <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-textMuted">
        <span>Automático: {formatNumber(calculatedValue)}</span>

        {adjustment !== 0 ? (
          <>
            <span className="font-semibold text-accent">
              Ajuste {formatSigned(adjustment)}
            </span>
            {!readOnly ? (
              <button
                type="button"
                className="rounded border border-border px-1.5 py-0.5 font-medium text-text hover:bg-bg-subtle"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearAdjustment}
              >
                Usar automático
              </button>
            ) : null}
          </>
        ) : (
          <span>Sem ajuste manual</span>
        )}
      </div>
    </div>
  )
}

function getDefaultCalculatedValue(
  character: CharacterTemplate,
  stat: CalculatedStatKey,
): number {
  if (stat === "armorClass") return getCalculatedArmorClass(character)
  if (stat === "initiative") return getCalculatedInitiative(character)
  if (stat === "mobility") return getCalculatedMobility(character)
  return getCalculatedPassivePerception(character)
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function cleanNumber(value: number): number {
  return Math.abs(value) < 0.000001 ? 0 : Number(value.toFixed(4))
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
