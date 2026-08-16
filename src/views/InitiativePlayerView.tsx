import { Clock3, Grid2X2, List, Shield, Swords } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "../components/ui/Button"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { InitiativeEntry } from "../models/initiative/Initiative"

type PlayerViewMode = "table" | "cards"

export function InitiativePlayerView() {
  const { session, hydrated } = useInitiativeSession()
  const { visibleCharacters } = useCharacterContext()
  const { userKey } = useSyncContext()
  const [viewMode, setViewMode] = useState<PlayerViewMode>("table")

  const ownedCharacterIds = useMemo(() => {
    const normalizedUserKey = userKey.trim()
    if (!normalizedUserKey) return new Set<string>()

    return new Set(
      visibleCharacters
        .filter(
          (character) =>
            character.get("owner")?.id?.trim() === normalizedUserKey,
        )
        .map((character) => character.get("id")),
    )
  }, [userKey, visibleCharacters])

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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button
              size="sm"
              variant={viewMode === "table" ? "primary" : "secondary"}
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
              Tabela
            </Button>
            <Button
              size="sm"
              variant={viewMode === "cards" ? "primary" : "secondary"}
              onClick={() => setViewMode("cards")}
            >
              <Grid2X2 className="h-4 w-4" />
              Cartões
            </Button>
            <span className="rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-textH">
              Rodada {session.round}
            </span>
            <span className="rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 font-medium text-textH">
              {active
                ? `Turno: ${active.name}`
                : session.started
                  ? "Combate em andamento"
                  : "Aguardando início"}
            </span>
          </div>
        </div>
      </header>

      {!entries.length ? (
        <div className="rounded-xl border border-dashed border-border bg-bg p-8 text-center text-sm text-textMuted">
          O mestre ainda não adicionou participantes à iniciativa.
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {entries.map((entry) => (
            <ReadOnlyCard
              key={entry.id}
              entry={entry}
              active={entry.id === session.activeEntryId}
              showPrivateStats={Boolean(
                entry.sourceId && ownedCharacterIds.has(entry.sourceId)
              )}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <ReadOnlyEntry
              key={entry.id}
              entry={entry}
              active={entry.id === session.activeEntryId}
              showPrivateStats={Boolean(
                entry.sourceId && ownedCharacterIds.has(entry.sourceId)
              )}
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
  showPrivateStats,
}: {
  entry: InitiativeEntry
  active: boolean
  showPrivateStats: boolean
}) {
  return (
    <article
      className={[
        "grid gap-3 rounded-xl border bg-bg p-3 shadow-theme-sm sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center",
        active ? "border-accent bg-accentBg" : "border-border",
        entry.defeated ? "opacity-55" : "",
      ].join(" ")}
    >
      <InitiativeValue entry={entry} />
      <EntrySummary entry={entry} active={active} />
      {showPrivateStats ? <PrivateStats entry={entry} /> : null}
    </article>
  )
}

function ReadOnlyCard({
  entry,
  active,
  showPrivateStats,
}: {
  entry: InitiativeEntry
  active: boolean
  showPrivateStats: boolean
}) {
  return (
    <article
      className={[
        "flex min-h-44 min-w-0 flex-col rounded-xl border bg-bg p-4 shadow-theme-sm",
        active ? "border-accent bg-accentBg" : "border-border",
        entry.defeated ? "opacity-55" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <EntrySummary entry={entry} active={active} />
        <div className="shrink-0 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
            Init.
          </div>
          <div className="text-xl font-bold text-textH">{entry.initiative}</div>
        </div>
      </div>

      {showPrivateStats ? (
        <div className="mt-auto pt-4">
          <PrivateStats entry={entry} />
        </div>
      ) : null}
    </article>
  )
}

function InitiativeValue({ entry }: { entry: InitiativeEntry }) {
  return (
    <div className="flex items-center gap-2 sm:block sm:text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        Init.
      </div>
      <div className="text-lg font-bold text-textH">{entry.initiative}</div>
    </div>
  )
}

function EntrySummary({
  entry,
  active,
}: {
  entry: InitiativeEntry
  active: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 break-words text-sm font-semibold text-textH">
          {entry.name}
        </h2>
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
  )
}

function PrivateStats({ entry }: { entry: InitiativeEntry }) {
  return (
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
  )
}

function formatHp(entry: InitiativeEntry): string {
  const current = entry.currentHp ?? 0
  const maximum = entry.maxHp
  const temporary = entry.temporaryHp ?? 0
  const base = maximum === undefined ? String(current) : `${current}/${maximum}`
  return temporary > 0 ? `${base} +${temporary} temp.` : base
}
