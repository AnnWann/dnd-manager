import { useEffect, useState } from "react"
import {
  initiativeEntryDisplayName,
  type InitiativeEntry,
  type InitiativeSession,
} from "../../web/src/models/initiative/Initiative"

type Props = {
  session: InitiativeSession | null
  isMaster: boolean
  connected: boolean
  onInitialize: () => boolean
  onOperation: (operation: Record<string, unknown>) => boolean
  resolveBonus: (entry: InitiativeEntry) => number
  rollingEnabled: boolean
}

export function OwlbearInitiativeStrip({ session, isMaster, connected, onInitialize, onOperation, resolveBonus, rollingEnabled }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [initiativeDraft, setInitiativeDraft] = useState("")
  const [error, setError] = useState("")
  const entries = (session?.entries ?? [])
    .filter(entry => isMaster || !entry.hidden)
    .sort((a, b) => a.order - b.order)
  const selected = isMaster ? entries.find(entry => entry.id === selectedId) : undefined

  useEffect(() => {
    setInitiativeDraft(selected === undefined ? "" : String(selected.initiative))
  }, [selected?.id, selected?.initiative])

  function send(type: string, extra: Record<string, unknown> = {}) {
    if (!connected || !isMaster || !onOperation({ type, characterId: "session", ...extra })) {
      setError("Não foi possível enviar a alteração ao servidor.")
      return
    }
    setError("")
  }

  function updateEntry(patch: Record<string, unknown>) {
    if (selected) send("initiative.entry.update", { entryId: selected.id, patch })
  }

  function removeSelected() {
    if (!selected || !window.confirm("Remover este turno da iniciativa?")) return
    send("initiative.entry.remove", { entryId: selected.id })
    setSelectedId(null)
  }

  return <aside className="owlbear-initiative-bar sticky top-0 z-30 border-b border-border bg-bg p-3 text-textH" aria-label="Ordem de iniciativa">
    <div className="mb-2 flex items-center justify-between gap-2">
      <strong className="text-sm">Iniciativa</strong>
      <span className="text-xs text-textMuted">{session?.started ? `Rodada ${session.round}` : "Combate não iniciado"}</span>
    </div>

    {entries.length ? <div className="owlbear-initiative-cards flex gap-2 overflow-x-auto pb-2" role="list">
      {entries.map(entry => {
        const active = Boolean(session?.started && session.activeEntryId === entry.id)
        const sharedTurns = entry.combatantId
          ? session?.entries.filter(other => other.combatantId === entry.combatantId) ?? []
          : []
        const turnIndex = sharedTurns.findIndex(other => other.id === entry.id)
        const name = initiativeEntryDisplayName(entry, isMaster ? "master" : "player")
        return <div role="listitem" key={entry.id}>
          <button
            type="button"
            disabled={!isMaster}
            aria-current={active ? "step" : undefined}
            aria-label={`${name}: iniciativa ${entry.initiative}${active ? ", turno atual" : ""}`}
            onClick={() => setSelectedId(current => current === entry.id ? null : entry.id)}
            className={`owlbear-initiative-card flex min-h-28 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors ${active ? "border-accentBorder bg-accentBg ring-2 ring-accent" : "border-border bg-bg-subtle"} ${selectedId === entry.id && isMaster ? "outline outline-2 outline-offset-1 outline-accent" : ""} ${entry.defeated ? "opacity-50" : ""}`}
          >
            {entry.imageUrl ? <img className="h-10 w-10 rounded-full object-cover" src={entry.imageUrl} alt="" /> : <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-bg font-semibold">{name.slice(0, 1)}</span>}
            <span className="line-clamp-2 w-full text-xs font-medium leading-tight">{name}</span>
            <strong className="text-lg tabular-nums" aria-label={`Iniciativa ${entry.initiative}`}>{entry.initiative}</strong>
            {sharedTurns.length > 1 ? <span className="text-[10px] text-textMuted">Turno {turnIndex + 1}/{sharedTurns.length}</span> : null}
            {entry.defeated ? <span className="text-[10px] text-textMuted">Derrotado</span> : null}
            {entry.hidden && isMaster ? <span className="text-[10px] text-textMuted">Oculto</span> : null}
          </button>
        </div>
      })}
    </div> : <p className="py-2 text-xs text-textMuted">{session ? "Nenhum participante na iniciativa." : "Aguardando a iniciativa da sessão."}</p>}

    {isMaster && <div className="mt-1 flex flex-wrap items-center gap-2" aria-label="Controles do mestre">
      {!session ? <button type="button" disabled={!connected} onClick={() => {
        if (!onInitialize()) setError("Não foi possível criar a iniciativa.")
        else setError("")
      }} className="rounded-lg border border-accentBorder bg-accentBg px-3 py-1.5 text-xs disabled:opacity-40">Criar iniciativa</button> : <>
        <button type="button" disabled={!connected || session.started || !session.entries.length} onClick={() => send("initiative.sort")} className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40">Ordenar</button>
        <button type="button" disabled={!connected || session.started || !session.entries.length} onClick={() => send("initiative.combat.start")} className="rounded-lg border border-accentBorder bg-accentBg px-3 py-1.5 text-xs disabled:opacity-40">Iniciar</button>
        <button type="button" disabled={!connected || !session.started} onClick={() => send("initiative.turn.previous")} className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
        <button type="button" disabled={!connected || !session.started} onClick={() => send("initiative.turn.next")} className="rounded-lg border border-accentBorder bg-accentBg px-3 py-1.5 text-xs disabled:opacity-40">Próximo turno</button>
        <button type="button" disabled={!connected || !session.started} onClick={() => {
          if (window.confirm("Encerrar o combate atual?")) send("initiative.combat.end")
        }} className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40">Encerrar</button>
      </>}
    </div>}

    {selected && isMaster && <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs">
      <div className="mb-2 font-semibold">{initiativeEntryDisplayName(selected, "master")}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">Iniciativa
          <input type="number" value={initiativeDraft} onChange={event => setInitiativeDraft(event.target.value)} className="w-20 rounded-lg border border-border bg-bg px-2 py-1.5" />
        </label>
        <button type="button" disabled={!connected || !Number.isFinite(Number(initiativeDraft)) || !initiativeDraft.trim()} onClick={() => updateEntry({ initiative: Number(initiativeDraft) })} className="rounded-lg border border-border px-2 py-1.5 disabled:opacity-40">Salvar</button>
        <button type="button" disabled={!connected || !rollingEnabled} onClick={() => {
          const initiativeBonus = resolveBonus(selected)
          if (!Number.isFinite(initiativeBonus)) { setError("Bônus de iniciativa inválido."); return }
          send("initiative.entry.update", {entryId:selected.id,patch:{initiativeBonus,initiative:Math.floor(Math.random()*20)+1+initiativeBonus}})
        }} className="rounded-lg border border-border px-2 py-1.5 disabled:opacity-40">Rolar d20</button>
        <button type="button" disabled={!connected} onClick={() => updateEntry({ hidden: !selected.hidden })} className="rounded-lg border border-border px-2 py-1.5 disabled:opacity-40">{selected.hidden ? "Revelar" : "Ocultar"}</button>
        <button type="button" disabled={!connected} onClick={() => updateEntry({ defeated: !selected.defeated })} className="rounded-lg border border-border px-2 py-1.5 disabled:opacity-40">{selected.defeated ? "Reativar" : "Derrotar"}</button>
        <button type="button" disabled={!connected} onClick={removeSelected} className="rounded-lg border border-danger px-2 py-1.5 text-danger disabled:opacity-40">Remover</button>
      </div>
      {session?.started && <p className="mt-2 text-textMuted">A ordem do combate iniciado permanece fixa; encerre e reinicie para reordenar.</p>}
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </aside>
}
