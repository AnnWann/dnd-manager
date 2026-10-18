export type ManualDamageField = {
  id: string
  label: string
  dice: string
  critical?: boolean
}
export function ManualActionRollFields({ primary, damages, values, physicalDice, attack, onPrimaryChange, onDamageChange }: {
  primary?: { label: string; instructions: string; value: string }
  damages: readonly ManualDamageField[]
  values: readonly string[]
  physicalDice: boolean
  attack: boolean
  onPrimaryChange: (value: string) => void
  onDamageChange: (index: number, value: string) => void
}) {
  const fieldStyle = "h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-textH"
  return <div className="grid gap-2">
    {primary ? <label className="grid gap-1 rounded-xl border border-accentBorder bg-accentBg/30 p-3">
      <span className="text-xs font-semibold text-textH">{primary.label}</span>
      <span className="text-[11px] leading-4 text-textMuted">{primary.instructions}</span>
      <input className={fieldStyle} type="number" inputMode="decimal" placeholder="Resultado" value={primary.value}
        onChange={event => onPrimaryChange(event.target.value)}/>
    </label> : null}
    {damages.map((damage, index) => <label key={damage.id} className="grid gap-1 rounded-xl border border-border bg-bg-subtle p-3">
      <span className="text-xs font-semibold text-textH">{damage.label}</span>
      <span className="text-[11px] leading-4 text-textMuted">
        Role {damage.dice}{physicalDice ? " com seus dados físicos" : ""} e informe o resultado somente dos dados.
        {attack && damage.critical !== false ? " Em um 20 natural, dobre os dados deste componente." : ""}
      </span>
      <input className={fieldStyle} type="number" inputMode="decimal" placeholder="Dano rolado" value={values[index] ?? ""}
        onChange={event => onDamageChange(index, event.target.value)}/>
    </label>)}
  </div>
}
