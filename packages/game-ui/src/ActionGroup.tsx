export type ActionGroupEntry = { id: string; name: string; usageMaximum?: number; usageRemaining?: number; customAbilityRoll?: { mode: string } }
export function ActionGroup<T extends ActionGroupEntry>({ title, entries, onSelect, emptyMessage }: {
  title: string; entries: readonly T[]; onSelect: (entry: T) => void; emptyMessage?: string
}) {
  return <div className="mt-3">
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">{title}</div>
    {entries.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {entries.map(entry => <button key={entry.id} type="button" onClick={() => onSelect(entry)}
        className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left text-xs font-semibold leading-4 text-textH transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <span className="block">{entry.name}</span>
        {entry.usageMaximum !== undefined ? <span className="mt-1 block text-[10px] font-medium text-textMuted">{entry.usageRemaining ?? 0}/{entry.usageMaximum} usos</span> : null}
        {entry.customAbilityRoll ? <span className="mt-1 block text-[10px] font-medium text-accent">{entry.customAbilityRoll.mode === "automatic" ? "rolagem automática" : "rolagem manual"}</span> : null}
      </button>)}
    </div> : <p className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-3 text-xs text-textMuted">{emptyMessage ?? "Nenhuma ação disponível."}</p>}
  </div>
}
