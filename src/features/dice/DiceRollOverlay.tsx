import { useEffect, useState } from "react"

import { DICE_ROLL_RESULT_EVENT } from "../../lib/diceRoller"
import { formatSigned } from "../../lib/formatSigned"
import type { SessionDiceRollResult } from "../../shared/session-runtime/diceRollProtocol"

const MAX_HISTORY = 8

export function DiceRollOverlay() {
  const [history, setHistory] = useState<SessionDiceRollResult[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    function onRoll(event: Event) {
      const result = (event as CustomEvent<SessionDiceRollResult>).detail
      if (!result) return
      setHistory((current) => [result, ...current].slice(0, MAX_HISTORY))
    }
    window.addEventListener(DICE_ROLL_RESULT_EVENT, onRoll)
    return () => window.removeEventListener(DICE_ROLL_RESULT_EVENT, onRoll)
  }, [])

  const latest = history[0]
  if (!latest) return null

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(92vw,340px)] rounded-xl border border-accentBorder bg-bg p-3 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-textH">{latest.label}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-textMuted">{modeLabel(latest)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={latest.natural === 20 ? "text-2xl font-black text-success" : latest.natural === 1 ? "text-2xl font-black text-danger" : "text-2xl font-black text-textH"}>
            {latest.total}
          </div>
          <div className="text-[10px] text-textMuted">{formatBreakdown(latest)}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <button type="button" className="text-[10px] font-semibold text-accent hover:underline" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Ocultar histórico" : `Histórico (${history.length})`}
        </button>
        <button type="button" className="text-[10px] text-textMuted hover:text-textH" onClick={() => setHistory([])}>Limpar</button>
      </div>
      {expanded ? (
        <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
          {history.slice(1).map((roll) => (
            <div key={roll.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-subtle px-2 py-1.5">
              <span className="min-w-0 truncate text-[11px] text-text">{roll.label}</span>
              <span className="shrink-0 text-xs font-bold text-textH">{roll.total}</span>
            </div>
          ))}
          {history.length === 1 ? <div className="text-[10px] text-textMuted">Nenhuma rolagem anterior.</div> : null}
        </div>
      ) : null}
    </aside>
  )
}

function modeLabel(result: SessionDiceRollResult): string {
  if (result.kind === "damage") return "Dano"
  if (result.mode === "advantage") return "Vantagem"
  if (result.mode === "disadvantage") return "Desvantagem"
  return "Rolagem"
}

function formatBreakdown(result: SessionDiceRollResult): string {
  const group = result.groups[0]
  if (!group) return String(result.total)
  if (result.kind === "damage") {
    const dice = group.rolls.join(" + ")
    return `(${dice})${result.modifier ? ` ${formatSigned(result.modifier)}` : ""}`
  }
  const d20 = group.rolls.length > 1 ? `[${group.rolls.join(", ")}] → ${group.kept}` : String(group.kept ?? group.rolls[0])
  return `${d20}${result.modifier ? ` ${formatSigned(result.modifier)}` : ""}`
}
