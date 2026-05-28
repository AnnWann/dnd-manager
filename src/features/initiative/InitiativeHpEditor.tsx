type HpTarget = {
  id: string
  currentHp: number
  maxHp: number
}
import { cn } from '../../lib/cn'
import { Input } from '../../components/ui/Input'

type Props = {
  target: HpTarget
  canEditHp: boolean
  onUpdateCurrentHp: (characterId: string, currentHp: number) => void
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
          onChange={(e) => onUpdateCurrentHp(target.id, Number(e.target.value) || 0)}
        />
        <span className="text-xs text-text">/ {target.maxHp}</span>
      </div>
    )
  }

  return <span className={cn('text-xs text-text', className)}>HP {target.currentHp}/{target.maxHp}</span>
}