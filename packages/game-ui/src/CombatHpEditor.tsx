export type DamagePartView = { amount: number; damageType?: string; magical?: boolean }
export type DamagePreviewView = { id: string; name: string; requested: number; applied: number; rules: readonly string[] }
export function CombatHpEditor({ mode, amount, parts, damageTypes, previews, valid, onAmountChange, onPartsChange, onSubmit, onCancel }: {
  mode: "damage" | "heal" | "temporary"
  amount: number
  parts: readonly DamagePartView[]
  damageTypes: readonly { value: string; label: string }[]
  previews: readonly DamagePreviewView[]
  valid: boolean
  onAmountChange: (amount: number) => void
  onPartsChange: (parts: DamagePartView[]) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const cls = "h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-textH"
  const label = (type?: string) => damageTypes.find(option => option.value === type)?.label ?? type
  return <>
    {mode === "damage" ? <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-sm font-semibold text-textH">Componentes de dano</div>
          <p className="mt-0.5 text-xs text-textMuted">Cada tipo é resolvido separadamente contra imunidade, resistência e vulnerabilidade.</p>
        </div>
        <button type="button" className="rounded-md border border-border px-3 py-2 text-xs text-textH"
          onClick={() => onPartsChange([...parts, { amount: 1, magical: false }])}>+ Componente</button>
      </div>
      {parts.map((part, index) => <div key={index} className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="grid gap-1 text-xs text-textMuted">Valor
          <input type="number" min={1} className={cls} value={part.amount}
            onChange={event => onPartsChange(parts.map((entry, i) => i === index ? {...entry, amount: Math.max(0, Math.trunc(Number(event.target.value)))} : entry))}/>
        </label>
        <label className="grid gap-1 text-xs text-textMuted">Tipo
          <select className={cls} value={part.damageType ?? ""}
            onChange={event => onPartsChange(parts.map((entry, i) => i === index ? {...entry, damageType: event.target.value || undefined} : entry))}>
            <option value="">Sem tipo / ignorar afinidades</option>
            {damageTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-textH">
          <input type="checkbox" checked={part.magical === true}
            onChange={event => onPartsChange(parts.map((entry, i) => i === index ? {...entry, magical: event.target.checked} : entry))}/> Mágico
        </label>
        <button type="button" title="Remover componente" disabled={parts.length === 1}
          onClick={() => onPartsChange(parts.filter((_, i) => i !== index))}
          className="h-10 rounded-md border border-border px-3 text-xs text-danger disabled:opacity-50">Remover</button>
      </div>)}
    </div> : <label className="grid max-w-xs gap-1.5 text-sm text-textH">
      <span className="font-medium">Valor</span>
      <input type="number" min={1} autoFocus className={cls} value={amount}
        onChange={event => onAmountChange(Math.max(0, Math.trunc(Number(event.target.value))))}/>
    </label>}
    <section className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-textMuted">Prévia</div>
      <div className="grid max-h-56 gap-2 overflow-y-auto">
        {previews.map(preview => <div key={preview.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs">
          <span className="font-semibold text-textH">{preview.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "damage" && parts.length === 1 && parts[0].damageType ? <span className="text-textMuted">{label(parts[0].damageType)}</span> : null}
            <span className={preview.applied !== preview.requested ? "font-bold text-accent" : "font-semibold text-textH"}>
              {preview.requested}{preview.applied !== preview.requested ? ` → ${preview.applied}` : ""}
            </span>
            {preview.rules.map(rule => <span key={rule} className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 font-semibold text-accent">{rule}</span>)}
          </div>
        </div>)}
      </div>
    </section>
    <div className="flex justify-end gap-2 border-t border-border pt-3">
      <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-xs text-textH">Cancelar</button>
      <button type="button" disabled={!valid} onClick={onSubmit} className="rounded-md border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH disabled:opacity-50">
        {mode === "damage" ? "Aplicar dano" : mode === "heal" ? "Curar" : "Adicionar PV temporários"}
      </button>
    </div>
  </>
}
