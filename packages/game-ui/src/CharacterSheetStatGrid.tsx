import type { ReactNode } from "react"
export type PortableStat = { id: string; label: string; value: string; hint?: string; onClick?: () => void }
export function CharacterSheetStatGrid({ stats, extra }: { stats: readonly PortableStat[]; extra?: ReactNode }) {
  return <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-textH">Stats</h2>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {stats.map(stat => <div key={stat.id}
        className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-border bg-bg-subtle p-2 text-center">
        <div className="text-[10px] uppercase tracking-wide text-textMuted">{stat.label}</div>
        {stat.onClick ? <button type="button" title={stat.hint} onClick={stat.onClick}
          className="mt-1 font-bold text-sm text-textH hover:text-accent">{stat.value}</button> :
          <div className="mt-1 font-bold text-sm text-textH">{stat.value}</div>}
        {stat.hint ? <div className="mt-1 text-[9px] text-textMuted">{stat.hint}</div> : null}
      </div>)}
      {extra}
    </div>
  </section>
}
