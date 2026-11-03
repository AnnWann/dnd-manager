import { BookOpen, PawPrint } from "lucide-react"
import { useMemo, useState } from "react"

import { CreatureStateDialog } from "./CreatureStateDialog"
import { CreaturePortraitCard } from "../features/creatures/CreaturePortraitCard"
import { type CompanionState } from "../shared/session-runtime/companionRuntime"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { CompendiumCreature } from "../models/creatures/CompendiumCreature"
import { type InitiativeEntry } from "../models/initiative/Initiative"

export function OwnedCreaturesView() {
  const runtime = useOptionalSessionRuntime()
  const { session } = useInitiativeSession()
  const [viewingCreatureId, setViewingCreatureId] = useState<string>()
  const creatures = runtime?.runtimeConfigSnapshot?.config.creatureCompendium.filter(creature => Boolean(creature.ownerUserId) && !creature.showInCompanions) ?? []
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
        <div className="grid gap-6">
          {(["familiar", "companion", "mount"] as const).map(kind => {
            const group = creatures.filter(creature => (creature.controlKind ?? "companion") === kind)
            return group.length ? (
              <section key={kind} className="grid gap-3">
                <h2 className="text-sm font-semibold text-textH">{kind === "companion" ? "Acompanhantes" : kind === "mount" ? "Montarias" : "Familiares"}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map(creature => (
                    <OwnedCreatureCard
                      key={creature.id}
                      creature={creature}
                      companion={runtime?.companionsById[creature.id]}
                      initiativeEntry={initiativeByCreatureId.get(creature.id)}
                      onOpen={() => setViewingCreatureId(creature.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null
          })}
        </div>
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

      {viewingCreature ? <CreatureStateDialog creature={viewingCreature} onClose={() => setViewingCreatureId(undefined)} /> : null}
    </div>
  )
}

function OwnedCreatureCard({
  creature,
  initiativeEntry,
  companion,
  onOpen,
}: {
  creature: CompendiumCreature
  companion?: CompanionState
  initiativeEntry?: InitiativeEntry
  onOpen: () => void
}) {
  return (
    <CreaturePortraitCard name={creature.name} imageUrl={creature.sheetImageUrl} onOpen={onOpen}>
      <div className="grid gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
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
          <MiniStat label="PV" value={companion ? `${companion.currentHp}/${companion.maxHp}` : formatHp(initiativeEntry, creature)} />
          <MiniStat label="Init." value={signed(creature.initiativeBonus)} />
        </div>
      </div>
    </CreaturePortraitCard>
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
