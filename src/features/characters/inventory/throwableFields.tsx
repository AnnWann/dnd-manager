import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { DIE_SIDES } from "../../../contexts/consts"
import type { DieSides } from "../../../models/dice/Die"
import type { ThrowableItem } from "../../../models/items/equipment/PocketItem"
import type { Itemmable } from "../../../models/items/item"

export function ThrowableFields({
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



export function withThrowableDefaults(item: Itemmable): ThrowableItem {
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

function isThrowableItem(item: Itemmable): item is ThrowableItem {
  return item.kind === "throwable"
}