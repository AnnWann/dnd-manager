import { X } from "lucide-react"
import { useEffect, type ReactNode } from "react"

import { cn } from "../../lib/cn"
import { Button } from "./Button"

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ title, onClose, children, className }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-bg-elevated p-5 shadow-theme-lg",
          className,
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-textH">
            {title}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {children}
      </section>
    </div>
  )
}
