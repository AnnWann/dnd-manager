import { useState } from "react"
import { Dices, Eye, EyeOff, History, Send } from "lucide-react"
import { parseManualDiceExpression } from "../../web/src/shared/session-runtime/manualDiceExpression"
import type { SessionDiceRollResult, SessionActionRollResult } from "../../web/src/shared/session-runtime/diceRollProtocol"

export type DiceHistoryEntry =
  | { kind: "dice"; result: SessionDiceRollResult }
  | { kind: "action"; result: SessionActionRollResult }

const PRESETS = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100"]
const field = "w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-textH focus:outline-none focus:ring-2 focus:ring-accentBorder"

export function SessionDicePanel({ connected, selectedCharacterId, onRoll, history }: {
  connected: boolean
  selectedCharacterId?: string
  onRoll: (request: Record<string, unknown>) => boolean
  history: DiceHistoryEntry[]
}) {
  const [expression, setExpression] = useState("1d20")
  const [label, setLabel] = useState("")
  const [visibility, setVisibility] = useState<"public" | "roller-master">("public")
  const [error, setError] = useState("")
  const [lastRequested, setLastRequested] = useState("")
  function roll(value = expression) {
    const parsed = parseManualDiceExpression(value)
    if (!parsed.ok) {
      setError("Expressão de dados inválida.")
      return
    }
    const requestId = crypto.randomUUID()
    const sent = onRoll({
      requestId,
      ...(selectedCharacterId ? { characterId: selectedCharacterId } : {}),
      label: label.trim() || "Rolagem manual",
      mode: "normal",
      visibility,
      source: { type: "manual", expression: parsed.value.expression },
    })
    if (!sent) { setError("Sessão desconectada. Nenhuma rolagem enviada."); return }
    setLastRequested(requestId)
    setError("")
    setExpression(value)
  }
  return <div className="grid gap-4 p-3 sm:p-4">
    <section className="grid gap-3 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="flex items-center gap-2 text-textH"><Dices className="h-5 w-5 text-accent"/><h2 className="text-base font-semibold">Rolador de dados</h2></div>
      <p className="text-xs text-textMuted">Rolagens processadas pelo servidor da sessão, como no D&D Manager.</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {PRESETS.map(die => <button type="button" key={die} disabled={!connected} onClick={()=>roll(die)}
          className="rounded-lg border border-border bg-bg-subtle px-2 py-3 text-xs font-semibold text-textH hover:border-accentBorder hover:bg-accentBg disabled:opacity-40">{die.replace("1","")}</button>)}
      </div>
      <label className="grid gap-1 text-xs font-medium text-textH">Expressão
        <input className={field} value={expression} onChange={e=>setExpression(e.target.value)} placeholder="2d6+3" onKeyDown={e=>{if(e.key==="Enter")roll()}}/>
      </label>
      <label className="grid gap-1 text-xs font-medium text-textH">Descrição (opcional)
        <input className={field} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Teste, dano, iniciativa..."/>
      </label>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textH"
          onClick={()=>setVisibility(v=>v==="public"?"roller-master":"public")}>
          {visibility==="public"?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}
          {visibility==="public"?"Pública":"Privada (você e mestre)"}
        </button>
        <button type="button" disabled={!connected} onClick={()=>roll()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4"/>Rolar</button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {lastRequested && !history.some(entry=>entry.result.requestId===lastRequested) && <p className="text-xs text-textMuted">Aguardando resultado do servidor...</p>}
    </section>
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-3 flex items-center gap-2 text-textH"><History className="h-4 w-4"/><h3 className="text-sm font-semibold">Rolagens da sessão</h3></div>
      {history.length===0 ? <p className="text-xs text-textMuted">As próximas rolagens aparecerão aqui.</p> : <div className="grid gap-2">
        {history.map(entry=>{
          const result=entry.result
          const title=entry.kind==="dice"?entry.result.label:entry.result.title
          const total=entry.kind==="dice"?entry.result.total:(entry.result.attack?.total ?? entry.result.primary?.total ?? entry.result.damage?.total)
          return <div key={result.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3">
            <div className="min-w-0"><div className="truncate text-xs font-semibold text-textH">{title}</div>
              <div className="text-[11px] text-textMuted">{result.sourceName || "Sessão"}{result.visibility==="roller-master"?" · Privada":""}</div>
            </div>
            <strong className="text-xl tabular-nums text-textH">{typeof total==="number"?total:"—"}</strong>
          </div>
        })}
      </div>}
    </section>
  </div>
}
