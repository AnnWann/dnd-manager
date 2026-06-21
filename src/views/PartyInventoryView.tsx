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
import type { Itemmable } from "../models/items/item"
import type { Race } from "../models/races/Race"
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
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 break-words">
              Inventário compartilhado
            </span>
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

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <Truck className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 break-words">
              Capacidade de transporte
            </span>
          </div>
          <p className="mt-1 max-w-full break-words text-xs leading-5 text-textMuted">
            Este valor não depende dos atributos dos personagens. Ele é
            definido pelo mestre conforme a carroça, embarcação, montarias e
            animais que puxam a carga.
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
                  O transporte está sobrecarregado. O sistema apenas sinaliza
                  a situação; ele não impede transferências automaticamente.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <Utensils className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 break-words">Autonomia de suprimentos</span>
          </div>
          <p className="mt-1 max-w-full break-words text-xs leading-5 text-textMuted">
            Uma ração individual vale {STANDARD_PORTIONS_PER_RATION} porção
            padrão. Um barril vale {STANDARD_PORTIONS_PER_BARREL} porções, ou
            40 humanoide-descansos para um consumidor padrão. Suprimentos
            mistos contam como uma porção de comida e uma de bebida.
          </p>
        </CardHeader>

        <CardContent className="grid min-w-0 gap-4 overflow-hidden">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SupplyMetric
              label="Porções de comida"
              value={formatNumber(supplyCalculation.foodPortions)}
              detail={`${formatNumber(supplyCalculation.foodPerLongRest)} consumidas por descanso`}
            />
            <SupplyMetric
              label="Comida restante"
              value={formatLongRestEstimate(
                supplyCalculation.foodLongRests,
                supplyCalculation.consumers.length,
              )}
              detail="descansos equivalentes"
            />
            <SupplyMetric
              label="Porções de bebida"
              value={formatNumber(supplyCalculation.drinkPortions)}
              detail={`${formatNumber(supplyCalculation.drinkPerLongRest)} consumidas por descanso`}
            />
            <SupplyMetric
              label="Bebida restante"
              value={formatLongRestEstimate(
                supplyCalculation.drinkLongRests,
                supplyCalculation.consumers.length,
              )}
              detail="descansos equivalentes"
            />
          </div>

          <div className="rounded-xl border border-accentBorder bg-accentBg p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Descansos longos sustentados pelo estoque atual
            </div>
            <div className="mt-1 text-2xl font-bold text-textH">
              {formatSupportedLongRests(
                supplyCalculation.supportedLongRests,
                supplyCalculation.consumers.length,
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              O menor valor entre comida e bebida limita o grupo. O cálculo é
              atualizado automaticamente, mas os suprimentos ainda não são
              consumidos ao apertar o botão de descanso longo.
            </p>
          </div>

          <div className="grid min-w-0 gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-textH">
              <UserRound className="h-4 w-4 shrink-0 text-accent" />
              Consumidores considerados ({supplyCalculation.consumers.length})
            </div>

            {supplyCalculation.consumers.length > 0 ? (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-text">
                      <span>
                        Comida: {formatNumber(consumer.foodPerLongRest)}
                      </span>
                      <span>
                        Bebida: {formatNumber(consumer.drinkPerLongRest)}
                      </span>
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
            Estoque registrado em {supplyItemCount} tipos de suprimento. Golias
            e meio-gigantes consomem 2 porções por descanso; halflings e gnomos
            consomem 0,5; as demais raças usam 1 porção por padrão.
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
  if (!Number.isFinite(value)) return "Não é consumida"
  return formatNumber(Math.max(0, value))
}

function formatRaceName(race: Race): string {
  const labels: Partial<Record<Race, string>> = {
    "deep-gnome": "Gnomo das Profundezas",
    gnome: "Gnomo",
    goliath: "Golias",
    "half-giant": "Meio-gigante",
    halfling: "Halfling",
    human: "Humano",
  }

  return labels[race] ?? race.replace(/-/g, " ")
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}
