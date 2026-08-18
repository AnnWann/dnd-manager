import type { DieSides } from "../../../../../../models/dice/Die"

type Props = {
  side: DieSides
  current: number
  max: number
  onUse: () => void
  onRecover: () => void
  onRemove: () => void
}

export function HitDiceRow({
  side,
  current,
  max,
  onUse,
  onRecover,
  onRemove,
}: Props) {
  return (
    <div className="grid grid-cols-[1fr_80px_80px_32px] items-center gap-2">
      <span className="text-sm text-text">
        {current}{side} / {max}{side}
      </span>

      <button
        type="button"
        disabled={current <= 0}
        className="rounded-md border border-border px-2 py-1 text-xs text-text disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onUse}
      >
        Usar
      </button>

      <button
        type="button"
        disabled={current >= max}
        className="rounded-md border border-border px-2 py-1 text-xs text-text disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onRecover}
      >
        Rec.
      </button>

      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-text"
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  )
}
