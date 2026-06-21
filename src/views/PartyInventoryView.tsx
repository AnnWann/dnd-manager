import { useMemo, useState } from "react"
import { PackageOpen, Scale, Truck, Utensils } from "lucide-react"

import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { useCharacterContext } from "../contexts/characterContext"
import { usePartyInventorySettings } from "../contexts/partyInventorySettingsContext"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"
import type { Itemmable } from "../models/items/item"
import type { SupplyItem } from "../models/items/SupplyItem"

export function PartyInventoryView() {
  const {
    partyInventory,
    transferCharacters,
    addPartyItem,
    updatePartyItem,
    removePartyItem,
    transferItem,
  } = useCharacterContext()
  const {
    carryCapacity,
    canEditCarryCapacity,
    setCarryCapacity,
  } = usePartyInventorySettings()
  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)

  const supplySummary = useMemo(() => {
    const supplies = partyInventory.filter(
      (item): item is SupplyItem => item.kind === "supply",
    )

    return {
      itemCount: supplies.length,
      foodUnits: sumSupplyUnits(supplies, "food"),
      drinkUnits: sumSupplyUnits(supplies, "drink"),
      mixedUnits: sumSupplyUnits(supplies, "mixed"),
    }
  }, [partyInventory])

  const totalWeight = partyInventory.reduce(
    (total, item) =>
      total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )
  const hasCapacity = carryCapacity > 0
  const remainingCapacity = carryCapacity - totalWeight
  const overloaded = hasCapacity && remainingCapacity < 0
  const loadPercentage = hasCapacity
    ? Math.min(100, Math.max(0, (totalWeight / carryCapacity) * 100))
    : 0

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden">
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 break-words">Inventário compartilhado</span>
          </div>
          <p className="mt-1 max-w-full break-words text-xs leading-5 text-textMuted">
            Itens deste espaço pertencem ao grupo. A capacidade representa o
            transporte disponível, como carroça, animais de tração e outros
            veículos definidos pelo mestre.
          </p>
        </CardHeader>

        <CardContent className="min-w-0 overflow-hidden">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Itens diferentes"
              value={String(partyInventory.length)}
            />
            <SummaryCard
              label="Peso atual"
              value={formatNumber(totalWeight)}
            />
            <SummaryCard
              label="Capacidade"
              value={
                hasCapacity
                  ? formatNumber(carryCapacity)
                  : "Não definida"
              }
            />
            <SummaryCard
              label="Espaço restante"
              value={
                hasCapacity
                  ? formatNumber(remainingCapacity)
                  : "Aguardando o mestre"
              }
              danger={overloaded}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <Truck className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 break-words">Capacidade de transporte</span>
          </div>
          <p className="mt-1 max-w-full break-words text-xs leading-5 text-textMuted">
            Este valor não depende dos atributos dos personagens. Ele é definido
            pelo mestre conforme a carroça, embarcação, montarias e animais que
            puxam a carga.
          </p>
        </CardHeader>

        <CardContent className="grid min-w-0 gap-4 overflow-hidden">
          {canEditCarryCapacity ? (
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-textH">
                Capacidade máxima do transporte
              </span>
              <Input
                className="w-full min-w-0 max-w-full"
                type="number"
                min={0}
                step="any"
                value={carryCapacity}
                onChange={(event) =>
                  setCarryCapacity(
                    Math.max(0, Number(event.target.value) || 0),
                  )
                }
              />
              <span className="text-[11px] leading-4 text-textMuted">
                Use 0 enquanto a capacidade ainda não estiver definida.
              </span>
            </label>
          ) : (
            <div className="rounded-xl border border-border bg-bg-subtle p-3 text-sm text-text">
              {hasCapacity
                ? `O mestre definiu a capacidade do transporte como ${formatNumber(carryCapacity)}.`
                : "O mestre ainda não definiu a capacidade do transporte."}
            </div>
          )}

          {hasCapacity ? (
            <div className="grid min-w-0 gap-2">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-textMuted">
                  <Scale className="h-4 w-4 shrink-0 text-accent" />
                  <span className="break-words">
                    {formatNumber(totalWeight)} de {formatNumber(carryCapacity)}
                  </span>
                </span>
                <span
                  className={
                    overloaded
                      ? "font-semibold text-danger"
                      : "font-semibold text-textH"
                  }
                >
                  {overloaded
                    ? `${formatNumber(Math.abs(remainingCapacity))} acima do limite`
                    : `${formatNumber(remainingCapacity)} livres`}
                </span>
              </div>

              <div className="h-2 w-full min-w-0 overflow-hidden rounded-full bg-bg-subtle">
                <div
                  className={
                    overloaded
                      ? "h-full rounded-full bg-danger"
                      : "h-full rounded-full bg-accent"
                  }
                  style={{ width: `${loadPercentage}%` }}
                />
              </div>

              {overloaded ? (
                <p className="break-words text-xs leading-5 text-danger">
                  O transporte está sobrecarregado. O sistema apenas sinaliza a
                  situação; ele não impede transferências automaticamente.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {supplySummary.itemCount > 0 ? (
        <Card className="min-w-0 max-w-full overflow-hidden">
          <CardHeader className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
              <Utensils className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 break-words">Suprimentos registrados</span>
            </div>
            <p className="mt-1 max-w-full break-words text-xs leading-5 text-textMuted">
              As unidades estão prontas para o futuro cálculo de descanso, mas
              ainda não são consumidas automaticamente.
            </p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              <SupplyChip label="Comida" value={supplySummary.foodUnits} />
              <SupplyChip label="Bebida" value={supplySummary.drinkUnits} />
              <SupplyChip label="Misto" value={supplySummary.mixedUnits} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <InventoryEditor
          title="Itens do grupo"
          description={
            hasCapacity
              ? `Peso compartilhado: ${formatNumber(totalWeight)} de ${formatNumber(carryCapacity)}.`
              : `Peso compartilhado: ${formatNumber(totalWeight)}. A capacidade ainda não foi definida pelo mestre.`
          }
          items={partyInventory}
          emptyMessage="O inventário do grupo está vazio."
          onAddItem={addPartyItem}
          onUpdateItem={updatePartyItem}
          onRemoveItem={removePartyItem}
          onTransferItem={setTransferringItem}
          transferLabel="Enviar a personagem"
        />
      </div>

      <TransferItemDialog
        open={transferringItem !== null}
        item={transferringItem}
        from={{ type: "party" }}
        characters={transferCharacters}
        onClose={() => setTransferringItem(null)}
        onTransfer={transferItem}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className={
        danger
          ? "min-w-0 max-w-full rounded-xl border border-danger bg-dangerBg p-3"
          : "min-w-0 max-w-full rounded-xl border border-border bg-bg-subtle p-3"
      }
    >
      <div className="break-words text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div
        className={
          danger
            ? "mt-1 max-w-full break-words text-base font-semibold text-danger"
            : "mt-1 max-w-full break-words text-base font-semibold text-textH"
        }
      >
        {value}
      </div>
    </div>
  )
}

function SupplyChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 max-w-full rounded-xl border border-accentBorder bg-accentBg px-3 py-2 text-xs font-medium text-textH">
      <span className="break-words">
        {label}: {formatNumber(value)} unidades
      </span>
    </div>
  )
}

function sumSupplyUnits(
  supplies: SupplyItem[],
  category: SupplyItem["supplyCategory"],
): number {
  return supplies
    .filter((item) => item.supplyCategory === category)
    .reduce(
      (total, item) =>
        total +
        Math.max(0, item.quantity ?? 0) *
          Math.max(0, item.supplyUnitsPerItem ?? 0),
      0,
    )
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}
