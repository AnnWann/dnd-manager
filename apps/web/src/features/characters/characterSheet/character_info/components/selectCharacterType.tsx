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

export function SelectCharacterType({
  character,
  updateCharacter,
  canEditCharacterType,
}: Props) {
  const type = character.get("sheet").type

  return (
    <div className="min-w-0 w-full">
      <label className="text-xs text-text">Tipo</label>

      <Select
        className="mt-1 w-full"
        value={type}
        disabled={!canEditCharacterType}
        onChange={(event) => {
          if (!canEditCharacterType) return
          updateCharacter(character.get("id"), (current) =>
            current.withSheet("type", event.target.value as CharacterType),
          )
        }}
      >
        {(canEditCharacterType ? CHARACTER_TYPES : [type]).map((entry) => (
          <option key={entry} value={entry}>
            {entry.charAt(0).toUpperCase() + entry.slice(1)}
          </option>
        ))}
      </Select>
    </div>
  )
}
