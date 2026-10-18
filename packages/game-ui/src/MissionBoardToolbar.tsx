import type { ReactNode } from "react"

export function MissionBoardToolbar<TStatus extends string>({
  statuses, search, onSearchChange, placeholder,
}: {
  statuses: readonly { status: TStatus; label: string; count: number; icon: ReactNode }[]
  search: string
  onSearchChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {statuses.map((entry) => (
          <div key={entry.status} className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
              {entry.icon}
            </span>
            <div>
              <div className="text-xl font-bold text-textH">{entry.count}</div>
              <div className="text-xs text-textMuted">{entry.label}</div>
            </div>
          </div>
        ))}
      </div>
      <label className="relative mt-4 block">
        <input
          type="search"
          className="h-10 w-full rounded-lg border border-border bg-bg pl-9 pr-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </span>
      </label>
    </>
  )
}
