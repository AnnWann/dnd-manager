import { useState, type ComponentProps } from "react"
import { useParams } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { CompendiumItemPickerDialog } from "../../items/CompendiumItemPickerDialog"
import {
  CURRENCY_DEFINITIONS,
  CURRENCY_TYPES,
  areAllCurrenciesInBagOfHolding,
  createCurrencyItem,
  type CurrencyType,
} from "../../../models/items/Currency"
import type { Itemmable } from "../../../models/items/item"
import { InventoryEditor as InventoryEditorV2 } from "./inventoryEditorV2"

type Props = ComponentProps<typeof InventoryEditorV2> & {
  onAddCompendiumItem?: (item: Itemmable) => void
}

export function InventoryEditor(props: Props) {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const { onAddCompendiumItem, ...editorProps } = props
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false)
  const [currencyType, setCurrencyType] = useState<CurrencyType>("gold")
  const [currencyQuantity, setCurrencyQuantity] = useState("1")
  const [insideBagOfHolding, setInsideBagOfHolding] = useState(false)
  const [compendiumOpen, setCompendiumOpen] = useState(false)

  const canUseBagOfHolding = editorProps.onToggleBagOfHolding !== undefined
  const compendiumTarget = onAddCompendiumItem ?? editorProps.onAddItem

  function requestAddItem(item: Itemmable) {
    if (item.kind !== "currency") {
      editorProps.onAddItem?.(item)
      return
    }

    setCurrencyType("gold")
    setCurrencyQuantity(
      String(Math.max(1, Math.trunc(Number(item.quantity) || 1))),
    )
    setInsideBagOfHolding(
      canUseBagOfHolding && areAllCurrenciesInBagOfHolding(editorProps.items),
    )
    setCurrencyDialogOpen(true)
  }

  function closeCurrencyDialog() {
    setCurrencyDialogOpen(false)
    setInsideBagOfHolding(false)
  }

  function addCurrency() {
    const quantity = Math.max(
      1,
      Math.trunc(Number(currencyQuantity) || 1),
    )

    editorProps.onAddItem?.(
      createCurrencyItem(
        currencyType,
        quantity,
        crypto.randomUUID(),
        canUseBagOfHolding && insideBagOfHolding,
      ),
    )
    closeCurrencyDialog()
  }

  return (
    <>
      {campaignId && compendiumTarget ? (
        <div className="mb-2 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCompendiumOpen(true)}
          >
            Adicionar do compêndio
          </Button>
        </div>
      ) : null}

      <InventoryEditorV2
        {...editorProps}
        onAddItem={editorProps.onAddItem ? requestAddItem : undefined}
      />

      <CurrencyAddDialog
        open={currencyDialogOpen}
        currencyType={currencyType}
        quantity={currencyQuantity}
        canUseBagOfHolding={canUseBagOfHolding}
        insideBagOfHolding={insideBagOfHolding}
        onCurrencyTypeChange={setCurrencyType}
        onQuantityChange={setCurrencyQuantity}
        onInsideBagOfHoldingChange={setInsideBagOfHolding}
        onCancel={closeCurrencyDialog}
        onConfirm={addCurrency}
      />

      {campaignId && compendiumTarget ? (
        <CompendiumItemPickerDialog
          open={compendiumOpen}
          campaignId={campaignId}
          onClose={() => setCompendiumOpen(false)}
          onSelect={compendiumTarget}
        />
      ) : null}
    </>
  )
}

function CurrencyAddDialog({
  open,
  currencyType,
  quantity,
  canUseBagOfHolding,
  insideBagOfHolding,
  onCurrencyTypeChange,
  onQuantityChange,
  onInsideBagOfHoldingChange,
  onCancel,
  onConfirm,
}: {
  open: boolean
  currencyType: CurrencyType
  quantity: string
  canUseBagOfHolding: boolean
  insideBagOfHolding: boolean
  onCurrencyTypeChange: (value: CurrencyType) => void
  onQuantityChange: (value: string) => void
  onInsideBagOfHoldingChange: (value: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="currency-add-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="currency-add-title"
              className="text-sm font-semibold text-textH"
            >
              Adicionar moedas
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Escolha a denominação e a quantidade. Moedas iguais no mesmo
              local serão empilhadas automaticamente.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-textH">
              Tipo da moeda
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {CURRENCY_TYPES.map((type) => {
                const definition = CURRENCY_DEFINITIONS[type]
                const selected = currencyType === type

                return (
                  <button
                    key={type}
                    type="button"
                    className={
                      selected
                        ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left text-xs font-medium text-textH"
                        : "rounded-lg border border-border bg-bg px-3 py-2 text-left text-xs text-text hover:bg-bg-subtle"
                    }
                    onClick={() => onCurrencyTypeChange(type)}
                  >
                    <span className="block">{definition.label}</span>
                    <span className="mt-0.5 block text-[10px] text-textMuted">
                      {definition.shortLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Quantidade</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
            />
          </label>

          {canUseBagOfHolding ? (
            <label className="flex items-start gap-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={insideBagOfHolding}
                onChange={(event) =>
                  onInsideBagOfHoldingChange(event.target.checked)
                }
              />
              <span>
                <span className="font-medium text-textH">
                  Adicionar à Bolsa Mágica
                </span>
                <span className="mt-0.5 block text-textMuted">
                  O valor inicial acompanha o estado atual das demais moedas do
                  personagem. Quando já existem moedas, o controle geral da carteira
                  mantém todas elas no mesmo local.
                </span>
              </span>
            </label>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" variant="primary" onClick={onConfirm}>
            Adicionar moedas
          </Button>
        </div>
      </div>
    </div>
  )
}
