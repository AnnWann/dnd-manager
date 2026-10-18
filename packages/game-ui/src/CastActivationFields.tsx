export function SpellCastChoiceField<T extends string | number>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
}) {
  return <label className="grid gap-1 text-xs text-textMuted">{label}
    <select className="h-9 rounded-lg border border-border bg-bg px-2 text-textH"
      value={value} onChange={event => {
        const selected = options.find(option => String(option.value) === event.target.value)
        if (selected) onChange(selected.value)
      }}>
      {options.map(option => <option key={String(option.value)} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
  </label>
}
export function AbilityActivationLevelField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max?: number; onChange: (value: number) => void
}) {
  return <label className="grid gap-1 rounded-xl border border-accentBorder bg-accentBg/30 p-3">
    <span className="text-xs font-semibold text-textH">{label || "Nível de uso"}</span>
    <span className="text-[11px] leading-4 text-textMuted">Escolha o nível desta ativação. Custos e fórmulas podem escalar com esse valor.</span>
    <input type="number" inputMode="numeric" min={min} max={max} step={1} value={value}
      className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-textH"
      onChange={event => onChange(Number(event.target.value))}/>
  </label>
}
