import { useEffect, useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import { EquipmentEditDialog } from "../equipment/equipmentEditDialog"
import type { Itemmable, ItemKind } from "../../../models/items/item"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import { EquipmentFields, withEquipmentDefaults } from "./equipmentFields"
import { ConsumableFields, withConsumableDefaults } from "./consumableFields"
import { ThrowableFields, withThrowableDefaults } from "./throwableFields"
import { newInventoryItem } from "./characterInventory"

type Props = {
  title: string
  description: string
  items: Itemmable[]
  emptyMessage: string
  onAddItem: (item: Itemmable) => void
  onUpdateItem: (itemId: string, updater: (item: Itemmable) => Itemmable) => void
  onRemoveItem: (itemId: string) => void
  onEquipItem: (itemId: string) => void
  onPocketItem?: (itemId: string) => void
  onToggleBagOfHolding?: (itemId: string) => void
}

type InventoryFilter =
  | "all"
  | "common"
  | "equipment"
  | "weapon"
  | "armor"
  | "helmet"
  | "gloves"
  | "boots"
  | "ring"
  | "consumable"
  | "throwable" 
  | "bagOfHolding"

const INVENTORY_FILTERS: Array<{ value: InventoryFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "common", label: "Comum" },
  { value: "equipment", label: "Equipamentos" },
  { value: "weapon", label: "Armas" },
  { value: "armor", label: "Armaduras" },
  { value: "helmet", label: "Capacetes" },
  { value: "gloves", label: "Luvas" },
  { value: "boots", label: "Botas" },
  { value: "ring", label: "Anéis" },
  { value: "consumable", label: "Consumíveis" },
  { value: "throwable", label: "Arremessáveis" },
  { value: "bagOfHolding", label: "Bolsa Mágica" },
]

function matchesInventoryFilter(item: Itemmable, filter: InventoryFilter) {
  if (filter === "all") return true
  if (filter === "common") return item.kind === "common"
  if (filter === "equipment") return item.kind === "equipment"
  if (filter === "consumable") return item.kind === "consumable"
  if (filter === "throwable") return item.kind === "throwable"
  if (filter === "bagOfHolding") {return item.insideBagOfHolding === true}


  return item.kind === "equipment" && item.equipSlot === filter
}

export function InventoryEditor({
  title,
  description,
  items,
  emptyMessage,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onEquipItem,
  onPocketItem,
  onToggleBagOfHolding,
}: Props) {
  const [editingEquipment, setEditingEquipment] = useState<Itemmable | null>(null)
  const [openItemKey, setOpenItemKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<InventoryFilter>("all")
  const [creatingItem, setCreatingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<Itemmable | null>(null)

  const filteredItems = items.filter((item) =>
    matchesInventoryFilter(item, filter),
  )

  function toggleItem(itemKey: string) {
    setOpenItemKey((current) => (current === itemKey ? null : itemKey))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">{title}</div>
            <div className="mt-1 text-xs text-text">{description}</div>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setCreatingItem(true)}
          >
            + Adicionar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          {INVENTORY_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                filter === option.value
                  ? "rounded-md border border-accentBorder bg-textH px-2 py-1 text-xs font-medium text-background"
                  : "rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-[color:var(--social-bg)]"
              }
              onClick={() => {
                setFilter(option.value)
                setOpenItemKey(null)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredItems.length ? (
          <div className="grid gap-3">
            {filteredItems.map((item, index) => {
              const itemKey = `${item.id}-${index}`
              const isOpen = openItemKey === itemKey

              return (
                <div
                  key={itemKey}
                  className="rounded-xl border border-border bg-[color:var(--social-bg)]"
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(itemKey)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-textH">
                        {item.name || "Item sem nome"}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text">
                        <span>Tipo: {inventoryItemTypeLabel(item)}</span>
                        <span>Qtd. {item.quantity ?? 1}</span>
                        <span>Peso {item.weight ?? 0}</span>
                      

                        {item.kind === "equipment" ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="rounded-md border border-border px-2 py-1 text-xs text-text"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEquipItem(item.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return
                              e.stopPropagation()
                              onEquipItem(item.id)
                            }}
                          >
                            Equipar
                          </span>
                        ) : null}

                        {canGoToPocket(item) && onPocketItem ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="rounded-md border border-border px-2 py-1 text-xs text-text"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPocketItem(item.id)
                            }}
                          >
                            Enviar ao bolso
                          </span>
                        ) : null}

                        {onToggleBagOfHolding ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className={[
                              "rounded-md border px-2 py-1 text-xs",
                              item.insideBagOfHolding
                                ? "border-accentBorder text-accent"
                                : "border-border text-text",
                            ].join(" ")}
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleBagOfHolding(item.id)
                            }}
                          >
                            {item.insideBagOfHolding
                              ? "Retirar da bolsa mágica"
                              : "Enviar à bolsa mágica"}
                          </span>
                        ) : null}
                        
                      </div>
                    </div>

                    <span className="shrink-0 text-xs text-text">
                      {isOpen ? "▼" : "▶"}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-border p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingItem(item)}
                        >
                          Editar
                        </Button>

                        {item.kind === "equipment" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onEquipItem(item.id)}
                          >
                            Equipar
                          </Button>
                        ) : null}

                          {canGoToPocket(item) && onPocketItem ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => onPocketItem(item.id)}
                            >
                              Colocar no bolso
                            </Button>
                          ) : null}

                          {onToggleBagOfHolding ? (
                            <span
                              role="button"
                              tabIndex={0}
                              className="rounded-md border border-border px-2 py-1 text-xs text-text"
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleBagOfHolding(item.id)
                              }}
                            >
                              {item.insideBagOfHolding
                                ? "Retirar da bolsa"
                                : "Enviar à bolsa"}
                            </span>
                          ) : null}

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          Remover
                        </Button>
                      </div>

                      {item.desc ? (
                        <p className="mt-3 text-sm text-text">
                          {item.desc}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-text">
            {items.length
              ? "Nenhum item encontrado nesse filtro."
              : emptyMessage}
          </p>
        )}
      </CardContent>

      <EquipmentEditDialog
        open={editingEquipment !== null}
        equipment={editingEquipment as Equipment | null}
        onClose={() => setEditingEquipment(null)}
        onSave={(nextEquipment) => {
          onUpdateItem(nextEquipment.id, () => nextEquipment)
          setEditingEquipment(null)
        }}
      />

      <ItemEditPopup
        open={creatingItem}
        title="Criar item"
        item={newInventoryItem()}
        onClose={() => setCreatingItem(false)}
        onSave={(item) => {
          onAddItem(item)
          setCreatingItem(false)
        }}
      />

      <ItemEditPopup
        open={editingItem !== null}
        title="Editar item"
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(item) => {
          onUpdateItem(item.id, () => item)
          setEditingItem(null)
        }}
/>
    </Card>
  )
}

function updateItemKind(item: Itemmable, kind: ItemKind): Itemmable {
  if (kind === "equipment") {
    return withEquipmentDefaults(item, item.equipSlot ?? "weapon")
  }

  if (kind === "consumable") {
    return withConsumableDefaults(item)
  }

  if (kind === "throwable") {
    return withThrowableDefaults(item)
  }

  return {
    ...item,
    kind,
    equippable: false,
    equipSlot: undefined,
    pocketable: false,
  }
}

function itemKindLabel(kind: ItemKind): string {
  if (kind === "equipment") return "Equipamento"
  if (kind === "consumable") return "Consumível"
  if (kind === "throwable") return "Arremessável"
  return "Comum"
}

function canGoToPocket(item: Itemmable): boolean {
  return item.pocketable === true
}

function ItemKindButtons({
  value,
  onChange,
}: {
  value: ItemKind
  onChange: (value: ItemKind) => void
}) {
  const options: Array<{ value: ItemKind; label: string }> = [
    { value: "common", label: "Comum" },
    { value: "equipment", label: "Equipamento" },
    { value: "consumable", label: "Consumível" },
    { value: "throwable", label: "Arremessável" },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            value === option.value
              ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
              : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function inventoryItemTypeLabel(item: Itemmable): string {
  if (item.kind === "equipment") {
    if (item.equipSlot === "armor") return "Armadura"
    if (item.equipSlot === "helmet") return "Capacete"
    if (item.equipSlot === "gloves") return "Luvas"
    if (item.equipSlot === "boots") return "Botas"
    if (item.equipSlot === "weapon") return "Arma"
    if (item.equipSlot === "ring") return "Anel"

    return "Equipamento"
  }

  return itemKindLabel(item.kind ?? "common")
}

function ItemEditPopup({
  open,
  title,
  item,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  item: Itemmable | null
  onClose: () => void
  onSave: (item: Itemmable) => void
}) {
  const [draft, setDraft] = useState<Itemmable | null>(null)

  useEffect(() => {
    if (open && item) setDraft(item)
    if (!open) setDraft(null)
  }, [open, item])

  if (!open || !draft) return null

  function patch(updater: (item: Itemmable) => Itemmable) {
    setDraft((current) => (current ? updater(current) : current))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="grid max-h-[90vh] w-full max-w-3xl gap-4 overflow-auto rounded-xl border border-border bg-background p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-textH">{title}</h2>

          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_90px_110px]">
          <div className="grid gap-2">
            <label className="text-xs text-text">Item</label>
            <Input
              value={draft.name}
              onChange={(e) =>
                patch((item) => ({ ...item, name: e.target.value }))
              }
              placeholder="Nome do item"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-text">Qtd.</label>
            <Input
              type="number"
              min={0}
              value={draft.quantity}
              onChange={(e) =>
                patch((item) => ({
                  ...item,
                  quantity: Number(e.target.value) || 0,
                }))
              }
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-text">Peso</label>
            <Input
              type="number"
              min={0}
              value={draft.weight ?? 0}
              onChange={(e) =>
                patch((item) => ({
                  ...item,
                  weight: Number(e.target.value) || 0,
                }))
              }
            />
          </div>

          <div className="grid gap-2 md:col-span-3">
            <label className="text-xs text-text">Tipo</label>
            <ItemKindButtons
              value={draft.kind ?? "common"}
              onChange={(kind) =>
                patch((item) => updateItemKind(item, kind))
              }
            />
          </div>

          <div className="grid gap-2 md:col-span-3">
            <label className="text-xs text-text">Descrição</label>
            <Textarea
              rows={2}
              value={draft.desc ?? ""}
              onChange={(e) =>
                patch((item) => ({ ...item, desc: e.target.value }))
              }
              placeholder="Descrição do item..."
            />
          </div>

          <div className="grid gap-2 md:col-span-3">
            <label className="text-xs text-text">Notas</label>
            <Textarea
              rows={2}
              value={draft.notes ?? ""}
              onChange={(e) =>
                patch((item) => ({ ...item, notes: e.target.value }))
              }
              placeholder="Detalhes, condições, localização..."
            />
          </div>

          {draft.kind === "equipment" ? (
            <EquipmentFields item={draft} onUpdate={patch} />
          ) : null}

          {draft.kind === "consumable" ? (
            <ConsumableFields item={draft} onUpdate={patch} />
          ) : null}

          {draft.kind === "throwable" ? (
            <ThrowableFields item={draft} onUpdate={patch} />
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <Button size="sm" variant="primary" onClick={() => onSave(draft)}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}