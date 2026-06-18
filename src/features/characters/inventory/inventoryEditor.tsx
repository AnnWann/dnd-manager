import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import { Select } from "../../../components/ui/Select"
import { EquipmentEditDialog } from "../equipment/equipmentEditDialog"
import type { Itemmable, ItemKind } from "../../../models/items/item"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type { Armor } from "../../../models/items/equipment/Armor"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { DieSides } from "../../../models/dice/Die"
import type { ConsumableItem, ThrowableItem } from "../../../models/items/equipment/PocketItem"

type EquipSlot = "armor" | "helmet" | "gloves" | "boots" | "weapon" | "ring"

type Props = {
  title: string
  description: string
  items: Itemmable[]
  emptyMessage: string
  onAddItem: () => void
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

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]

const DIE_SIDES: DieSides[] = [
  "d2",
  "d3",
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
]

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

          <Button size="sm" variant="primary" onClick={onAddItem}>
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
                      <div className="grid gap-3 md:grid-cols-[1fr_90px_110px]">
                        <div className="grid gap-2">
                          <label className="text-xs text-text">Item</label>

                          <Input
                            value={item.name}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Nome do item"
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-xs text-text">Qtd.</label>

                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
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
                            value={item.weight ?? 0}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
                                weight: Number(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>

                        <div className="grid gap-2 md:col-span-3">
                          <label className="text-xs text-text">Tipo</label>

                          <ItemKindButtons
                            value={item.kind ?? "common"}
                            onChange={(kind) =>
                              onUpdateItem(item.id, (current) =>
                                updateItemKind(current, kind),
                              )
                            }
                          />
                        </div>

                        <div className="grid gap-2 md:col-span-3">
                          <label className="text-xs text-text">Descrição</label>

                          <Textarea
                            rows={2}
                            value={item.desc ?? ""}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
                                desc: e.target.value,
                              }))
                            }
                            placeholder="Descrição do item..."
                          />
                        </div>

                        <div className="grid gap-2 md:col-span-3">
                          <label className="text-xs text-text">Notas</label>

                          <Textarea
                            rows={2}
                            value={item.notes ?? ""}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
                                notes: e.target.value,
                              }))
                            }
                            placeholder="Detalhes, condições, localização..."
                          />
                        </div>

                        {item.kind === "equipment" ? (
                          <EquipmentFields
                            item={item}
                            onUpdate={(updater) => onUpdateItem(item.id, updater)}
                          />
                        ) : null}

                        {item.kind === "consumable" ? (
                          <ConsumableFields
                            item={item}
                            onUpdate={(updater) => onUpdateItem(item.id, updater)}
                          />
                        ) : null}

                        {item.kind === "throwable" ? (
                          <ThrowableFields
                            item={item}
                            onUpdate={(updater) => onUpdateItem(item.id, updater)}
                          />
                        ) : null}

                        <div className="flex justify-end gap-2 md:col-span-3">
                          {item.kind === "equipment" ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingEquipment(item)}
                              >
                                ✏️
                              </Button>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onEquipItem(item.id)}
                              >
                                Equipar
                              </Button>
                            </>
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
                      </div>
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

function EquipmentFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  return (
    <>
      <div className="grid gap-2 md:col-span-3">
        <label className="text-xs text-text">Slot</label>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {[
            ["armor", "Armadura"],
            ["helmet", "Capacete"],
            ["gloves", "Luvas"],
            ["boots", "Botas"],
            ["weapon", "Arma"],
            ["ring", "Anel"],
            ["cape", "Capa"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                item.equipSlot === value
                  ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
                  : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
              }
              onClick={() =>
                onUpdate((current) =>
                  withEquipmentDefaults(current, value as EquipSlot),
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {item.equipSlot === "armor" ? (
        <div className="grid gap-2 md:col-span-3">
          <label className="text-xs text-text">Tipo de armadura</label>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["light", "Leve"],
              ["medium", "Média"],
              ["heavy", "Pesada"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  (item as Partial<Armor>).armorType === value
                    ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
                    : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
                }
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    armorType: value as Armor["armorType"],
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {item.equipSlot === "weapon" ? (
        <WeaponFields item={item} onUpdate={onUpdate} />
      ) : null}
    </>
  )
}

function WeaponFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const weapon = item as Partial<Weapon>

  return (
    <div className="grid gap-3 md:col-span-3 md:grid-cols-4">
      <div className="grid gap-2">
        <label className="text-xs text-text">Qtd. dados</label>

        <Input
          type="number"
          min={1}
          value={weapon.damage?.quantity ?? 1}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              damage: {
                quantity: Number(e.target.value) || 1,
                sides: weapon.damage?.sides ?? "d6",
              },
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Dado</label>

        <Select
          value={weapon.damage?.sides ?? "d6"}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              damage: {
                quantity: weapon.damage?.quantity ?? 1,
                sides: e.target.value as DieSides,
              },
            }))
          }
        >
          {DIE_SIDES.map((side) => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Atributo</label>

        <Select
          value={weapon.modifierAttribute ?? "str"}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              modifierAttribute: e.target.value as Attribute,
            }))
          }
        >
          {ATTRIBUTES.map((attribute) => (
            <option key={attribute.value} value={attribute.value}>
              {attribute.label}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.twoHanded ?? false}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              twoHanded: e.target.checked,
            }))
          }
        />
        Duas mãos
      </label>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.proficient ?? false}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              proficient: e.target.checked,
            }))
          }
        />
        Proficiente
      </label>
    </div>
  )
}

function ConsumableFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const consumable = isConsumableItem(item) ? item : undefined

  return (
    <div className="grid gap-2 md:col-span-3">
      <label className="text-xs text-text">Uso</label>

      <Input
        value={consumable?.useText ?? ""}
        onChange={(e) =>
          onUpdate((current) => ({
            ...current,
            useText: e.target.value,
          }))
        }
        placeholder="Ex.: Recupera 2d4+2 PV"
      />
    </div>
  )
}

function ThrowableFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const throwable = isThrowableItem(item) ? item : undefined

  return (
    <div className="grid gap-3 md:col-span-3 md:grid-cols-3">
      <div className="grid gap-2">
        <label className="text-xs text-text">Qtd. dados</label>

        <Input
          type="number"
          min={1}
          value={throwable?.damage?.quantity ?? 1}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              damage: {
                quantity: Number(e.target.value) || 1,
                sides: throwable?.damage?.sides ?? "d4",
              },
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Dado</label>

        <Select
          value={throwable?.damage?.sides ?? "d4"}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              damage: {
                quantity: throwable?.damage?.quantity ?? 1,
                sides: e.target.value as DieSides,
              },
            }))
          }
        >
          {DIE_SIDES.map((side) => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Alcance</label>

        <Input
          value={throwable?.range ?? ""}
          onChange={(e) =>
            onUpdate((current) => ({
              ...current,
              range: e.target.value,
            }))
          }
          placeholder="Ex.: 6/18m"
        />
      </div>
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


function withEquipmentDefaults(
  item: Itemmable,
  equipSlot: EquipSlot,
): Itemmable {
  const base = {
    ...item,
    kind: "equipment" as const,
    equippable: true,
    equipSlot,
    pocketable: equipSlot === "weapon" || equipSlot === "ring",
  }

  if (equipSlot === "weapon") {
    return withWeaponDefaults(base)
  }

  if (equipSlot === "armor") {
    return {
      ...base,
      armorType: (item as Partial<Armor>).armorType ?? "light",
    }
  }

  return {
    ...base,
    armorType: undefined,
  }
}

function withWeaponDefaults(item: Itemmable): Itemmable {
  const weapon = item as Partial<Weapon>

  return {
    ...item,
    properties: weapon.properties ?? [],
    twoHanded: weapon.twoHanded ?? false,
    damage: weapon.damage ?? {
      quantity: 1,
      sides: "d6",
    },
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  }
}

function withConsumableDefaults(item: Itemmable): ConsumableItem {
  return {
    ...item,
    kind: "consumable",
    equippable: false,
    equipSlot: undefined,
    pocketable: true,
    useText: (item as Partial<ConsumableItem>).useText ?? "",
  }
}

function withThrowableDefaults(item: Itemmable): ThrowableItem {
  const throwable = item as Partial<ThrowableItem>

  return {
    ...item,
    kind: "throwable",
    equippable: false,
    equipSlot: undefined,
    pocketable: true,
    damage: throwable.damage ?? {
      quantity: 1,
      sides: "d4",
    },
    range: throwable.range ?? "",
  }
}

function isConsumableItem(item: Itemmable): item is ConsumableItem {
  return item.kind === "consumable"
}

function isThrowableItem(item: Itemmable): item is ThrowableItem {
  return item.kind === "throwable"
}
