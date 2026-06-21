import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import { clampInt } from "../../../lib/numberFormat"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function Attributes({
  character,
  updateCharacter,
}: Props) {
  const [showRawValues, setShowRawValues] = useState(false)

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-textH">
            Atributos
          </h2>

          <p className="mt-0.5 text-[11px] text-textMuted">
            {showRawValues
              ? "Exibindo apenas os valores base armazenados."
              : "Exibindo os valores finais com bônus raciais e de equipamentos."}
          </p>
        </div>

        <Button
          className="w-full shrink-0 sm:w-auto"
          size="sm"
          variant={showRawValues ? "primary" : "secondary"}
          onClick={() => setShowRawValues((current) => !current)}
        >
          {showRawValues ? "Mostrar finais" : "Mostrar brutos"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
        {ATTRIBUTE_KEYS.map((attribute) => {
          const baseScore =
            character.get("sheet").attributes[attribute]

          const racialBonus =
            character.get("sheet").race.attributeBonus?.[attribute] ?? 0

          const effectiveScore =
            character.getEffectiveAttribute(attribute)

          const displayedScore = showRawValues
            ? baseScore
            : effectiveScore

          const displayedModifier = showRawValues
            ? Math.floor((baseScore - 10) / 2)
            : character.getEffectiveAttributeModifier(attribute)

          const otherBonus = effectiveScore - baseScore - racialBonus

          function updateDisplayedScore(value: number) {
            const requestedScore = clampInt(value, 1, 30)

            updateCharacter(character.get("id"), (current) => {
              const currentBase =
                current.get("sheet").attributes[attribute]

              const nextBase = showRawValues
                ? requestedScore
                : clampInt(
                    currentBase +
                      (requestedScore -
                        current.getEffectiveAttribute(attribute)),
                    1,
                    30,
                  )

              return current.withSheet("attributes", {
                ...current.get("sheet").attributes,
                [attribute]: nextBase,
              })
            })
          }

          return (
            <div
              key={attribute}
              className="grid min-w-0 gap-2 rounded-lg border border-border bg-bg-subtle p-3"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="text-sm font-bold uppercase tracking-wide text-textH">
                  {attributeShort(attribute)}
                </div>

                <div className="flex shrink-0 items-baseline gap-1 text-right">
                  <span className="text-[10px] uppercase tracking-wide text-textMuted">
                    Mod.
                  </span>
                  <span className="text-xl font-bold text-textH">
                    {formatSigned(displayedModifier)}
                  </span>
                </div>
              </div>

              <label className="grid min-w-0 gap-1 text-center">
                <span className="text-[10px] uppercase tracking-wide text-textMuted">
                  {showRawValues ? "Bruto" : "Final"}
                </span>

                <Input
                  type="number"
                  inputMode="numeric"
                  aria-label={`${showRawValues ? "Valor bruto" : "Valor final"} de ${attributeShort(attribute)}`}
                  className="h-11 w-full min-w-0 px-2 text-center text-xl font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={displayedScore}
                  min={1}
                  max={30}
                  onChange={(event) =>
                    updateDisplayedScore(Number(event.target.value))
                  }
                />
              </label>

              {!showRawValues ? (
                <div className="min-h-4 break-words text-center text-[10px] leading-4 text-textMuted">
                  Base {baseScore}
                  {racialBonus !== 0
                    ? ` • Raça ${formatSigned(racialBonus)}`
                    : ""}
                  {otherBonus !== 0
                    ? ` • Outros ${formatSigned(otherBonus)}`
                    : ""}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
