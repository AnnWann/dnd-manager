import { useState } from "react"
import { Copy, PackageOpen, Plus } from "lucide-react"

import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Textarea } from "../components/ui/Textarea"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"
import {
  itemJsonTemplate,
  parseItemJson,
} from "../features/items/itemJsonGuide"
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
  const [transferringItem, setTransferringItem] = useState<Itemmable | null>(null)
  const [jsonValue, setJsonValue] = useState("")
  const [jsonMessage, setJsonMessage] = useState("")
  const canManage = userRole === "master"

  async function copyStructure() {
    const template = JSON.stringify(itemJsonTemplate(), null, 2)
    await navigator.clipboard.writeText(template)
    setJsonValue(template)
    setJsonMessage("Guia completo copiado.")
  }

  function addFromJson() {
    try {
      addGroundItem(parseItemJson(jsonValue))
      setJsonValue("")
      setJsonMessage("Item adicionado ao chão.")
    } catch (error) {
      setJsonMessage(error instanceof Error ? error.message : "JSON inválido.")
    }
  }

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden">
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">Chão</span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            Itens largados por personagens ficam disponíveis aqui para todo o grupo.
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

      {canManage ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-textH">Adicionar item via JSON</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Cole somente o objeto do item ou o guia completo para IA. Quando o
              envelope completo for usado, apenas o conteúdo do campo `item` será
              importado.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-72 font-mono text-xs"
              value={jsonValue}
              placeholder="Cole o JSON do item ou o guia preenchido por uma IA"
              onChange={(event) => {
                setJsonValue(event.target.value)
                setJsonMessage("")
              }}
            />
            <p className="mt-2 text-[11px] leading-5 text-textMuted">
              O guia inclui campos válidos, enums e exemplos de armas, armaduras,
              consumíveis, itens arremessáveis, suprimentos, focos com magias e
              moedas.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={!jsonValue.trim()}
                onClick={addFromJson}
              >
                <Plus className="h-4 w-4" />
                Adicionar ao chão
              </Button>
              <Button size="sm" variant="secondary" onClick={copyStructure}>
                <Copy className="h-4 w-4" />
                Copiar guia completo para IA
              </Button>
              {jsonMessage ? (
                <span className="text-xs text-textMuted">{jsonMessage}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
