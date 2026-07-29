import { useState } from "react"
import { Hand, PackageOpen } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  findHandOccupantByItemId,
  getHandOccupants,
  getUsedHands,
  setHandOccupantHandsWithRules,
  type HandOccupant,
  type HeldHands,
} from "../../../models/characters/characterHands"
import { isWeaponImprovisedGrip } from "../../../models/items/equipment/Weapon"

export type HandItemActionsDialogState = {
  itemId: string
}

export function HandItemActionsDialog({
  character,
  state,
  onClose,
}: {
  character: CharacterTemplate
  state: HandItemActionsDialogState | null
  onClose: () => void
}) {
  const {
    updateCharacter,
    stowHandOccupant,
    dropHandOccupant,
  } = useCharacterContext()
  const [pendingHands, setPendingHands] = useState<HeldHands | null>(null)

  if (!state) return null

  const itemId: string = state.itemId
  const resolvedOccupant = findHandOccupantByItemId(character, itemId)
  if (!resolvedOccupant) return null
  const occupant: HandOccupant = resolvedOccupant

  const blockers = getHandOccupants(character).filter(
    (entry) => entry.item.id !== occupant.item.id,
  )
  const itemIsWeapon = occupant.reference.type === "weapon"
  const improvised =
    itemIsWeapon && isWeaponImprovisedGrip(occupant.item)

  function setHands(hands: HeldHands) {
    const availableAfterRemovingCurrent =
      character.get("sheet").arms -
      (getUsedHands(character) - occupant.hands)

    if (availableAfterRemovingCurrent < hands) {
      setPendingHands(hands)
      return
    }

    updateCharacter(character.get("id"), (current) => {
      const currentOccupant = findHandOccupantByItemId(
        current,
        itemId,
      )
      if (!currentOccupant) return current
      return setHandOccupantHandsWithRules(
        current,
        currentOccupant.reference,
        hands,
      )
    })
    onClose()
  }

  function removeSelected(destination: "inventory" | "ground") {
    const currentOccupant = findHandOccupantByItemId(
      character,
      itemId,
    )
    if (!currentOccupant) return

    if (destination === "inventory") {
      stowHandOccupant(character.get("id"), currentOccupant.reference)
    } else {
      dropHandOccupant(character.get("id"), currentOccupant.reference)
    }
    onClose()
  }

  function freeBlocker(
    blocker: HandOccupant,
    destination: "inventory" | "ground",
  ) {
    if (!pendingHands) return

    if (destination === "inventory") {
      stowHandOccupant(character.get("id"), blocker.reference)
    } else {
      dropHandOccupant(character.get("id"), blocker.reference)
    }

    updateCharacter(character.get("id"), (current) => {
      const currentOccupant = findHandOccupantByItemId(
        current,
        itemId,
      )
      if (!currentOccupant) return current
      return setHandOccupantHandsWithRules(
        current,
        currentOccupant.reference,
        pendingHands,
      )
    })
    onClose()
  }

  return (
    <Modal
      title={`Gerenciar: ${occupant.name}`}
      onClose={onClose}
      className="max-w-xl"
    >
      <div className="grid gap-4">
        <div className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="flex items-start gap-3">
            <Hand className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div>
              <div className="text-sm font-semibold text-textH">
                Empunhadura atual: {occupant.hands} {occupant.hands === 1 ? "mão" : "mãos"}
              </div>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                {improvised
                  ? "Esta arma exige duas mãos. Com uma mão, usa Força e causa 1d4 + Força como arma improvisada."
                  : itemIsWeapon
                    ? "Qualquer arma pode ocupar uma ou duas mãos. Apenas propriedades específicas alteram ataque ou dano."
                    : occupant.arcaneFocus
                      ? "Este foco não bloqueia conjuração, mesmo quando ocupa duas mãos."
                      : "O item pode ocupar uma ou duas mãos sem benefício adicional por padrão."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={occupant.hands === 1 ? "primary" : "secondary"}
            onClick={() => setHands(1)}
          >
            Uma mão
          </Button>
          <Button
            variant={occupant.hands === 2 ? "primary" : "secondary"}
            onClick={() => setHands(2)}
          >
            Duas mãos
          </Button>
          <Button
            variant="secondary"
            onClick={() => removeSelected("inventory")}
          >
            Guardar
          </Button>
          <Button
            variant="danger"
            onClick={() => removeSelected("ground")}
          >
            Largar no chão
          </Button>
        </div>

        {pendingHands ? (
          <div className="grid gap-3 border-t border-border pt-4">
            <div className="rounded-xl border border-warning bg-warningBg p-3">
              <div className="text-sm font-semibold text-textH">
                Não há mãos livres suficientes
              </div>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Escolha outro item para guardar ou largar. Depois disso,
                {" "}{occupant.name} passará automaticamente para {pendingHands}
                {" "}{pendingHands === 1 ? "mão" : "mãos"}.
              </p>
            </div>

            {blockers.map((blocker) => (
              <article
                key={blocker.key}
                className="rounded-xl border border-border bg-bg-subtle p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {blocker.name}
                    </div>
                    <div className="mt-1 text-xs text-textMuted">
                      Ocupa {blocker.hands} {blocker.hands === 1 ? "mão" : "mãos"}
                      {blocker.arcaneFocus ? " · foco arcano" : ""}
                    </div>
                  </div>
                  <PackageOpen className="h-4 w-4 shrink-0 text-textMuted" />
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => freeBlocker(blocker, "inventory")}
                  >
                    Guardar este item
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => freeBlocker(blocker, "ground")}
                  >
                    Largar este item
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
