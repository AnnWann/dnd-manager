import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Ellipsis } from "lucide-react"

type Props = {
  label: string
  children: (close: () => void) => ReactNode
  placement?: "auto" | "above"
}

/** Render action menus in document.body to escape Card overflow and stacking contexts. */
export function InventoryFloatingMenu({ label, children, placement = "auto" }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    function positionMenu() {
      const anchor = triggerRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const width = menuRef.current?.offsetWidth ?? 192
      const height = menuRef.current?.offsetHeight ?? 240
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
      const below = rect.bottom + 4
      const above = rect.top - height - 4
      const top = placement === "above" && above >= 8
        ? above
        : below + height <= window.innerHeight - 8
          ? below
          : above >= 8
            ? above
            : Math.max(8, window.innerHeight - height - 8)
      setPosition(previous =>
        previous.top === top && previous.left === left ? previous : { top, left },
      )
    }
    positionMenu()
    window.addEventListener("resize", positionMenu)
    window.addEventListener("scroll", positionMenu, true)
    return () => {
      window.removeEventListener("resize", positionMenu)
      window.removeEventListener("scroll", positionMenu, true)
    }
  }, [open, placement])

  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={label}
        aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-textMuted hover:bg-bg-subtle">
        <Ellipsis className="h-4 w-4" />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div ref={menuRef} role="menu" aria-label={label}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[2147483000] max-h-[calc(100dvh-1rem)] min-w-48 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-2 shadow-theme-lg">
          {children(() => setOpen(false))}
        </div>,
        document.body,
      ) : null}
    </>
  )
}
