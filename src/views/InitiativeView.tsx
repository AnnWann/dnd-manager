import { Button } from "../components/ui/Button"
import { InitiativeCarousel } from "../features/initiative/initiativeCarousel"
import { InitiativeForm } from "../features/initiative/InitiativeForm"
import { useInitiative } from "../features/initiative/useIniciative"
import type { Character } from "../types"

type Props = {
  characters: Character[]
}

export function InitiativeView({ characters }: Props) {
  const initiative = useInitiative()

  return (
    <section className="flex flex-col gap-6">
      <InitiativeForm
        characters={characters}
        addedCharacterIds={initiative.initiativeOrder.map(
          (e) => e.character.id,
        )}
        onAdd={initiative.addToInitiative}
      />

      <InitiativeCarousel
        order={initiative.initiativeOrder}
        currentTurnIndex={initiative.currentTurnIndex}
        onRemove={initiative.removeFromInitiative}
      />

      <div
        className="
          flex flex-wrap items-center justify-center gap-3
          rounded-2xl border border-accentBorder
          bg-accentBg/20 p-4
        "
      >
        <Button
          variant="primary"
          onClick={initiative.nextTurn}
          disabled={initiative.initiativeOrder.length === 0}
        >
          Próximo Turno
        </Button>

        <Button
          variant="secondary"
          onClick={initiative.clearInitiative}
          disabled={initiative.initiativeOrder.length === 0}
        >
          Limpar Iniciativa
        </Button>
      </div>
    </section>
  )
}