import { Skull, Trash2 } from "lucide-react"

import { Button } from "../../components/ui/Button"
import {
  ConditionChips,
  EntryIdentity,
  TradeControls,
  formatHp,
} from "./InitiativeEntryParts"
import type { InitiativeRosterProps } from "./initiativeRosterTypes"

type InitiativeCardsProps = InitiativeRosterProps & {
  cardRefs: { current: Map<string, HTMLDivElement> }
}

export function InitiativeCards({ cardRefs, ...props }: InitiativeCardsProps) {
  return (
    <div className="overflow-x-auto scroll-smooth p-5">
      <div className="flex min-w-max items-stretch gap-4 pb-2">
        {props.entries.map((entry) => {
          const active = entry.id === props.activeEntryId
          const anchor = props.started && entry.id === props.roundAnchorEntryId

          return (
            <div
              key={entry.id}
              ref={(node) => {
                if (node) cardRefs.current.set(entry.id, node)
                else cardRefs.current.delete(entry.id)
              }}
              className="relative flex items-stretch"
            >
              {anchor ? (
                <div className="mr-4 flex w-8 shrink-0 flex-col items-center justify-center gap-2 text-danger">
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]">
                    Rodada {props.round}
                  </span>
                  <span className="h-full min-h-56 w-0.5 bg-danger" />
                </div>
              ) : null}

              <article
                className={[
                  "flex w-72 shrink-0 flex-col rounded-xl border bg-bg p-4 shadow-theme-sm",
                  "transition-[transform,border-color,box-shadow] duration-300",
                  active
                    ? "scale-[1.03] border-accent shadow-theme-lg"
                    : "border-border",
                  entry.defeated ? "opacity-55" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <EntryIdentity
                    entry={entry}
                    onOpen={() => props.onOpen(entry.id)}
                  />
                  <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center">
                    <div className="text-[10px] uppercase text-textMuted">
                      Init.
                    </div>
                    <div className="text-xl font-bold text-textH">
                      {entry.initiative}
                    </div>
                  </div>
                </div>

                {active ? (
                  <div className="mt-3 rounded-lg bg-accent px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-white">
                    Turno atual
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-border bg-bg-subtle p-3">
                    <div className="text-xs text-textMuted">Pontos de vida</div>
                    <div className="mt-1 font-semibold text-textH">
                      {formatHp(entry)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-subtle p-3">
                    <div className="text-xs text-textMuted">
                      Classe de armadura
                    </div>
                    <div className="mt-1 font-semibold text-textH">
                      {entry.armorClass ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex-1">
                  <ConditionChips
                    entry={entry}
                    onAdd={() => props.onCondition(entry.id)}
                    onRemove={(conditionId) =>
                      props.onRemoveCondition(entry.id, conditionId)
                    }
                  />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <TradeControls
                    entry={entry}
                    onTrade={props.onTrade}
                    canTrade={props.canTrade}
                  />
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant={entry.defeated ? "outline" : "ghost"}
                      title={
                        entry.defeated ? "Reativar" : "Marcar como derrotado"
                      }
                      onClick={() =>
                        props.patchEntry(entry.id, {
                          defeated: !entry.defeated,
                        })
                      }
                    >
                      <Skull className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Remover"
                      onClick={() => props.onRemove(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </div>
  )
}
