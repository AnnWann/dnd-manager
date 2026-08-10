import { useEffect } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type {
  Metamagic,
  MetamagicId,
} from "../../../models/magic/metamagic/Metamagic"

type Props = {
  open: boolean
  options: Metamagic[]
  selected: MetamagicId[]
  max: number
  onChange: (selected: MetamagicId[]) => void
  onClose: () => void
}

export function MetamagicSelectionModal({
  open,
  options,
  selected,
  max,
  onChange,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  function toggle(id: MetamagicId) {
    if (selected.includes(id)) {
      onChange(selected.filter((entry) => entry !== id))
      return
    }
    if (selected.length >= max) return
    onChange([...selected, id])
  }

  return createPortal(
    <div className="fixed inset-0 z-[12500] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escolher metamagias"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">
              Escolher metamagias
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              {selected.length}/{max} selecionadas
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {options.map((metamagic) => {
            const isSelected = selected.includes(metamagic.id)
            const disabled = !isSelected && selected.length >= max
            return (
              <button
                key={metamagic.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(metamagic.id)}
                className={
                  isSelected
                    ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left text-sm font-medium text-textH"
                    : "rounded-xl border border-border bg-bg p-3 text-left text-sm font-medium text-text disabled:opacity-45"
                }
              >
                {metamagic.name}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
