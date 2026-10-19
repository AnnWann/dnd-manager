import type { ReactNode } from "react"
import { ArrowLeft, Swords, TrendingUp } from "lucide-react"

/** Site character header extracted without changing its visuals or navigation semantics. */
export function CharacterSheetHeader({ name, id, onBack, onLevelUp, onCombat, inCombat = false, extra }: {
  name: string
  id?: string
  onBack?: () => void
  onLevelUp?: () => void
  onCombat?: () => void
  inCombat?: boolean
  extra?: ReactNode
}) {
  return <header className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    {onBack ? <button type="button" onClick={onBack}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-textH hover:bg-accentBg">
      <ArrowLeft className="h-4 w-4" /> Selecionar personagem
    </button> : null}
    <div className="min-w-0 flex-1 text-center sm:text-left">
      <div className="truncate font-semibold text-textH">{name}</div>
      {id ? <div className="truncate text-xs text-text">{id}</div> : null}
    </div>
    {inCombat && onCombat ? <button type="button" onClick={onCombat}
      className="order-last mx-auto inline-flex w-full items-center justify-center gap-2 rounded-lg border border-danger bg-dangerBg px-4 py-2 text-sm font-semibold text-danger transition hover:brightness-110 sm:absolute sm:left-1/2 sm:top-1/2 sm:order-none sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2"
      title="Abrir iniciativa"><Swords className="h-4 w-4"/> Em combate</button> : null}
    {onLevelUp ? <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={onLevelUp}
        className="inline-flex items-center gap-2 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm font-medium text-textH hover:bg-bg-subtle">
        <TrendingUp className="h-4 w-4"/> Subir de nível
      </button>
    </div> : null}
    {extra}
  </header>
}
