import { Input } from "../../../components/ui/Input"
import type { ConsumableItem } from "../../../models/items/equipment/PocketItem"
import type { Itemmable } from "../../../models/items/item"

export function ConsumableFields({
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

export function withConsumableDefaults(item: Itemmable): ConsumableItem {
  return {
    ...item,
    kind: "consumable",
    equippable: false,
    equipSlot: undefined,
    pocketable: true,
    useText: (item as Partial<ConsumableItem>).useText ?? "",
  }
}

export function isConsumableItem(item: Itemmable): item is ConsumableItem {
  return item.kind === "consumable"
}