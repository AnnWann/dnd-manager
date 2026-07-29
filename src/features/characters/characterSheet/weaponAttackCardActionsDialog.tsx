import { Hand, PackageOpen, Swords } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getHandOccupants,
  setWeaponGripWithRules,
  type HandOccupant,
} from "../../../models/characters/characterHands"

export type WeaponAttackCardDialogState = {
  weaponId: string
  mode: "manage" | "free-hand"
}

export function WeaponAttackCardActionsDialog({
  character,
  state,
  onClose,
}: {
  character: CharacterTemplate
  state: WeaponAttackCardDialogState | null
  onClose: () => void
}) {
  const {
    updateCharacter,
    stowHandOccupant,
    dropHandOccupant,
  } = useCharacterContext()

  if (!state) return null

  const weapons = character.get("equipment").weapons
  const weaponIndex = weapons.findIndex((weapon) => weapon.id === state.weaponId)
  const weapon = weapons[weaponIndex]

  if (!weapon) return null

  const blockers = getHandOccupants(character).filter(
    (occupant) =>
      !(
        occupant.reference.type === "weapon" &&
        occupant.item.id === state.weaponId
      ),
  )

  function finishTwoHandedGrip() {
    updateCharacter(character.get("id"), (current) => {
      const currentIndex = current
        .get("equipment")
        .weapons.findIndex((entry) => entry.id === state?.weaponId)
      if (currentIndex < 0) return current
      return setWeaponGripWithRules(current, currentIndex, true)
    })
  }

  function resolveBlocker(
    occupant: HandOccupant,
    destination: "inventory" | "ground",
  ) {
    if (destination === "inventory") {
      stowHandOccupant(character.get("id"), occupant.reference)
    } else {
      dropHandOccupant(character.get("id"), occupant.reference)
    }

    finishTwoHandedGrip()
    onClose()
  }

  function removeSelectedWeapon(destination: "inventory" | "ground") {
    const reference = { type: "weapon" as const, index: weaponIndex }

    if (destination === "inventory") {
      stowHandOccupant(character.get("id"), reference)
    } else {
      dropHandOccupant(character.get("id"), reference)
    }

    onClose()
  }

  if (state.mode === "manage") {
    return (
      <Modal
        title={`Gerenciar arma: ${weapon.name || "Arma sem nome"}`}
        onClose={onClose}
        className="max-w-md"
      >
        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-bg-subtle p-3">
            <div className="flex items-start gap-3">
              <Swords className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-sm leading-6 text-text">
                Esta arma não possui uma empunhadura alternativa. Você pode
                guardá-la no inventário pessoal ou soltá-la no Inventário do
                chão.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => removeSelectedWeapon("inventory")}
            >
              Guardar
            </Button>
            <Button
              variant="danger"
              onClick={() => removeSelectedWeapon("ground")}
            >
              Soltar no chão
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={`Liberar a outra mão para ${weapon.name || "a arma"}`}
      onClose={onClose}
      className="max-w-xl"
    >
      <div className="grid gap-4">
        <div className="rounded-xl border border-warning bg-warningBg p-3">
          <div className="flex items-start gap-3">
            <Hand className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-sm leading-6 text-text">
              Para empunhar esta arma com duas mãos, escolha o item que será
              guardado ou solto. Depois da escolha, a arma passará
              automaticamente para duas mãos.
            </p>
          </div>
        </div>

        {blockers.length ? (
          <div className="grid gap-3">
            {blockers.map((occupant) => (
              <article
                key={occupant.key}
                className="rounded-xl border border-border bg-bg-subtle p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {occupant.name}
                    </div>
                    <div className="mt-1 text-xs text-textMuted">
                      Ocupa {occupant.hands} {occupant.hands === 1 ? "mão" : "mãos"}
                      {occupant.arcaneFocus ? " · foco arcano" : ""}
                    </div>
                  </div>
                  <PackageOpen className="h-4 w-4 shrink-0 text-textMuted" />
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => resolveBlocker(occupant, "inventory")}
                  >
                    Guardar e usar duas mãos
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => resolveBlocker(occupant, "ground")}
                  >
                    Soltar e usar duas mãos
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle p-4 text-center text-xs text-textMuted">
            Nenhum outro item ocupando uma mão foi encontrado.
          </div>
        )}
      </div>
    </Modal>
  )
}
