import type { ReactNode, MouseEvent } from "react"

/** Presentation-only building blocks for the main character sheet. */
export function CharacterSheetSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-textH">{title}</h2>
    {children}
  </section>
}

const formatSigned = (value: number) => value >= 0 ? `+${value}` : String(value)

export function CharacterSheetNumberField({
  label, value, onChange, min, max, signed = false, automaticValue, adjustment,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  signed?: boolean
  automaticValue?: number
  adjustment?: number
}) {
  const hasDerivedState = automaticValue !== undefined && adjustment !== undefined
  const hasManualAdjustment = hasDerivedState && Math.abs(adjustment) >= 0.000001
  return <label
    className={["grid min-w-0 gap-1 rounded-lg border bg-bg-subtle p-2 text-center",
      hasManualAdjustment ? "border-accentBorder" : "border-border"].join(" ")}
    title={hasDerivedState ? hasManualAdjustment
      ? `Valor manual. Automático: ${automaticValue}; ajuste: ${formatSigned(adjustment)}`
      : `Valor automático: ${automaticValue}` : undefined}
  >
    <span className="truncate text-[10px] uppercase tracking-wide text-textMuted">{label}</span>
    <input type="number" inputMode="decimal" min={min} max={max}
      className="h-8 min-w-0 rounded-md border border-border bg-bg px-1 text-center text-sm font-bold text-textH"
      value={value} aria-label={label} onChange={event => onChange(Number(event.target.value))} />
    {hasDerivedState ? <span className={["truncate text-[9px] font-semibold",
      hasManualAdjustment ? "text-accent" : "text-textMuted"].join(" ")}>
      {hasManualAdjustment ? `Manual · Auto ${automaticValue} · ${formatSigned(adjustment)}` : "Automático"}
    </span> : null}
    {signed ? <span className="sr-only">Valor atual {formatSigned(value)}</span> : null}
  </label>
}

export function CharacterSheetReadOnlyStat({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-accentBorder bg-accentBg px-2 py-2 text-center">
    <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
    <div className="mt-1 text-lg font-bold text-textH">{value}</div>
  </div>
}

export function CharacterSheetDerivedTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
    <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
    <div className="mt-1 text-lg font-bold text-textH">{value}</div>
  </div>
}

export function CharacterSheetAttributeCard({
  label, value, automaticValue, modifier, onChange, onRoll,
}: {
  label: string; value: number; automaticValue: number; modifier: string
  onChange: (value: number) => void
  onRoll: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const adjustment = value - automaticValue
  const manual = Math.abs(adjustment) >= 0.000001
  return <div className={["grid min-w-0 gap-1 rounded-lg border bg-bg-subtle p-2 text-center",
    manual ? "border-accentBorder" : "border-border"].join(" ")}
    title={manual
      ? `Valor manual: ${value}. Automático: ${automaticValue}; ajuste: ${formatSigned(adjustment)}`
      : `Valor automático: ${automaticValue}`}>
    <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</span>
    <input type="number" min={1} max={30} inputMode="numeric"
      className="h-8 min-w-0 rounded-md border border-border bg-bg px-1 text-center text-sm font-bold text-textH"
      value={value} onChange={event => onChange(Number(event.target.value))} aria-label={label} />
    <span className={["truncate text-[9px] font-semibold", manual ? "text-accent" : "text-textMuted"].join(" ")}>
      {manual ? `Manual · Auto ${automaticValue} · ${formatSigned(adjustment)}` : "Automático"}
    </span>
    <button type="button" onClick={onRoll}
      className="rounded text-xs font-bold text-textH hover:bg-accentBg hover:text-accent">{modifier}</button>
  </div>
}

export function CharacterSheetSaveCard({
  label, proficient, bonus, onToggle, onRoll,
}: {
  label: string; proficient: boolean; bonus: string
  onToggle: () => void
  onRoll: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return <div className={["flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
    proficient ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle"].join(" ")}>
    <button type="button" aria-pressed={proficient}
      title={`${label}: ${proficient ? "proficiente" : "não proficiente"}`}
      onClick={onToggle}
      className={["flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        proficient ? "border-accent bg-accent text-white" : "border-textMuted"].join(" ")}>
      {proficient ? <span aria-hidden="true">✓</span> : null}
    </button>
    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-textH">{label}</span>
    <button type="button" onClick={onRoll}
      className="shrink-0 rounded px-1 text-sm font-bold text-textH hover:bg-bg hover:text-accent">{bonus}</button>
  </div>
}
