import { useMemo, useState } from "react"
import {
  PackageOpen,
  Scale,
  Truck,
  UserRound,
  Utensils,
} from "lucide-react"

import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { useCharacterContext } from "../contexts/characterContext"
import { usePartyInventorySettings } from "../contexts/partyInventorySettingsContext"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"
import { formatRaceName } from "../lib/raceNames"
import type { Itemmable } from "../models/items/item"
import {
  calculatePartySupplies,
  STANDARD_PORTIONS_PER_BARREL,
  STANDARD_PORTIONS_PER_RATION,
} from "../models/supplies/partySupply"

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

  const supplyCalculation = useMemo(
    () => calculatePartySupplies(partyInventory, transferCharacters),
    [partyInventory, transferCharacters],
  )
  const supplyItemCount = partyInventory.filter(
    (item) => item.kind === "supply",
  ).length

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
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">Inventário compartilhado</span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            Itens deste espaço pertencem ao grupo. A capacidade representa o
            transporte disponível, como carroça, animais de tração e outros
            veículos definidos pelo mestre.
          </p>
        </CardHeader>

        <CardContent>
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
              label="Descansos completos"
              value={formatSupportedLongRests(
                supplyCalculation.supportedLongRests,
                supplyCalculation.consumers.length,
              )}
              danger={
                supplyCalculation.consumers.length > 0 &&
                supplyCalculation.supportedLongRests < 1
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <Truck className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">Capacidade de transporte</span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            Este valor é definido pelo mestre conforme a carroça, embarcação,
            montarias e animais que puxam a carga.
          </p>
        </CardHeader>

        <CardContent className="grid gap-4">
          {canEditCarryCapacity ? (
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-textH">
                Capacidade máxima do transporte
              </span>
              <Input
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
                ? `O mestre definiu a capacidade como ${formatNumber(carryCapacity)}.`
                : "O mestre ainda não definiu a capacidade do transporte."}
            </div>
          )}

          {hasCapacity ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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

              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
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
                <p className="text-xs leading-5 text-danger">
                  O transporte está sobrecarregado. O sistema apenas sinaliza a
                  situação; ele não impede transferências automaticamente.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <Utensils className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">Autonomia de suprimentos</span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            Comida e bebida contam igualmente como suprimento. Uma ração vale {" "}
            {STANDARD_PORTIONS_PER_RATION} porção e um barril vale {" "}
            {STANDARD_PORTIONS_PER_BARREL}. Cada item é contado apenas uma vez,
            mesmo quando sua categoria é mista.
          </p>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SupplyMetric
              label="Suprimento total"
              value={formatNumber(supplyCalculation.supplyPortions)}
              detail={`${supplyItemCount} tipos registrados`}
            />
            <SupplyMetric
              label="Consumo do grupo"
              value={formatNumber(supplyCalculation.supplyPerLongRest)}
              detail="porções por rodada de descansos"
            />
            <SupplyMetric
              label="Descansos equivalentes"
              value={formatLongRestEstimate(
                supplyCalculation.supplyLongRests,
                supplyCalculation.consumers.length,
              )}
              detail="antes do arredondamento"
            />
            <SupplyMetric
              label="Comida / bebida"
              value={`${formatNumber(supplyCalculation.foodPortions)} / ${formatNumber(supplyCalculation.drinkPortions)}`}
              detail="apenas composição informativa"
            />
          </div>

          <div className="rounded-xl border border-accentBorder bg-accentBg p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Descansos longos completos sustentados pelo estoque
            </div>
            <div className="mt-1 text-2xl font-bold text-textH">
              {formatSupportedLongRests(
                supplyCalculation.supportedLongRests,
                supplyCalculation.consumers.length,
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Cada personagem precisa apenas atingir seu requisito total de
              suprimento. A escolha pode misturar comida e bebida livremente.
              Descansos abaixo do requisito continuam possíveis, mas recuperam
              apenas metade dos recursos e aumentam a exaustão.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-textH">
              <UserRound className="h-4 w-4 shrink-0 text-accent" />
              Consumidores considerados ({supplyCalculation.consumers.length})
            </div>

            {supplyCalculation.consumers.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {supplyCalculation.consumers.map((consumer) => (
                  <div
                    key={consumer.characterId}
                    className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
                  >
                    <div className="truncate text-sm font-semibold text-textH">
                      {consumer.name}
                    </div>
                    <div className="mt-1 text-[11px] text-textMuted">
                      {formatRaceName(consumer.race)}
                    </div>
                    <div className="mt-2 text-xs text-text">
                      Suprimento por descanso: {formatNumber(consumer.supplyPerLongRest)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-textMuted">
                Nenhum personagem jogador ou humanoide do grupo está disponível
                para o cálculo.
              </p>
            )}
          </div>

          <p className="text-[11px] leading-4 text-textMuted">
            Golias e meio-gigantes precisam de 2 porções por descanso; halflings
            e gnomos precisam de 0,5; as demais raças usam 1 porção por padrão.
          </p>
        </CardContent>
      </Card>

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
          ? "min-w-0 rounded-xl border border-danger bg-dangerBg p-3"
          : "min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
      }
    >
      <div className="break-words text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div
        className={
          danger
            ? "mt-1 break-words text-base font-semibold text-danger"
            : "mt-1 break-words text-base font-semibold text-textH"
        }
      >
        {value}
      </div>
    </div>
  )
}

function SupplyMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="break-words text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 break-words text-lg font-bold text-textH">
        {value}
      </div>
      <div className="mt-1 break-words text-[11px] leading-4 text-textMuted">
        {detail}
      </div>
    </div>
  )
}

function formatSupportedLongRests(
  value: number,
  consumerCount: number,
): string {
  if (consumerCount === 0) return "Sem membros"
  if (!Number.isFinite(value)) return "Ilimitados"
  return String(Math.max(0, Math.floor(value)))
}

function formatLongRestEstimate(
  value: number,
  consumerCount: number,
): string {
  if (consumerCount === 0) return "Sem membros"
  if (!Number.isFinite(value)) return "Não é consumido"
  return formatNumber(Math.max(0, value))
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}
