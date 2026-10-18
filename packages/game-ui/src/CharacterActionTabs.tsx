export type ActionFilterOption<T extends string> = { value: T; label: string }
/** Filter selection is controlled by the host; neither rules nor navigation are imported. */
export function CharacterActionTabs<T extends string>({ filters, selected, onSelect }: {
  filters: readonly ActionFilterOption<T>[]
  selected: T
  onSelect: (filter: T) => void
}) {
  return <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4" role="tablist" aria-label="Filtrar ações">
    {filters.map(option => <button key={option.value} type="button" role="tab"
      aria-selected={selected === option.value}
      onClick={() => onSelect(option.value)}
      className={["rounded-md px-2 py-2 text-xs font-semibold transition-colors",
        selected === option.value ? "bg-accentBg text-textH shadow-theme-sm" : "text-textMuted hover:bg-bg hover:text-textH"].join(" ")}>
      {option.label}
    </button>)}
  </div>
}
