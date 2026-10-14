import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { ItemCreationDialog } from "../../items/ItemCreationDialog"
import { findStandardDefinitionForItem } from "../../items/standardItemCompendium"
import type { ItemKind, Itemmable } from "../../../models/items/item"
import { isConsumableItemKind } from "../../../models/items/itemConsumption"
import type { SupplyItem } from "../../../models/items/SupplyItem"
import { ItemDropdownDetails } from "./itemDropdownDetails"
import { InventoryGridBoard } from "./InventoryGridBoard"
import { InventoryItemTile } from "./InventoryItemTile"
import { InventoryFloatingMenu } from "./InventoryFloatingMenu"
import { canStoreItem, getItemContainerId, isCompartment } from "../../../models/items/itemCompartments"
import { Select } from "../../../components/ui/Select"
import type { EquippedInventoryEntry } from "../../../models/characters/characterEquippedInventory"

type Props = {
  title: string
  description: string
  items: Itemmable[]
  equippedItems?: EquippedInventoryEntry[]
  onUnequipItem?: (entry: EquippedInventoryEntry) => void
  searchQuery?: string
  emptyMessage: string
  mutationsDisabled?: boolean
  onAddItem?: (item: Itemmable) => void
  onUpdateItem?: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  onRemoveItem?: (itemId: string) => void
  onConsumeItem?: (itemId: string) => void
  onEquipItem?: (itemId: string) => void
  onToggleBagOfHolding?: (itemId: string) => void
  onMoveAllCurrenciesToBagOfHolding?: () => void
  onToggleAttunement?: (itemId: string) => void
  attunedItemIds?: string[]
  onTransferItem?: (item: Itemmable) => void
  transferLabel?: string
  /** Hide the currency wallet when this editor represents a specialized subset. */
  showCurrencyWallet?: boolean
}

type InventoryFilter =
  | "all"
  | ItemKind
  | "weapon"
  | "armor"
  | "helmet"
  | "gloves"
  | "boots"
  | "ring"
  | "necklace"
  | "bagOfHolding"
  | "magicItem"
  | "requiresAttunement"

const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  common: "Comum",
  equipment: "Equipamento",
  consumable: "Consumível",
  throwable: "Arremessável",
  supply: "Suprimento",
  ammunition: "Munição",
  tool: "Ferramenta",
  focus: "Foco",
  instrument: "Instrumento",
  pack: "Pacote",
  gear: "Equipamento geral",
  currency: "Moeda",
  shield: "Escudo",
}

const INVENTORY_FILTERS: Array<{ value: InventoryFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "magicItem", label: "Itens mágicos" },
  { value: "requiresAttunement", label: "Exigem sintonia" },
  { value: "common", label: "Comuns" },
  { value: "supply", label: "Suprimentos" },
  { value: "equipment", label: "Equipamentos" },
  { value: "weapon", label: "Armas" },
  { value: "armor", label: "Armaduras" },
  { value: "shield", label: "Escudos" },
  { value: "ammunition", label: "Munições" },
  { value: "tool", label: "Ferramentas" },
  { value: "focus", label: "Focos" },
  { value: "instrument", label: "Instrumentos" },
  { value: "pack", label: "Pacotes" },
  { value: "gear", label: "Equipamento geral" },
  { value: "consumable", label: "Consumíveis" },
  { value: "throwable", label: "Arremessáveis" },
  { value: "helmet", label: "Capacetes" },
  { value: "gloves", label: "Luvas" },
  { value: "boots", label: "Botas" },
  { value: "ring", label: "Anéis" },
  { value: "necklace", label: "Colares" },
  { value: "bagOfHolding", label: "Bolsa Mágica" },
]

export function InventoryEditor({
  title,
  description,
  items,
  equippedItems = [],
  onUnequipItem,
  searchQuery = "",
  emptyMessage,
  mutationsDisabled = false,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onConsumeItem,
  onEquipItem,
  onToggleBagOfHolding,
  onMoveAllCurrenciesToBagOfHolding,
  onToggleAttunement,
  attunedItemIds = [],
  onTransferItem,
  transferLabel = "Transferir",
  showCurrencyWallet = true,
}: Props) {
  const [filter, setFilter] = useState<InventoryFilter>("all")
  const [creatingItem, setCreatingItem] = useState(false)
  const [viewingItem, setViewingItem] = useState<Itemmable | null>(null)
  const [editingItem, setEditingItem] = useState<Itemmable | null>(null)
  const [newCompartment, setNewCompartment] = useState<Itemmable | null>(null)

  const currencyItems = items.filter((item) => item.kind === "currency")
  const regularItems = items.filter((item) => item.kind !== "currency")
  const normalizedQuery = searchQuery.trim().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("pt-BR")
  const filteredItems = regularItems.filter((item) =>
    matchesInventoryFilter(item, filter) && (!normalizedQuery || item.name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(normalizedQuery)),
  )

  function openDetails(item: Itemmable) {
    setViewingItem(item)
  }

  function openEdit(item: Itemmable) {
    if (mutationsDisabled) return
    setViewingItem(null)
    setEditingItem(item)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="break-words text-sm font-semibold text-textH">
              {title}
            </div>
            <div className="mt-1 break-words text-xs leading-5 text-text">
              {description}
            </div>
          </div>
          {onAddItem ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full sm:w-auto" size="sm" variant="secondary"
                disabled={mutationsDisabled}
                onClick={() => setNewCompartment({
                  id: crypto.randomUUID(), name: "Mochila", desc: "", notes: "",
                  quantity: 1, weight: 1, kind: "pack", pocketable: false,
                  compartment: { unit: "slots", capacity: 10, maxWeightKg: 20 },
                })}>
                + Compartimento
              </Button>
              <Button className="w-full sm:w-auto" size="sm" variant="primary"
                disabled={mutationsDisabled} onClick={() => setCreatingItem(true)}>
                + Adicionar
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {equippedItems.length ? (
          <section className="mb-5 grid gap-3" aria-label="Itens equipados">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-textH">Itens equipados</div>
                <p className="mt-1 text-xs text-textMuted">
                  Também aparecem aqui para consulta. Continuam na ficha de equipamento, sem duplicar peso ou efeitos.
                </p>
              </div>
              <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-xs text-textH">
                {equippedItems.length} equipado(s)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {equippedItems.filter(({ item, location }) =>
                (!normalizedQuery || `${item.name} ${location}`.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(normalizedQuery)) &&
                matchesInventoryFilter(item, filter)
              ).map(entry => (
                <InventoryItemTile key={entry.item.id}
                  item={entry.item}
                  equipped location={entry.location}
                  actions={{ selected: false, toggleSelected: () => {}, requestMove: () => {}, canMove: false }}
                  isAttuned={Boolean(entry.item.attuned)}
                  typeLabel={inventoryItemTypeLabel(entry.item)}
                  mutationsDisabled={mutationsDisabled}
                  onDetails={() => openDetails(entry.item)}
                  onTransfer={onUnequipItem ? () => onUnequipItem(entry) : undefined}
                  transferLabel="Desequipar"
                />
              ))}
            </div>
          </section>
        ) : null}
        {showCurrencyWallet ? (
          <CurrencyWallet
            items={currencyItems}
            allItems={items}
            mutationsDisabled={mutationsDisabled}
            onAddItem={onAddItem}
            onUpdateItem={onUpdateItem}
            onRemoveItem={onRemoveItem}
            onTransferItem={onTransferItem}
            onMoveAllCurrenciesToBagOfHolding={
              onMoveAllCurrenciesToBagOfHolding
            }
            transferLabel={transferLabel}
            onViewItem={openDetails}
            onMoveItem={onUpdateItem ? (itemId, containerId) => {
              const verdict = canStoreItem(items, itemId, containerId)
              if (!verdict.ok) return
              const moved = verdict.items.find(item => item.id === itemId)
              if (moved) onUpdateItem(itemId, () => moved)
            } : undefined}
          />
        ) : null}

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {INVENTORY_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                filter === option.value
                  ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-medium text-textH"
                  : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-text hover:bg-[color:var(--social-bg)]"
              }
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <InventoryGridBoard
          items={items}
          filteredItems={filteredItems}
          filtered={filter !== "all" || Boolean(normalizedQuery)}
          mutationsDisabled={mutationsDisabled}
          emptyMessage={emptyMessage}
          onMoveItem={onUpdateItem ? (itemId, containerId) => {
            const verdict = canStoreItem(items, itemId, containerId)
            if (!verdict.ok) return
            const moved = verdict.items.find(item => item.id === itemId)
            if (moved) onUpdateItem(itemId, () => moved)
          } : undefined}
          renderItem={(item, actions) => (
            <InventoryItemTile item={item} actions={actions}
              isAttuned={attunedItemIds.includes(item.id)}
              typeLabel={item.kind === "supply"
                ? `${inventoryItemTypeLabel(item)} · ${formatSupplySummary(item as SupplyItem)}`
                : inventoryItemTypeLabel(item)}
              mutationsDisabled={mutationsDisabled}
              onDetails={() => openDetails(item)}
              onToggleAttunement={item.magicItem && item.requiresAttunement && onToggleAttunement
                ? () => onToggleAttunement(item.id) : undefined}
              onConsume={isConsumableItemKind(item) && onConsumeItem
                ? () => onConsumeItem(item.id) : undefined}
              onEquip={onEquipItem ? () => onEquipItem(item.id) : undefined}
              onTransfer={onTransferItem ? () => onTransferItem(item) : undefined}
              transferLabel={transferLabel}
              onRemove={onRemoveItem ? () => onRemoveItem(item.id) : undefined}
            />
          )}
        />
      </CardContent>

      <ItemDetailsDialog
        item={viewingItem}
        canEdit={Boolean(onUpdateItem) && !equippedItems.some(entry => entry.item.id === viewingItem?.id)}
        mutationsDisabled={mutationsDisabled}
        onClose={() => setViewingItem(null)}
        onEdit={openEdit}
        onUpdate={
          viewingItem && onUpdateItem && !mutationsDisabled && !equippedItems.some(entry => entry.item.id === viewingItem.id)
            ? (updater) => onUpdateItem(viewingItem.id, updater)
            : undefined
        }
      />

      <ItemCreationDialog
        open={!mutationsDisabled && creatingItem}
        title="Criar item"
        onClose={() => setCreatingItem(false)}
        onSave={(item) => {
          if (mutationsDisabled) return
          onAddItem?.(item)
          setCreatingItem(false)
        }}
      />

      <ItemCreationDialog
        open={!mutationsDisabled && newCompartment !== null}
        title="Novo compartimento"
        saveLabel="Criar compartimento"
        item={newCompartment}
        onClose={() => setNewCompartment(null)}
        onSave={item => {
          onAddItem?.(item)
          setNewCompartment(null)
        }}
      />

      <ItemCreationDialog
        open={!mutationsDisabled && editingItem !== null}
        title="Editar item"
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(item) => {
          if (mutationsDisabled) return
          onUpdateItem?.(item.id, () => item)
          setEditingItem(null)
        }}
      />
    </Card>
  )
}

function ItemDetailsDialog({
  item,
  canEdit,
  mutationsDisabled,
  onClose,
  onEdit,
  onUpdate,
}: {
  item: Itemmable | null
  canEdit: boolean
  mutationsDisabled: boolean
  onClose: () => void
  onEdit: (item: Itemmable) => void
  onUpdate?: (updater: (item: Itemmable) => Itemmable) => void
}) {
  if (!item) return null

  const definition = findStandardDefinitionForItem(item)
  const protectedDefinition = definition?.locked === true

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-details-title"
    >
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="item-details-title" className="text-lg font-semibold text-textH">
                {item.name || "Item sem nome"}
              </h2>
              {definition ? <ItemBadge label="Compêndio" /> : null}
              {protectedDefinition ? (
                <ItemBadge label="Definição protegida" />
              ) : null}
              {item.magicItem ? <ItemBadge label="Mágico" /> : null}
              {item.requiresAttunement ? (
                <ItemBadge label="Requer sintonia" />
              ) : null}
            </div>
            <div className="mt-1 text-xs text-textMuted">
              {inventoryItemTypeLabel(item)} · Quantidade {item.quantity ?? 1} · {item.weight ?? 0} kg por item
            </div>
          </div>

          <div className="flex gap-2">
            {canEdit && !protectedDefinition ? (
              <Button
                size="sm"
                disabled={mutationsDisabled}
                onClick={() => onEdit(item)}
              >
                Editar
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        {protectedDefinition ? (
          <div className="mt-4 rounded-lg border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-textH">
            Nome, tipo, peso e propriedades deste item vêm da definição canônica do compêndio. Os controles operacionais, como quantidade de moedas e conteúdo da Bolsa Mágica, continuam disponíveis no inventário.
          </div>
        ) : null}

        <ItemDropdownDetails item={item} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

function CurrencyWallet({
  items,
  allItems,
  onMoveItem,
  mutationsDisabled,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onTransferItem,
  onMoveAllCurrenciesToBagOfHolding,
  transferLabel,
  onViewItem,
}: {
  items: Itemmable[]
  allItems: Itemmable[]
  onMoveItem?: (itemId: string, containerId?: string) => void
  mutationsDisabled: boolean
  onAddItem?: (item: Itemmable) => void
  onUpdateItem?: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  onRemoveItem?: (itemId: string) => void
  onTransferItem?: (item: Itemmable) => void
  onMoveAllCurrenciesToBagOfHolding?: () => void
  transferLabel: string
  onViewItem: (item: Itemmable) => void
}) {
  const positiveCurrency = items.filter((item) => (item.quantity ?? 0) > 0)
  const currenciesInsideBagOfHolding =
    positiveCurrency.length > 0 &&
    positiveCurrency.every((item) => item.insideBagOfHolding === true)

  return (
    <div className="mb-4 rounded-xl border border-accentBorder bg-accentBg p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-textH">Moedas</div>
          <div className="mt-1 text-xs leading-5 text-textMuted">
            Valores monetários ficam separados do restante dos itens.
          </div>
        </div>
        {onAddItem || onMoveAllCurrenciesToBagOfHolding ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {onMoveAllCurrenciesToBagOfHolding ? (
              <Button
                className="w-full sm:w-auto"
                size="sm"
                variant={currenciesInsideBagOfHolding ? "primary" : "secondary"}
                disabled={mutationsDisabled}
                onClick={onMoveAllCurrenciesToBagOfHolding}
              >
                {currenciesInsideBagOfHolding
                  ? "Retirar da Bolsa Mágica"
                  : "Colocar na Bolsa Mágica"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-bg p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-medium text-textH">
                  {item.name || "Moedas"}
                </div>
                <ItemBadge label="Definição protegida" />
              </div>
              <label className="mt-2 grid gap-1.5">
                <span className="text-[11px] text-textMuted">Quantidade</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  disabled={mutationsDisabled || !onUpdateItem}
                  value={item.quantity ?? 0}
                  onChange={(event) =>
                    onUpdateItem?.(item.id, (current) => ({
                      ...current,
                      quantity: Math.max(
                        0,
                        Math.trunc(Number(event.target.value) || 0),
                      ),
                    }))
                  }
                />
              </label>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-textMuted">
                  {getItemContainerId(item, allItems)
                    ? `Em: ${allItems.find(entry => entry.id === getItemContainerId(item, allItems))?.name ?? "Compartimento"}`
                    : "Fora de compartimentos"}
                </span>
                <InventoryFloatingMenu label={`Ações de ${item.name || "moedas"}`} placement="above">
                  {close => (
                    <>
                  <div className="absolute bottom-9 right-0 z-30 min-w-48 rounded-xl border border-border bg-bg-elevated p-2 shadow-theme-lg">
                    {onMoveItem ? <label className="mb-2 grid gap-1 text-[11px] text-textMuted">
                      Mover para
                      <Select value={getItemContainerId(item, allItems) ?? ""}
                        disabled={mutationsDisabled}
                        onChange={event => {
                          onMoveItem(item.id, event.target.value || undefined)
                          close()
                        }}>
                        <option value="">Fora de compartimentos</option>
                        {allItems.filter(isCompartment).map(container =>
                          <option key={container.id} value={container.id}>{container.name}</option>)}
                      </Select>
                    </label> : null}
                    <button type="button" onClick={event => {
                      onViewItem(item)
                      event.currentTarget.closest("details")?.removeAttribute("open")
                    }} className="block w-full rounded-md px-2 py-2 text-left text-xs text-textH hover:bg-accentBg">
                      Ver detalhes
                    </button>
                    {onTransferItem ? <button type="button" disabled={mutationsDisabled}
                      onClick={event => {
                        onTransferItem(item)
                        event.currentTarget.closest("details")?.removeAttribute("open")
                      }} className="block w-full rounded-md px-2 py-2 text-left text-xs text-textH hover:bg-accentBg disabled:opacity-40">
                      {transferLabel}
                    </button> : null}
                    {onRemoveItem ? <button type="button" disabled={mutationsDisabled}
                      onClick={event => {
                        onRemoveItem(item.id)
                        event.currentTarget.closest("details")?.removeAttribute("open")
                      }} className="block w-full rounded-md px-2 py-2 text-left text-xs text-danger hover:bg-accentBg disabled:opacity-40">
                      Remover
                    </button> : null}
                  </div>
                    </>
                  )}
                </InventoryFloatingMenu>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function matchesInventoryFilter(
  item: Itemmable,
  filter: InventoryFilter,
): boolean {
  if (filter === "all") return true
  if (filter === "bagOfHolding") return item.insideBagOfHolding === true
  if (filter === "magicItem") return item.magicItem === true
  if (filter === "requiresAttunement") {
    return item.magicItem === true && item.requiresAttunement === true
  }

  if (
    filter === "weapon" ||
    filter === "armor" ||
    filter === "helmet" ||
    filter === "gloves" ||
    filter === "boots" ||
    filter === "ring" ||
    filter === "necklace"
  ) {
    return item.kind === "equipment" && item.equipSlot === filter
  }

  return item.kind === filter
}

function ItemBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}

function inventoryItemTypeLabel(item: Itemmable): string {
  if (item.category === "bagOfHolding") return "Bolsa Mágica"
  if (item.kind === "equipment") {
    if (item.equipSlot === "armor") return "Armadura"
    if (item.equipSlot === "helmet") return "Capacete"
    if (item.equipSlot === "gloves") return "Luvas"
    if (item.equipSlot === "boots") return "Botas"
    if (item.equipSlot === "cape") return "Capa"
    if (item.equipSlot === "weapon") return "Arma"
    if (item.equipSlot === "ring") return "Anel"
    if (item.equipSlot === "necklace") return "Colar"
  }
  return ITEM_KIND_LABELS[item.kind ?? "common"]
}

function formatSupplySummary(item: SupplyItem): string {
  const units = Math.max(0, item.supplyUnitsPerItem ?? 0)
  const label = item.supplyUnitLabel?.trim() || "unidades"
  return `${units} ${label}/item`
}
