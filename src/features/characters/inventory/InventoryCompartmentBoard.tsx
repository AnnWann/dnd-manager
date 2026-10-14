import { useState, type DragEvent, type ReactNode } from "react"
import { ChevronDown, ChevronRight, FolderOpen, GripVertical, Package, MoveRight } from "lucide-react"
import { Select } from "../../../components/ui/Select"
import type { Itemmable } from "../../../models/items/item"
import {
  canStoreItem,
  getCompartmentContents,
  getCompartmentUsage,
  getItemCompartment,
  getItemContainerId,
  isCompartment,
  isInsideCompartment,
} from "../../../models/items/itemCompartments"

type Props = {
  items: Itemmable[]
  filteredItems: Itemmable[]
  filtered: boolean
  mutationsDisabled?: boolean
  emptyMessage: string
  renderItem: (item: Itemmable) => ReactNode
  onMoveItem?: (id: string, destinationId?: string) => void
}

export function InventoryCompartmentBoard({
  items, filteredItems, filtered, mutationsDisabled = false, emptyMessage,
  renderItem, onMoveItem,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)
  const [error, setError] = useState("")
  const compartments = items.filter(isCompartment)
  const canMove = !mutationsDisabled && Boolean(onMoveItem)

  function toggle(id: string) {
    setCollapsed(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function move(itemId: string, toId?: string) {
    const verdict = canStoreItem(items, itemId, toId)
    if (!verdict.ok) { setError(verdict.reason); return }
    setError("")
    onMoveItem?.(itemId, toId)
    if (toId) setCollapsed(previous => {
      const next = new Set(previous)
      next.delete(toId)
      return next
    })
  }
  function startDrag(event: DragEvent, id: string) {
    if (!canMove) return
    event.stopPropagation()
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("application/x-inventory-item", id)
    event.dataTransfer.setData("text/plain", id)
    setDraggedId(id)
    setError("")
  }
  function accept(event: DragEvent, id?: string) {
    if (!canMove) return
    const source = draggedId || event.dataTransfer.getData("application/x-inventory-item")
    if (!source || source === id) return
    if (id) {
      const destination = items.find(item => item.id === id)
      if (!destination || !isCompartment(destination) || isInsideCompartment(destination, source, items)) return
    }
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "move"
    setHoverTarget(id ?? "__root__")
  }
  function drop(event: DragEvent, id?: string) {
    if (!canMove) return
    event.preventDefault()
    event.stopPropagation()
    const source = event.dataTransfer.getData("application/x-inventory-item") || draggedId
    setDraggedId(null)
    setHoverTarget(null)
    if (source && source !== id) move(source, id)
  }

  function locationPicker(item: Itemmable) {
    if (!canMove) return null
    return (
      <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-textMuted">
        <MoveRight className="h-3.5 w-3.5" />
        <span>Mover para</span>
        <Select
          className="h-8 min-w-40 flex-1 rounded-lg border border-border bg-bg px-2 text-xs text-textH sm:max-w-60"
          aria-label={`Destino de ${item.name}`}
          value={getItemContainerId(item, items) ?? ""}
          onChange={event => move(item.id, event.target.value || undefined)}
        >
          <option value="">Fora de compartimentos</option>
          {compartments.filter(container => container.id !== item.id && !isInsideCompartment(container, item.id, items))
            .map(container => <option key={container.id} value={container.id}>{container.name || "Compartimento"}</option>)}
        </Select>
      </label>
    )
  }

  function itemRow(item: Itemmable) {
    return (
      <div key={item.id} draggable={canMove}
        onDragStart={event => startDrag(event, item.id)}
        onDragEnd={() => { setDraggedId(null); setHoverTarget(null) }}
        className={`min-w-0 ${draggedId === item.id ? "opacity-45" : ""}`}>
        <div className="relative">
          {canMove ? <GripVertical className="pointer-events-none absolute left-1 top-3 z-10 h-4 w-4 cursor-grab text-textMuted" /> : null}
          {renderItem(item)}
        </div>
        {locationPicker(item)}
      </div>
    )
  }

  function folder(item: Itemmable, depth: number): ReactNode {
    if (depth > 16) return null
    const config = getItemCompartment(item)!
    const usage = getCompartmentUsage(items, item)
    const children = getCompartmentContents(items, item.id).filter(child => child.kind !== "currency")
    const open = !collapsed.has(item.id)
    const full = usage.size > config.capacity + 0.000001 ||
      (config.maxWeightKg !== null && usage.weightKg > config.maxWeightKg + 0.000001)
    const isHover = hoverTarget === item.id
    return <section key={item.id}
      draggable={canMove} onDragStart={event => startDrag(event, item.id)}
      onDragEnd={() => { setDraggedId(null); setHoverTarget(null) }}
      onDragOver={event => accept(event, item.id)}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoverTarget(null) }}
      onDrop={event => drop(event, item.id)}
      className={`min-w-0 rounded-xl border bg-bg-subtle p-3 transition-colors ${isHover ? "border-accentBorder bg-accentBg" : full ? "border-danger" : "border-border"}`}>
      <div className="flex items-start gap-2">
        {canMove ? <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-textMuted" /> : null}
        <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={() => toggle(item.id)} aria-expanded={open}>
          {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
          <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-textH">{item.name || "Compartimento"}</span>
            <span className={`mt-1 block text-xs ${full ? "text-danger" : "text-textMuted"}`}>
              {usage.items} item(ns) · {format(usage.size)} / {format(config.capacity)} {config.unit === "slots" ? "slots" : "L"} ·
              {" "}{format(usage.weightKg)} / {config.maxWeightKg === null ? "∞" : format(config.maxWeightKg)} kg
            </span>
          </span>
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
        <div className={`h-full ${full ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${config.capacity ? Math.min(100, usage.size / config.capacity * 100) : usage.size ? 100 : 0}%` }} />
      </div>
      {open ? <div className="mt-3 grid min-w-0 gap-3 border-l-2 border-border pl-2 sm:pl-3">
        {itemRow(item)}
        {children.map(child => isCompartment(child) ? folder(child, depth + 1) : itemRow(child))}
        {canMove ? <div className={`rounded-lg border border-dashed p-3 text-center text-xs text-textMuted ${isHover ? "border-accentBorder text-textH" : "border-border"}`}>
          Arraste itens para cá ou use “Mover para”
        </div> : null}
      </div> : null}
    </section>
  }

  const roots = filtered
    ? filteredItems
    : items.filter(item => item.kind !== "currency" && !getItemContainerId(item, items))
  return (
    <div className="grid min-w-0 gap-3">
      {error ? <div role="alert" className="rounded-lg border border-danger p-3 text-xs text-danger">{error}</div> : null}
      {!filtered && compartments.length > 0 ? <div className="flex items-center gap-2 text-xs font-semibold text-textH">
        <FolderOpen className="h-4 w-4 text-accent" /> Compartimentos
        <span className="font-normal text-textMuted">· arraste e solte para organizar</span>
      </div> : null}
      {!filtered && items.filter(item => isCompartment(item) && !getItemContainerId(item, items))
        .map(item => folder(item, 0))}
      {!filtered ? (
        <div onDragOver={event => accept(event)}
          onDrop={event => drop(event)}
          className={`grid min-w-0 gap-3 rounded-xl border border-dashed p-3 ${hoverTarget === "__root__" ? "border-accentBorder bg-accentBg" : "border-border"}`}>
          <div className="flex items-center gap-2 text-xs font-semibold text-textH">
            <Package className="h-4 w-4" /> Fora de compartimentos
          </div>
          {roots.filter(item => !isCompartment(item)).map(itemRow)}
          {!roots.some(item => !isCompartment(item)) ? <p className="text-xs text-textMuted">Solte itens aqui para deixá-los fora de compartimentos.</p> : null}
        </div>
      ) : filteredItems.length ? filteredItems.map(item =>
        <div key={item.id}>{itemRow(item)}<div className="mt-1 text-xs text-textMuted">
          {getItemContainerId(item, items)
            ? `Em: ${items.find(parent => parent.id === getItemContainerId(item, items))?.name ?? "Compartimento"}`
            : "Fora de compartimentos"}
        </div></div>
      ) : <p className="text-sm text-textMuted">{emptyMessage}</p>}
      {!filtered && !roots.length && !compartments.length ? <p className="text-sm text-textMuted">{emptyMessage}</p> : null}
    </div>
  )
}
function format(value: number) { return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) }
