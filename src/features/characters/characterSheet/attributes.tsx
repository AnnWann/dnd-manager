import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import { clampInt } from "../../../lib/numberFormat"
import {
  getAsiAttributeIncrease,
  getCharacterAsis,
  type CharacterAsi,
} from "../../../models/characters/CharacterAsi"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { ATTRIBUTE_KEYS, type Attribute } from "../../../models/sheet/Attribute"

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
  const asis = getCharacterAsis(character)

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
              : "Exibindo os valores finais com bônus raciais, ASI, habilidades e equipamentos."}
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
          const asiBonus = getAsiAttributeIncrease(character, attribute)

          const effectiveScore =
            character.getEffectiveAttribute(attribute)

          const displayedScore = showRawValues
            ? baseScore
            : effectiveScore

          const displayedModifier = showRawValues
            ? Math.floor((baseScore - 10) / 2)
            : character.getEffectiveAttributeModifier(attribute)

          const otherBonus = effectiveScore - baseScore - racialBonus - asiBonus

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
                  {asiBonus !== 0
                    ? ` • ASI ${formatSigned(asiBonus)}`
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

      {asis.length ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-textMuted">
            ASI e talentos
          </div>
          <div className="grid gap-2">
            {asis
              .toSorted((left, right) => left.classLevel - right.classLevel)
              .map((asi) => (
                <div
                  key={asi.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-textH">
                      {formatAsiLabel(asi)}
                    </div>
                    <div className="mt-0.5 text-textMuted">
                      Nível {asi.classLevel} de {asi.className}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-semibold text-textH">
                    {formatAsiIncrease(asi)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatAsiLabel(asi: CharacterAsi): string {
  if (asi.kind === "feat") return asi.ability?.name || "Talento"
  if (asi.kind === "half-feat") return asi.ability?.name || "Meio talento"
  return "Aumento de atributo"
}

function formatAsiIncrease(asi: CharacterAsi): string {
  const parts = ATTRIBUTE_KEYS
    .filter((attribute) => (asi.increases[attribute] ?? 0) > 0)
    .map(
      (attribute) =>
        `${formatSigned(asi.increases[attribute] ?? 0)} ${attributeLabel(attribute)}`,
    )

  return parts.join(" / ") || (asi.ability ? "Talento" : "—")
}

function attributeLabel(attribute: Attribute): string {
  const labels: Record<Attribute, string> = {
    str: "FOR",
    dex: "DES",
    con: "CON",
    int: "INT",
    wis: "SAB",
    cha: "CAR",
  }
  return labels[attribute]
}
