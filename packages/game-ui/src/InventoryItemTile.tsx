import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Ellipsis, Package, Sword, FlaskConical, Shield, Backpack } from "lucide-react"
export type InventoryTileData = {
  name?: string
  quantity?: number
  weight?: number
  kind?: string
  equipSlot?: string
  magicItem?: unknown
}
export type InventoryTileCommands = {
  selected: boolean
  toggleSelected: () => void
  requestMove: () => void
  canMove: boolean
}

type Props = {
  item: InventoryTileData
  actions: InventoryTileCommands
  isAttuned: boolean
  typeLabel: string
  mutationsDisabled: boolean
  equipped?: boolean
  location?: string
  onDetails: () => void
  onToggleAttunement?: () => void
  onConsume?: () => void
  onEquip?: () => void
  onTransfer?: () => void
  transferLabel: string
  onRemove?: () => void
  children?: ReactNode
}

type MenuAnchor = { kind: "button" } | { kind: "pointer"; x: number; y: number }

export function InventoryItemTile(props: Props) {
  const { item, actions, isAttuned, typeLabel, mutationsDisabled, equipped = false, location, onDetails,
    onToggleAttunement, onConsume, onEquip, onTransfer, transferLabel, onRemove } = props
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const open = anchor !== null
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!anchor) return
    const currentAnchor = anchor

    function reposition() {
      const rect = currentAnchor.kind === "button" ? triggerRef.current?.getBoundingClientRect() : undefined
      const x = currentAnchor.kind === "pointer" ? currentAnchor.x : (rect?.right ?? 8)
      const y = currentAnchor.kind === "pointer" ? currentAnchor.y : (rect?.bottom ?? 8)
      const menuWidth = menuRef.current?.offsetWidth ?? 192
      const menuHeight = menuRef.current?.offsetHeight ?? 240
      const left = Math.max(8, Math.min(rect ? x - menuWidth : x, window.innerWidth - menuWidth - 8))
      const below = y + (rect ? 4 : 0)
      const above = (rect?.top ?? y) - menuHeight - 4
      const top = below + menuHeight <= window.innerHeight - 8 || below <= 8
        ? below
        : above >= 8 ? above : Math.max(8, window.innerHeight - menuHeight - 8)
      setPosition(previous => previous.top === top && previous.left === left ? previous : { top, left })
    }

    reposition()
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [anchor])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setAnchor(null)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setAnchor(null)
      returnFocusRef.current?.focus()
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function openContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    const target = event.target instanceof Element ? event.target : event.currentTarget
    const focusTarget = target.closest<HTMLElement>("button, input, [tabindex]")
      ?? triggerRef.current ?? event.currentTarget.querySelector("button") ?? event.currentTarget
    returnFocusRef.current = focusTarget
    const keyboard = event.clientX === 0 && event.clientY === 0
    const bounds = keyboard ? focusTarget.getBoundingClientRect() : undefined
    setAnchor({ kind: "pointer", x: bounds?.left ?? event.clientX, y: bounds?.bottom ?? event.clientY })
  }

  function run(action: () => void) { setAnchor(null); action() }
  const commands: Array<{ label: string; action: () => void; destructive?: boolean }> = [
    { label: "Ver detalhes", action: onDetails },
    ...(actions.canMove ? [{ label: "Mover para...", action: actions.requestMove }] : []),
    ...(onEquip ? [{ label: "Equipar", action: onEquip }] : []),
    ...(onToggleAttunement ? [{ label: isAttuned ? "Desfazer sintonia" : "Sintonizar", action: onToggleAttunement }] : []),
    ...(onConsume ? [{ label: item.kind === "ammunition" ? "Consumir munição" : "Consumir", action: onConsume }] : []),
    ...(onTransfer ? [{ label: transferLabel, action: onTransfer }] : []),
    ...(onRemove ? [{ label: "Remover", action: onRemove, destructive: true }] : []),
  ]
  const ItemIcon = item.equipSlot === "weapon" ? Sword
    : item.equipSlot === "armor" || item.equipSlot === "shield" ? Shield
    : item.kind === "supply" || item.kind === "consumable" ? FlaskConical
    : item.kind === "pack" ? Backpack : Package
  return (
    <article onContextMenu={openContextMenu} className={props.children ? "h-full min-w-0" : `group relative flex min-h-[108px] min-w-0 flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-accentBorder ${actions.selected || equipped ? "border-accentBorder bg-accentBg" : "border-border bg-bg-elevated"}`}>
      {props.children ?? <>
        <div className="flex min-w-0 items-start gap-2">
          {actions.canMove ? <input aria-label={`Selecionar ${item.name || "item"}`} type="checkbox" checked={actions.selected}
            onChange={actions.toggleSelected} disabled={!actions.canMove}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer opacity-60 group-hover:opacity-100" /> : null}
          <ItemIcon className="mt-0.5 h-5 w-5 shrink-0 text-textMuted" />
          <button type="button" onClick={onDetails} title={item.name}
            className="min-w-0 flex-1 break-words text-left text-sm font-medium leading-5 text-textH hover:underline">
            {item.name || "Item sem nome"}
          </button>
          <button ref={triggerRef} type="button" aria-label={`Ações de ${item.name || "item"}`}
            aria-expanded={open} aria-haspopup="menu" onClick={() => {
              returnFocusRef.current = triggerRef.current
              setAnchor(previous => previous?.kind === "button" ? null : { kind: "button" })
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-textMuted hover:bg-bg">
            <Ellipsis className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-auto min-w-0">
          <div className="truncate text-[11px] text-textMuted">{location || typeLabel}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-textMuted">
            <span>×{item.quantity ?? 1}</span><span>{item.weight ?? 0} kg/un.</span>
            {equipped ? <span className="rounded border border-accentBorder bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-textH">Equipado</span> : null}
            {item.magicItem ? <span className="rounded bg-accentBg px-1.5 py-0.5 text-[10px] text-textH">Mágico</span> : null}
            {isAttuned ? <span className="rounded bg-accentBg px-1.5 py-0.5 text-[10px] text-textH">Sintonizado</span> : null}
          </div>
        </div>
      </>}
      {open && typeof document !== "undefined" ? createPortal(
        <div ref={menuRef} onContextMenu={event => { event.preventDefault(); event.stopPropagation() }} role="menu" aria-label={`Ações de ${item.name || "item"}`}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[2147483000] max-h-[calc(100dvh-1rem)] min-w-48 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-1.5 shadow-theme-lg">
          {commands.map(command => <button type="button" role="menuitem" key={command.label}
            disabled={mutationsDisabled && command.label !== "Ver detalhes"}
            onClick={() => run(command.action)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-accentBg disabled:opacity-40 ${command.destructive ? "text-danger" : "text-textH"}`}>
            {command.label}
          </button>)}
        </div>,
        document.body,
      ) : null}
    </article>
  )
}
