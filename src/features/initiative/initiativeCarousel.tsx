import type { InitiativeResult } from "./initiative"
import { InitiativeCard } from "./initiativeCard"

type Props = {
  order: InitiativeResult[]
  currentTurnIndex: number
  canSeeCharacterDetails: (character: InitiativeResult['character']) => boolean
  onRemove?: (characterId: string) => void
  onRemoveEffect?: (characterId: string, effectId: string) => void
}

function circularOffset(index: number, centerIndex: number, length: number) {
  let offset = index - centerIndex

  if (offset > length / 2) offset -= length
  if (offset < -length / 2) offset += length

  return offset
}

export function InitiativeCarousel({ order, currentTurnIndex, canSeeCharacterDetails, onRemove, onRemoveEffect }: Props) {
  if (order.length === 0) {
    return <p className="text-sm text-text">Nenhum personagem na iniciativa.</p>
  }

  return (
    <div className="relative mt-4 h-[190px] w-full overflow-hidden">
      {order.map((entry, index) => {
        const offset = circularOffset(index, currentTurnIndex, order.length)
        const isCurrentTurn = index === currentTurnIndex

        return (
          <div
            key={entry.character.id}
            className="absolute left-1/2 top-2 w-[320px] transition-all duration-300 ease-out"
            style={{
              transform: `
                translateX(calc(-50% + ${offset * 360}px))
                scale(${isCurrentTurn ? 1.05 : 0.92})
              `,
              opacity: Math.abs(offset) > 2 ? 0 : isCurrentTurn ? 1 : 0.65,
              zIndex: isCurrentTurn ? 10 : 5 - Math.abs(offset),
            }}
          >
            <InitiativeCard
              entry={entry}
              isCurrentTurn={isCurrentTurn}
              showCharacterDetails={canSeeCharacterDetails(entry.character)}
              onRemove={onRemove}
              onRemoveEffect={onRemoveEffect}
            />
          </div>
        )
      })}
    </div>
  )
}