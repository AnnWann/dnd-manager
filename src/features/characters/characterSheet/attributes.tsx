import { Input } from "../../../components/ui/Input"
import { clampInt } from "../../../lib/numberFormat"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import type { Attribute, Character } from "../../../models/types"
import { calcAttributeModifier } from "../../../rules/attribute/calcAttributeModifier"


type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}


export function Attributes({ character, updateCharacter }: Props) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
      {ATTRIBUTE_KEYS.map((attr) => (
        <div key={attr}>
          <label className="text-xs text-text">{attributeShort(attr)}</label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              className="h-9 px-2"
              value={character.sheet.attributes[attr]}
              min={1}
              max={30}
              onChange={(e) => {
                const score = clampInt(Number(e.target.value), 1, 30)
                updateCharacter(character.id, (c) => ({
                  ...c,
                  attributes: { ...c.attributes, [attr]: score },
                }))
              }}
            />
            <div className="w-10 text-right text-xs text-text">
              {formatSigned(calcAttributeModifier(character.sheet.attributes[attr]))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function attributeShort(attribute: Attribute): 'FOR' | 'DES' | 'CON' |'INT' | 'SAB' | 'WIS' | 'CHA' | 'ERROR' {
  switch(attribute) {
    case 'str': return 'FOR'
    case 'dex': return 'DES'
    case 'con': return 'CON'
    case 'int': return 'INT'
    case 'wis': return 'SAB'
    case 'cha': return 'CHA'
    default: return 'ERROR'
  }
}

export function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}