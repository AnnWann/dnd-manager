import { useState, type DragEvent, type ReactNode } from "react"
import { ArrowLeft, Check, Folder, FolderOpen, GripVertical, MoveRight, Package, X } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import type { Itemmable } from "../../../models/items/item"
import { canItemGoInPocket } from "../../../models/items/itemPocketability"
import {
  canStoreItem,
  getCompartmentUsage,
  getItemCompartment,
  getItemContainerId,
  isCompartment,
  isInsideCompartment,
} from "../../../models/items/itemCompartments"

export type InventoryTileActions = {
  selected: boolean
  toggleSelected: () => void
  requestMove: () => void
  canMove: boolean
}

type Props = {
  items: Itemmable[]
  filteredItems: Itemmable[]
  filtered: boolean
  mutationsDisabled?: boolean
  emptyMessage: string
  renderItem: (item: Itemmable, actions: InventoryTileActions) => ReactNode
  onMoveItem?: (id: string, destinationId?: string) => void
  /** Equipment pockets are a virtual compartment, not items in the inventory array. */
  pocketItems?: Itemmable[]
  filteredPocketItems?: Itemmable[]
  renderPocketItem?: (item: Itemmable) => ReactNode
  onMoveToPocket?: (id: string) => void
}

const ROOT = "__root__"
const POCKETS = "__pockets__"
const MAX_POCKETS = 8

function format(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

export function InventoryGridBoard({
  items, filteredItems, filtered, mutationsDisabled = false,
  emptyMessage, renderItem, onMoveItem,
  pocketItems, filteredPocketItems = [], renderPocketItem, onMoveToPocket,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)
  const [moveDialogIds, setMoveDialogIds] = useState<string[]>([])
  const [error, setError] = useState("")

  const compartments = items.filter(isCompartment)
  const active = compartments.find(item => item.id === activeId)
  const showingPockets = pocketItems !== undefined && Boolean(renderPocketItem)
  const pockets = pocketItems ?? []
  const pocketActive = showingPockets && activeId === POCKETS
  const currentContainerId = active?.id
  const canMove = !mutationsDisabled && Boolean(onMoveItem || onMoveToPocket) && (compartments.length > 0 || showingPockets)
  const validSelection = selectedIds.filter(id => items.some(item => item.id === id && item.kind !== "currency"))
  const movingIds = moveDialogIds.filter(id => items.some(item => item.id === id))

  function folderPath(item: Itemmable): string {
    const names: string[] = []
    const visited = new Set<string>([item.id])
    let parentId = getItemContainerId(item, items)
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      const parent = items.find(entry => entry.id === parentId)
      if (!parent) break
      names.unshift(parent.name || "Compartimento")
      parentId = getItemContainerId(parent, items)
    }
    return names.length ? names.join(" / ") : "Fora de compartimentos"
  }

  function validateMove(ids: string[], destinationId?: string):
    { ok: true } | { ok: false; reason: string } {
    if (destinationId === POCKETS) {
      if (!showingPockets || !onMoveToPocket) return { ok: false, reason: "Bolsos indisponíveis." }
      if (pockets.length + ids.length > MAX_POCKETS) return { ok: false, reason: "Não há espaço nos bolsos (limite de 8)." }
      if (ids.some(id => !items.some(item => item.id === id && canItemGoInPocket(item) && !isCompartment(item)))) {
        return { ok: false, reason: "Um dos itens não pode ser guardado nos bolsos." }
      }
      return { ok: true }
    }
    if (!onMoveItem) return { ok: false, reason: "Movimentação indisponível." }
    let staged = items
    for (const id of ids) {
      const check = canStoreItem(staged, id, destinationId)
      if (!check.ok) return check
      staged = check.items
    }
    return { ok: true }
  }

  function move(ids: string[], destinationId?: string) {
    const check = validateMove(ids, destinationId)
    if (!check.ok) { setError(check.reason); return false }
    setError("")
    for (const id of ids) {
      if (destinationId === POCKETS) onMoveToPocket?.(id)
      else onMoveItem?.(id, destinationId)
    }
    setSelectedIds(previous => previous.filter(id => !ids.includes(id)))
    setMoveDialogIds([])
    return true
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

  function accept(event: DragEvent, destinationId?: string) {
    if (!canMove) return
    const source = draggedId || event.dataTransfer.getData("application/x-inventory-item")
    if (!source || source === destinationId) return
    if (destinationId === POCKETS) {
      if (!validateMove([source], POCKETS).ok) return
    } else if (destinationId) {
      const destination = items.find(item => item.id === destinationId)
      if (!destination || !isCompartment(destination) || isInsideCompartment(destination, source, items)) return
    }
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "move"
    setHoverTarget(destinationId ?? ROOT)
  }

  function drop(event: DragEvent, destinationId?: string) {
    if (!canMove) return
    event.preventDefault()
    event.stopPropagation()
    const source = event.dataTransfer.getData("application/x-inventory-item") || draggedId
    setDraggedId(null)
    setHoverTarget(null)
    if (source && source !== destinationId) move([source], destinationId)
  }

  function tile(item: Itemmable): ReactNode {
    return (
      <div key={item.id} draggable={canMove}
        onDragStart={event => startDrag(event, item.id)}
        onDragEnd={() => { setDraggedId(null); setHoverTarget(null) }}
        className={`min-w-0 ${draggedId === item.id ? "opacity-40" : ""}`}>
        {renderItem(item, {
          selected: validSelection.includes(item.id),
          toggleSelected: () => setSelectedIds(previous =>
            previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id]),
          requestMove: () => { setError(""); setMoveDialogIds([item.id]) },
          canMove,
        })}
        {filtered ? <div className="mt-1 truncate px-1 text-[11px] text-textMuted" title={folderPath(item)}>
          Em: {folderPath(item)}
        </div> : null}
      </div>
    )
  }

  function folder(item: Itemmable): ReactNode {
    const config = getItemCompartment(item)!
    const usage = getCompartmentUsage(items, item)
    const selected = currentContainerId === item.id
    const hovering = hoverTarget === item.id
    const canDropHere = draggedId ? validateMove([draggedId], item.id).ok : true
    const full = usage.size > config.capacity ||
      (config.maxWeightKg !== null && usage.weightKg > config.maxWeightKg)
    return (
      <div key={item.id}
        onDragOver={event => accept(event, item.id)}
        onDrop={event => drop(event, item.id)}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoverTarget(null)
        }}
        className={`min-w-0 rounded-xl border transition-colors ${
          hovering ? (canDropHere ? "border-accentBorder bg-accentBg" : "border-danger bg-bg-subtle")
            : selected ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle hover:border-accentBorder"
        }`}>
        <button type="button" onClick={() => { setActiveId(item.id); setError("") }}
          aria-pressed={selected}
          aria-label={`Abrir compartimento ${item.name}`}
          className="flex w-full min-w-0 flex-col gap-2 p-3 text-left">
          <div className="flex w-full min-w-0 items-center gap-2">
            {selected ? <FolderOpen className="h-5 w-5 shrink-0 text-accent" /> : <Folder className="h-5 w-5 shrink-0 text-textMuted" />}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-textH" title={item.name}>
              {item.name || "Compartimento"}
            </span>
            {selected ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
          </div>
          <div className="w-full truncate text-[11px] text-textMuted" title={folderPath(item)}>{folderPath(item)}</div>
          <div className="w-full text-xs text-textMuted">
            {format(usage.size)}/{format(config.capacity)} {config.unit === "slots" ? "slots" : "L"}
            <span className="mx-1.5">·</span>
            {format(usage.weightKg)}/{config.maxWeightKg === null ? "∞" : format(config.maxWeightKg)} kg
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg" aria-hidden="true">
            <div className={`h-full ${full ? "bg-danger" : "bg-accent"}`}
              style={{ width: `${config.capacity ? Math.min(100, usage.size / config.capacity * 100) : usage.size ? 100 : 0}%` }} />
          </div>
          {draggedId ? <span className={`text-[11px] ${canDropHere ? "text-textMuted" : "text-danger"}`}>
            {hovering ? (canDropHere ? "Solte para guardar aqui" : "Sem espaço ou destino inválido")
              : (canDropHere ? "Pode receber o item" : "Indisponível")}
          </span> : null}
        </button>
      </div>
    )
  }

  const visible = filtered
    ? filteredItems
    : items.filter(item => item.kind !== "currency" && !isCompartment(item) &&
      getItemContainerId(item, items) === currentContainerId)
  const activeContents = currentContainerId
    ? items.filter(item => getItemContainerId(item, items) === currentContainerId && item.kind !== "currency")
    : []
  const nestedFolders = filtered ? [] : activeContents.filter(isCompartment)
  const storedCurrencies = activeContents.filter(item => item.kind === "currency")
  const displayedItems = pocketActive && !filtered ? [] : visible.filter(item => !isCompartment(item))
  const displayedPocketItems = showingPockets
    ? (filtered ? filteredPocketItems : pocketActive ? pockets : [])
    : []
  const displayedFilteredFolders = filtered ? visible.filter(isCompartment) : []
  const parentId = active ? getItemContainerId(active, items) : undefined

  return (
    <div className="grid min-w-0 gap-4">
      {error ? <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-danger p-3 text-xs text-danger">
        <span>{error}</span><button type="button" aria-label="Dispensar erro" onClick={() => setError("")}><X className="h-4 w-4" /></button>
      </div> : null}

      {compartments.length > 0 || showingPockets ? <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <FolderOpen className="h-4 w-4 text-accent" />
            Compartimentos
          </div>
          <span className="text-xs text-textMuted">{compartments.length + (showingPockets ? 1 : 0)} compartimento(s)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          <div onDragOver={event => accept(event)} onDrop={event => drop(event)}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoverTarget(null)
            }}
            className={`rounded-xl border ${hoverTarget === ROOT ? "border-accentBorder bg-accentBg" : !currentContainerId && !pocketActive ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle hover:border-accentBorder"}`}>
            <button type="button" onClick={() => { setActiveId(null); setError("") }}
              aria-pressed={!currentContainerId && !pocketActive}
              className="flex h-full min-h-[94px] w-full flex-col items-start justify-between gap-2 p-3 text-left">
              <div className="flex w-full items-center gap-2">
                <Package className="h-5 w-5 shrink-0 text-textMuted" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-textH">Itens soltos</span>
                {!currentContainerId && !pocketActive ? <Check className="h-4 w-4 text-accent" /> : null}
              </div>
              <div className="text-xs text-textMuted">
                {items.filter(item => item.kind !== "currency" && !isCompartment(item) && !getItemContainerId(item, items)).length} item(ns)
              </div>
              {draggedId ? <div className="text-[11px] text-textMuted">Solte aqui para retirar do compartimento</div> : null}
            </button>
          </div>
          {compartments.map(folder)}
          {showingPockets ? <div
            onDragOver={event => accept(event, POCKETS)} onDrop={event => drop(event, POCKETS)}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoverTarget(null) }}
            className={`min-w-0 rounded-xl border transition-colors ${hoverTarget === POCKETS || pocketActive ? "border-accentBorder bg-accentBg" : "border-border bg-bg-subtle hover:border-accentBorder"}`}>
            <button type="button" onClick={() => { setActiveId(POCKETS); setError("") }}
              aria-pressed={pocketActive} aria-label="Abrir compartimento Bolsos"
              className="flex h-full w-full min-w-0 flex-col gap-2 p-3 text-left">
              <div className="flex w-full min-w-0 items-center gap-2">
                {pocketActive ? <FolderOpen className="h-5 w-5 shrink-0 text-accent" /> : <Folder className="h-5 w-5 shrink-0 text-textMuted" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-textH">Bolsos</span>
                {pocketActive ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
              </div>
              <div className="text-xs text-textMuted">{pockets.length}/{MAX_POCKETS} espaços ocupados</div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${pockets.length / MAX_POCKETS * 100}%` }} />
              </div>
              {draggedId ? <span className="text-[11px] text-textMuted">
                {validateMove([draggedId], POCKETS).ok ? "Solte para guardar no bolso" : "Item incompatível ou sem espaço"}
              </span> : null}
            </button>
          </div> : null}
        </div>
      </section> : null}

      <section className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3 sm:p-4"
        onDragOver={event => { if (!currentContainerId && !pocketActive && !filtered) accept(event) }}
        onDrop={event => { if (!currentContainerId && !pocketActive && !filtered) drop(event) }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {active && !filtered ? <button type="button" aria-label="Voltar ao compartimento anterior"
                title="Voltar" className="rounded-lg p-1 text-textMuted hover:bg-bg"
                onClick={() => setActiveId(parentId ?? null)}>
                <ArrowLeft className="h-4 w-4" />
              </button> : null}
              <h3 className="truncate text-sm font-semibold text-textH">
                {filtered ? "Resultados do filtro" : pocketActive ? "Bolsos" : active?.name || "Fora de compartimentos"}
              </h3>
            </div>
            <p className="mt-1 text-xs text-textMuted">
              {filtered ? `${visible.length} item(ns) encontrados em todos os compartimentos` :
                pocketActive ? `${pockets.length}/${MAX_POCKETS} espaços ocupados · Retire itens pelo menu de ações`
                : active ? `${folderPath(active)} · ${activeContents.length} item(ns) dentro`
                : "Itens não guardados em nenhum compartimento"}
            </p>
          </div>
          <div className="text-xs text-textMuted">{displayedItems.length + displayedFilteredFolders.length + displayedPocketItems.length} item(ns)</div>
        </div>
        {storedCurrencies.length && !filtered ? (
          <div className="mb-3 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-textMuted">
            <span className="font-medium text-textH">Moedas guardadas: </span>
            {storedCurrencies.map(item => `${item.quantity ?? 0}× ${item.name || "moedas"}`).join(" · ")}
            <span className="ml-1">· Gerencie as quantidades na carteira acima.</span>
          </div>
        ) : null}
        {active && !filtered ? <details className="mb-3 rounded-lg border border-border bg-bg p-2">
          <summary className="cursor-pointer text-xs font-medium text-textH">
            Gerenciar este compartimento (editar, transferir ou retirar)
          </summary>
          <div className="mt-2 max-w-64">{tile(active)}</div>
        </details> : null}
        {nestedFolders.length ? <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {nestedFolders.map(item => <button type="button" key={item.id}
            onClick={() => setActiveId(item.id)}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-bg p-2 text-left text-xs text-textH hover:border-accentBorder">
            <Folder className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{item.name}</span>
          </button>)}
        </div> : null}

        {canMove && validSelection.length ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accentBorder bg-accentBg p-2">
          <span className="text-xs font-medium text-textH">{validSelection.length} selecionado(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>Limpar</Button>
            <Button size="sm" variant="primary" onClick={() => { setError(""); setMoveDialogIds(validSelection) }}>
              <MoveRight className="h-3.5 w-3.5" /> Mover selecionados
            </Button>
          </div>
        </div> : null}

        {displayedItems.length || displayedFilteredFolders.length || displayedPocketItems.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {displayedFilteredFolders.map(folder)}
            {displayedItems.map(tile)}
            {displayedPocketItems.map(item => <div key={`pocket:${item.id}`} className="min-w-0">
              {renderPocketItem?.(item)}
              {filtered ? <div className="mt-1 px-1 text-[11px] text-textMuted">Em: Bolsos</div> : null}
            </div>)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Package className="h-6 w-6 text-textMuted" />
            <p className="text-xs text-textMuted">{filtered ? emptyMessage : "Nenhum item aqui. Selecione outro compartimento ou mova itens para este local."}</p>
            {draggedId ? <span className="text-xs text-accent">Solte aqui para retirar do compartimento</span> : null}
          </div>
        )}
      </section>

      {movingIds.length ? <Modal
        title={movingIds.length === 1 ? "Mover item" : `Mover ${movingIds.length} itens`}
        description="Escolha um destino. A capacidade e o limite de peso serão verificados antes da movimentação."
        onClose={() => setMoveDialogIds([])}>
        <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {[undefined, ...compartments.map(item => item.id), ...(showingPockets ? [POCKETS] : [])].map(destinationId => {
            const pocketDestination = destinationId === POCKETS
            const folderItem = destinationId && !pocketDestination ? compartments.find(item => item.id === destinationId) : undefined
            const validation = validateMove(movingIds, destinationId)
            const usage = folderItem ? getCompartmentUsage(items, folderItem) : undefined
            return <button key={destinationId ?? ROOT} type="button" disabled={!validation.ok}
              onClick={() => move(movingIds, destinationId)}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder disabled:cursor-not-allowed disabled:opacity-40">
              {folderItem || pocketDestination ? <Folder className="h-5 w-5 shrink-0 text-accent" /> : <Package className="h-5 w-5 shrink-0 text-textMuted" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-textH">{pocketDestination ? "Bolsos" : folderItem?.name || "Fora de compartimentos"}</span>
                <span className="mt-1 block truncate text-xs text-textMuted">
                  {pocketDestination ? `${pockets.length}/${MAX_POCKETS} espaços ocupados` : folderItem ? `${format(usage!.size)}/${format(getItemCompartment(folderItem)!.capacity)} ${getItemCompartment(folderItem)!.unit === "slots" ? "slots" : "L"}` : "Sem limite de recipiente"}
                </span>
                {!validation.ok ? <span className="mt-1 block text-[11px] text-danger" title={validation.reason}>{validation.reason}</span> : null}
              </span>
              {validation.ok ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
            </button>
          })}
        </div>
        <div className="flex justify-end border-t border-border p-3">
          <Button size="sm" variant="secondary" onClick={() => setMoveDialogIds([])}>Cancelar</Button>
        </div>
      </Modal> : null}

      {draggedId ? <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accentBorder bg-bg-elevated px-4 py-2 text-xs text-textH shadow-lg">
        <GripVertical className="h-4 w-4" /> Arraste para um compartimento acima
      </div> : null}
    </div>
  )
}
