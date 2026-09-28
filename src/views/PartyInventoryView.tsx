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
import { Select } from "../components/ui/Select"
import { useCharacterContext } from "../contexts/characterContext"
import { usePartyInventorySettings } from "../contexts/partyInventorySettingsContext"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { formatRaceName } from "../lib/raceNames"
import type { Itemmable } from "../models/items/item"
import { consumeItemQuantity } from "../models/items/itemConsumption"
import { getItemStackWeightKg } from "../models/items/itemWeight"
import {
  calculatePartySupplies,
  getEffectiveRaceSupplyConsumption,
  getLongRestSupplyRequirements,
} from "../models/supplies/partySupply"
import {
  formatSupplyPhysicalAmount,
  normalizeLongRestSupplySettings,
} from "../shared/rest/longRestSupplySettings"

export function PartyInventoryView() {
  const runtime = useOptionalSessionRuntime()
  const {
    partyInventory: localPartyInventory,
    transferCharacters,
    canViewCharacterDetails,
    addPartyItem,
    updatePartyItem,
    removePartyItem,
    transferItem,
  } = useCharacterContext()
  const partyInventory = runtime?.inventoryState?.initialized
    ? runtime.inventoryState.partyInventory
    : localPartyInventory
  const {
    carryCapacity: localCarryCapacity,
    canEditCarryCapacity,
    setCarryCapacity: setLocalCarryCapacity,
    additionalSupplyConsumption: localAdditionalSupplyConsumption,
    canEditAdditionalSupplyConsumption,
    setAdditionalSupplyConsumption: setLocalAdditionalSupplyConsumption,
    inventoryAccessible: localInventoryAccessible,
    canEditInventoryAccessible,
    setInventoryAccessible: setLocalInventoryAccessible,
  } = usePartyInventorySettings()
  const carryCapacity =
    runtime?.inventoryState?.carryCapacity ?? localCarryCapacity
  const additionalSupplyConsumption =
    runtime?.inventoryState?.additionalSupplyConsumption
    ?? localAdditionalSupplyConsumption
  const inventoryAccessible =
    runtime?.inventoryState?.partyInventoryAccessible
    ?? localInventoryAccessible
  const isMaster = runtime
    ? runtime.role === "MASTER"
    : canEditInventoryAccessible
  const canUseSharedInventory = isMaster || inventoryAccessible
  const supplyItems = partyInventory.filter((item) => item.kind === "supply")
  const regularPartyItems = partyInventory.filter(
    (item) => item.kind !== "supply",
  )
  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)

  // Inventory composition is shared, but character visibility is not. The
  // server therefore publishes a privacy-safe authoritative consumer list and
  // aggregate consumption for sessions. Local mode still derives the same
  // values from all character sheets available to the workspace.
  const supplySettings = normalizeLongRestSupplySettings(
    runtime?.runtimeConfigSnapshot?.config.longRestSupplies,
  )
  const supplyCalculation = useMemo(
    () => calculatePartySupplies(partyInventory, []),
    [partyInventory],
  )
  const visibleSupplyConsumerDetails = useMemo(
    () => new Map(
      transferCharacters.map((character) => {
        const race = character.get("sheet").race
        const requirements = getLongRestSupplyRequirements(
          race,
          supplySettings,
        )
        return [
          character.get("id"),
          {
            race: race.race,
            requirements,
          },
        ] as const
      }),
    ),
    [supplySettings, transferCharacters],
  )
  const localSupplyConsumers = useMemo(
    () => transferCharacters.map((character) => ({
      characterId: character.get("id"),
      name: character.get("name"),
    })),
    [transferCharacters],
  )
  const localRawConsumption = useMemo(
    () => transferCharacters.reduce(
      (total, character) => {
        const consumption = getEffectiveRaceSupplyConsumption(
          character.get("sheet").race,
        )
        return {
          food: total.food + consumption.food,
          drink: total.drink + consumption.drink,
        }
      },
      { food: 0, drink: 0 },
    ),
    [transferCharacters],
  )
  const supplyConsumers =
    runtime?.inventoryState?.supplyConsumers ?? localSupplyConsumers
  const rawFoodPerLongRest =
    runtime?.inventoryState?.foodPerLongRest
    ?? runtime?.inventoryState?.supplyPerLongRest
    ?? localRawConsumption.food
  const rawDrinkPerLongRest =
    runtime?.inventoryState?.drinkPerLongRest
    ?? localRawConsumption.drink
  const supplyItemCount = partyInventory.filter(
    (item) => item.kind === "supply",
  ).length
  const standardConsumerCount = additionalSupplyConsumption
  const foodPerLongRest =
    supplySettings.enabled && supplySettings.food.enabled
      ? (
          rawFoodPerLongRest
          + standardConsumerCount
        ) * supplySettings.food.portionsPerStandardRest
      : 0
  const drinkPerLongRest =
    supplySettings.enabled && supplySettings.drink.enabled
      ? (
          rawDrinkPerLongRest
          + standardConsumerCount
        ) * supplySettings.drink.portionsPerStandardRest
      : 0
  const foodLongRests =
    foodPerLongRest > 0
      ? supplyCalculation.foodPortions / foodPerLongRest
      : Number.POSITIVE_INFINITY
  const drinkLongRests =
    drinkPerLongRest > 0
      ? supplyCalculation.drinkPortions / drinkPerLongRest
      : Number.POSITIVE_INFINITY
  const effectiveSupplyLongRests = !supplySettings.enabled
    ? Number.POSITIVE_INFINITY
    : Math.min(foodLongRests, drinkLongRests)
  const effectiveSupportedLongRests = Number.isFinite(
    effectiveSupplyLongRests,
  )
    ? Math.max(0, Math.floor(effectiveSupplyLongRests))
    : Number.POSITIVE_INFINITY
  const hasSupplyConsumers =
    supplyConsumers.length > 0 || additionalSupplyConsumption > 0

  const totalWeight = partyInventory.reduce((total, item) => total + getItemStackWeightKg(item), 0)
  const hasCapacity = carryCapacity > 0
  const remainingCapacity = carryCapacity - totalWeight
  const overloaded = hasCapacity && remainingCapacity < 0
  const loadPercentage = hasCapacity
    ? Math.min(100, Math.max(0, (totalWeight / carryCapacity) * 100))
    : 0

  function setAuthoritativeCarryCapacity(value: number) {
    const next = Number.isFinite(value) ? Math.max(0, value) : 0
    if (runtime) {
      if (runtime.status !== "connected") {
        console.warn("[session-runtime] Carry-capacity change ignored while the authoritative session server is disconnected.")
        return
      }
      runtime.dispatchInventoryOperation({
        type: "party.settings.carryCapacity.set",
        characterId: "session",
        value: next,
      })
      return
    }
    setLocalCarryCapacity(next)
  }

  function setAuthoritativeAdditionalSupplyConsumption(value: number) {
    const next = Number.isFinite(value) ? Math.max(0, value) : 0
    if (runtime) {
      if (runtime.status !== "connected") {
        console.warn("[session-runtime] Additional supply-consumption change ignored while the authoritative session server is disconnected.")
        return
      }
      runtime.dispatchInventoryOperation({
        type: "party.settings.additionalSupplyConsumption.set",
        characterId: "session",
        value: next,
      })
      return
    }
    setLocalAdditionalSupplyConsumption(next)
  }

  function setAuthoritativeInventoryAccessible(value: boolean) {
    if (runtime) {
      if (runtime.status !== "connected" || runtime.role !== "MASTER") {
        console.warn(
          "[session-runtime] Shared-inventory access change ignored without a connected MASTER.",
        )
        return
      }
      runtime.dispatchInventoryOperation({
        type: "party.settings.accessible.set",
        characterId: "session",
        value,
      })
      return
    }
    setLocalInventoryAccessible(value)
  }

  function addItem(item: Itemmable) {
    if (runtime) {
      runtime.dispatchInventoryOperation({ type: "party.item.add", characterId: "session", item })
      return
    }
    addPartyItem(item)
  }

  function updateItem(itemId: string, updater: (item: Itemmable) => Itemmable) {
    const item = partyInventory.find((entry) => entry.id === itemId)
    if (!item) return
    const next = updater(item)
    if (runtime) {
      runtime.dispatchInventoryOperation({ type: "party.item.update", characterId: "session", itemId, item: next })
      return
    }
    updatePartyItem(itemId, updater)
  }

  function removeItem(itemId: string) {
    if (runtime) {
      runtime.dispatchInventoryOperation({ type: "party.item.remove", characterId: "session", itemId })
      return
    }
    removePartyItem(itemId)
  }

  function consumePartyItem(itemId: string) {
    const item = partyInventory.find((entry) => entry.id === itemId)
    if (!item) return
    const nextItem = consumeItemQuantity(item)
    if (!nextItem) {
      removeItem(itemId)
      return
    }
    updateItem(itemId, () => nextItem)
  }

  function transfer(request: Parameters<NonNullable<typeof transferItem>>[0]) {
    if (runtime) {
      const characterId = request.to.type === "character" ? request.to.characterId : "session"
      runtime.dispatchInventoryOperation({ type: "inventory.item.transfer", characterId, request })
      return
    }
    transferItem?.(request)
  }

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

        <CardContent className="grid gap-4">
          {canEditInventoryAccessible ? (
            <label className="grid gap-1.5 rounded-xl border border-border bg-bg-subtle p-3">
              <span className="text-xs font-semibold text-textH">
                Acesso dos jogadores
              </span>
              <Select
                value={inventoryAccessible ? "accessible" : "inaccessible"}
                onChange={(event) =>
                  setAuthoritativeInventoryAccessible(
                    event.target.value === "accessible",
                  )
                }
              >
                <option value="accessible">
                  Acessível — jogadores podem usar o inventário do grupo
                </option>
                <option value="inaccessible">
                  Inacessível — jogadores usam apenas o que carregam
                </option>
              </Select>
              <span className="text-[11px] leading-4 text-textMuted">
                Quando inacessível, jogadores não podem retirar, guardar ou
                consumir itens e suprimentos daqui. Descansos usam apenas o
                inventário pessoal do personagem.
              </span>
            </label>
          ) : null}

          {canUseSharedInventory ? (
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
                value={hasCapacity ? formatNumber(carryCapacity) : "Não definida"}
              />
              <SummaryCard
                label="Descansos completos"
                value={
                  supplySettings.enabled
                    ? formatSupportedLongRests(
                        effectiveSupportedLongRests,
                        hasSupplyConsumers,
                      )
                    : "Não exigidos"
                }
                danger={
                  supplySettings.enabled
                  && hasSupplyConsumers
                  && effectiveSupportedLongRests < 1
                }
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-bg-subtle p-4">
              <div className="text-sm font-semibold text-textH">
                Inventário do grupo inacessível
              </div>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                O mestre bloqueou o acesso ao estoque compartilhado. Você pode
                usar, consumir e levar para descansos apenas os itens presentes
                no inventário do seu próprio personagem.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {canUseSharedInventory ? (
        <>
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
              <span className="text-xs font-medium text-textH">Capacidade máxima do transporte</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={carryCapacity}
                onChange={(event) => setAuthoritativeCarryCapacity(Number(event.target.value) || 0)}
              />
              <span className="text-[11px] leading-4 text-textMuted">Use 0 enquanto a capacidade ainda não estiver definida.</span>
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
                  <span className="break-words">{formatNumber(totalWeight)} de {formatNumber(carryCapacity)}</span>
                </span>
                <span className={overloaded ? "font-semibold text-danger" : "font-semibold text-textH"}>
                  {overloaded
                    ? `${formatNumber(Math.abs(remainingCapacity))} acima do limite`
                    : `${formatNumber(remainingCapacity)} livres`}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
                <div className={overloaded ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"} style={{ width: `${loadPercentage}%` }} />
              </div>

              {overloaded ? (
                <p className="text-xs leading-5 text-danger">
                  O transporte está sobrecarregado. O sistema apenas sinaliza a situação; ele não impede transferências automaticamente.
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
            {supplySettings.enabled
              ? "Comida e bebida são verificadas separadamente conforme as regras de descanso longo definidas pelo mestre."
              : "Esta campanha não exige suprimentos para concluir descansos longos."}
          </p>
        </CardHeader>

        <CardContent className="grid gap-4">
          {canEditAdditionalSupplyConsumption && supplySettings.enabled ? (
            <div className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-textH">
                    Consumidores adicionais
                  </div>
                  <p className="mt-1 max-w-2xl text-[11px] leading-4 text-textMuted">
                    Cada unidade equivale a um humanoide padrão adicional e
                    recebe os mesmos requisitos de comida e bebida configurados
                    para a campanha.
                  </p>
                </div>
                <label className="grid min-w-40 gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                    Consumidores padrão
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={additionalSupplyConsumption}
                    onChange={(event) =>
                      setAuthoritativeAdditionalSupplyConsumption(
                        Number(event.target.value) || 0,
                      )
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}

          {supplySettings.enabled ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {supplySettings.food.enabled ? (
                  <SupplyMetric
                    label={`${supplySettings.food.label} disponível`}
                    value={formatSupplyPhysicalAmount(
                      supplyCalculation.foodPortions,
                      supplySettings.food,
                    )}
                    detail={`${formatNumber(supplyCalculation.foodPortions)} porções no estoque`}
                  />
                ) : null}
                {supplySettings.drink.enabled ? (
                  <SupplyMetric
                    label={`${supplySettings.drink.label} disponível`}
                    value={formatSupplyPhysicalAmount(
                      supplyCalculation.drinkPortions,
                      supplySettings.drink,
                    )}
                    detail={`${formatNumber(supplyCalculation.drinkPortions)} porções no estoque`}
                  />
                ) : null}
                {supplySettings.food.enabled ? (
                  <SupplyMetric
                    label={`${supplySettings.food.label} por rodada de descanso`}
                    value={formatSupplyPhysicalAmount(
                      foodPerLongRest,
                      supplySettings.food,
                    )}
                    detail={`${formatNumber(foodPerLongRest)} porções necessárias`}
                  />
                ) : null}
                {supplySettings.drink.enabled ? (
                  <SupplyMetric
                    label={`${supplySettings.drink.label} por rodada de descanso`}
                    value={formatSupplyPhysicalAmount(
                      drinkPerLongRest,
                      supplySettings.drink,
                    )}
                    detail={`${formatNumber(drinkPerLongRest)} porções necessárias`}
                  />
                ) : null}
              </div>

              <div className="rounded-xl border border-accentBorder bg-accentBg p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                  Descansos longos completos sustentados pelo estoque
                </div>
                <div className="mt-1 text-2xl font-bold text-textH">
                  {formatSupportedLongRests(
                    effectiveSupportedLongRests,
                    hasSupplyConsumers,
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  O estoque precisa cobrir todos os recursos habilitados.{" "}
                  {supplySettings.shortageMode === "partial"
                    ? "Se faltar comida ou bebida, o descanso ainda pode ser concluído parcialmente."
                    : "Se faltar comida ou bebida, o descanso longo é bloqueado."}
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm text-textH">
              Descansos longos não consomem suprimentos nesta campanha.
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-textH">
              <UserRound className="h-4 w-4 shrink-0 text-accent" />
              Consumidores considerados ({supplyConsumers.length}
              {additionalSupplyConsumption > 0 ? " + adicionais" : ""})
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {supplyConsumers.map((consumer) => {
                const details = visibleSupplyConsumerDetails.get(
                  consumer.characterId,
                )
                const canViewDetails =
                  canViewCharacterDetails(consumer.characterId)
                  && Boolean(details)
                return (
                  <div
                    key={consumer.characterId}
                    className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
                  >
                    <div className="truncate text-sm font-semibold text-textH">
                      {consumer.name}
                    </div>
                    {canViewDetails && details ? (
                      <>
                        <div className="mt-1 text-[11px] text-textMuted">
                          {formatRaceName(details.race)}
                        </div>
                        {supplySettings.enabled ? (
                          <div className="mt-2 grid gap-1 text-xs text-text">
                            {supplySettings.food.enabled ? (
                              <span>
                                {supplySettings.food.label}:{" "}
                                {formatSupplyPhysicalAmount(
                                  details.requirements.foodPortions,
                                  supplySettings.food,
                                )}
                              </span>
                            ) : null}
                            {supplySettings.drink.enabled ? (
                              <span>
                                {supplySettings.drink.label}:{" "}
                                {formatSupplyPhysicalAmount(
                                  details.requirements.drinkPortions,
                                  supplySettings.drink,
                                )}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="mt-1 text-[11px] font-medium text-textMuted">
                          Personagem privado
                        </div>
                        <div className="mt-2 text-xs text-textMuted">
                          Raça, ficha e consumo individual ocultos.
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {!hasSupplyConsumers ? (
              <p className="text-xs leading-5 text-textMuted">
                Nenhum personagem da sessão ou consumidor adicional está
                disponível para o cálculo.
              </p>
            ) : null}
          </div>

          <p className="text-[11px] leading-4 text-textMuted">
            {supplyItemCount} tipos de suprimento registrados. Itens marcados
            como “Comida e bebida” contribuem para os dois requisitos ao mesmo
            tempo.
          </p>
        </CardContent>
      </Card>

      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <InventoryEditor
          title="Suprimentos do grupo"
          description="Comida, água e outros recursos consumidos pela viagem e pelos descansos ficam separados dos demais itens."
          items={supplyItems}
          emptyMessage="O grupo não possui suprimentos armazenados."
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onConsumeItem={consumePartyItem}
          onTransferItem={setTransferringItem}
          transferLabel="Enviar a personagem"
        />
      </div>

      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <InventoryEditor
          title="Itens do grupo"
          description={hasCapacity
            ? `Peso compartilhado: ${formatNumber(totalWeight)} de ${formatNumber(carryCapacity)}.`
            : `Peso compartilhado: ${formatNumber(totalWeight)}. A capacidade ainda não foi definida pelo mestre.`}
          items={regularPartyItems}
          emptyMessage="O inventário do grupo não possui outros itens."
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onConsumeItem={consumePartyItem}
          onTransferItem={setTransferringItem}
          transferLabel="Enviar a personagem"
        />
      </div>


        </>
      ) : null}

      <TransferItemDialog
        open={canUseSharedInventory && transferringItem !== null}
        item={transferringItem}
        from={{ type: "party" }}
        characters={transferCharacters}
        canViewCharacterDetails={canViewCharacterDetails}
        onClose={() => setTransferringItem(null)}
        onTransfer={transfer}
      />
    </div>
  )
}

function SummaryCard({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={danger ? "min-w-0 rounded-xl border border-danger bg-dangerBg p-3" : "min-w-0 rounded-xl border border-border bg-bg-subtle p-3"}>
      <div className="break-words text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</div>
      <div className={danger ? "mt-1 break-words text-base font-semibold text-danger" : "mt-1 break-words text-base font-semibold text-textH"}>{value}</div>
    </div>
  )
}

function SupplyMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="break-words text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-1 break-words text-lg font-bold text-textH">{value}</div>
      <div className="mt-1 break-words text-[11px] leading-4 text-textMuted">{detail}</div>
    </div>
  )
}

function formatSupportedLongRests(value: number, hasConsumers: boolean): string {
  if (!hasConsumers) return "Sem membros"
  if (!Number.isFinite(value)) return "Ilimitados"
  return String(Math.max(0, Math.floor(value)))
}

function formatLongRestEstimate(value: number, hasConsumers: boolean): string {
  if (!hasConsumers) return "Sem membros"
  if (!Number.isFinite(value)) return "Não é consumido"
  return formatNumber(Math.max(0, value))
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}
