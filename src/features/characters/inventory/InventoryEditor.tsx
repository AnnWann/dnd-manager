import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import type { Itemmable } from "../../../models/items/item"
import { Select } from "../../../components/ui/Select"
import { EquipmentEditDialog } from "../equipment/equipmentEditDialog"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type { Armor } from "../../../models/items/equipment/Armor"

type Props = {
  title: string
  description: string
  items: Itemmable[]
  emptyMessage: string
  onAddItem: () => void
  onUpdateItem: (itemId: string, updater: (item: Itemmable) => Itemmable) => void
  onRemoveItem: (itemId: string) => void
  onEquipItem: (itemId: string) => void
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
}: Props) {
  const [editingEquipment, setEditingEquipment] = useState<Itemmable | null>(null)
  const [openItemIds, setOpenItemIds] = useState<string[]>([])

  function toggleItem(itemId: string) {
    setOpenItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    )
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
        {items.length ? (
          <div className="grid gap-3">
            {items.map((item) => {
              const isOpen = openItemIds.includes(item.id)

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-[color:var(--social-bg)]"
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-textH">
                        {item.name || "Item sem nome"}
                      </div>

                      <div className="mt-1 text-xs text-text">
                        Qtd. {item.quantity ?? 1} • Peso {item.weight ?? 0}
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
                            value={Array.isArray(item.notes) ? item.notes.join("\n") : ""}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
                                notes: e.target.value,
                              }))
                            }
                            placeholder="Detalhes, condições, localização..."
                          />
                        </div>

                        <label className="flex items-center gap-2 text-xs text-text">
                          <input
                            type="checkbox"
                            checked={item.equippable ?? false}
                            onChange={(e) =>
                              onUpdateItem(item.id, (current) => ({
                                ...current,
                                equippable: e.target.checked,
                                equipSlot: e.target.checked
                                  ? current.equipSlot ?? "weapon"
                                  : undefined,
                              }))
                            }
                          />
                          Equipável
                        </label>

                        {item.equippable ? (
                          <>
                            <div className="grid gap-2 md:col-span-3">
                              <label className="text-xs text-text">Slot</label>

                              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                {[
                                  ["armor", "Armadura"],
                                  ["helmet", "Capacete"],
                                  ["gloves", "Luvas"],
                                  ["boots", "Botas"],
                                  ["weapon", "Arma"],
                                  ["ring", "Anel"],
                                  ["pocket", "Bolso"],
                                ].map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    className={
                                      item.equipSlot === value
                                        ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs text-background font-medium"
                                        : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
                                    }
                                    onClick={() =>
                                      onUpdateItem(item.id, (current) => ({
                                        ...current,
                                        equipSlot: value as Itemmable["equipSlot"],
                                        armorType:
                                          value === "armor"
                                            ? ((current as Partial<Armor>).armorType ?? "light")
                                            : undefined,
                                      }))
                                    }
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {item.equipSlot === "armor" ? (
                              <div className="grid gap-2">
                                <label className="text-xs text-text">
                                  Tipo de armadura
                                </label>

                                <Select
                                  value={(item as Partial<Armor>).armorType ?? "light"}
                                  onChange={(e) =>
                                    onUpdateItem(item.id, (current) => ({
                                      ...current,
                                      armorType: e.target.value as Armor["armorType"],
                                    }))
                                  }
                                >
                                  <option value="light">Leve</option>
                                  <option value="medium">Média</option>
                                  <option value="heavy">Pesada</option>
                                </Select>
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        <div className="flex justify-end gap-2 md:col-span-3">
                          {item.equippable ? (
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
          <p className="text-sm text-text">{emptyMessage}</p>
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