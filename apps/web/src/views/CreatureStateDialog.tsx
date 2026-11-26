import { useMemo, useState } from "react"

import { Modal } from "../components/ui/Modal"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Select } from "../components/ui/Select"
import { allCreatureFeatures, defaultCompanionState } from "../shared/session-runtime/companionRuntime"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../models/combat/Damage"
import {
  CreatureQuickSheet,
  quickSheetFromCompendiumCreature,
} from "../features/creatures/CreatureQuickSheet"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { CompendiumCreature } from "../models/creatures/CompendiumCreature"
import { createInitiativeEntry, type InitiativeEntry } from "../models/initiative/Initiative"

export function CreatureStateDialog({ creature, onClose }: { creature: CompendiumCreature; onClose: () => void }) {
  const runtime = useOptionalSessionRuntime()
  const { session } = useInitiativeSession()
  const [hpAmount, setHpAmount] = useState(1)
  const [hpMode, setHpMode] = useState<"damage" | "heal" | "temporary" | "set">("damage")
  const [damageType, setDamageType] = useState<DamageType>("bludgeoning")

  const initiativeByCreatureId = useMemo(() => {
    const result = new Map<string, InitiativeEntry>()
    for (const entry of session.entries) {
      const creatureId = creatureIdFromSourceId(entry.sourceId)
      if (!creatureId || result.has(creatureId)) continue
      result.set(creatureId, entry)
    }
    return result
  }, [session.entries])

  const viewingCreature = creature
  const viewingCompanion = viewingCreature ? runtime?.companionsById[viewingCreature.id] ?? defaultCompanionState(viewingCreature) : undefined
  const viewingEntry = viewingCreature
    ? initiativeByCreatureId.get(viewingCreature.id)
    : undefined
  const effectiveViewingEntry = viewingCreature && viewingCompanion
    ? {
        ...(viewingEntry ?? createInitiativeEntry({
          id: "companion:" + viewingCreature.id,
          sourceId: "compendium:" + viewingCreature.id,
          sourceType: "monster",
          name: viewingCreature.name,
          side: viewingCreature.defaultSide,
          initiative: 0,
          initiativeBonus: viewingCreature.initiativeBonus,
          armorClass: viewingCreature.armorClass,
          currentHp: viewingCompanion.currentHp,
          maxHp: viewingCompanion.maxHp,
          temporaryHp: viewingCompanion.temporaryHp,
        })),
        currentHp: viewingCompanion.currentHp,
        maxHp: viewingCompanion.maxHp,
        temporaryHp: viewingCompanion.temporaryHp,
        conditions: viewingCompanion.conditions ?? viewingEntry?.conditions ?? [],
        creatureFeatureResources: Object.fromEntries(allCreatureFeatures(viewingCreature)
          .filter(feature => feature.usage)
          .map(feature => [feature.id, {
            max: feature.usage!.max, used: viewingCompanion.featureUses[feature.id] ?? 0,
          }])),
        creatureSpellResources: {
          slots: Object.fromEntries(Object.entries(viewingCreature.spellcasting?.slots ?? {})
            .map(([level, max]) => [level, { max: max ?? 0, current: viewingCompanion.spellSlots[level] ?? max ?? 0 }])),
          perDay: Object.fromEntries((viewingCreature.spellcasting?.spells ?? [])
            .filter(spell => spell.usage.type === "perDay")
            .map(spell => [spell.spellIndex, {
              max: spell.usage.type === "perDay" ? spell.usage.uses : 0,
              used: viewingCompanion.spellPerDay?.[spell.spellIndex] ?? 0,
            }])),
        },
      } as InitiativeEntry
    : viewingEntry

  return (
        <Modal
          title={viewingCreature.name}
          onClose={() => onClose()}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={{
              ...quickSheetFromCompendiumCreature(
                viewingCreature, effectiveViewingEntry, { enableRolls: true },
              ),
              rollContext: { creatureId: viewingCreature.id, initiativeEntryId: viewingEntry?.id, canSpendOutsideInitiative: true },
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
  )
}

function creatureIdFromSourceId(sourceId?: string): string | undefined {
  const prefix = "compendium:"
  return sourceId?.startsWith(prefix) ? sourceId.slice(prefix.length) : undefined
}

