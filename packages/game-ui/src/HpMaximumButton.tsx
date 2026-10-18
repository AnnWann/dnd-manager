type Props = { value: number; reduced: boolean; onClick: () => void }

/** UI-only maximum HP control; callers own authorization and mutations. */
export function HpMaximumButton({ value, reduced, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center transition-colors hover:border-accentBorder hover:bg-accentBg"
    >
      <div className="text-[10px] uppercase tracking-wide text-textMuted">Vida máxima</div>
      <div className="mt-1 text-lg font-semibold text-textH">{value}</div>
      {reduced ? <div className="text-[9px] text-danger">reduzida</div> : null}
    </button>
  )
}
