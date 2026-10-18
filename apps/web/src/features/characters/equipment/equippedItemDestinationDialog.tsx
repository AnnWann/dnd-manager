import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import type { EquippedItemDestination } from "../../../models/characters/characterEquippedItemMovement"
import type { Itemmable } from "../../../models/items/item"
import { canItemGoInPocket } from "../../../models/items/itemPocketability"

export function EquippedItemDestinationDialog({
  open,
  item,
  pocketCount,
  onClose,
  onMove,
}: {
  open: boolean
  item: Itemmable
  pocketCount: number
  onClose: () => void
  onMove: (destination: EquippedItemDestination) => void
}) {
  if (!open) return null

  const canUsePocket = canItemGoInPocket(item)
  const pocketFull = pocketCount >= 8

  function move(destination: EquippedItemDestination) {
    onMove(destination)
    onClose()
  }

  return (
    <Modal
      title={`Destino de ${item.name || "item sem nome"}`}
      onClose={onClose}
      className="max-w-md"
    >
      <div className="grid gap-4">
        <p className="text-sm leading-6 text-text">
          Escolha para onde o item deve ir ao ser retirado do equipamento.
        </p>

        <div className="grid gap-2">
          <DestinationButton
            title="Inventário"
            description="Guarda o item no inventário pessoal do personagem."
            onClick={() => move("inventory")}
          />

          {canUsePocket ? (
            <DestinationButton
              title={pocketFull ? "Bolso cheio" : "Bolso"}
              description={
                pocketFull
                  ? "Os oito espaços de bolso já estão ocupados."
                  : "Move o item diretamente para um dos espaços de bolso."
              }
              disabled={pocketFull}
              onClick={() => move("pocket")}
            />
          ) : null}

          <DestinationButton
            title="Inventário do chão"
            description="Larga o item no chão para que outros personagens possam pegá-lo."
            danger
            onClick={() => move("ground")}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DestinationButton({
  title,
  description,
  disabled = false,
  danger = false,
  onClick,
}: {
  title: string
  description: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-xl border p-3 text-left transition-colors",
        danger
          ? "border-danger/40 bg-dangerBg hover:border-danger"
          : "border-border bg-bg-subtle hover:border-accentBorder hover:bg-accentBg",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      <div className={danger ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-textH"}>
        {title}
      </div>
      <div className="mt-1 text-xs leading-5 text-textMuted">
        {description}
      </div>
    </button>
  )
}
