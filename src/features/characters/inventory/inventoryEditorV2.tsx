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

type Props = {
  title: string
  description: string
  items: Itemmable[]
  emptyMessage: string
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
  emptyMessage,
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
}: Props) {
  const [filter, setFilter] = useState<InventoryFilter>("all")
  const [creatingItem, setCreatingItem] = useState(false)
  const [viewingItem, setViewingItem] = useState<Itemmable | null>(null)
  const [editingItem, setEditingItem] = useState<Itemmable | null>(null)

  const currencyItems = items.filter((item) => item.kind === "currency")
  const regularItems = items.filter((item) => item.kind !== "currency")
  const filteredItems = regularItems.filter((item) =>
    matchesInventoryFilter(item, filter),
  )

  function openDetails(item: Itemmable) {
    setViewingItem(item)
  }

  function openEdit(item: Itemmable) {
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
            <Button
              className="w-full sm:w-auto"
              size="sm"
              variant="primary"
              onClick={() => setCreatingItem(true)}
            >
              + Adicionar
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <CurrencyWallet
          items={currencyItems}
          onAddItem={onAddItem}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          onTransferItem={onTransferItem}
          onMoveAllCurrenciesToBagOfHolding={
            onMoveAllCurrenciesToBagOfHolding
          }
          transferLabel={transferLabel}
          onViewItem={openDetails}
        />

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

        {filteredItems.length ? (
          <div className="grid gap-3">
            {filteredItems.map((item, index) => {
              const isAttuned = attunedItemIds.includes(item.id)
              const definition = findStandardDefinitionForItem(item)

              return (
                <article
                  key={`${item.id}-${index}`}
                  className="rounded-xl border border-border bg-[color:var(--social-bg)] p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-textH">
                          {item.name || "Item sem nome"}
                        </span>
                        {definition ? <ItemBadge label="Compêndio" /> : null}
                        {definition?.locked ? (
                          <ItemBadge label="Definição protegida" />
                        ) : null}
                        {item.magicItem ? <ItemBadge label="Mágico" /> : null}
                        {item.requiresAttunement ? (
                          <ItemBadge label="Requer sintonia" />
                        ) : null}
                        {isAttuned ? <ItemBadge label="Sintonizado" /> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text">
                        <span>{inventoryItemTypeLabel(item)}</span>
                        <span>Qtd. {item.quantity ?? 1}</span>
                        <span>Peso {item.weight ?? 0}</span>
                        {item.kind === "supply" ? (
                          <span>{formatSupplySummary(item as SupplyItem)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDetails(item)}
                      >
                        Ver detalhes
                      </Button>

                      {item.magicItem &&
                      item.requiresAttunement &&
                      onToggleAttunement ? (
                        <Button
                          size="sm"
                          variant={isAttuned ? "primary" : "secondary"}
                          onClick={() => onToggleAttunement(item.id)}
                        >
                          {isAttuned ? "Desfazer sintonia" : "Sintonizar"}
                        </Button>
                      ) : null}

                      {isConsumableItemKind(item) && onConsumeItem ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onConsumeItem(item.id)}
                        >
                          {item.kind === "ammunition"
                            ? "Consumir munição"
                            : "Consumir"}
                        </Button>
                      ) : null}

                      {onEquipItem ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onEquipItem(item.id)}
                        >
                          Equipar
                        </Button>
                      ) : null}

                      {onToggleBagOfHolding ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onToggleBagOfHolding(item.id)}
                        >
                          {item.insideBagOfHolding
                            ? "Retirar da bolsa"
                            : "Enviar à bolsa"}
                        </Button>
                      ) : null}

                      {onTransferItem ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onTransferItem(item)}
                        >
                          {transferLabel}
                        </Button>
                      ) : null}

                      {onRemoveItem ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-text">
            {items.length
              ? regularItems.length
                ? "Nenhum item encontrado nesse filtro."
                : "Nenhum item além das moedas."
              : emptyMessage}
          </p>
        )}
      </CardContent>

      <ItemDetailsDialog
        item={viewingItem}
        canEdit={Boolean(onUpdateItem)}
        onClose={() => setViewingItem(null)}
        onEdit={openEdit}
        onUpdate={
          viewingItem && onUpdateItem
            ? (updater) => onUpdateItem(viewingItem.id, updater)
            : undefined
        }
      />

      <ItemCreationDialog
        open={creatingItem}
        title="Criar item"
        onClose={() => setCreatingItem(false)}
        onSave={(item) => {
          onAddItem?.(item)
          setCreatingItem(false)
        }}
      />

      <ItemCreationDialog
        open={editingItem !== null}
        title="Editar item"
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(item) => {
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
  onClose,
  onEdit,
  onUpdate,
}: {
  item: Itemmable | null
  canEdit: boolean
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
              <Button size="sm" onClick={() => onEdit(item)}>
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
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onTransferItem,
  onMoveAllCurrenciesToBagOfHolding,
  transferLabel,
  onViewItem,
}: {
  items: Itemmable[]
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
                  disabled={!onUpdateItem}
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onViewItem(item)}
                >
                  Ver detalhes
                </Button>
                {onTransferItem ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onTransferItem(item)}
                  >
                    {transferLabel}
                  </Button>
                ) : null}
                {onRemoveItem ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    Remover
                  </Button>
                ) : null}
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
