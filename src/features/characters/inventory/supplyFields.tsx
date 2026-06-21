import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Itemmable } from "../../../models/items/item"
import type {
  SupplyCategory,
  SupplyItem,
} from "../../../models/items/SupplyItem"
import {
  getSupplyPackageDefaults,
  STANDARD_PORTIONS_PER_BARREL,
  STANDARD_PORTIONS_PER_RATION,
  type SupplyPackageKind,
} from "../../../models/supplies/partySupply"

const SUPPLY_CATEGORIES: Array<{
  value: SupplyCategory
  label: string
}> = [
  { value: "food", label: "Comida" },
  { value: "drink", label: "Bebida" },
  { value: "mixed", label: "Comida e bebida" },
  { value: "other", label: "Outro" },
]

const PACKAGE_OPTIONS: Array<{
  value: SupplyPackageKind
  label: string
}> = [
  { value: "ration", label: "Ração individual — 1 porção" },
  { value: "barrel", label: "Barril — 40 porções" },
  { value: "custom", label: "Quantidade personalizada" },
]

export function withSupplyDefaults(item: Itemmable): SupplyItem {
  const current = item as Partial<SupplyItem>
  const supplyPackage = inferSupplyPackage(current)
  const packageDefaults = getSupplyPackageDefaults(supplyPackage)

  return {
    ...item,
    kind: "supply",
    equippable: false,
    equipSlot: undefined,
    pocketable: false,
    insideBagOfHolding: false,
    supplyCategory: current.supplyCategory ?? "food",
    supplyPackage,
    supplyUnitsPerItem: Math.max(
      0,
      current.supplyUnitsPerItem ?? packageDefaults.portions,
    ),
    supplyUnitLabel:
      current.supplyUnitLabel ?? packageDefaults.label,
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
    <section className="grid min-w-0 gap-3 rounded-xl border border-border bg-bg-subtle p-3 md:col-span-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-textH">
          Dados de suprimento
        </div>
        <p className="mt-1 max-w-full break-words text-[11px] leading-4 text-textMuted">
          Uma porção sustenta um humanoide Médio por um descanso longo. Uma
          ração individual vale {STANDARD_PORTIONS_PER_RATION} porção; um barril
          vale {STANDARD_PORTIONS_PER_BARREL} porções.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <label className="grid min-w-0 gap-1">
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

        <label className="grid min-w-0 gap-1">
          <span className="text-xs text-textMuted">Embalagem</span>
          <Select
            value={supply.supplyPackage ?? "custom"}
            onChange={(event) => {
              const nextPackage = event.target.value as SupplyPackageKind
              const defaults = getSupplyPackageDefaults(nextPackage)

              onUpdate((current) => ({
                ...withSupplyDefaults(current),
                supplyPackage: nextPackage,
                supplyUnitsPerItem:
                  nextPackage === "custom"
                    ? withSupplyDefaults(current).supplyUnitsPerItem
                    : defaults.portions,
                supplyUnitLabel: defaults.label,
              }))
            }}
          >
            {PACKAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="text-xs text-textMuted">
            Porções padrão por item
          </span>
          <Input
            type="number"
            min={0}
            step="any"
            disabled={supply.supplyPackage !== "custom"}
            value={supply.supplyUnitsPerItem}
            onChange={(event) =>
              onUpdate((current) => ({
                ...withSupplyDefaults(current),
                supplyPackage: "custom",
                supplyUnitsPerItem: Math.max(
                  0,
                  Number(event.target.value) || 0,
                ),
              }))
            }
          />
        </label>
      </div>

      <p className="text-[11px] leading-4 text-textMuted">
        A quantidade geral do item representa quantas rações, barris ou
        embalagens desse tipo existem no inventário.
      </p>
    </section>
  )
}

function inferSupplyPackage(
  item: Partial<SupplyItem>,
): SupplyPackageKind {
  if (item.supplyPackage) return item.supplyPackage
  if (item.supplyUnitsPerItem === STANDARD_PORTIONS_PER_BARREL) {
    return "barrel"
  }
  if (item.supplyUnitsPerItem === STANDARD_PORTIONS_PER_RATION) {
    return "ration"
  }
  return "custom"
}
