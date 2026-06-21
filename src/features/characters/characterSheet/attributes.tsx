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
  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <h2 className="mb-3 text-sm font-semibold text-textH">
        Atributos
      </h2>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
        {ATTRIBUTE_KEYS.map((attribute) => {
          const baseScore =
            character.get("sheet").attributes[attribute]

          const racialBonus =
            character.get("sheet").race.attributeBonus?.[attribute] ?? 0

          const effectiveScore =
            character.getEffectiveAttribute(attribute)

          const modifier =
            character.getEffectiveAttributeModifier(attribute)

          return (
            <div
              key={attribute}
              className="grid grid-cols-[52px_minmax(0,1fr)_72px] items-center gap-2 rounded-lg border border-border bg-bg-subtle p-2"
            >
              <div className="text-xs font-bold uppercase tracking-wide text-textH">
                {attributeShort(attribute)}
              </div>

              <div className="min-w-0 text-center">
                <div className="text-[10px] uppercase tracking-wide text-textMuted">
                  Total
                </div>

                <div className="text-2xl font-bold leading-none text-textH">
                  {effectiveScore}
                </div>

                <div className="mt-1 text-[11px] font-semibold text-text">
                  Mod. {formatSigned(modifier)}
                </div>
              </div>

              <label className="grid min-w-0 gap-1 text-center">
                <span className="text-[10px] uppercase tracking-wide text-textMuted">
                  Base
                </span>

                <Input
                  type="number"
                  aria-label={`Valor base de ${attributeShort(attribute)}`}
                  className="h-8 px-1 text-center text-xs"
                  value={baseScore}
                  min={1}
                  max={30}
                  onChange={(event) => {
                    const nextScore = clampInt(
                      Number(event.target.value),
                      1,
                      30,
                    )

                    updateCharacter(character.get("id"), (current) =>
                      current.withSheet("attributes", {
                        ...current.get("sheet").attributes,
                        [attribute]: nextScore,
                      }),
                    )
                  }}
                />

                {racialBonus !== 0 ? (
                  <span className="truncate text-[10px] font-semibold text-accent">
                    Raça {formatSigned(racialBonus)}
                  </span>
                ) : null}
              </label>
            </div>
          )
        })}
      </div>
    </section>
  )
}
