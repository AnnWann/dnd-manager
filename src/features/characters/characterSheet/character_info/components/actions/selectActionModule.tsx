import { Input } from "../../../../../../components/ui/Input"
import type { ActionType } from "../../../../../../models/actions/Actions"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"

type Props = {
  action: ActionType
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function SelectActionModule ({
  action,
  character,
  updateCharacter,
}: Props) {
  return (
    <div>
      <label className="text-xs text-text">{actionLabel(action)}</label>
      <Input
        type="number"
        className="mt-1"
        value={character.actionsPerTurn[action] ?? 0}
        onChange={(e) =>
          updateCharacter(character.id, (c) => ({
            ...c,
           actionsPerTurn: { 
              ...c.actionsPerTurn,
              [action]: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
           }
          }))
        }
      />
    </div>
  )
}

function actionLabel(action: ActionType) {
  switch(action) {
    case 'action': return 'Ação'
    case 'bonusAction': return 'Ação Bonus'
    case 'reaction': return 'Reação'
    case 'interaction': return 'Interação'
    case 'free': return 'Ação Livre'
    case 'legendaryAction': return 'Ação Lendária'
    case 'legendaryReaction': return 'Reação Lendária'
    case 'legendaryResistance': return 'Resistência Lendária'
  }
}