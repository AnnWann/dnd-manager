import { useMemo, useState } from "react"
import { Coffee, Moon, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  takeLongRest,
  takeShortRest,
  type HitDiceConsumption,
} from "../../../models/characters/characterRest"
import type { DieSides } from "../../../models/dice/Die"

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

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterRestControls({
  character,
  updateCharacter,
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

  function completeLongRest() {
    updateCharacter(character.get("id"), (current) =>
      takeLongRest(current),
    )
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
        onClose={() => setLongRestOpen(false)}
        onConfirm={completeLongRest}
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
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="long-rest-title"
        className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 text-text shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader
          id="long-rest-title"
          title="Descanso longo"
          description="O personagem recuperará toda a vida, dados de vida, espaços de magia, espaços de pacto, pontos de feitiçaria e habilidades de descanso curto ou longo."
          onClose={onClose}
        />

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <Button size="sm" variant="primary" onClick={onConfirm}>
            Concluir descanso
          </Button>
        </div>
      </div>
    </div>
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
      <div>
        <h2 id={id} className="text-base font-semibold text-textH">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-textMuted">
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
