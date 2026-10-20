import { BookOpen, FileImage, PawPrint } from "lucide-react"
import { useMemo, useState } from "react"

import { Modal } from "../components/ui/Modal"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Select } from "../components/ui/Select"
import { allCreatureFeatures, defaultCompanionState, type CompanionState } from "../shared/session-runtime/companionRuntime"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../models/combat/Damage"
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
  const [hpAmount, setHpAmount] = useState(1)
  const [hpMode, setHpMode] = useState<"damage" | "heal" | "temporary" | "set">("damage")
  const [damageType, setDamageType] = useState<DamageType>("bludgeoning")

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
  const viewingCompanion = viewingCreature ? runtime?.companionsById[viewingCreature.id] ?? defaultCompanionState(viewingCreature) : undefined
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
        <div className="grid gap-6">
          {(["familiar", "companion", "mount"] as const).map(kind => {
            const group = creatures.filter(creature => (creature.controlKind ?? "familiar") === kind)
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

      {viewingCreature ? (
        <Modal
          title={viewingCreature.name}
          onClose={() => setViewingCreatureId(undefined)}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={{
              ...quickSheetFromCompendiumCreature(
                viewingCreature, viewingEntry, { enableRolls: true },
              ),
              currentHp: viewingCompanion?.currentHp,
              maxHp: viewingCompanion?.maxHp,
              temporaryHp: viewingCompanion?.temporaryHp,
            }}
            preferImage={Boolean(viewingCreature.sheetImageUrl)}
          />
          {viewingCompanion && runtime ? (
            <section className="mt-4 grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
              <div className="font-semibold text-sm text-textH">Estado persistente do acompanhante</div>
              <p className="text-xs text-textMuted">PV e usos são mantidos pela sessão, mesmo fora da iniciativa.</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-xs text-textMuted">Aplicar
                  <Select value={hpMode} onChange={event => setHpMode(event.target.value as typeof hpMode)}>
                    <option value="damage">Dano</option>
                    <option value="heal">Cura</option>
                    <option value="temporary">PV temporários</option>
                    <option value="set">Definir PV</option>
                  </Select>
                </label>
                <label className="grid gap-1 text-xs text-textMuted">Quantidade
                  <Input type="number" min={0} value={hpAmount} onChange={event => setHpAmount(Math.max(0, Number(event.target.value) || 0))} />
                </label>
                {hpMode === "damage" ? (
                  <label className="grid gap-1 text-xs text-textMuted">Tipo
                    <Select value={damageType} onChange={event => setDamageType(event.target.value as DamageType)}>
                      {DAMAGE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </label>
                ) : null}
                <Button variant="secondary" onClick={() => runtime.dispatchCompanionOperation({
                  type: "hp", creatureId: viewingCreature.id, mode: hpMode, amount: hpAmount,
                  damageType: hpMode === "damage" ? damageType : undefined,
                })}>Aplicar</Button>
              </div>
              {allCreatureFeatures(viewingCreature).filter(feature => feature.usage).length ? (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold text-textH">Usos das habilidades</span>
                  {allCreatureFeatures(viewingCreature).filter(feature => feature.usage).map(feature => (
                    <div key={feature.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs">
                      <span>{feature.name}: {viewingCompanion.featureUses[feature.id] ?? 0}/{feature.usage!.max} usados</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => runtime.dispatchCompanionOperation({ type: "feature", creatureId: viewingCreature.id, featureId: feature.id, delta: -1 })}>Usar</Button>
                        <Button size="sm" variant="secondary" onClick={() => runtime.dispatchCompanionOperation({ type: "feature", creatureId: viewingCreature.id, featureId: feature.id, delta: 1 })}>Restaurar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {viewingCreature.spellcasting ? (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold text-textH">Espaços de magia disponíveis</span>
                  {Object.entries(viewingCreature.spellcasting.slots).map(([level, max]) => (
                    <div key={level} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs">
                      <span>Nível {level}: {viewingCompanion.spellSlots[level] ?? max ?? 0}/{max ?? 0}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => runtime.dispatchCompanionOperation({ type: "spellSlot", creatureId: viewingCreature.id, level: Number(level), delta: -1 })}>Gastar</Button>
                        <Button size="sm" variant="secondary" onClick={() => runtime.dispatchCompanionOperation({ type: "spellSlot", creatureId: viewingCreature.id, level: Number(level), delta: 1 })}>Restaurar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </Modal>
      ) : null}
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
          <MiniStat label="PV" value={companion ? `${companion.currentHp}/${companion.maxHp}` : formatHp(initiativeEntry, creature)} />
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
