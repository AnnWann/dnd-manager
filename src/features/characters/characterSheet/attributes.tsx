import { useState } from "react"
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
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function Attributes({ character, updateCharacter }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          flex items-center gap-2
          text-sm font-medium text-textH
          transition-opacity hover:opacity-80
        "
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>Atributos</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attr) => (
            <div key={attr}>
              <label className="text-xs text-text">
                {attributeShort(attr)}
              </label>

              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  className="h-9 px-2"
                  value={character.get("sheet").attributes[attr]}
                  min={1}
                  max={30}
                  onChange={(e) => {
                    const score = clampInt(Number(e.target.value), 1, 30)

                    updateCharacter(character.get("id"), (c) =>
                      c.withSheet("attributes", {
                        ...c.get("sheet").attributes,
                        [attr]: score,
                      }),
                    )
                  }}
                />

                <div className="w-10 text-right text-xs text-text">
                  {formatSigned(character.getEffectiveAttributeModifier(attr))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}