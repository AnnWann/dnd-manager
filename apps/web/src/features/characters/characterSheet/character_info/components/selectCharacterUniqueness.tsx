import type { CharacterTemplate } from "../../../../../models/characters/CharacterTemplate"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function SelectCharacterUniqueness({
  character,
  updateCharacter,
}: Props) {
  return (
    <div className="flex min-w-0 w-full items-start pt-1 xl:pt-6">
      <label className="flex items-center gap-2 text-xs text-text">
        <input
          type="checkbox"
          checked={character.get("unique")}
          onChange={(event) =>
            updateCharacter(character.get("id"), (current) =>
              current.with("unique", event.target.checked),
            )
          }
        />
        Personagem único
      </label>
    </div>
  )
}
