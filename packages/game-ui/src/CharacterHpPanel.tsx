import type { ReactNode } from "react"

/** Character HP framing with host-owned HP and hit-dice actions. */
export function CharacterHpPanel({ hp, hitDice, title = "Pontos de Vida", subtitle = "Combate" }: {
  hp: ReactNode
  hitDice: ReactNode
  title?: string
  subtitle?: string
}) {
  return <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-textH">{title}</h2>
      <span className="text-xs text-textMuted">{subtitle}</span>
    </div>
    {hp}
    <div className="mt-4 border-t border-border pt-3">{hitDice}</div>
  </section>
}
