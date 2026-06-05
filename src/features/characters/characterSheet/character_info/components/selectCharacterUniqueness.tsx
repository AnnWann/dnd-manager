import type { CharacterTemplate } from "../../../../../models/characters/CharacterTemplate"


type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function SelectCharacterUniqueness ({
  character,
  updateCharacter,
}: Props) {
  return (
    <div className="w-full md:w-[320px]">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={character.unique}
          onChange={(e) =>
            updateCharacter(character.id, (c) => ({
              ...c,
              unique: e.target.checked,
            }))
          }
        />

        <span className="text-xs text-text">
          Personagem Único
        </span>
      </label>
    </div>
  )
}