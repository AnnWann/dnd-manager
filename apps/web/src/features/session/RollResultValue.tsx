import type { ReactNode } from "react"
import { requestRollAdjustment } from "../../lib/diceRoller"
import type { SessionRollAdjustmentRequest, SessionDiceRollMode } from "../../shared/session-runtime/diceRollProtocol"

export const nextRollMode = (mode: SessionDiceRollMode): SessionDiceRollMode =>
  mode === "normal" ? "advantage" : mode === "advantage" ? "disadvantage" : "normal"

export type RollValueAdjustment = {
  adjustment?: SessionRollAdjustmentRequest
  onAdjust?: (request: SessionRollAdjustmentRequest) => void
}

export function RollResultValue({ children, className, adjustment, onAdjust = requestRollAdjustment }: RollValueAdjustment & { children: ReactNode; className?: string }) {
  if (!adjustment) return <span className={className}>{children}</span>
  const action = adjustment.target === "damage"
    ? adjustment.critical ? "Marcar dano como crítico" : "Remover crítico do dano"
    : adjustment.mode === "advantage" ? "Aplicar vantagem" : adjustment.mode === "disadvantage" ? "Aplicar desvantagem" : "Voltar à rolagem normal"
  return <button type="button" title={action + " · Mestre"} aria-label={action}
    onClick={() => onAdjust(adjustment)}
    className={className + " cursor-pointer rounded px-1 hover:bg-accentBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accentBorder"}>
    {children}
  </button>
}
