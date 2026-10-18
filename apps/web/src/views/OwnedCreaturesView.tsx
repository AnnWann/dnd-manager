import { BookOpen, FileImage, PawPrint } from "lucide-react"
import { useMemo, useState } from "react"

import { Modal } from "../components/ui/Modal"
import {
  CreatureQuickSheet,
  quickSheetFromCompendiumCreature,
} from "../features/creatures/CreatureQuickSheet"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { CompendiumCreature } from "../models/creatures/CompendiumCreature"
import type { InitiativeEntry } from "../models/initiative/Initiative"

export function OwnedCreaturesView() {
  const runtime = useOptionalSessionRuntime()
  const { session } = useInitiativeSession()
  const [viewingCreatureId, setViewingCreatureId] = useState<string>()

  const creatures = runtime?.runtimeConfigSnapshot?.config.creatureCompendium ?? []
  const initiativeByCreatureId = useMemo(() => {
    const result = new Map<string, InitiativeEntry>()
    for (const entry of session.entries) {
      const creatureId = creatureIdFromSourceId(entry.sourceId)
      if (!creatureId || result.has(creatureId)) continue
      result.set(creatureId, entry)
    }
    return result
  }, [session.entries])

  const viewingCreature = creatures.find(
    (creature) => creature.id === viewingCreatureId,
  )
  const viewingEntry = viewingCreature
    ? initiativeByCreatureId.get(viewingCreature.id)
    : undefined

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex items-center gap-3">
          <PawPrint className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-heading text-xl font-semibold text-textH">
              Minhas criaturas
            </h1>
            <p className="mt-1 text-sm text-text">
              Familiares, montarias e companheiros atribuídos a você pelo mestre.
            </p>
          </div>
        </div>
      </section>

      {creatures.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {creatures.map((creature) => (
            <OwnedCreatureCard
              key={creature.id}
              creature={creature}
              initiativeEntry={initiativeByCreatureId.get(creature.id)}
              onOpen={() => setViewingCreatureId(creature.id)}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-bg p-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-textMuted" />
          <h2 className="mt-3 text-sm font-semibold text-textH">
            Nenhuma criatura atribuída
          </h2>
          <p className="mt-1 text-sm text-textMuted">
            O mestre pode atribuir uma criatura a você pelo Compêndio de Criaturas.
          </p>
        </section>
      )}

      {viewingCreature ? (
        <Modal
          title={viewingCreature.name}
          onClose={() => setViewingCreatureId(undefined)}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={quickSheetFromCompendiumCreature(
              viewingCreature,
              viewingEntry,
              { enableRolls: true },
            )}
            preferImage={Boolean(viewingCreature.sheetImageUrl)}
          />
          {!viewingEntry && viewingCreature.spellcasting ? (
            <div className="mt-3 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">
              Recursos de magia são controlados pela iniciativa. Adicione a criatura
              ao combate para consumir espaços e usos por dia.
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}

function OwnedCreatureCard({
  creature,
  initiativeEntry,
  onOpen,
}: {
  creature: CompendiumCreature
  initiativeEntry?: InitiativeEntry
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="overflow-hidden rounded-xl border border-border bg-bg text-left shadow-theme-sm transition-colors hover:border-accentBorder"
      onClick={onOpen}
    >
      <div className="aspect-[16/9] w-full overflow-hidden border-b border-border bg-bg-subtle">
        {creature.sheetImageUrl ? (
          <img
            src={creature.sheetImageUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileImage className="h-10 w-10 text-textMuted" />
          </div>
        )}
      </div>

      <div className="grid gap-3 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold text-textH">
              {creature.name}
            </h2>
            {initiativeEntry ? (
              <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                Na iniciativa
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-textMuted">
            {[creature.size, creature.category, creature.challengeRating && `ND ${creature.challengeRating}`]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="CA" value={String(initiativeEntry?.armorClass ?? creature.armorClass ?? "—")} />
          <MiniStat label="PV" value={formatHp(initiativeEntry, creature)} />
          <MiniStat label="Init." value={signed(creature.initiativeBonus)} />
        </div>
      </div>
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-2">
      <div className="text-[10px] font-semibold uppercase text-textMuted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-textH">{value}</div>
    </div>
  )
}

function creatureIdFromSourceId(sourceId?: string): string | undefined {
  const prefix = "compendium:"
  return sourceId?.startsWith(prefix) ? sourceId.slice(prefix.length) : undefined
}

function formatHp(
  entry: InitiativeEntry | undefined,
  creature: CompendiumCreature,
): string {
  const current = entry?.currentHp ?? creature.maxHp
  const maximum = entry?.maxHp ?? creature.maxHp
  if (current === undefined && maximum === undefined) return "—"
  if (maximum === undefined) return String(current ?? "—")
  return `${current ?? maximum}/${maximum}`
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}
