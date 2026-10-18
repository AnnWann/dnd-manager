export type ToggleOption<T extends string> = { value: T; label: string }
export function ConfigurationToggleGrid<T extends string>({ title, choices, selected, disabled, onToggle }: {
  title: string
  choices: readonly ToggleOption<T>[]
  selected: readonly T[]
  disabled: boolean
  onToggle: (value: T) => void
}) {
  return <div className="mt-5 rounded-xl border border-border bg-bg-subtle p-3">
    <div className="text-xs font-semibold text-textH">{title}</div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {choices.map(choice => {
        const checked = selected.includes(choice.value)
        return <button key={choice.value} type="button" disabled={disabled}
          aria-pressed={checked} onClick={() => onToggle(choice.value)}
          className={["rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-default disabled:opacity-70",
            checked ? "border-accentBorder bg-accentBg text-textH" : "border-border bg-bg text-text"].join(" ")}>
          {checked ? "✓ " : ""}{choice.label}
        </button>
      })}
    </div>
  </div>
}
