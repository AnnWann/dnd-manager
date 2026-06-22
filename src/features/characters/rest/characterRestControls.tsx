import { useEffect, useMemo, useState } from "react"
import { Coffee, Moon, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
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
  getEffectiveRaceSupplyConsumption,
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

const PORTION_EPSILON = 0.000001

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
  const [shortRestOpen, setShortRestOpen] = useState(false)
  const [longRestOpen, setLongRestOpen] = useState(false)

  function completeShortRest(
    healing: number,
    hitDiceConsumption: HitDiceConsumption,
  ) {
    updateCharacter(character.get("id"), (current) =>
      takeShortRest(current, healing, hitDiceConsumption),
    )
    setShortRestOpen(false)
  }

  function confirmLongRest(selection: LongRestSupplySelection[]) {
    completeLongRest(character.get("id"), selection)
    setLongRestOpen(false)
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-textH">
            Descanso
          </h2>

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

type ShortRestDialogProps = {
  open: boolean
  character: CharacterTemplate
  onClose: () => void
  onConfirm: (
    healing: number,
    hitDiceConsumption: HitDiceConsumption,
  ) => void
}

function ShortRestDialog({
  open,
  character,
  onClose,
  onConfirm,
}: ShortRestDialogProps) {
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
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={resetAndClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="short-rest-title"
        className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-4 text-text shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
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

                  const currentAmount =
                    hitDiceConsumption[side] ?? 0

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
      </div>
    </div>
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
  const consumption = getEffectiveRaceSupplyConsumption(
    character.get("sheet").race,
  )
  const foodCost = consumption.food
  const drinkCost = consumption.drink
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
  const [selectedByItem, setSelectedByItem] = useState<
    Record<string, number>
  >({})

  useEffect(() => {
    if (!open) return

    setSelectedByItem(
      selectionToRecord(
        createAutomaticLongRestSelection(
          partyInventory,
          foodCost,
          drinkCost,
        ),
      ),
    )
  }, [drinkCost, foodCost, open, partyInventory])

  const selection = useMemo<LongRestSupplySelection[]>(
    () =>
      Object.entries(selectedByItem)
        .filter(([, portions]) => portions > 0)
        .map(([itemId, portions]) => ({ itemId, portions })),
    [selectedByItem],
  )
  const totals = useMemo(
    () => getSupplySelectionTotals(partyInventory, selection),
    [partyInventory, selection],
  )

  if (!open) return null

  const missingFood = Math.max(0, foodCost - totals.food)
  const missingDrink = Math.max(0, drinkCost - totals.drink)
  const foodComplete = missingFood <= PORTION_EPSILON
  const drinkComplete = missingDrink <= PORTION_EPSILON
  const canConfirm = foodComplete && drinkComplete

  function setSelectedPortions(item: SupplyItem, value: number) {
    const available = getTotalSupplyPortions(item)
    const nextValue = Math.max(0, Math.min(available, value || 0))

    setSelectedByItem((current) => ({
      ...current,
      [item.id]: nextValue,
    }))
  }

  function autoSelect() {
    setSelectedByItem(
      selectionToRecord(
        createAutomaticLongRestSelection(
          partyInventory,
          foodCost,
          drinkCost,
        ),
      ),
    )
  }

  function resetAndClose() {
    setSelectedByItem({})
    onClose()
  }

  function confirm() {
    if (!canConfirm) return
    onConfirm(selection)
    setSelectedByItem({})
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-x-hidden bg-black/65 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={resetAndClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="long-rest-title"
        className="grid max-h-[94vh] w-full min-w-0 max-w-2xl overflow-hidden rounded-xl border border-border bg-bg-elevated p-3 text-text shadow-theme-lg sm:p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader
          id="long-rest-title"
          title="Descanso longo"
          description="Escolha os suprimentos que serão consumidos. Você pode dividir comida e bebida entre várias pilhas ou consumir apenas parte de uma embalagem."
          onClose={resetAndClose}
        />

        <div className="grid min-h-0 gap-4 overflow-y-auto py-4 pr-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SupplyRequirement
              label="Comida necessária"
              value={foodCost}
              complete={foodComplete}
            />
            <SupplyRequirement
              label="Comida selecionada"
              value={totals.food}
              complete={foodComplete}
            />
            <SupplyRequirement
              label="Bebida necessária"
              value={drinkCost}
              complete={drinkComplete}
            />
            <SupplyRequirement
              label="Bebida selecionada"
              value={totals.drink}
              complete={drinkComplete}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              size="sm"
              variant="secondary"
              onClick={() => setSelectedByItem({})}
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
                const selected = selectedByItem[item.id] ?? 0

                return (
                  <label
                    key={item.id}
                    className="grid min-w-0 gap-3 rounded-xl border border-border bg-bg-subtle p-3 sm:grid-cols-[minmax(0,1fr)_130px] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold text-textH">
                        {item.name || "Suprimento sem nome"}
                      </span>
                      <span className="mt-1 block break-words text-[11px] leading-4 text-textMuted">
                        {supplyCategoryLabel(item)} • {formatPortions(available)} disponíveis
                      </span>
                    </span>

                    <span className="grid min-w-0 gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                        Porções a consumir
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={available}
                        step="any"
                        value={selected}
                        onChange={(event) =>
                          setSelectedPortions(
                            item,
                            Number(event.target.value) || 0,
                          )
                        }
                      />
                    </span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-3 py-6 text-center text-xs leading-5 text-textMuted">
              O inventário do grupo não possui suprimentos de comida ou bebida disponíveis.
            </div>
          )}

          {!canConfirm ? (
            <div className="rounded-xl border border-danger bg-dangerBg p-3 text-xs leading-5 text-danger">
              A seleção ainda não sustenta o descanso.
              {!foodComplete
                ? ` Faltam ${formatPortions(missingFood)} de comida.`
                : ""}
              {!drinkComplete
                ? ` Faltam ${formatPortions(missingDrink)} de bebida.`
                : ""}
            </div>
          ) : (
            <div className="rounded-xl border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-textH">
              Suprimentos suficientes. Serão consumidas {formatPortions(totals.selectedPortions)} distribuídas entre os itens selecionados.
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
            disabled={!canConfirm}
            onClick={confirm}
          >
            Consumir e descansar
          </Button>
        </div>
      </div>
    </div>
  )
}

function SupplyRequirement({
  label,
  value,
  complete,
}: {
  label: string
  value: number
  complete: boolean
}) {
  return (
    <div
      className={
        complete
          ? "min-w-0 rounded-xl border border-accentBorder bg-accentBg p-3"
          : "min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
      }
    >
      <div className="break-words text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 break-words text-lg font-bold text-textH">
        {formatPortions(value)}
      </div>
    </div>
  )
}

function supplyCategoryLabel(item: SupplyItem): string {
  if (item.supplyCategory === "food") return "Comida"
  if (item.supplyCategory === "drink") return "Bebida"
  if (item.supplyCategory === "mixed") {
    return "Misto — conta como comida e bebida"
  }
  return "Outro"
}

function selectionToRecord(
  selection: LongRestSupplySelection[],
): Record<string, number> {
  return Object.fromEntries(
    selection.map((entry) => [entry.itemId, entry.portions]),
  )
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

function formatPortions(value: number): string {
  const normalized = Math.max(0, value)
  const formatted = Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toLocaleString("pt-BR", { maximumFractionDigits: 2 })

  return `${formatted} ${normalized === 1 ? "porção" : "porções"}`
}
