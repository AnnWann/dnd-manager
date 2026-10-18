export type TransferDestination = { key: string; label: string }

/** Host-controlled inventory transfer dialog; no inventory or permission dependencies. */
export function InventoryTransferForm({
  itemName, maxQuantity, destinations, destinationKey, quantity,
  onDestinationChange, onQuantityChange, onSubmit, onClose,
}: {
  itemName: string
  maxQuantity: number
  destinations: readonly TransferDestination[]
  destinationKey: string
  quantity: number
  onDestinationChange: (key: string) => void
  onQuantityChange: (quantity: number) => void
  onSubmit: () => void
  onClose: () => void
}) {
  return <div className="fixed inset-0 z-[10000] flex max-w-full items-center justify-center overflow-x-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true"
      className="w-full min-w-0 max-w-md overflow-hidden rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4"
      onMouseDown={event => event.stopPropagation()}>
      <div className="min-w-0 border-b border-border pb-4">
        <h2 className="break-words text-base font-semibold text-textH">Transferir item</h2>
        <p className="mt-1 max-w-full break-words text-xs text-textMuted">{itemName || "Item sem nome"} • disponível: {maxQuantity}</p>
      </div>
      {!destinations.length
        ? <div className="max-w-full break-words py-6 text-center text-sm text-textMuted">Nenhum destino disponível para este item.</div>
        : <div className="grid min-w-0 max-w-full gap-4 py-4">
            <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-textH">Destino</span>
              <select className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-textH" value={destinationKey} onChange={event => onDestinationChange(event.target.value)}>
                {destinations.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-textH">Quantidade</span>
              <input className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-textH" type="number" min={1} max={maxQuantity} value={quantity}
                onChange={event => onQuantityChange(Number(event.target.value) || 1)}/>
            </label>
          </div>}
      <div className="flex min-w-0 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button type="button" className="h-10 rounded-md border border-border px-4 text-sm text-textH" onClick={onClose}>Cancelar</button>
        <button type="button" className="h-10 rounded-md border border-accentBorder bg-accentBg px-4 text-sm font-semibold text-textH disabled:opacity-50"
          disabled={!destinations.some(option => option.key === destinationKey)} onClick={onSubmit}>Transferir</button>
      </div>
    </div>
  </div>
}
