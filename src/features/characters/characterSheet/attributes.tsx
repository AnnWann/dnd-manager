import { Input } from "../../../components/ui/Input"
import { clampInt } from "../../../lib/numberFormat"
import { ABILITIES as ATTRIBUTES, abilityModifier, formatSigned } from "../../../lib/rules"
import type { Attribute, Character } from "../../../models/types"


type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  attributeShort: (ability: Attribute) => string
}


export function Attributes({ character, updateCharacter, attributeShort }: Props) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
      {ATTRIBUTES.map(({ key }) => (
        <div key={key}>
          <label className="text-xs text-text">{attributeShort(key)}</label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              className="h-9 px-2"
              value={character.attributes[key]}
              min={1}
              max={30}
              onChange={(e) => {
                const score = clampInt(Number(e.target.value), 1, 30)
                updateCharacter(character.id, (c) => ({
                  ...c,
                  attributes: { ...c.attributes, [key]: score },
                }))
              }}
            />
            <div className="w-10 text-right text-xs text-text">
              {formatSigned(abilityModifier(character.attributes[key]))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}