import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Itemmable } from "../../../models/items/item"
import type {
  SupplyCategory,
  SupplyItem,
} from "../../../models/items/SupplyItem"

const SUPPLY_CATEGORIES: Array<{
  value: SupplyCategory
  label: string
}> = [
  { value: "food", label: "Comida" },
  { value: "drink", label: "Bebida" },
  { value: "mixed", label: "Misto" },
  { value: "other", label: "Outro" },
]

export function withSupplyDefaults(item: Itemmable): SupplyItem {
  const current = item as Partial<SupplyItem>

  return {
    ...item,
    kind: "supply",
    equippable: false,
    equipSlot: undefined,
    pocketable: false,
    insideBagOfHolding: false,
    supplyCategory: current.supplyCategory ?? "food",
    supplyUnitsPerItem: Math.max(0, current.supplyUnitsPerItem ?? 1),
    supplyUnitLabel: current.supplyUnitLabel ?? "porções",
  } as SupplyItem
}

export function SupplyFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const supply = withSupplyDefaults(item)

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3 md:col-span-3">
      <div>
        <div className="text-xs font-semibold text-textH">
          Dados de suprimento
        </div>
        <p className="mt-1 text-[11px] leading-4 text-textMuted">
          As unidades ficam registradas agora; o cálculo de descansos será adicionado depois.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs text-textMuted">Categoria</span>
          <Select
            value={supply.supplyCategory}
            onChange={(event) =>
              onUpdate((current) => ({
                ...withSupplyDefaults(current),
                supplyCategory: event.target.value as SupplyCategory,
              }))
            }
          >
            {SUPPLY_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-textMuted">
            Unidades por quantidade
          </span>
          <Input
            type="number"
            min={0}
            step="any"
            value={supply.supplyUnitsPerItem}
            onChange={(event) =>
              onUpdate((current) => ({
                ...withSupplyDefaults(current),
                supplyUnitsPerItem: Math.max(
                  0,
                  Number(event.target.value) || 0,
                ),
              }))
            }
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-textMuted">Nome da unidade</span>
          <Input
            value={supply.supplyUnitLabel ?? ""}
            placeholder="porções, litros, barris..."
            onChange={(event) =>
              onUpdate((current) => ({
                ...withSupplyDefaults(current),
                supplyUnitLabel: event.target.value,
              }))
            }
          />
        </label>
      </div>
    </section>
  )
}
