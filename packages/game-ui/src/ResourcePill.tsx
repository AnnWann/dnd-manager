export function ResourcePill({ label, current, max, onDecrease, onIncrease }: {
  label: string; current: number; max: number; onDecrease?: () => void; onIncrease?: () => void
}) {
  return <div className="flex min-h-14 min-w-0 max-w-full items-center gap-3 rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-sm sm:min-h-0 sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-xs">
    <span className="min-w-0 break-words font-semibold text-textH">{label}</span>
    <span className="shrink-0 text-textMuted">{current}/{max}</span>
    {onDecrease || onIncrease ? <div className="ml-auto flex shrink-0 gap-2 sm:gap-1">
      <button type="button" aria-label={`Diminuir ${label}`} disabled={!onDecrease || current <= 0} onClick={onDecrease} className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-bg text-xl font-semibold text-textH transition-colors hover:border-accentBorder hover:bg-accentBg disabled:opacity-35 sm:h-7 sm:w-7 sm:text-sm">−</button>
      <button type="button" aria-label={`Aumentar ${label}`} disabled={!onIncrease || current >= max} onClick={onIncrease} className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-bg text-xl font-semibold text-textH transition-colors hover:border-accentBorder hover:bg-accentBg disabled:opacity-35 sm:h-7 sm:w-7 sm:text-sm">+</button>
    </div> : null}
  </div>
}
