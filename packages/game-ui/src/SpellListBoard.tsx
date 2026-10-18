export type SpellListEntry = { key: string; name: string; level: number; source: string; cost?: string }
export type SpellActionFilter = { value: string; label: string }

export function SpellListBoard<T extends SpellListEntry>({
  entries, filters, selectedFilter, onFilterChange, availableLevels, levelFilter, onLevelChange, onSelect,
}: {
  entries: readonly T[]
  filters: readonly SpellActionFilter[]
  selectedFilter: string
  onFilterChange: (next: string) => void
  availableLevels: readonly number[]
  levelFilter: number | "all"
  onLevelChange: (next: number | "all") => void
  onSelect: (entry: T) => void
}) {
  return <>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Magias</h2>
        <p className="mt-1 text-[10px] text-textMuted">Magias conhecidas, preparadas ou concedidas.</p>
      </div>
      {availableLevels.length > 1 ? <label className="grid gap-1 text-[10px] text-textMuted">
        Nível
        <select className="h-8 rounded-lg border border-border bg-bg px-2 text-xs text-textH"
          value={levelFilter}
          onChange={event => onLevelChange(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value="all">Todos</option>
          {availableLevels.map(level => <option key={level} value={level}>{level === 0 ? "Truques" : `Nível ${level}`}</option>)}
        </select>
      </label> : null}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4">
      {filters.map(option => <button key={option.value} type="button" onClick={() => onFilterChange(option.value)}
        className={["rounded-md px-2 py-2 text-xs font-semibold",
          selectedFilter === option.value ? "bg-accentBg text-textH" : "text-textMuted"].join(" ")}>
        {option.label}
      </button>)}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {entries.map(entry => <button key={entry.key} type="button" onClick={() => onSelect(entry)}
        className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left hover:border-accentBorder hover:bg-accentBg">
        <div className="truncate text-xs font-semibold text-textH">{entry.name}</div>
        <div className="mt-1 text-[10px] text-textMuted">{entry.level === 0 ? "Truque" : `N${entry.level}`} • {entry.source}</div>
        {entry.cost ? <div className="mt-1 text-[10px] font-semibold text-accent">{entry.cost}</div> : null}
      </button>)}
    </div>
  </>
}
