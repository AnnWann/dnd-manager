import type { ReactNode, MouseEvent } from "react"

/** Display-only weapon attack card. Dice, ammunition and mutations are supplied by its host. */
export function WeaponAttackTile({
  name, hands, improvised, attackBonus, damage, onOpen, onRollAttack, onRollDamage, ammunition,
}: {
  name: string
  hands: 1 | 2
  improvised: boolean
  attackBonus: string
  damage: string
  onOpen: () => void
  onRollAttack: (event: MouseEvent<HTMLButtonElement>) => void
  onRollDamage: () => void
  ammunition?: ReactNode
}) {
  return <div className="min-w-0 rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center transition-colors hover:border-accentBorder">
    <button type="button" title="Abrir opções de empunhadura, guardar ou largar" onClick={onOpen}
      className="flex w-full min-w-0 items-center justify-center gap-1 rounded-md text-[10px] uppercase tracking-wide text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <span className="truncate">{name || "Arma"}{improvised ? " · imp." : ""}</span>
      <span className="shrink-0 rounded-full border border-accentBorder bg-accentBg px-1 py-0.5 text-[9px] font-semibold text-accent">{hands}M</span>
    </button>
    <button type="button" onClick={onRollAttack}
      className="mt-1 rounded px-1 text-lg font-bold text-textH hover:bg-accentBg hover:text-accent">{attackBonus}</button>
    <button type="button" onClick={onRollDamage} title="Clique para rolar o dano no servidor."
      className="block w-full rounded text-[10px] font-medium text-textMuted hover:bg-accentBg hover:text-accent">{damage}</button>
    {ammunition}
  </div>
}
