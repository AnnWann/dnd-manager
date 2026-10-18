import type { MouseEvent } from "react"

/** Display-only unarmed attack. Host supplies modifier, damage and roll execution. */
export function UnarmedAttackTile({ monkLevel, attackBonus, damage, onRollAttack, onRollDamage }: {
  monkLevel: number
  attackBonus: string
  damage: string
  onRollAttack: (event: MouseEvent<HTMLButtonElement>) => void
  onRollDamage: () => void
}) {
  return <div className="min-w-0 rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
    <div className="truncate text-[10px] uppercase tracking-wide text-textMuted">
      Ataque desarmado{monkLevel > 0 ? ` · M${monkLevel}` : ""}
    </div>
    <button type="button" onClick={onRollAttack}
      className="mt-1 rounded px-1 text-lg font-bold text-textH hover:bg-accentBg hover:text-accent">{attackBonus}</button>
    <button type="button" onClick={onRollDamage} title="Clique para rolar o dano no servidor."
      className="block w-full rounded text-[10px] font-medium text-textMuted hover:bg-accentBg hover:text-accent">{damage}</button>
  </div>
}
