import { useState } from "react"
import { HpActionButtons } from "./HpActionButtons"
import { HpValue } from "./HpValue"

/** Actual shared HP controls used by website and VTT adapters. Mutations belong to the host. */
export function SharedSessionHp({ current, max, temporary, hitDice, onHeal, onDamage, canEdit = true }: {
  current: number; max: number; temporary: number
  hitDice?: Readonly<Record<string, { current: number; max: number }>>
  onHeal: (amount: number) => void
  onDamage: (amount: number) => void
  canEdit?: boolean
}) {
  const [operation, setOperation] = useState<"heal" | "damage" | null>(null)
  const [value, setValue] = useState("")
  function apply() {
    const amount = Number(value)
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000) return
    if (operation === "heal") onHeal(amount)
    if (operation === "damage") onDamage(amount)
    setOperation(null); setValue("")
  }
  return <div className="session-hp-shared">
    <h3>HP</h3>
    <div className="session-hp-values">
      <HpValue label="Vida atual" value={current}/>
      <HpValue label="Vida máxima" value={max}/>
      <HpValue label="Vida temporária" value={temporary}/>
    </div>
    {canEdit ? <HpActionButtons compact onHeal={() => setOperation("heal")} onDamage={() => setOperation("damage")}/> : null}
    {operation && <div className="session-hp-operation">
      <label>{operation === "heal" ? "Cura" : "Dano"}
        <input autoFocus type="number" min={1} max={100000} step={1} value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <button type="button" onClick={apply} disabled={!Number.isSafeInteger(Number(value)) || Number(value) <= 0}>Aplicar</button>
      <button type="button" onClick={() => setOperation(null)}>Cancelar</button>
    </div>}
    {hitDice && Object.keys(hitDice).length > 0 ? <div className="session-hit-dice">
      <h4>Dados de vida</h4>
      {Object.entries(hitDice).map(([die, pool]) => <div key={die}>{die}: {pool.current} / {pool.max}</div>)}
    </div> : null}
  </div>
}
