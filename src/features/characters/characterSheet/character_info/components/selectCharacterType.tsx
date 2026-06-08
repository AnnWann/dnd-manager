import { Select } from "../../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../../models/characters/CharacterTemplate"
import { CHARACTER_TYPES, type CharacterType } from "../../../../../models/characters/CharacterType"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  canEditCharacterType: boolean
}

export function SelectCharacterType ({
  character,
  updateCharacter,
  canEditCharacterType  
}: Props) {
  const type = character.get('sheet').type
  return (
    <div className="w-full md:w-[320px]">
      <label className="text-xs text-text">
        Tipo
      </label>

      <Select
        className="mt-1"
        value={type}
        disabled={!canEditCharacterType}
        onChange={(e) =>
          canEditCharacterType
            ?
          updateCharacter(character.get('id'), (c) => c.withSheet('type', e.target.value as CharacterType)) : undefined
        } 
      >
        {(canEditCharacterType ? CHARACTER_TYPES : [type]).map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </Select>
    </div>
  )
}