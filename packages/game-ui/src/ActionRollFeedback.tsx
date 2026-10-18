export type ActionRollFeedbackEntry = {
  label: string
  dice?: string
  diceValue: number | string
  formulaBonus?: number
  total: number | string
}
export function ActionRollFeedback({ results }: { results: readonly ActionRollFeedbackEntry[] }) {
  if (!results.length) return null
  return <div className="grid gap-2 rounded-xl border border-accentBorder bg-accentBg/30 p-3">
    <div className="text-xs font-semibold text-textH">Resultado da rolagem</div>
    {results.map((result, index) => <div key={`${result.label}-${index}`} className="rounded-lg border border-border bg-bg px-3 py-2 text-xs">
      <div className="font-semibold text-textH">{result.label}</div>
      <div className="mt-1 text-textMuted">
        {result.dice ? `${result.dice} = ` : "Dado = "}
        <span className="font-semibold text-textH">{result.diceValue}</span>
        {result.formulaBonus ? <> {result.formulaBonus > 0 ? "+" : "−"} {Math.abs(result.formulaBonus)} de fórmula</> : null}
      </div>
      <div className="mt-1 font-semibold text-accent">Total: {result.total}</div>
    </div>)}
  </div>
}
