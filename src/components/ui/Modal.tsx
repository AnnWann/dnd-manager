import { X } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { cn } from "../../lib/cn"
import { Button } from "./Button"

type ModalProps = {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ title, description, onClose, children, className }: ModalProps) {
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
    <div className="fixed inset-0 z-[10000] flex h-screen w-screen items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]",
          className,
        )}
      >
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg-elevated/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="min-w-0">
            <h2 className="break-words font-heading text-lg font-semibold text-textH">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-textMuted">
                {description}
              </p>
            ) : null}
          </div>
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
