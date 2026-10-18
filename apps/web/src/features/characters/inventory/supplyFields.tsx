import { Input } from "../../../components/ui/Input"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { Select } from "../../../components/ui/Select"
import type { Itemmable } from "../../../models/items/item"
import type {
  SupplyCategory,
  SupplyItem,
} from "../../../models/items/SupplyItem"
import {
  getSupplyPackageDefaults,
  getTotalSupplyPortions,
  STANDARD_PORTIONS_PER_BARREL,
  STANDARD_PORTIONS_PER_RATION,
  type SupplyPackageKind,
} from "../../../models/supplies/partySupply"
import {
  formatSupplyPhysicalAmount,
  normalizeLongRestSupplySettings,
} from "../../../shared/rest/longRestSupplySettings"

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
  const hasSupplyData =
    current.supplyPackage !== undefined ||
    current.supplyUnitsPerItem !== undefined ||
    current.supplyCategory !== undefined
  const supplyPackage = hasSupplyData
    ? inferSupplyPackage(current)
    : "ration"
  const packageDefaults = getSupplyPackageDefaults(supplyPackage)
  const parsedRemaining = Number(current.remainingSupplyUnits)
  const currentWeight = Math.max(0, Number(item.weight) || 0)

  return {
    ...item,
    kind: "supply",
    equippable: false,
    equipSlot: undefined,
    pocketable: false,
    insideBagOfHolding: false,
    weight: currentWeight,
    supplyCategory: current.supplyCategory ?? "food",
    supplyPackage,
    supplyUnitsPerItem: Math.max(
      0,
      current.supplyUnitsPerItem ?? packageDefaults.portions,
    ),
    remainingSupplyUnits:
      current.remainingSupplyUnits !== undefined &&
      Number.isFinite(parsedRemaining)
        ? Math.max(0, parsedRemaining)
        : undefined,
    supplyUnitLabel:
      current.supplyUnitLabel ?? packageDefaults.label,
  } as SupplyItem
}

export function setSupplyPackageQuantity(
  item: Itemmable,
  quantity: number,
): SupplyItem {
  const supply = withSupplyDefaults(item)
  const nextQuantity = Math.max(0, Number(quantity) || 0)
  const portionsPerItem = Math.max(0, supply.supplyUnitsPerItem || 0)

  return {
    ...supply,
    quantity: nextQuantity,
    remainingSupplyUnits: nextQuantity * portionsPerItem,
  }
}

export function setSupplyRemainingPortions(
  item: Itemmable,
  remainingPortions: number,
): SupplyItem {
  const supply = withSupplyDefaults(item)
  const remaining = Math.max(0, Number(remainingPortions) || 0)
  const portionsPerItem = Math.max(0, supply.supplyUnitsPerItem || 0)

  return {
    ...supply,
    quantity:
      portionsPerItem > 0
        ? Math.ceil(remaining / portionsPerItem)
        : 0,
    remainingSupplyUnits: remaining,
  }
}

export function SupplyFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const supply = withSupplyDefaults(item)
  const runtime = useOptionalSessionRuntime()
  const supplySettings = normalizeLongRestSupplySettings(
    runtime?.runtimeConfigSnapshot?.config.longRestSupplies,
  )

  return (
    <section className="grid min-w-0 gap-3 rounded-xl border border-border bg-bg-subtle p-3 md:col-span-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-textH">
          Dados de suprimento
        </div>
        <p className="mt-1 max-w-full break-words text-[11px] leading-4 text-textMuted">
          O inventário armazena suprimentos em porções. Pela regra atual da
          campanha, 1 porção de comida equivale a{" "}
          {formatSupplyPhysicalAmount(1, supplySettings.food)} e 1 porção de
          bebida equivale a{" "}
          {formatSupplyPhysicalAmount(1, supplySettings.drink)}. Uma ração
          padrão vale {STANDARD_PORTIONS_PER_RATION} porção; um barril padrão
          vale {STANDARD_PORTIONS_PER_BARREL} porções.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

              onUpdate((current) => {
                const supply = withSupplyDefaults(current)
                const unitsPerItem =
                  nextPackage === "custom"
                    ? supply.supplyUnitsPerItem
                    : defaults.portions

                return {
                  ...supply,
                  supplyPackage: nextPackage,
                  supplyUnitsPerItem: unitsPerItem,
                  weight: supply.weight,
                  remainingSupplyUnits:
                    Math.max(0, Number(supply.quantity) || 0)
                    * Math.max(0, unitsPerItem),
                  supplyUnitLabel: defaults.label,
                }
              })
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
              onUpdate((current) => {
                const supply = withSupplyDefaults(current)
                const unitsPerItem = Math.max(
                  0,
                  Number(event.target.value) || 0,
                )

                return {
                  ...supply,
                  supplyPackage: "custom",
                  supplyUnitsPerItem: unitsPerItem,
                  remainingSupplyUnits:
                    Math.max(0, Number(supply.quantity) || 0)
                    * unitsPerItem,
                }
              })
            }
          />
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="text-xs text-textMuted">
            Porções restantes no estoque
          </span>
          <Input
            type="number"
            min={0}
            step="any"
            value={getTotalSupplyPortions(supply)}
            onChange={(event) =>
              onUpdate((current) =>
                setSupplyRemainingPortions(
                  current,
                  Number(event.target.value) || 0,
                ),
              )
            }
          />
        </label>
      </div>

      <p className="text-[11px] leading-4 text-textMuted">
        Quantidade e estoque ficam vinculados. Alterar a quantidade recalcula
        as porções disponíveis; alterar as porções recalcula quantas embalagens
        são necessárias. Estoques parcialmente consumidos podem manter a última
        embalagem incompleta.
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
