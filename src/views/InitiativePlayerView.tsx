import { Clock3, Grid2X2, List, Shield, Swords } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "../components/ui/Button"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { InitiativeCards } from "../features/initiative/InitiativeCards"
import { DeathSaveCounter } from "../features/initiative/InitiativeEntryParts"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import { initiativeEntryDisplayName, type InitiativeEntry } from "../models/initiative/Initiative"

type PlayerViewMode = "table" | "cards"

export function InitiativePlayerView() {
  const { session, hydrated } = useInitiativeSession()
  const runtime = useOptionalSessionRuntime()
  const { visibleCharacters } = useCharacterContext()
  const { userKey } = useSyncContext()
  const [viewMode, setViewMode] = useState<PlayerViewMode>("table")
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

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

  const entries = useMemo(
    () => session.entries.filter((entry) => !entry.hidden),
    [session.entries],
  )
  const active = entries.find((entry) => entry.id === session.activeEntryId)

  useEffect(() => {
    if (viewMode !== "cards" || !session.activeEntryId) return

    cardRefs.current.get(session.activeEntryId)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [session.activeEntryId, viewMode])

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text">
        Carregando iniciativa compartilhada…
      </div>
    )
  }

  const canViewPrivateStats = (entry: InitiativeEntry) =>
    Boolean(entry.sourceId && ownedCharacterIds.has(entry.sourceId))
  const canViewDeathSaves = (entry: InitiativeEntry) =>
    Boolean(entry.deathSaves) && (
      session.deathSaveVisibility === "everyone" ||
      (session.deathSaveVisibility === "owner" && canViewPrivateStats(entry))
    )
  const canEditDeathSaves = (entry: InitiativeEntry) =>
    Boolean(
      runtime &&
      runtime.status === "connected" &&
      session.deathSaveOwnerCanEdit &&
      canViewPrivateStats(entry),
    )
  const setDeathSaves = (
    entry: InitiativeEntry,
    deathSaves: { successes: number; failures: number },
  ) => {
    if (!canEditDeathSaves(entry)) return
    runtime?.dispatchInitiativeOperation({
      type: "initiative.deathSaves.set",
      characterId: "session",
      entryId: entry.id,
      successes: deathSaves.successes,
      failures: deathSaves.failures,
    })
  }

  const noop = () => undefined

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
                ? `Turno: ${initiativeEntryDisplayName(active, "player")}`
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
        <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
          <InitiativeCards
            entries={entries}
            activeEntryId={session.activeEntryId}
            roundAnchorEntryId={session.roundAnchorEntryId}
            round={session.round}
            started={session.started}
            cardRefs={cardRefs}
            readOnly
            canViewPrivateStats={canViewPrivateStats}
            patchEntry={noop}
            onOpen={noop}
            onCondition={noop}
            onRemove={noop}
            onTrade={noop}
            canTrade={() => false}
            onRemoveCondition={noop}
          />
        </section>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <ReadOnlyEntry
              key={entry.id}
              entry={entry}
              active={entry.id === session.activeEntryId}
              showPrivateStats={canViewPrivateStats(entry)}
              showDeathSaves={canViewDeathSaves(entry)}
              editDeathSaves={canEditDeathSaves(entry)}
              onDeathSaves={(deathSaves) => setDeathSaves(entry, deathSaves)}
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
  showDeathSaves,
  editDeathSaves,
  onDeathSaves,
}: {
  entry: InitiativeEntry
  active: boolean
  showPrivateStats: boolean
  showDeathSaves: boolean
  editDeathSaves: boolean
  onDeathSaves: (deathSaves: { successes: number; failures: number }) => void
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
          <h2 className="min-w-0 break-words text-sm font-semibold text-textH">
            {initiativeEntryDisplayName(entry, "player")}
          </h2>
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              <Clock3 className="h-3 w-3" /> Turno atual
            </span>
          ) : null}
          {entry.downed ? (
            <span className="rounded-full border border-danger/50 bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger">
              Caído
            </span>
          ) : entry.defeated ? (
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
        {entry.downed && showDeathSaves ? (
          <div className="mt-2 rounded-lg border border-danger/40 bg-danger/10 p-2">
            <DeathSaveCounter
              entry={entry}
              editable={editDeathSaves}
              onChange={onDeathSaves}
            />
          </div>
        ) : null}
      </div>

      {showPrivateStats ? <PrivateStats entry={entry} /> : null}
    </article>
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
