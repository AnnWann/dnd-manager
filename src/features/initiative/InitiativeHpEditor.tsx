type HpTarget = {
  id: string
  currentHp: number
  maxHp: number
  temporaryHp?: number
}
import { cn } from '../../lib/cn'
import { Input } from '../../components/ui/Input'

type Props = {
  target: HpTarget
  canEditHp: boolean
  onUpdateCurrentHp: (characterId: string, currentHp: number, temporaryHp?: number) => void
  className?: string
}

export function InitiativeHpEditor({ target, canEditHp, onUpdateCurrentHp, className }: Props) {
  if (canEditHp) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs text-text">HP</span>
        <Input
          type="number"
          min={0}
          max={Math.max(0, target.maxHp)}
          className="h-8 w-20 text-xs"
          value={target.currentHp}
          onChange={(e) => onUpdateCurrentHp(target.id, Number(e.target.value) || 0, target.temporaryHp)}
        />
        <span className="text-xs text-text">/ {target.maxHp}</span>

        <span className="text-xs text-text">HP Temp.</span>
        <Input
          type="number"
          min={0}
          className="h-8 w-20 text-xs"
          value={target.temporaryHp ?? 0}
          onChange={(e) => onUpdateCurrentHp(target.id, target.currentHp, Number(e.target.value) || 0)}
        />
      </div>
    )
  }

  return (
    <span className={cn('text-xs text-text', className)}>
      HP {target.currentHp}/{target.maxHp} — Temp {target.temporaryHp ?? 0}
    </span>
  )
}