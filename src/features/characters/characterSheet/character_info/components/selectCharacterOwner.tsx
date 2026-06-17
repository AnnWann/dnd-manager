import { Input } from "../../../../../components/ui/Input"
import { Select } from "../../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../../models/characters/CharacterTemplate"
import type { Player } from "../../../../../models/player/Player"


type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  playerKeys: string[]
  getOwner: (ownerName: string) => Player
  createOwner: (ownerName: string) => Player
}

export function SelectCharacterOwner ({
  character,
  updateCharacter,
  playerKeys,
  getOwner,
  createOwner
}: Props) {

  const owner = character.get('owner')

  return (
     <div className="w-full md:w-[320px]">
        <label className="text-xs text-text">
          Jogador atribuído
        </label>

        <Select
          className="mt-1"
          value={owner.name ?? ''}
          onChange={(e) =>
            updateCharacter(character.get('id'), (c) => c.with('owner', getOwner(e.target.value)))
          }
        >
          <option value="">Sem jogador</option>
          {playerKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </Select>

        <Input
          className="mt-2"
          value={owner.name ?? ''}
          onChange={(e) =>
            updateCharacter(character.get('id'), (c) => c.with('owner', createOwner(e.target.value)))
          }
          placeholder="Ou digite um novo nome de jogador"
        />
      </div>
  )
}