// features/characters/spells/SpellSlotsEditor.tsx

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getCustomSpellSlotPools,
  restoreCustomSpellSlot,
  spendCustomSpellSlot,
} from "../../../models/characters/customClassConfig"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

const SLOT_LEVELS: MagicCircleLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function SpellSlotsEditor({
  character,
  updateCharacter,
}: Props) {
  const slots = character.getSpellSlots()
  const pactSlots = character.getPactSlots()
  const customPools = getCustomSpellSlotPools(character)

  function spendSlot(level: MagicCircleLevel) {
    updateCharacter(character.get("id"), (c) =>
      c.spendSpellSlot(level),
    )
  }

  function restoreSlot(level: MagicCircleLevel) {
    updateCharacter(character.get("id"), (c) =>
      c.restoreSpellSlot(level),
    )
  }

  function spendPactSlot() {
    updateCharacter(character.get("id"), (c) =>
      c.spendPactSlot(),
    )
  }

  function restorePactSlot() {
    updateCharacter(character.get("id"), (c) =>
      c.restorePactSlot(),
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Espaços de magia
        </div>

        <div className="mt-1 text-xs text-text">
          Slots derivados das classes e pools adicionais configurados.
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3">
          {SLOT_LEVELS.map((level) => {
            const slot = slots[level]

            if (!slot || slot.max <= 0) return null

            return (
              <SlotRow
                key={level}
                label={`Nível ${level}`}
                current={slot.current}
                max={slot.max}
                onSpend={() => spendSlot(level)}
                onRestore={() => restoreSlot(level)}
              />
            )
          })}

          {pactSlots ? (
            <SlotRow
              label={`Pacto — Nível ${pactSlots.level}`}
              current={pactSlots.current}
              max={pactSlots.max}
              onSpend={spendPactSlot}
              onRestore={restorePactSlot}
            />
          ) : null}

          {customPools.map((pool) => (
            <div key={pool.id} className="rounded-lg border border-accentBorder bg-accentBg/20 p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-textH">{pool.name}</div>
                  <div className="text-[11px] text-textMuted">
                    Pool independente • recupera em descanso {pool.recovery === "short" ? "curto" : "longo"}
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                {SLOT_LEVELS.map((level) => {
                  const slot = pool.slots[level]
                  if (!slot || slot.max <= 0) return null
                  return (
                    <SlotRow
                      key={`${pool.id}-${level}`}
                      label={`Nível ${level}`}
                      current={slot.current}
                      max={slot.max}
                      compact
                      onSpend={() => updateCharacter(character.get("id"), (current) => spendCustomSpellSlot(current, pool.id, level))}
                      onRestore={() => updateCharacter(character.get("id"), (current) => restoreCustomSpellSlot(current, pool.id, level))}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SlotRow({
  label,
  current,
  max,
  onSpend,
  onRestore,
  compact = false,
}: {
  label: string
  current: number
  max: number
  onSpend: () => void
  onRestore: () => void
  compact?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border border-border ${compact ? "bg-bg px-3 py-2" : "p-3"}`}>
      <div>
        <div className="text-sm font-medium text-textH">{label}</div>
        <div className="text-xs text-text">{current}/{max} disponíveis</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={current <= 0} onClick={onSpend}>
          Gastar
        </Button>
        <Button size="sm" variant="secondary" disabled={current >= max} onClick={onRestore}>
          Restaurar
        </Button>
      </div>
    </div>
  )
}
