export type AmmunitionOption = { key: string; name: string; description?: string; quantity: number }
export function AmmunitionSelectionList({
  options, compatibleKeys, selectedKey, groupName, onToggleCompatible, onSelect,
}: {
  options: readonly AmmunitionOption[]
  compatibleKeys: readonly string[]
  selectedKey: string
  groupName: string
  onToggleCompatible: (key: string, enabled: boolean) => void
  onSelect: (key: string) => void
}) {
  if (!options.length) return <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-textMuted">
    Nenhum item do tipo Munição está no inventário deste personagem.
  </div>
  return <div className="grid gap-2">
    {options.map(option => {
      const compatible = compatibleKeys.includes(option.key)
      return <article key={option.key} className="rounded-xl border border-border bg-bg-subtle p-3">
        <div className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={compatible}
            onChange={event => onToggleCompatible(option.key, event.target.checked)}
            aria-label={`${option.name}: compatível`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold text-textH">{option.name || "Munição"}</div>
              <div className="shrink-0 text-xs font-bold text-textH">{option.quantity}</div>
            </div>
            {option.description?.trim() ? <p className="mt-1 text-xs leading-5 text-textMuted">{option.description}</p> : null}
            <label className="mt-2 flex items-center gap-2 text-xs text-text">
              <input type="radio" name={groupName} checked={selectedKey === option.key} disabled={!compatible}
                onChange={() => onSelect(option.key)} /> Usar como munição ativa
            </label>
          </div>
        </div>
      </article>
    })}
  </div>
}
