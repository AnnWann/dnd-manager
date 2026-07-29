import { X } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

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

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex h-dvh w-screen items-stretch justify-stretch overflow-hidden sm:items-center sm:justify-center sm:p-4">
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
          "relative z-10 flex h-dvh max-h-dvh w-full max-w-3xl flex-col overflow-hidden bg-bg-elevated shadow-theme-lg sm:h-auto sm:max-h-[92dvh] sm:rounded-xl sm:border sm:border-border",
          className,
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg-elevated px-4 py-3 sm:px-5">
          <h2 className="min-w-0 break-words font-heading text-lg font-semibold text-textH">
            {title}
          </h2>
          <Button
            className="shrink-0"
            size="icon"
            variant="ghost"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  )
}
