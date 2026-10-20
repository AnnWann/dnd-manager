import { useEffect, useRef, useState } from "react"
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
  onRoll?: (entry: InitiativeEntry) => boolean
  rollingEnabled: boolean
  onClose?: () => void
  onExpand?: (expanded: boolean) => void
}

export function OwlbearInitiativeStrip({
  session, isMaster, connected, onInitialize, onOperation, resolveBonus, onRoll, rollingEnabled, onClose, onExpand,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [initiativeDraft, setInitiativeDraft] = useState("")
  const [error, setError] = useState("")
  const menuRef = useRef<HTMLDetailsElement>(null)
  const entries = [...(session?.entries ?? [])]
    .filter(entry => isMaster || !entry.hidden)
    .sort((a, b) => a.order - b.order)
  const selected = isMaster ? entries.find(entry => entry.id === selectedId) : undefined

  useEffect(() => {
    onExpand?.(Boolean(selected))
  }, [Boolean(selected), onExpand])

  useEffect(() => {
    setInitiativeDraft(selected === undefined ? "" : String(selected.initiative))
  }, [selected?.id, selected?.initiative])

  function send(type: string, extra: Record<string, unknown> = {}) {
    if (!connected || !isMaster || !onOperation({ type, characterId: "session", ...extra })) {
      setError("Não foi possível enviar a alteração ao servidor.")
      return
    }
    setError("")
    menuRef.current?.removeAttribute("open")
  }

  function updateEntry(patch: Record<string, unknown>) {
    if (selected) send("initiative.entry.update", { entryId: selected.id, patch })
  }

  function removeSelected() {
    if (!selected || !window.confirm("Remover este turno da iniciativa?")) return
    send("initiative.entry.remove", { entryId: selected.id })
    setSelectedId(null)
  }

  function reroll() {
    if (!selected || !rollingEnabled || !connected) return
    if (onRoll) {
      if (!onRoll(selected)) setError("Não foi possível enviar a rolagem.")
      else setError("")
      return
    }
    const initiativeBonus = resolveBonus(selected)
    if (!Number.isFinite(initiativeBonus)) {
      setError("Bônus de iniciativa inválido.")
      return
    }
    send("initiative.entry.update", {
      entryId: selected.id,
      patch: { initiativeBonus, initiative: Math.floor(Math.random() * 20) + 1 + initiativeBonus },
    })
  }

  return <aside className="owlbear-initiative-bar" aria-label="Ordem de iniciativa">
    <div className="owlbear-initiative-toolbar">
      <strong className="owlbear-initiative-heading">Iniciativa</strong>
      <span className="owlbear-initiative-round">{session?.started ? `Rodada ${session.round}` : "Preparação"}</span>
      <div className="owlbear-initiative-actions">
        {isMaster && <>
          {!session ? <button type="button" className="owlbear-initiative-primary" disabled={!connected} onClick={() => {
            if (!onInitialize()) setError("Não foi possível criar a iniciativa.")
            else setError("")
          }}>Criar</button> : !session.started
            ? <button type="button" className="owlbear-initiative-primary" disabled={!connected || !entries.length} onClick={() => send("initiative.combat.start")}>Iniciar</button>
            : <>
                <button type="button" title="Turno anterior" aria-label="Turno anterior" disabled={!connected} onClick={() => send("initiative.turn.previous")}>‹</button>
                <button type="button" className="owlbear-initiative-primary" title="Próximo turno" aria-label="Próximo turno" disabled={!connected} onClick={() => send("initiative.turn.next")}>›</button>
              </>
          }
          {session && <details className="owlbear-initiative-menu" ref={menuRef}>
            <summary title="Mais controles" aria-label="Mais controles">⋯</summary>
            <div className="owlbear-initiative-menu-content">
              <button type="button" disabled={!connected || session.started || !entries.length} onClick={() => send("initiative.sort")}>Ordenar por iniciativa</button>
              <button type="button" disabled={!connected || !session.started} onClick={() => {
                if (window.confirm("Encerrar o combate atual?")) send("initiative.combat.end")
              }}>Encerrar combate</button>
            </div>
          </details>}
        </>}
        {onClose && <button type="button" className="owlbear-initiative-close" title="Fechar iniciativa" aria-label="Fechar iniciativa" onClick={onClose}>×</button>}
      </div>
    </div>

    {entries.length ? <div className="owlbear-initiative-cards" role="list">
      {entries.map(entry => {
        const active = Boolean(session?.started && session.activeEntryId === entry.id)
        const sharedTurns = entry.combatantId
          ? session?.entries.filter(other => other.combatantId === entry.combatantId) ?? []
          : []
        const turnIndex = sharedTurns.findIndex(other => other.id === entry.id)
        const name = initiativeEntryDisplayName(entry, isMaster ? "master" : "player")
        return <div role="listitem" key={entry.id}>
          <button type="button" disabled={!isMaster}
            title={name + (sharedTurns.length > 1 ? ` · Turno ${turnIndex + 1}/${sharedTurns.length}` : "")}
            aria-label={`${name}: iniciativa ${entry.initiative}${active ? ", turno atual" : ""}`}
            aria-current={active ? "step" : undefined}
            onClick={() => setSelectedId(current => current === entry.id ? null : entry.id)}
            className={`owlbear-initiative-card${active ? " is-active" : ""}${selectedId === entry.id && isMaster ? " is-selected" : ""}${entry.defeated ? " is-defeated" : ""}`}
          >
            {entry.imageUrl
              ? <img className="owlbear-initiative-avatar" src={entry.imageUrl} alt="" />
              : <span className="owlbear-initiative-avatar avatar-fallback" aria-hidden="true">{name.slice(0, 1)}</span>}
            <strong className="owlbear-initiative-value" aria-label={`Iniciativa ${entry.initiative}`}>{entry.initiative}</strong>
            {sharedTurns.length > 1 && <span className="owlbear-initiative-turn">{turnIndex + 1}/{sharedTurns.length}</span>}
            {entry.hidden && isMaster && <span className="owlbear-initiative-flag" title="Oculto dos jogadores">◌</span>}
          </button>
        </div>
      })}
    </div> : <p className="owlbear-initiative-empty">{session ? "Nenhum participante." : "Aguardando sessão."}</p>}

    {selected && isMaster && <section className="owlbear-initiative-editor">
      <span className="owlbear-initiative-editor-name">{initiativeEntryDisplayName(selected, "master")}</span>
      <label>Iniciativa <input type="number" value={initiativeDraft} onChange={event => setInitiativeDraft(event.target.value)} /></label>
      <button type="button" disabled={!connected || !initiativeDraft.trim() || !Number.isFinite(Number(initiativeDraft))} onClick={() => updateEntry({ initiative: Number(initiativeDraft) })}>Salvar</button>
      <button type="button" disabled={!connected || !rollingEnabled} onClick={reroll}>Rolar</button>
      <button type="button" disabled={!connected} onClick={() => updateEntry({ hidden: !selected.hidden })}>{selected.hidden ? "Revelar" : "Ocultar"}</button>
      <button type="button" disabled={!connected} onClick={() => updateEntry({ defeated: !selected.defeated })}>{selected.defeated ? "Reativar" : "Derrotar"}</button>
      <button type="button" disabled={!connected} onClick={removeSelected}>Remover</button>
      <button type="button" title="Fechar edição" aria-label="Fechar edição" onClick={() => setSelectedId(null)}>×</button>
    </section>}
    {error && <p role="alert" className="owlbear-initiative-error">{error}</p>}
  </aside>
}
