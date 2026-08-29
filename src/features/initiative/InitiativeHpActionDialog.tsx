import { Select as SharedSelect } from "../../components/ui/Select"
import { useMemo, useState } from "react"
import { HeartPulse, Plus, ShieldPlus, Trash2, Zap } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import {
  DAMAGE_TYPE_OPTIONS,
  damageAffinityLabel,
  damageTypeLabel,
  resolveDamage,
  type DamageAffinity,
  type DamageType,
} from "../../models/combat/Damage"
import type { InitiativeEntry } from "../../models/initiative/Initiative"
import type { InitiativeDamagePart } from "../session-runtime/initiativeSessionProtocol"

export type InitiativeHpActionMode = "damage" | "heal" | "temporary"

export type InitiativeHpActionPayload =
  | { mode: "damage"; parts: InitiativeDamagePart[] }
  | { mode: "heal" | "temporary"; amount: number }

export type InitiativeHpActionTarget = {
  entry: InitiativeEntry
  affinities: DamageAffinity[]
}

const selectClassName =
  "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export function InitiativeHpActionDialog({
  targets,
  initialMode,
  onClose,
  onApply,
}: {
  targets: InitiativeHpActionTarget[]
  initialMode: InitiativeHpActionMode
  onClose: () => void
  onApply: (payload: InitiativeHpActionPayload) => void
}) {
  const [mode, setMode] = useState<InitiativeHpActionMode>(initialMode)
  const [amount, setAmount] = useState(1)
  const [parts, setParts] = useState<InitiativeDamagePart[]>([
    { amount: 1, damageType: undefined, magical: false },
  ])

  const previews = useMemo(() =>
    targets.map(({ entry, affinities }) => {
      if (mode !== "damage") return { entry, requested: amount, applied: amount, rules: [] as string[] }
      const resolved = parts.map((part) => resolveDamage(part.amount, part.damageType, affinities, { magical: part.magical }))
      return {
        entry,
        requested: resolved.reduce((total, result) => total + result.requested, 0),
        applied: resolved.reduce((total, result) => total + result.applied, 0),
        rules: Array.from(new Set(resolved.flatMap((result) => result.affinity ? [damageAffinityLabel(result.affinity)] : []))),
      }
    }),
  [amount, mode, parts, targets])

  const valid = mode === "damage"
    ? parts.length > 0 && parts.every((part) => Number.isInteger(part.amount) && part.amount > 0)
    : Number.isInteger(amount) && amount > 0

  function submit() {
    if (!valid) return
    if (mode === "damage") {
      onApply({ mode, parts })
      return
    }
    onApply({ mode, amount })
  }

  return (
    <Modal
      title={mode === "damage" ? "Aplicar dano" : mode === "heal" ? "Aplicar cura" : "Adicionar PV temporários"}
      onClose={onClose}
      className="max-w-3xl"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mode === "damage" ? "danger" : "secondary"} onClick={() => setMode("damage")}>
            <Zap className="h-4 w-4" /> Dano
          </Button>
          <Button size="sm" variant={mode === "heal" ? "primary" : "secondary"} onClick={() => setMode("heal")}>
            <HeartPulse className="h-4 w-4" /> Cura
          </Button>
          <Button size="sm" variant={mode === "temporary" ? "primary" : "secondary"} onClick={() => setMode("temporary")}>
            <ShieldPlus className="h-4 w-4" /> PV temp.
          </Button>
          <span className="ml-auto self-center text-xs text-textMuted">
            {targets.length} alvo{targets.length === 1 ? "" : "s"}
          </span>
        </div>

        {mode === "damage" ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-textH">Componentes de dano</div>
                <p className="mt-0.5 text-xs text-textMuted">Cada tipo é resolvido separadamente contra imunidade, resistência e vulnerabilidade.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setParts((current) => [...current, { amount: 1, damageType: undefined, magical: false }])}>
                <Plus className="h-4 w-4" /> Componente
              </Button>
            </div>

            {parts.map((part, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto_auto] sm:items-end">
                <label className="grid gap-1 text-xs text-textMuted">
                  Valor
                  <Input
                    type="number"
                    min={1}
                    value={part.amount}
                    onChange={(event) => setParts((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, amount: Math.max(0, Math.trunc(Number(event.target.value))) } : entry))}
                  />
                </label>
                <label className="grid gap-1 text-xs text-textMuted">
                  Tipo
                  <SharedSelect
                    className={selectClassName}
                    value={part.damageType ?? ""}
                    onChange={(event) => setParts((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, damageType: event.target.value ? event.target.value as DamageType : undefined } : entry))}
                  >
                    <option value="">Sem tipo / ignorar afinidades</option>
                    {DAMAGE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SharedSelect>
                </label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-textH">
                  <input
                    type="checkbox"
                    checked={part.magical === true}
                    onChange={(event) => setParts((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, magical: event.target.checked } : entry))}
                  />
                  Mágico
                </label>
                <Button size="icon" variant="ghost" title="Remover componente" disabled={parts.length === 1} onClick={() => setParts((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <label className="grid max-w-xs gap-1.5 text-sm text-textH">
            <span className="font-medium">Valor</span>
            <Input type="number" min={1} value={amount} autoFocus onChange={(event) => setAmount(Math.max(0, Math.trunc(Number(event.target.value))))} />
          </label>
        )}

        <section className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-textMuted">Prévia</div>
          <div className="grid max-h-56 gap-2 overflow-y-auto">
            {previews.map(({ entry, requested, applied, rules }) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs">
                <span className="font-semibold text-textH">{entry.name}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {mode === "damage" && parts.length === 1 && parts[0].damageType ? (
                    <span className="text-textMuted">{damageTypeLabel(parts[0].damageType)}</span>
                  ) : null}
                  <span className={applied !== requested ? "font-bold text-accent" : "font-semibold text-textH"}>
                    {requested}{applied !== requested ? ` → ${applied}` : ""}
                  </span>
                  {rules.map((rule) => <span key={rule} className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 font-semibold text-accent">{rule}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant={mode === "damage" ? "danger" : "primary"} disabled={!valid} onClick={submit}>
            {mode === "damage" ? "Aplicar dano" : mode === "heal" ? "Curar" : "Adicionar PV temporários"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
