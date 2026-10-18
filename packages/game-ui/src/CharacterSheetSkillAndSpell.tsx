import type { ReactNode, MouseEvent } from "react"

/** Search and results rendering only. Skill lookup and permission checks stay in the host. */
export function CharacterSheetSkillSearch({
  query, onQueryChange, hasQuery, hasResults, children,
}: {
  query: string
  onQueryChange: (value: string) => void
  hasQuery: boolean
  hasResults: boolean
  children: ReactNode
}) {
  return <>
    <input value={query} aria-label="Buscar perícia pelo nome"
      placeholder="Buscar perícia pelo nome"
      className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-textH"
      onChange={event => onQueryChange(event.target.value)} />
    {hasQuery
      ? hasResults
        ? <div className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
        : <p className="mt-2 text-xs text-textMuted">Nenhuma perícia corresponde à busca.</p>
      : <p className="mt-2 text-xs text-textMuted">Digite para localizar uma perícia.</p>}
  </>
}

export function CharacterSheetSpellAttackTile({
  label, attackBonus, saveDc, onRoll,
}: {
  label: string
  attackBonus: string
  saveDc: number
  onRoll: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return <div className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</div>
    <div className="mt-1 flex items-baseline justify-center gap-2">
      <button type="button" className="rounded px-1 text-sm font-bold text-textH hover:bg-bg hover:text-accent" onClick={onRoll}>{attackBonus}</button>
      <span className="text-[10px] text-textMuted">CD</span>
      <span className="text-sm font-bold text-textH">{saveDc}</span>
    </div>
  </div>
}
