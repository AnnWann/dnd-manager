import type { InitiativeResult } from "./initiative"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { badge } from "../spells/addedSpells/badge"
import { InitiativeHpEditor } from './InitiativeHpEditor'

type Props = {
  entry: InitiativeResult
  isCurrentTurn: boolean
  showCharacterDetails: boolean
  canEditHp: boolean
  onUpdateCurrentHp: (characterId: string, currentHp: number, temporaryHp?: number) => void
  onRemove?: (characterId: string) => void
  onRemoveEffect?: (characterId: string, effectId: string) => void
}

export function InitiativeCard({ entry, isCurrentTurn, showCharacterDetails, canEditHp, onUpdateCurrentHp, onRemove, onRemoveEffect }: Props) {
  return (
    <Card
      className={
        isCurrentTurn
          ? "border-accent shadow-md"
          : "border-accentBorder"
      }
      >
      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading text-lg leading-none text-textH">
              {entry.displayName}
            </h3>
            <p className="mt-2 text-sm text-text">
              Iniciativa: <strong>{entry.initiative}</strong>
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {isCurrentTurn && (
              <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-white">
                Turno atual
              </span>
            )}

            {onRemove ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onRemove(entry.id)}
              >
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3">
        <div className="flex flex-col gap-3">
          {showCharacterDetails ? (
            <div className="flex flex-col gap-1 text-xs text-text">
              <InitiativeHpEditor
                target={entry}
                canEditHp={canEditHp}
                onUpdateCurrentHp={onUpdateCurrentHp}
              />
              <span>CA {entry.armorClass}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {entry.effects.length ? (
              entry.effects.map((effect) => (
                onRemoveEffect ? (
                  <button
                    key={effect.id}
                    type="button"
                    className="cursor-pointer text-left transition hover:opacity-75"
                    onClick={() => onRemoveEffect(entry.id, effect.id)}
                    title={`Clique para remover — ${effect.label} (${effect.turnsRemaining})`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {badge(effect.label, { kind: 'grid', title: 'Clique para remover' })}
                      <span
                        className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white"
                        title={`Turnos restantes: ${effect.turnsRemaining}`}
                      >
                        {effect.turnsRemaining}
                      </span>
                    </span>
                  </button>
                ) : (
                  <span key={effect.id} className="inline-flex items-center gap-2">
                    {badge(effect.label, { kind: 'grid' })}
                    <span
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white"
                      title={`Turnos restantes: ${effect.turnsRemaining}`}
                    >
                      {effect.turnsRemaining}
                    </span>
                  </span>
                )
              ))
            ) : (
              <span className="text-xs text-text">Sem efeitos</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}