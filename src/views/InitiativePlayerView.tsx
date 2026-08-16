import { Clock3, Shield, Swords } from "lucide-react"

import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { InitiativeEntry } from "../models/initiative/Initiative"

export function InitiativePlayerView() {
  const { session, hydrated } = useInitiativeSession()

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text">
        Carregando iniciativa compartilhada…
      </div>
    )
  }

  const entries = session.entries.filter((entry) => !entry.hidden)
  const active = entries.find((entry) => entry.id === session.activeEntryId)

  return (
    <div className="grid min-w-0 gap-4">
      <header className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-textH">
              <Swords className="h-4 w-4 text-accent" />
              Iniciativa
            </div>
            <p className="mt-1 text-xs text-textMuted">
              Visualização compartilhada. Somente o mestre pode alterar o combate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-textH">
              Rodada {session.round}
            </span>
            <span className="rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 font-medium text-textH">
              {active ? `Turno: ${active.name}` : session.started ? "Combate em andamento" : "Aguardando início"}
            </span>
          </div>
        </div>
      </header>

      {!entries.length ? (
        <div className="rounded-xl border border-dashed border-border bg-bg p-8 text-center text-sm text-textMuted">
          O mestre ainda não adicionou participantes à iniciativa.
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <ReadOnlyEntry
              key={entry.id}
              entry={entry}
              active={entry.id === session.activeEntryId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReadOnlyEntry({
  entry,
  active,
}: {
  entry: InitiativeEntry
  active: boolean
}) {
  return (
    <article
      className={[
        "grid gap-3 rounded-xl border bg-bg p-3 shadow-theme-sm sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center",
        active ? "border-accent bg-accentBg" : "border-border",
        entry.defeated ? "opacity-55" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 sm:block sm:text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
          Init.
        </div>
        <div className="text-lg font-bold text-textH">{entry.initiative}</div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-textH">{entry.name}</h2>
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              <Clock3 className="h-3 w-3" /> Turno atual
            </span>
          ) : null}
          {entry.defeated ? (
            <span className="rounded-full border border-border px-2 py-1 text-[10px] text-textMuted">
              Derrotado
            </span>
          ) : null}
        </div>

        {entry.conditions.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.conditions.map((condition) => (
              <span
                key={condition.id}
                title={condition.description}
                className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-[10px] text-textH"
              >
                {condition.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-textH sm:justify-end">
        {entry.currentHp !== undefined ? (
          <span className="rounded-lg border border-border bg-bg-subtle px-2.5 py-2">
            PV {formatHp(entry)}
          </span>
        ) : null}
        {entry.armorClass !== undefined ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-subtle px-2.5 py-2">
            <Shield className="h-3.5 w-3.5" /> CA {entry.armorClass}
          </span>
        ) : null}
      </div>
    </article>
  )
}

function formatHp(entry: InitiativeEntry): string {
  const current = entry.currentHp ?? 0
  const maximum = entry.maxHp
  const temporary = entry.temporaryHp ?? 0
  const base = maximum === undefined ? String(current) : `${current}/${maximum}`
  return temporary > 0 ? `${base} +${temporary} temp.` : base
}
