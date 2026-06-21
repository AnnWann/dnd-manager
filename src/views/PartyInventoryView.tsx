import { useMemo, useState } from "react"
import { PackageOpen, Utensils } from "lucide-react"

import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { useCharacterContext } from "../contexts/characterContext"
import type { Itemmable } from "../models/items/item"
import type { SupplyItem } from "../models/items/SupplyItem"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"

export function PartyInventoryView() {
  const {
    partyInventory,
    transferCharacters,
    addPartyItem,
    updatePartyItem,
    removePartyItem,
    transferItem,
  } = useCharacterContext()
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

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 text-accent" />
            Inventário compartilhado
          </div>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Itens deste espaço pertencem ao grupo. Jogadores podem enviar itens próprios para cá, retirar itens e transferi-los diretamente para outros personagens disponíveis.
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Itens diferentes" value={String(partyInventory.length)} />
            <SummaryCard label="Peso total" value={formatNumber(totalWeight)} />
            <SummaryCard label="Suprimentos" value={String(supplySummary.itemCount)} />
            <SummaryCard label="Descansos restantes" value="Ainda não calculado" />
          </div>
        </CardContent>
      </Card>

      {supplySummary.itemCount > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold text-textH">
              <Utensils className="h-4 w-4 text-accent" />
              Suprimentos registrados
            </div>
            <p className="mt-1 text-xs text-textMuted">
              As unidades estão prontas para o futuro cálculo de descanso, mas ainda não são consumidas automaticamente.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <SupplyChip label="Comida" value={supplySummary.foodUnits} />
              <SupplyChip label="Bebida" value={supplySummary.drinkUnits} />
              <SupplyChip label="Misto" value={supplySummary.mixedUnits} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <InventoryEditor
        title="Itens do grupo"
        description={`Peso compartilhado total: ${formatNumber(totalWeight)}. O inventário do grupo não usa capacidade de carga de um personagem específico.`}
        items={partyInventory}
        emptyMessage="O inventário do grupo está vazio."
        onAddItem={addPartyItem}
        onUpdateItem={updatePartyItem}
        onRemoveItem={removePartyItem}
        onTransferItem={setTransferringItem}
        transferLabel="Enviar a personagem"
      />

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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 break-words text-base font-semibold text-textH">
        {value}
      </div>
    </div>
  )
}

function SupplyChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-medium text-textH">
      {label}: {formatNumber(value)} unidades
    </span>
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
