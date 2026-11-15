import { Select } from "../../components/ui/Select"
import type { SessionActionRollResult, SessionDiceRollResult, SessionResolvedDamageRoll, SessionRollAdjustmentRequest } from "../../shared/session-runtime/diceRollProtocol"
import { requestRollAdjustment } from "../../lib/diceRoller"

type Props = {
  roll: SessionActionRollResult | SessionDiceRollResult
  onAdjust?: (request: SessionRollAdjustmentRequest) => void
}

/** Mounted only for masters; the server independently enforces this permission. */
export function RollAdjustmentControls({ roll, onAdjust = requestRollAdjustment }: Props) {
  const modes: { target: "dice" | "attack" | "primary"; instanceIndex?: number; label: string; mode: string }[] = []
  const damages: { damage: SessionResolvedDamageRoll; instanceIndex?: number; damageIndex: number; label: string }[] = []
  if ("kind" in roll) {
    if (roll.natural !== undefined && roll.groups.length === 1 && roll.groups[0].sides === 20) {
      modes.push({ target: "dice", label: roll.label, mode: roll.mode })
    }
    if (roll.kind === "damage") damages.push({ damage: { ...roll, critical: roll.critical ?? false }, damageIndex: 0, label: roll.label })
    roll.damages?.forEach((damage, index) => damages.push({ damage, damageIndex: index + (roll.kind === "damage" ? 1 : 0), label: damage.label || "Dano" }))
  } else {
    if (roll.attack) modes.push({ target: "attack", label: "Ataque", mode: roll.attack.mode })
    if (roll.primary?.natural !== undefined && roll.primary.groups.length === 1 && roll.primary.groups[0].sides === 20) {
      modes.push({ target: "primary", label: roll.primary.label, mode: roll.primary.mode })
    }
    ;[...(roll.damage ? [roll.damage] : []), ...(roll.damages ?? [])].forEach((damage, damageIndex) => damages.push({ damage, damageIndex, label: damage.label || "Dano" }))
    roll.instances?.forEach((instance, instanceIndex) => {
      if (instance.attack) modes.push({ target: "attack", instanceIndex, label: instance.label, mode: instance.attack.mode })
      instance.damages?.forEach((damage, damageIndex) => damages.push({ damage, damageIndex, instanceIndex, label: instance.label + " · " + (damage.label || "Dano") }))
    })
  }
  const eligible = damages.filter(({ damage }) => damage.damageType !== "healing")
  if (!modes.length && !eligible.length) return null
  return <details className="rounded-lg border border-border bg-bg-subtle px-3 py-2">
    <summary className="cursor-pointer text-[11px] font-semibold text-textH">Ajustar rolagem · Mestre</summary>
    <div className="mt-2 grid gap-2">
      {modes.map((entry, index) => <label key={"mode:" + index} className="grid gap-1 text-[11px] text-textH">
        {entry.label}
        <Select aria-label={"Modo de " + entry.label} value={entry.mode}
          className="rounded border border-border bg-bg px-2 py-1 text-textH"
          onChange={event => onAdjust({ rollId: roll.id, target: entry.target, instanceIndex: entry.instanceIndex, mode: event.target.value as "normal" | "advantage" | "disadvantage" })}>
          <option value="normal">Normal</option><option value="advantage">Vantagem</option><option value="disadvantage">Desvantagem</option>
        </Select>
      </label>)}
      {eligible.map((entry, index) => <label key={"damage:" + index} className="flex items-center gap-2 text-[11px] text-textH">
        <input type="checkbox" checked={entry.damage.critical}
          onChange={event => onAdjust({ rollId: roll.id, target: "damage", instanceIndex: entry.instanceIndex, damageIndex: entry.damageIndex, critical: event.target.checked })}/>
        {entry.label} · Crítico
      </label>)}
      <p className="text-[10px] text-textMuted">Mantém o dado original. PV já aplicados não são recalculados.</p>
    </div>
  </details>
}
