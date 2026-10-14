import { useState } from "react"
import { Ellipsis, Package, Sword, FlaskConical, Shield, Backpack } from "lucide-react"
import type { Itemmable } from "../../../models/items/item"
import type { InventoryTileActions } from "./InventoryGridBoard"

type Props = {
  item: Itemmable
  actions: InventoryTileActions
  isAttuned: boolean
  typeLabel: string
  mutationsDisabled: boolean
  onDetails: () => void
  onToggleAttunement?: () => void
  onConsume?: () => void
  onEquip?: () => void
  onTransfer?: () => void
  transferLabel: string
  onRemove?: () => void
}

export function InventoryItemTile(props: Props) {
  const { item, actions, isAttuned, typeLabel, mutationsDisabled, onDetails,
    onToggleAttunement, onConsume, onEquip, onTransfer, transferLabel, onRemove } = props
  const [open, setOpen] = useState(false)
  function run(action: () => void) { setOpen(false); action() }
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
    <article className={`group relative flex min-h-[108px] min-w-0 flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-accentBorder ${actions.selected ? "border-accentBorder bg-accentBg" : "border-border bg-bg-elevated"}`}>
      <div className="flex min-w-0 items-start gap-2">
        <input aria-label={`Selecionar ${item.name || "item"}`} type="checkbox" checked={actions.selected}
          onChange={actions.toggleSelected} disabled={!actions.canMove}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer opacity-60 group-hover:opacity-100" />
        <ItemIcon className="mt-0.5 h-5 w-5 shrink-0 text-textMuted" />
        <button type="button" onClick={onDetails} title={item.name}
          className="min-w-0 flex-1 break-words text-left text-sm font-medium leading-5 text-textH hover:underline">
          {item.name || "Item sem nome"}
        </button>
        <div className="relative shrink-0" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
        }}>
          <button type="button" aria-label={`Ações de ${item.name || "item"}`} aria-expanded={open}
            aria-haspopup="menu" onClick={() => setOpen(!open)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-textMuted hover:bg-bg">
            <Ellipsis className="h-4 w-4" />
          </button>
          {open ? <div role="menu" className="absolute right-0 top-8 z-30 min-w-44 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-theme-lg">
            {commands.map(command => <button type="button" role="menuitem" key={command.label}
              disabled={mutationsDisabled && command.label !== "Ver detalhes"}
              onClick={() => run(command.action)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-accentBg disabled:opacity-40 ${command.destructive ? "text-danger" : "text-textH"}`}>
              {command.label}
            </button>)}
          </div> : null}
        </div>
      </div>
      <div className="mt-auto min-w-0">
        <div className="truncate text-[11px] text-textMuted">{typeLabel}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-textMuted">
          <span>×{item.quantity ?? 1}</span><span>{item.weight ?? 0} kg/un.</span>
          {item.magicItem ? <span className="rounded bg-accentBg px-1.5 py-0.5 text-[10px] text-textH">Mágico</span> : null}
          {isAttuned ? <span className="rounded bg-accentBg px-1.5 py-0.5 text-[10px] text-textH">Sintonizado</span> : null}
        </div>
      </div>
    </article>
  )
}
