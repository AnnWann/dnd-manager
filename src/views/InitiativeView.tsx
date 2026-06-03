import type { Character } from '../features/models/types'
import type { InitiativeResult } from '../features/initiative/initiative'
import { InitiativeBoard } from '../features/initiative/InitiativeBoard'

type Props = {
  characters: Character[]
  initiativeOrder: InitiativeResult[]
  currentTurnIndex: number
  canSeeCharacterDetails: (character: Character | InitiativeResult) => boolean
  canEditInitiative: boolean
  canEditCharacterHp: (character: Character | InitiativeResult) => boolean
  onAdd: (character: Character, rolledValue: number) => void
  onRemove: (characterId: string) => void
  onRemoveEffect: (characterId: string, effectId: string) => void
  onApplyEffect: (characterId: string, effectLabel: string) => void
  onNextTurn: () => void
  onClear: () => void
  onUpdateCurrentHp: (characterId: string, currentHp: number, temporaryHp?: number) => void
}

export function InitiativeView({
  characters,
  initiativeOrder,
  currentTurnIndex,
  canSeeCharacterDetails,
  canEditInitiative,
  canEditCharacterHp,
  onAdd,
  onRemove,
  onRemoveEffect,
  onApplyEffect,
  onNextTurn,
  onClear,
  onUpdateCurrentHp,
}: Props) {
  return (
    <InitiativeBoard
      characters={characters}
      initiativeOrder={initiativeOrder}
      currentTurnIndex={currentTurnIndex}
      canSeeCharacterDetails={canSeeCharacterDetails}
      canEditInitiative={canEditInitiative}
      canEditCharacterHp={canEditCharacterHp}
      onAdd={onAdd}
      onRemove={onRemove}
      onRemoveEffect={onRemoveEffect}
      onApplyEffect={onApplyEffect}
      onNextTurn={onNextTurn}
      onClear={onClear}
      onUpdateCurrentHp={onUpdateCurrentHp}
    />
  )
}