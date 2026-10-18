import { Grid2X2, List, Swords } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "../components/ui/Button"
import { Modal } from "../components/ui/Modal"
import { useSyncContext } from "../contexts/syncContext"
import { InitiativeCards } from "../features/initiative/InitiativeCards"
import {
  CreatureQuickSheet,
  quickSheetFromCompendiumCreature,
} from "../features/creatures/CreatureQuickSheet"
import { InitiativeTable } from "../features/initiative/InitiativeTable"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import { initiativeEntryDisplayName, type InitiativeEntry } from "../models/initiative/Initiative"

type PlayerViewMode = "table" | "cards"

export function InitiativePlayerView() {
  const { session, hydrated } = useInitiativeSession()
  const runtime = useOptionalSessionRuntime()
  const { userKey } = useSyncContext()
  const [viewMode, setViewMode] = useState<PlayerViewMode>("cards")
  const [viewingCreatureEntryId, setViewingCreatureEntryId] = useState<string>()
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const ownedCharacterIds = useMemo(() => {
    const normalizedUserKey = userKey.trim()
    if (!normalizedUserKey || !runtime) return new Set<string>()

    return new Set(
      Object.values(runtime.sessionCharactersById)
        .filter(
          (character) =>
            character.active &&
            character.ownerUserId?.trim() === normalizedUserKey,
        )
        .map((character) => character.characterId),
    )
  }, [runtime?.sessionCharactersById, userKey])

  const ownedCreaturesById = useMemo(
    () =>
      new Map(
        (runtime?.runtimeConfigSnapshot?.config.creatureCompendium ?? []).map(
          (creature) => [creature.id, creature] as const,
        ),
      ),
    [runtime?.runtimeConfigSnapshot],
  )

  const entries = useMemo(
    () => session.entries.filter((entry) => !entry.hidden),
    [session.entries],
  )
  const active = entries.find((entry) => entry.id === session.activeEntryId)
  const viewingCreatureEntry = viewingCreatureEntryId
    ? entries.find((entry) => entry.id === viewingCreatureEntryId)
    : undefined
  const viewingCreatureId = creatureIdFromSourceId(viewingCreatureEntry?.sourceId)
  const viewingCreature = viewingCreatureId
    ? ownedCreaturesById.get(viewingCreatureId)
    : undefined

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

  const canViewPrivateStats = (entry: InitiativeEntry) => {
    if (!entry.sourceId) return false
    if (ownedCharacterIds.has(entry.sourceId)) return true
    const creatureId = creatureIdFromSourceId(entry.sourceId)
    return Boolean(creatureId && ownedCreaturesById.has(creatureId))
  }
  const canOpenCreature = (entry: InitiativeEntry) => {
    const creatureId = creatureIdFromSourceId(entry.sourceId)
    return Boolean(creatureId && ownedCreaturesById.has(creatureId))
  }
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
      <header className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-textH">
              <Swords className="h-4 w-4 text-accent" />
              Iniciativa
            </div>
            <p className="mt-1 text-xs text-textMuted">
              Visualização compartilhada. Somente o mestre pode alterar o combate.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs lg:justify-end">
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
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm">
          <InitiativeCards
            entries={entries}
            activeEntryId={session.activeEntryId}
            roundAnchorEntryId={session.roundAnchorEntryId}
            round={session.round}
            started={session.started}
            cardRefs={cardRefs}
            readOnly
            canViewPrivateStats={canViewPrivateStats}
            canOpenEntry={canOpenCreature}
            patchEntry={noop}
            onOpen={(entryId) => setViewingCreatureEntryId(entryId)}
            onCondition={noop}
            onRemove={noop}
            onTrade={noop}
            canTrade={() => false}
            onRemoveCondition={noop}
          />
        </section>
      ) : (
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm">
          <InitiativeTable entries={entries} activeEntryId={session.activeEntryId} roundAnchorEntryId={session.roundAnchorEntryId} round={session.round} started={session.started} readOnly canViewPrivateStats={canViewPrivateStats} canOpenEntry={canOpenCreature} canViewDeathSaves={canViewDeathSaves} canEditDeathSaves={canEditDeathSaves} onDeathSaves={(entry, deathSaves) => setDeathSaves(entry, deathSaves)} patchEntry={noop} onOpen={(entryId) => setViewingCreatureEntryId(entryId)} onCondition={noop} onRemove={noop} onTrade={noop} canTrade={() => false} onRemoveCondition={noop} />
        </section>
      )}

      {viewingCreature && viewingCreatureEntry ? (
        <Modal
          title={viewingCreature.name}
          onClose={() => setViewingCreatureEntryId(undefined)}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={quickSheetFromCompendiumCreature(
              viewingCreature,
              viewingCreatureEntry,
              { enableRolls: true },
            )}
            preferImage={Boolean(viewingCreature.sheetImageUrl)}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function creatureIdFromSourceId(sourceId?: string): string | undefined {
  const prefix = "compendium:"
  return sourceId?.startsWith(prefix) ? sourceId.slice(prefix.length) : undefined
}

function formatHp(entry: InitiativeEntry): string {
  const current = entry.currentHp ?? 0
  const maximum = entry.maxHp
  const temporary = entry.temporaryHp ?? 0
  const base = maximum === undefined ? String(current) : `${current}/${maximum}`
  return temporary > 0 ? `${base} +${temporary} temp.` : base
}