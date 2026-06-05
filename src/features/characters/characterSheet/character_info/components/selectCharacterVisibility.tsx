import { Select } from "../../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../../models/characters/CharacterTemplate"


type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function SelectCharacterVisibility({
  character,
  updateCharacter,
}: Props) {
  return (
    <div className="w-full md:w-[320px]">
      <label className="text-xs text-text">
        Visibilidade
      </label>

      <Select
        className="mt-1"
        value={character.visibility ?? 'private'}
        onChange={(e) =>
          updateCharacter(character.id, (c) => ({
            ...c,
            visibility: e.target.value as 'private' | 'party' | 'master',
          }))
        }
      >
        <option value="player">Privado</option>
        <option value="master">Equipe</option>
        <option value="master">Mestre</option>
      </Select>
    </div>
  )
}