import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "../../../../../../components/ui/Input"
import { Select } from "../../../../../../components/ui/Select"
import type { Die, DieSides } from "../../../../../../models/dice/Die"

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (die: Die) => void
}

const DIE_SIDES: DieSides[] = [
  "d2",
  "d3",
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
]

export function AddHitDiceDialog({ open, onClose, onAdd }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [sides, setSides] = useState<DieSides>("d8")

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  function handleAdd() {
    onAdd({
      quantity: Math.max(1, quantity),
      sides,
    })

    setQuantity(1)
    setSides("d8")
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div
        className="w-full max-w-sm rounded-lg border border-border p-4 shadow-xl"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <h2 className="text-sm font-medium text-textH">
          Adicionar dado de vida
        </h2>

        <div className="mt-4 flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-text">Quantidade</label>

            <Input
              type="number"
              min={1}
              className="mt-1"
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>

          <div className="flex-1">
            <label className="text-xs text-text">Dado</label>

            <Select
              className="mt-1"
              value={sides}
              onChange={(e) => setSides(e.target.value as DieSides)}
            >
              {DIE_SIDES.map((side) => (
                <option key={side} value={side}>
                  {side}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs text-text"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs text-textH"
            onClick={handleAdd}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}