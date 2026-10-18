import type { ReactNode } from "react"

/** Standalone labelled combat-stat panel. */
export function StatShell({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-h-24 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    <div className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-textMuted">{label}</div>
    {children}
  </div>
}
