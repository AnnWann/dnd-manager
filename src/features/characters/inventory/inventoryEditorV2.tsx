import { useEffect, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import { normalizeItemText } from "../../../lib/textNormalization"
import { withShieldDefaults } from "../../../models/items/equipment/Shield"
import type { ItemKind, Itemmable } from "../../../models/items/item"
import { isConsumableItemKind } from "../../../models/items/itemConsumption"
import {
  canItemGoInPocket,
  getDefaultPocketableForKind,
  isAutomaticallyPocketableKind,
} from "../../../models/items/itemPocketability"
import type { SupplyItem } from "../../../models/items/SupplyItem"
import { newInventoryItem } from "./characterInventory"
import { ConsumableFields, withConsumableDefaults } from "./consumableFields"
import { EquipmentFields, withEquipmentDefaults } from "./equipmentFields"
import { ItemDropdownDetails } from "./itemDropdownDetails"
import { SupplyFields, withSupplyDefaults } from "./supplyFields"
import { ThrowableFields, withThrowableDefaults } from "./throwableFields"

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

const ITEM_KIND_OPTIONS: Array<{ value: ItemKind; label: string }> = [
  { value: "common", label: "Comum" },
  { value: "supply", label: "Suprimento" },
  { value: "equipment", label: "Equipamento" },
  { value: "shield", label: "Escudo" },
  { value: "ammunition", label: "Munição" },
  { value: "tool", label: "Ferramenta" },
  { value: "focus", label: "Foco" },
  { value: "instrument", label: "Instrumento" },
  { value: "pack", label: "Pacote" },
  { value: "gear", label: "Equipamento geral" },
  { value: "currency", label: "Moeda" },
  { value: "consumable", label: "Consumível" },
  { value: "throwable", label: "Arremessável" },
]

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
  onToggleAttunement,
  attunedItemIds = [],
  onTransferItem,
  transferLabel = "Transferir",
}: Props) {
  const [openItemKey, setOpenItemKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<InventoryFilter>("all")
  const [creatingItem, setCreatingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<Itemmable | null>(null)

  const currencyItems = items.filter((item) => item.kind === "currency")
  const regularItems = items.filter((item) => item.kind !== "currency")
  const filteredItems = regularItems.filter((item) =>
    matchesInventoryFilter(item, filter),
  )

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
          onEquipItem={onEquipItem}
          transferLabel={transferLabel}
          onEditItem={setEditingItem}
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
              const isAttuned = attunedItemIds.includes(item.id)

              return (
                <article
                  key={itemKey}
                  className="overflow-hidden rounded-xl border border-border bg-[color:var(--social-bg)]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenItemKey((current) =>
                        current === itemKey ? null : itemKey,
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-textH">
                          {item.name || "Item sem nome"}
                        </span>
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
                    <span className="shrink-0 text-xs text-text">
                      {isOpen ? "▼" : "▶"}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-border p-3">
                      <div className="flex flex-wrap gap-2">
                        {onUpdateItem ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingItem(item)}
                          >
                            Editar
                          </Button>
                        ) : null}

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
                            disabled={!onRemoveItem}
                  onClick={() => onRemoveItem?.(item.id)}
                          >
                            Remover
                          </Button>
                        ) : null}
                      </div>

                      <ItemDropdownDetails
                        item={item}
                        onUpdate={
                          onUpdateItem
                            ? (updater) => onUpdateItem(item.id, updater)
                            : undefined
                        }
                      />
                    </div>
                  ) : null}
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

      {onAddItem ? (
      <ItemEditPopup
        open={creatingItem}
        title="Criar item"
        item={newInventoryItem()}
        onClose={() => setCreatingItem(false)}
        onSave={(item) => {
          onAddItem(normalizeItemText(item))
          setCreatingItem(false)
        }}
      />
      ) : null}

      {onUpdateItem ? (
      <ItemEditPopup
        open={editingItem !== null}
        title="Editar item"
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(item) => {
          onUpdateItem(item.id, () => normalizeItemText(item))
          setEditingItem(null)
        }}
      />
      ) : null}
    </Card>
  )
}

function ItemBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}

function CurrencyWallet({
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onTransferItem,
  onEquipItem,
  transferLabel,
  onEditItem,
}: {
  items: Itemmable[]
  onAddItem?: (item: Itemmable) => void
  onUpdateItem?: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  onRemoveItem?: (itemId: string) => void
  onTransferItem?: (item: Itemmable) => void
  onEquipItem?: (itemId: string) => void
  transferLabel: string
  onEditItem: (item: Itemmable) => void
}) {
  return (
    <div className="mb-4 rounded-xl border border-accentBorder bg-accentBg p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-textH">Moedas</div>
          <div className="mt-1 text-xs leading-5 text-textMuted">
            Valores monetários ficam separados do restante dos itens.
          </div>
        </div>
        {onAddItem ? (
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="secondary"
            onClick={() => onAddItem(newCurrencyItem())}
          >
            + Moeda
          </Button>
        ) : null}
      </div>

      {items.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-bg p-3"
            >
              <div className="truncate text-sm font-medium text-textH">
                {item.name || "Moedas"}
              </div>
              <label className="mt-2 grid gap-1.5">
                <span className="text-[11px] text-textMuted">Quantidade</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!onUpdateItem}
                  value={item.quantity ?? 0}
                  onChange={(event) =>
                    onUpdateItem?.(item.id, (current) => ({
                      ...current,
                      quantity: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {onUpdateItem ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEditItem(item)}
                  >
                    Editar
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

function newCurrencyItem(): Itemmable {
  return normalizeItemText({
    id: crypto.randomUUID(),
    name: "Moedas",
    desc: "",
    notes: "",
    quantity: 0,
    weight: 0,
    pocketable: true,
    kind: "currency",
    magicItem: false,
    requiresAttunement: false,
    insideBagOfHolding: false,
  })
}

function updateItemKind(item: Itemmable, kind: ItemKind): Itemmable {
  if (kind === "equipment") {
    return withEquipmentDefaults(item, item.equipSlot ?? "weapon")
  }
  if (kind === "shield") return withShieldDefaults(item)
  if (kind === "consumable") return withConsumableDefaults(item)
  if (kind === "throwable") return withThrowableDefaults(item)
  if (kind === "supply") return withSupplyDefaults(item)

  return {
    ...item,
    kind,
    equippable: false,
    equipSlot: undefined,
    pocketable: getDefaultPocketableForKind(kind),
    insideBagOfHolding: false,
    weight: kind === "currency" ? 0 : item.weight,
  }
}

function inventoryItemTypeLabel(item: Itemmable): string {
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

function ItemKindButtons({
  value,
  onChange,
}: {
  value: ItemKind
  onChange: (value: ItemKind) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ITEM_KIND_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            value === option.value
              ? "rounded-md border border-accentBorder bg-accentBg px-2 py-2 text-xs font-medium text-textH"
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

  const automaticPocket = isAutomaticallyPocketableKind(draft.kind)
  const blockedFromPocket =
    draft.kind === "supply" || draft.kind === "pack" || draft.kind === "shield"

  return (
    <div className="fixed inset-0 z-[10000] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="grid max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-3xl gap-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="break-words text-sm font-semibold text-textH">{title}</h2>
          <Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_90px_110px]">
          <label className="grid min-w-0 gap-2">
            <span className="text-xs text-text">Item</span>
            <Input
              value={draft.name}
              onChange={(event) =>
                patch((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Nome do item"
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-xs text-text">Qtd.</span>
            <Input
              type="number"
              min={0}
              step="any"
              value={draft.quantity}
              onChange={(event) =>
                patch((current) => ({
                  ...current,
                  quantity: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-xs text-text">Peso</span>
            <Input
              type="number"
              min={0}
              step="any"
              value={draft.weight ?? 0}
              onChange={(event) =>
                patch((current) => ({
                  ...current,
                  weight: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          </label>

          <div className="grid min-w-0 gap-2 md:col-span-3">
            <span className="text-xs text-text">Tipo</span>
            <ItemKindButtons
              value={draft.kind ?? "common"}
              onChange={(kind) => patch((current) => updateItemKind(current, kind))}
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text md:col-span-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={draft.magicItem === true}
              onChange={(event) =>
                patch((current) => ({
                  ...current,
                  magicItem: event.target.checked,
                  requiresAttunement: event.target.checked
                    ? current.requiresAttunement ?? false
                    : false,
                }))
              }
            />
            <span>
              <span className="font-medium text-textH">Item mágico</span>
              <span className="mt-0.5 block text-textMuted">
                Permite filtrar o item como mágico e habilita a opção de exigir sintonia.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text md:col-span-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={draft.requiresAttunement === true}
              disabled={!draft.magicItem}
              onChange={(event) =>
                patch((current) => ({
                  ...current,
                  requiresAttunement: event.target.checked,
                }))
              }
            />
            <span>
              <span className="font-medium text-textH">Requer sintonia</span>
              <span className="mt-0.5 block text-textMuted">
                O item poderá ocupar um dos três espaços de sintonia do personagem.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text md:col-span-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={canItemGoInPocket(draft)}
              disabled={automaticPocket || blockedFromPocket}
              onChange={(event) =>
                patch((current) => ({ ...current, pocketable: event.target.checked }))
              }
            />
            <span>
              <span className="font-medium text-textH">Cabe no bolso</span>
              <span className="mt-0.5 block text-textMuted">
                {automaticPocket
                  ? "Esta categoria sempre pode ser guardada no bolso."
                  : blockedFromPocket
                    ? "Esta categoria não pode ser colocada no bolso."
                    : "Marque para permitir que este item seja colocado no bolso."}
              </span>
            </span>
          </label>

          <label className="grid min-w-0 gap-2 md:col-span-3">
            <span className="text-xs text-text">Descrição</span>
            <Textarea
              rows={2}
              value={draft.desc ?? ""}
              onChange={(event) =>
                patch((current) => ({ ...current, desc: event.target.value }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2 md:col-span-3">
            <span className="text-xs text-text">Notas</span>
            <Textarea
              rows={2}
              value={draft.notes ?? ""}
              onChange={(event) =>
                patch((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>

          {draft.kind === "equipment" || draft.kind === "shield" ? (
            <EquipmentFields item={draft} onUpdate={patch} />
          ) : null}
          {draft.kind === "consumable" ? (
            <ConsumableFields item={draft} onUpdate={patch} />
          ) : null}
          {draft.kind === "throwable" ? (
            <ThrowableFields item={draft} onUpdate={patch} />
          ) : null}
          {draft.kind === "supply" ? (
            <SupplyFields item={draft} onUpdate={patch} />
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!draft.name.trim()}
            onClick={() => onSave(draft)}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}
