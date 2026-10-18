/** Presentation-only active ammunition control; host performs inventory/session mutations. */
export function WeaponAmmunitionBar({ name, description, quantity, canSpend, onConfigure, onSpend }: {
  name: string
  description?: string
  quantity: number
  canSpend: boolean
  onConfigure: () => void
  onSpend: () => void
}) {
  return <div className="mt-2 border-t border-border pt-2">
    <div className="flex min-w-0 items-center gap-1.5">
      <button type="button" onClick={onConfigure}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[10px] font-medium text-text hover:bg-bg"
        title="Selecionar e configurar munições desta arma">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <span className={quantity > 0 ? "shrink-0 text-[10px] font-bold text-textH" : "shrink-0 text-[10px] font-bold text-danger"}
        title="Quantidade disponível">{quantity}</span>
      <button type="button" aria-label={`Gastar 1 ${name}`}
        disabled={!canSpend} onClick={onSpend}
        className="flex h-7 w-8 shrink-0 items-center justify-center rounded-md border border-accentBorder bg-accentBg text-accent transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40">−</button>
      <button type="button" aria-label="Configurar ou gastar várias munições" title="Configurar munições" onClick={onConfigure}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-textMuted hover:border-borderStrong hover:text-textH">⚙</button>
    </div>
    {description?.trim() ? <div className="mt-1 truncate px-1.5 text-[9px] text-textMuted" title={description}>{description}</div> : null}
  </div>
}
