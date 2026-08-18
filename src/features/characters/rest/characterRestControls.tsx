import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Coffee, Moon, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  takeShortRest,
  type HitDiceConsumption,
} from "../../../models/characters/characterRest"
import type { DieSides } from "../../../models/dice/Die"
import type { Itemmable } from "../../../models/items/item"
import {
  isSupplyItem,
  type SupplyItem,
} from "../../../models/items/SupplyItem"
import {
  createAutomaticLongRestSelection,
  getRequiredSupplyForRace,
  getSupplySelectionTotals,
  getTotalSupplyPortions,
  type LongRestSupplySelection,
} from "../../../models/supplies/partySupply"

const DIE_ORDER: DieSides[] = [
  "d2",
  "d3",
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
]

const QUANTITY_STEP = 1
const PERCENTAGE_STEPS = [0, 25, 50, 75, 100] as const
const PORTION_EPSILON = 0.000001

type BarrelSelection = {
  quantity: number
  percentage: number
}

type Props = {
  character: CharacterTemplate
  partyInventory: Itemmable[]
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  completeLongRest: (
    characterId: string,
    selection: LongRestSupplySelection[],
  ) => void
}

export function CharacterRestControls({
  character,
  partyInventory,
  updateCharacter,
  completeLongRest,
}: Props) {
  const runtime = useOptionalSessionRuntime()
  const [shortRestOpen, setShortRestOpen] = useState(false)
  const [longRestOpen, setLongRestOpen] = useState(false)
  const characterId = character.get("id")

  function completeShortRest(
    healing: number,
    hitDiceConsumption: HitDiceConsumption,
  ) {
    if (runtime) {
      // Until the remaining rest domains become authoritative, their legacy
      // mutation still happens locally. HP is excluded from that mutation and
      // the server receives exactly one short-rest domain event.
      updateCharacter(characterId, (current) =>
        takeShortRest(current, 0, hitDiceConsumption),
      )

      if (runtime.status === "connected") {
        runtime.dispatchHpOperation({
          type: "character.rest.short",
          characterId,
          healing,
        })
      } else {
        console.warn("[session-runtime] Short rest ignored by the authoritative session server while disconnected.")
      }
    } else {
      updateCharacter(characterId, (current) =>
        takeShortRest(current, healing, hitDiceConsumption),
      )
    }

    setShortRestOpen(false)
  }

  function confirmLongRest(selection: LongRestSupplySelection[]) {
    if (runtime) {
      const requiredSupply = getRequiredSupplyForRace(character.get("sheet").race)
      const totals = getSupplySelectionTotals(partyInventory, selection)
      const recovery =
        totals.selectedPortions + PORTION_EPSILON < requiredSupply
          ? "partial" as const
          : "full" as const

      if (runtime.status === "connected") {
        runtime.dispatchHpOperation({
          type: "character.rest.long",
          characterId,
          recovery,
        })
      } else {
        console.warn("[session-runtime] Long rest ignored by the authoritative session server while disconnected.")
      }
    }

    completeLongRest(characterId, selection)
    setLongRestOpen(false)
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-textH">Descanso</h2>
          <p className="mt-0.5 text-[11px] text-textMuted">
            Recupere vida, dados de vida, habilidades e recursos mágicos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShortRestOpen(true)}
          >
            <Coffee className="h-4 w-4" />
            Descanso curto
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setLongRestOpen(true)}
          >
            <Moon className="h-4 w-4" />
            Descanso longo
          </Button>
        </div>
      </section>

      <ShortRestDialog
        open={shortRestOpen}
        character={character}
        onClose={() => setShortRestOpen(false)}
        onConfirm={completeShortRest}
      />

      <LongRestDialog
        open={longRestOpen}
        character={character}
        partyInventory={partyInventory}
        onClose={() => setLongRestOpen(false)}
        onConfirm={confirmLongRest}
      />
    </>
  )
}

function ShortRestDialog({
  open,
  character,
  onClose,
  onConfirm,
}: {
  open: boolean
  character: CharacterTemplate
  onClose: () => void
  onConfirm: (
    healing: number,
    hitDiceConsumption: HitDiceConsumption,
  ) => void
}) {
  const [healing, setHealing] = useState(0)
  const [hitDiceConsumption, setHitDiceConsumption] =
    useState<HitDiceConsumption>({})

  const availableHitDice = useMemo(
    () =>
      DIE_ORDER.map((side) => ({
        side,
        data: character.get("sheet").HP.hitDice[side],
      })).filter(
        (entry) =>
          entry.data !== undefined &&
          entry.data.current.quantity > 0,
      ),
    [character],
  )

  if (!open) return null

  const totalDice = Object.values(hitDiceConsumption).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

  function resetAndClose() {
    setHealing(0)
    setHitDiceConsumption({})
    onClose()
  }

  function confirm() {
    onConfirm(
      Math.max(0, Math.trunc(healing)),
      hitDiceConsumption,
    )
    setHealing(0)
    setHitDiceConsumption({})
  }

  return (
    <ModalShell onClose={resetAndClose} maxWidth="max-w-lg">
      <DialogHeader
        id="short-rest-title"
        title="Descanso curto"
        description="Informe a cura recebida e quantos dados de vida serão consumidos. Recursos de descanso curto e espaços de pacto serão restaurados."
        onClose={resetAndClose}
      />

      <div className="grid gap-4 py-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Pontos de vida recuperados
          </span>
          <Input
            type="number"
            min={0}
            value={healing}
            onChange={(event) =>
              setHealing(
                Math.max(0, Math.trunc(Number(event.target.value) || 0)),
              )
            }
          />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-textH">
              Dados de vida consumidos
            </span>
            <span className="text-[11px] font-semibold text-textMuted">
              Total: {totalDice}
            </span>
          </div>

          {availableHitDice.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableHitDice.map(({ side, data }) => {
                if (!data) return null
                const currentAmount = hitDiceConsumption[side] ?? 0

                return (
                  <label
                    key={side}
                    className="grid grid-cols-[1fr_80px] items-center gap-3 rounded-lg border border-border bg-bg-subtle p-3"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-textH">
                        {side}
                      </span>
                      <span className="block text-[11px] text-textMuted">
                        {data.current.quantity}/{data.max.quantity} disponíveis
                      </span>
                    </span>

                    <Input
                      type="number"
                      min={0}
                      max={data.current.quantity}
                      className="text-center"
                      value={currentAmount}
                      onChange={(event) => {
                        const nextAmount = Math.max(
                          0,
                          Math.min(
                            data.current.quantity,
                            Math.trunc(Number(event.target.value) || 0),
                          ),
                        )

                        setHitDiceConsumption((current) => ({
                          ...current,
                          [side]: nextAmount,
                        }))
                      }}
                    />
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-4 text-center text-xs text-textMuted">
              Nenhum dado de vida disponível. O descanso ainda pode restaurar habilidades e espaços de pacto.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button size="sm" variant="secondary" onClick={resetAndClose}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" onClick={confirm}>
          Concluir descanso
        </Button>
      </div>
    </ModalShell>
  )
}

function LongRestDialog({
  open,
  character,
  partyInventory,
  onClose,
  onConfirm,
}: {
  open: boolean
  character: CharacterTemplate
  partyInventory: Itemmable[]
  onClose: () => void
  onConfirm: (selection: LongRestSupplySelection[]) => void
}) {
  const requiredSupply = getRequiredSupplyForRace(
    character.get("sheet").race,
  )
  const supplies = useMemo(
    () =>
      partyInventory.filter(
        (item): item is SupplyItem =>
          isSupplyItem(item) &&
          item.supplyCategory !== "other" &&
          getTotalSupplyPortions(item) > 0,
      ),
    [partyInventory],
  )
  const [portionsByItem, setPortionsByItem] = useState<
    Record<string, number>
  >({})
  const [barrelSelectionByItem, setBarrelSelectionByItem] = useState<
    Record<string, BarrelSelection>
  >({})

  useEffect(() => {
    if (!open) return

    const automaticSelection = createAutomaticLongRestSelection(
      partyInventory,
      requiredSupply,
    )

    setPortionsByItem(selectionToPortions(automaticSelection))
    setBarrelSelectionByItem(
      selectionToBarrelSelections(automaticSelection, supplies),
    )
  }, [open, partyInventory, requiredSupply, supplies])

  const selection = useMemo<LongRestSupplySelection[]>(
    () =>
      supplies
        .map((item) => {
          const available = getTotalSupplyPortions(item)

          if (isBarrelSupply(item)) {
            const barrelSelection = barrelSelectionByItem[item.id] ?? {
              quantity: 0,
              percentage: 100,
            }

            return {
              itemId: item.id,
              portions: Math.min(
                available,
                Math.max(
                  0,
                  barrelSelection.quantity *
                    (barrelSelection.percentage / 100),
                ),
              ),
            }
          }

          return {
            itemId: item.id,
            portions: Math.min(
              available,
              Math.max(0, portionsByItem[item.id] ?? 0),
            ),
          }
        })
        .filter((entry) => entry.portions > 0),
    [barrelSelectionByItem, portionsByItem, supplies],
  )

  const totals = useMemo(
    () => getSupplySelectionTotals(partyInventory, selection),
    [partyInventory, selection],
  )

  if (!open) return null

  const selectedSupply = totals.selectedPortions
  const difference = selectedSupply - requiredSupply
  const isPartial = difference < -PORTION_EPSILON

  function setDirectQuantity(item: SupplyItem, value: number) {
    const quantity = clampWholeQuantity(
      value,
      getTotalSupplyPortions(item),
    )

    setPortionsByItem((current) => ({
      ...current,
      [item.id]: quantity,
    }))
  }

  function setBarrelQuantity(item: SupplyItem, value: number) {
    const quantity = clampWholeQuantity(
      value,
      getTotalSupplyPortions(item),
    )

    setBarrelSelectionByItem((current) => ({
      ...current,
      [item.id]: {
        quantity,
        percentage: current[item.id]?.percentage ?? 100,
      },
    }))
  }

  function setBarrelPercentage(item: SupplyItem, value: number) {
    const percentage = Math.max(
      0,
      Math.min(100, Math.round(value / 25) * 25),
    )

    setBarrelSelectionByItem((current) => ({
      ...current,
      [item.id]: {
        quantity: current[item.id]?.quantity ?? 0,
        percentage,
      },
    }))
  }

  function autoSelect() {
    const automaticSelection = createAutomaticLongRestSelection(
      partyInventory,
      requiredSupply,
    )

    setPortionsByItem(selectionToPortions(automaticSelection))
    setBarrelSelectionByItem(
      selectionToBarrelSelections(automaticSelection, supplies),
    )
  }

  function clearSelection() {
    setPortionsByItem({})
    setBarrelSelectionByItem({})
  }

  function resetAndClose() {
    clearSelection()
    onClose()
  }

  function confirm() {
    onConfirm(selection)
    clearSelection()
  }

  return (
    <ModalShell onClose={resetAndClose} maxWidth="max-w-2xl">
      <DialogHeader
        id="long-rest-title"
        title="Preparar descanso longo"
        description="Digite ou ajuste na barra quantas rações serão selecionadas. Nos barris, a porcentagem é aplicada apenas sobre essa quantidade."
        onClose={resetAndClose}
      />

      <div className="grid min-h-0 gap-4 overflow-y-auto py-4 pr-1">
        <SupplyBalanceBar
          required={requiredSupply}
          selected={selectedSupply}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="secondary"
            onClick={clearSelection}
          >
            Limpar seleção
          </Button>
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="secondary"
            onClick={autoSelect}
          >
            Seleção automática
          </Button>
        </div>

        {supplies.length > 0 ? (
          <div className="grid gap-2">
            {supplies.map((item) => {
              const available = getTotalSupplyPortions(item)
              const isBarrel = isBarrelSupply(item)
              const directQuantity = Math.min(
                available,
                Math.max(0, portionsByItem[item.id] ?? 0),
              )
              const barrelSelection = barrelSelectionByItem[item.id] ?? {
                quantity: 0,
                percentage: 100,
              }
              const selectedRations = Math.min(
                available,
                Math.max(0, barrelSelection.quantity),
              )
              const percentage = barrelSelection.percentage
              const consumedPortions = isBarrel
                ? selectedRations * (percentage / 100)
                : directQuantity

              return (
                <div
                  key={item.id}
                  className="grid min-w-0 gap-4 rounded-xl border border-border bg-bg-subtle p-3"
                >
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-textH">
                      {item.name || "Suprimento sem nome"}
                    </div>
                    <div className="mt-1 break-words text-[11px] leading-4 text-textMuted">
                      {supplyCategoryLabel(item)} • {formatPortions(available)} disponíveis
                    </div>
                  </div>

                  {isBarrel ? (
                    <>
                      <WholeQuantityControl
                        label="Rações selecionadas"
                        value={selectedRations}
                        maximum={available}
                        onChange={(value) =>
                          setBarrelQuantity(item, value)
                        }
                      />

                      <label className="grid min-w-0 gap-2 border-t border-border pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-textH">
                            Percentual das rações selecionadas
                          </span>
                          <span className="rounded-md border border-border bg-bg px-2 py-1 font-semibold text-textH">
                            {formatPercentage(percentage)}
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={25}
                          value={percentage}
                          onChange={(event) =>
                            setBarrelPercentage(
                              item,
                              Number(event.target.value),
                            )
                          }
                          className="w-full cursor-pointer"
                        />

                        <div className="flex justify-between text-[10px] text-textMuted">
                          {PERCENTAGE_STEPS.map((step) => (
                            <span key={step}>{step}%</span>
                          ))}
                        </div>
                      </label>

                      <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-textH">
                        Consumo resultante: {formatPortions(consumedPortions)}
                        <span className="ml-1 text-textMuted">
                          ({formatCompactNumber(selectedRations)} × {formatPercentage(percentage)})
                        </span>
                      </div>
                    </>
                  ) : (
                    <WholeQuantityControl
                      label="Rações a consumir"
                      value={directQuantity}
                      maximum={available}
                      onChange={(value) =>
                        setDirectQuantity(item, value)
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-3 py-6 text-center text-xs leading-5 text-textMuted">
            O inventário do grupo não possui suprimentos disponíveis. Ainda é possível fazer um descanso parcial sem consumir nada.
          </div>
        )}

        {isPartial ? (
          <div className="rounded-xl border border-danger bg-dangerBg p-3 text-xs leading-5 text-danger">
            O suprimento selecionado está abaixo do necessário. O personagem recuperará metade dos recursos e ganhará 1 nível de exaustão.
          </div>
        ) : difference > PORTION_EPSILON ? (
          <div className="rounded-xl border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-textH">
            Há suprimento acima do necessário. Tudo que foi selecionado será consumido, sem benefício adicional por enquanto.
          </div>
        ) : (
          <div className="rounded-xl border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-textH">
            A seleção cobre exatamente o necessário para um descanso completo.
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          size="sm"
          variant="secondary"
          onClick={resetAndClose}
        >
          Cancelar
        </Button>
        <Button
          className="w-full sm:w-auto"
          size="sm"
          variant="primary"
          onClick={confirm}
        >
          {isPartial
            ? "Consumir e descansar parcialmente"
            : "Consumir e descansar"}
        </Button>
      </div>
    </ModalShell>
  )
}

function WholeQuantityControl({
  label,
  value,
  maximum,
  onChange,
}: {
  label: string
  value: number
  maximum: number
  onChange: (value: number) => void
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-end">
        <div className="min-w-0">
          <div className="text-xs font-medium text-textH">{label}</div>
          <div className="mt-1 text-[11px] text-textMuted">
            Máximo disponível: {formatCompactNumber(maximum)}
          </div>
        </div>

        <Input
          type="number"
          min={0}
          max={maximum}
          step={QUANTITY_STEP}
          value={value}
          className="text-center"
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </div>

      <input
        type="range"
        min={0}
        max={maximum}
        step={QUANTITY_STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer"
      />

      <div className="flex justify-between text-[10px] text-textMuted">
        <span>0</span>
        <span>{formatCompactNumber(maximum / 2)}</span>
        <span>{formatCompactNumber(maximum)}</span>
      </div>
    </label>
  )
}

function SupplyBalanceBar({
  required,
  selected,
}: {
  required: number
  selected: number
}) {
  const displayMaximum = Math.max(required * 1.5, selected, 1)
  const selectedWidth = Math.min(100, (selected / displayMaximum) * 100)
  const requiredPosition = Math.min(
    100,
    (required / displayMaximum) * 100,
  )
  const difference = selected - required

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
            Suprimento necessário
          </div>
          <div className="mt-1 text-xl font-bold text-textH">
            {formatPortions(required)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
            Selecionado
          </div>
          <div className="mt-1 text-xl font-bold text-textH">
            {formatPortions(selected)}
          </div>
        </div>
      </div>

      <div className="relative h-4 overflow-hidden rounded-full bg-bg">
        <div
          className={
            difference < -PORTION_EPSILON
              ? "h-full rounded-full bg-danger"
              : "h-full rounded-full bg-accent"
          }
          style={{ width: `${selectedWidth}%` }}
        />
        <div
          aria-label="Quantidade necessária"
          className="absolute inset-y-0 w-0.5 bg-danger"
          style={{ left: `calc(${requiredPosition}% - 1px)` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-textMuted">
          A linha vermelha marca o necessário para o descanso completo.
        </span>
        <span
          className={
            difference < -PORTION_EPSILON
              ? "font-semibold text-danger"
              : "font-semibold text-textH"
          }
        >
          {formatSupplyDifference(difference)}
        </span>
      </div>
    </section>
  )
}

function ModalShell({
  children,
  onClose,
  maxWidth,
}: {
  children: ReactNode
  onClose: () => void
  maxWidth: string
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-x-hidden bg-black/65 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`grid max-h-[94vh] w-full min-w-0 ${maxWidth} overflow-hidden rounded-xl border border-border bg-bg-elevated p-3 text-text shadow-theme-lg sm:p-4`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function selectionToPortions(
  selection: LongRestSupplySelection[],
): Record<string, number> {
  return Object.fromEntries(
    selection.map((entry) => [entry.itemId, entry.portions]),
  )
}

function selectionToBarrelSelections(
  selection: LongRestSupplySelection[],
  supplies: SupplyItem[],
): Record<string, BarrelSelection> {
  const selectedByItem = new Map(
    selection.map((entry) => [entry.itemId, entry.portions]),
  )

  return Object.fromEntries(
    supplies
      .filter(isBarrelSupply)
      .map((item) => {
        const available = getTotalSupplyPortions(item)
        const selected = Math.min(
          available,
          Math.max(0, selectedByItem.get(item.id) ?? 0),
        )

        if (selected > 0 && selected < 1 && available >= 1) {
          const percentage = Math.max(
            25,
            Math.min(100, Math.round(selected * 4) * 25),
          )

          return [item.id, { quantity: 1, percentage }]
        }

        return [
          item.id,
          {
            quantity: Math.round(selected),
            percentage: 100,
          },
        ]
      }),
  )
}

function isBarrelSupply(item: SupplyItem): boolean {
  return (
    item.supplyPackage === "barrel" ||
    item.supplyUnitsPerItem === 40
  )
}

function clampWholeQuantity(value: number, maximum: number): number {
  const integerValue = Math.round(Number(value) || 0)
  return Math.max(0, Math.min(maximum, integerValue))
}

function supplyCategoryLabel(item: SupplyItem): string {
  if (item.supplyCategory === "food") return "Comida"
  if (item.supplyCategory === "drink") return "Bebida"
  if (item.supplyCategory === "mixed") return "Comida e bebida"
  return "Outro"
}

function formatSupplyDifference(difference: number): string {
  if (Math.abs(difference) <= PORTION_EPSILON) {
    return "Quantidade exata"
  }

  return difference < 0
    ? `${formatPortions(Math.abs(difference))} abaixo`
    : `${formatPortions(difference)} acima`
}

function DialogHeader({
  id,
  title,
  description,
  onClose,
}: {
  id: string
  title: string
  description: string
  onClose: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
      <div className="min-w-0">
        <h2 id={id} className="break-words text-base font-semibold text-textH">
          {title}
        </h2>
        <p className="mt-1 max-w-full break-words text-xs leading-5 text-textMuted">
          {description}
        </p>
      </div>

      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-border hover:bg-bg-subtle hover:text-textH"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function formatPercentage(value: number): string {
  const normalized = Math.max(0, Math.min(100, value))
  return `${normalized.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`
}

function formatCompactNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function formatPortions(value: number): string {
  const normalized = Math.max(0, value)
  const formatted = formatCompactNumber(normalized)

  return `${formatted} ${normalized === 1 ? "porção" : "porções"}`
}
