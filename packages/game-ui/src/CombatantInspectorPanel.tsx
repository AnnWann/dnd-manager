import type { ReactNode } from "react"

/** Inspector shell independent of encounter source, character providers or combat state. */
export function CombatantInspectorPanel({ name, status, pinned, selected, canChangeHp, onTogglePinned, onCollapse, onHpAction, children }: {
  name?: string; status?: string; pinned: boolean; selected: boolean; canChangeHp: boolean
  onTogglePinned: () => void; onCollapse: () => void
  onHpAction: (mode: "damage" | "heal" | "temporary") => void
  children?: ReactNode
}) {
  return <aside className="sticky top-4 grid max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto rounded-xl border border-border bg-bg p-3 shadow-theme-lg">
    <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-textMuted">Painel do combatente</div>
        <div className="mt-1 truncate text-sm font-semibold text-textH">{name || "Nenhum combatente selecionado"}</div>
        {selected && status ? <div className="mt-1 text-[11px] text-textMuted">{status}</div> : null}
      </div>
      <div className="flex shrink-0 gap-1">
        {selected ? <button type="button" title={pinned ? "Voltar a seguir o turno" : "Fixar esta ficha"} onClick={onTogglePinned}
          className="rounded-md border border-border px-2 py-1 text-xs text-textH">{pinned ? "Desafixar" : "Fixar"}</button> : null}
        <button type="button" title="Ocultar painel" onClick={onCollapse}
          className="rounded-md border border-border px-2 py-1 text-xs text-textH">Ocultar</button>
      </div>
    </div>
    {selected && children ? <>
      <div className="grid grid-cols-3 gap-2">
        {(["damage", "heal", "temporary"] as const).map((mode, i) => <button key={mode} type="button"
          disabled={mode !== "temporary" && !canChangeHp} onClick={() => onHpAction(mode)}
          className="rounded-md border border-border bg-bg-subtle px-2 py-2 text-xs font-semibold text-textH disabled:opacity-50">
          {["Dano", "Cura", "Temp."][i]}
        </button>)}
      </div>
      {children}
    </> : <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-textMuted">
      Inicie o combate ou clique em um participante para manter sua ficha aqui.
    </div>}
  </aside>
}
