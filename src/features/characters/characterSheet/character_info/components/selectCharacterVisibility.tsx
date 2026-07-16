import { Select } from "../../../../../components/ui/Select"
import type { CharacterTemplate } from "../../../../../models/characters/CharacterTemplate"

type CharacterVisibility = "private" | "party" | "master"

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
    <div className="min-w-0 w-full">
      <label className="text-xs text-text">Visibilidade</label>

      <Select
        className="mt-1 w-full"
        value={character.get("visibility") ?? "private"}
        onChange={(event) =>
          updateCharacter(character.get("id"), (current) =>
            current.with("visibility", event.target.value as CharacterVisibility),
          )
        }
      >
        <option value="private">Privado</option>
        <option value="party">Grupo</option>
        <option value="master">Mestre</option>
      </Select>
    </div>
  )
}
