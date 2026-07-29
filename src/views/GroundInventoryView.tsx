import { useState } from "react"
import { PackageOpen } from "lucide-react"

import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"
import type { Itemmable } from "../models/items/item"

export function GroundInventoryView() {
  const { userRole } = useSyncContext()
  const {
    groundInventory,
    transferCharacters,
    canViewCharacterDetails,
    addGroundItem,
    updateGroundItem,
    removeGroundItem,
    transferItem,
  } = useCharacterContext()
  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)
  const canManage = userRole === "master"

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden">
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">Inventário do chão</span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            Itens largados por personagens ficam disponíveis aqui para todo o
            grupo. Jogadores podem pegar ou transferir itens. O mestre também
            pode criar, editar e remover itens diretamente.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Summary label="Itens diferentes" value={groundInventory.length} />
            <Summary
              label="Quantidade total"
              value={groundInventory.reduce(
                (total, item) => total + Math.max(0, item.quantity ?? 0),
                0,
              )}
            />
          </div>
        </CardContent>
      </Card>

      <InventoryEditor
        title="Itens no chão"
        description="Este inventário não possui limite de peso ou capacidade."
        items={groundInventory}
        emptyMessage="Não há itens largados no chão."
        onAddItem={canManage ? addGroundItem : undefined}
        onUpdateItem={canManage ? updateGroundItem : undefined}
        onRemoveItem={canManage ? removeGroundItem : undefined}
        onTransferItem={setTransferringItem}
        transferLabel="Pegar ou transferir"
      />

      <TransferItemDialog
        open={transferringItem !== null}
        item={transferringItem}
        from={{ type: "ground" }}
        characters={transferCharacters}
        canViewCharacterDetails={canViewCharacterDetails}
        onClose={() => setTransferringItem(null)}
        onTransfer={transferItem}
      />
    </div>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{value}</div>
    </div>
  )
}
