export function LevelSelectionGrid({ title, description, levels, selectedLevels, disabled, onToggle }: {
  title: string
  description: string
  levels: readonly number[]
  selectedLevels: readonly number[]
  disabled: boolean
  onToggle: (level: number) => void
}) {
  return <div className="mt-5 rounded-xl border border-border bg-bg-subtle p-3">
    <div className="text-xs font-semibold text-textH">{title}</div>
    <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
    <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
      {levels.map(level => {
        const selected = selectedLevels.includes(level)
        return <button key={level} type="button" disabled={disabled} aria-pressed={selected}
          onClick={() => onToggle(level)}
          className={["rounded-lg border px-2 py-2 text-xs font-semibold disabled:cursor-default disabled:opacity-70",
            selected ? "border-accentBorder bg-accentBg text-textH" : "border-border bg-bg text-textMuted"].join(" ")}>
          {selected ? "✓ " : ""}{level}
        </button>
      })}
    </div>
  </div>
}
