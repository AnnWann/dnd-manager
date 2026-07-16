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

export function SelectCharacterOwner({
  character,
  updateCharacter,
  playerKeys,
  getOwner,
  createOwner,
}: Props) {
  const owner = character.get("owner")

  return (
    <div className="min-w-0 w-full">
      <label className="text-xs text-text">Jogador atribuído</label>

      <Select
        className="mt-1 w-full"
        value={owner.id ?? ""}
        onChange={(event) =>
          updateCharacter(character.get("id"), (current) =>
            current.with("owner", getOwner(event.target.value)),
          )
        }
      >
        <option value="">Sem jogador</option>
        {playerKeys.map((key) => {
          const player = getOwner(key)
          return (
            <option key={key} value={key}>
              {player.name || key}
            </option>
          )
        })}
      </Select>

      <Input
        className="mt-2 w-full"
        value={owner.name ?? ""}
        onChange={(event) =>
          updateCharacter(character.get("id"), (current) =>
            current.with("owner", createOwner(event.target.value)),
          )
        }
        placeholder="Ou digite um novo nome de jogador"
      />
    </div>
  )
}
