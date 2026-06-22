import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { CharacterBackgroundSection } from "./characterBackgroundSection"
import { CharacterProfileTab as BaseCharacterProfileTab } from "./characterProfile"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterProfileTab({
  character,
  updateCharacter,
}: Props) {
  return (
    <div className="grid gap-4">
      <CharacterBackgroundSection
        character={character}
        updateCharacter={updateCharacter}
      />
      <BaseCharacterProfileTab
        character={character}
        updateCharacter={updateCharacter}
      />
    </div>
  )
}
