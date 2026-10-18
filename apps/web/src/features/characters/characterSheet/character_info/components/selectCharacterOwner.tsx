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
  /** Kept for caller compatibility; session ownership must come from a real account. */
  createOwner: (ownerName: string) => Player
}

export function SelectCharacterOwner({
  character,
  updateCharacter,
  playerKeys,
  getOwner,
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

      <p className="mt-2 text-[11px] leading-4 text-textMuted">
        Selecione um membro ativo da campanha. O vínculo usa o ID da conta do
        jogador, não um nome digitado manualmente.
      </p>
    </div>
  )
}
