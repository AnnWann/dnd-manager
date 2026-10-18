import type { ReactNode } from "react"

/** Host-configured character statistic views. Never reads character models or session state. */
export function CharacterConfigStatCell({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-bg-subtle p-2 text-center">
    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-textMuted">{label}</div>
    {children}
  </div>
}
export function CharacterConfigStatValue({ value }: { value: string }) {
  return <div className="flex h-10 items-center justify-center text-xl font-bold text-textH">{value}</div>
}
export function CharacterConfigSaveToggle({ label, bonus, proficient, disabled, onToggle }: {
  label: string; bonus: string; proficient: boolean; disabled: boolean; onToggle: () => void
}) {
  return <button type="button" disabled={disabled} aria-pressed={proficient} onClick={onToggle}
    className={["flex min-h-12 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left",
      proficient ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle",
      !disabled ? "hover:border-accentBorder" : ""].join(" ")}>
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        proficient ? "border-accent bg-accent text-white" : "border-textMuted"].join(" ")}>
        {proficient ? "✓" : null}
      </span>
      <span className="text-xs font-bold text-textH">{label}</span>
    </span>
    <span className="text-sm font-bold text-textH">{bonus}</span>
  </button>
}
