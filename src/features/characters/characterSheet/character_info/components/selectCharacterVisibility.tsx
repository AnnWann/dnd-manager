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
        value={character.get('visibility') ?? 'Privado'}
        onChange={(e) =>
          updateCharacter(character.get('id'), (c) => c.with('visibility', stringToVisibility(e.target.value)))
        }
      >
        <option value="player">Privado</option>
        <option value="master">Equipe</option>
        <option value="master">Mestre</option>
      </Select>
    </div>
  )
}

function stringToVisibility(s: string): 'private' | 'party' | 'master' {
  switch(s){
    case 'Equipe': return 'party'
    case 'Mestre': return 'master'
    default: return 'private'
  }
}