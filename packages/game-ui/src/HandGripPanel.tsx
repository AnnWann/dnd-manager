import type { ReactNode } from "react"
export function HandGripPanel({ hands, explanation, onSetHands, controls, blockers }: {
  hands: 1 | 2
  explanation: string
  onSetHands: (hands: 1 | 2) => void
  controls: ReactNode
  blockers?: ReactNode
}) {
  return <div className="grid gap-4">
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-sm font-semibold text-textH">Empunhadura atual: {hands} {hands === 1 ? "mão" : "mãos"}</div>
      <p className="mt-1 text-xs leading-5 text-textMuted">{explanation}</p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {([1, 2] as const).map(value =>
        <button key={value} type="button" onClick={() => onSetHands(value)}
          className={["rounded-lg border px-3 py-2 text-sm font-semibold",
            hands === value ? "border-accentBorder bg-accentBg text-textH" : "border-border bg-bg-subtle text-text"].join(" ")}>
          {value === 1 ? "Uma mão" : "Duas mãos"}
        </button>
      )}
    </div>
    <div className="grid gap-2 border-t border-border pt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">Destino ao retirar</div>
      {controls}
    </div>
    {blockers}
  </div>
}
