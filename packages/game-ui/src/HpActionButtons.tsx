type Props = {
  compact?: boolean
  onHeal: () => void
  onDamage: () => void
}

/** Presentation-only HP actions; the host owns permissions and mutations. */
export function HpActionButtons({ compact = false, onHeal, onDamage }: Props) {
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-3"}>
      <button type="button" onClick={onHeal}
        className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs font-semibold text-textH transition-colors hover:border-accentBorder hover:bg-accentBg">
        Curar
      </button>
      <button type="button" onClick={onDamage}
        className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs font-semibold text-textH transition-colors hover:border-danger hover:bg-dangerBg">
        Dano
      </button>
    </div>
  )
}
