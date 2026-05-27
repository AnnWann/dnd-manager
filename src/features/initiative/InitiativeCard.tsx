import type { InitiativeResult } from "./initiative"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"

type Props = {
  entry: InitiativeResult
  isCurrentTurn: boolean
  onRemove: (characterId: string) => void
}

export function InitiativeCard({ entry, isCurrentTurn, onRemove }: Props) {
  return (
    <Card
      className={
        isCurrentTurn
          ? "border-accent shadow-md"
          : "border-accentBorder"
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-lg text-textH">
            {entry.character.name}
          </h3>

          {isCurrentTurn && (
            <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-white">
              Turno atual
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text">
            Iniciativa: <strong>{entry.initiative}</strong>
          </p>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRemove(entry.character.id)}
          >
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}