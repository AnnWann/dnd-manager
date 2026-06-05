import type { ActionType } from "../../../../../../models/actions/Actions"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import { SelectActionModule } from "./selectActionModule"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

const ACTIONS: ActionType[] = [
  'action',
  'bonusAction',
  'reaction',
  'interaction',
  'free',
  'legendaryAction',
  'legendaryReaction',
  'legendaryResistance',
]

export function SelectActions({
  character,
  updateCharacter,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {ACTIONS.map((action) => (
        <SelectActionModule
          key={action}
          action={action}
          character={character}
          updateCharacter={updateCharacter}
        />
      ))}
    </div>
  )
}