import { useState } from "react"
import { AlertTriangle, Hand } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getSpellcastingHandState,
  setWeaponGripWithRules,
  type HandOccupant,
} from "../../../models/characters/characterHands"

export function SpellcastingHandsWarning({
  character,
}: {
  character: CharacterTemplate
}) {
  const {
    updateCharacter,
    stowHandOccupant,
    dropHandOccupant,
  } = useCharacterContext()
  const [selectedOccupant, setSelectedOccupant] =
    useState<HandOccupant | null>(null)
  const state = getSpellcastingHandState(character)

  if (state.canCast) return null

  function handleOccupant(occupant: HandOccupant) {
    const reference = occupant.reference

    if (
      occupant.canReduceToOneHand &&
      reference.type === "weapon"
    ) {
      updateCharacter(character.get("id"), (current) =>
        setWeaponGripWithRules(
          current,
          reference.index,
          false,
        ),
      )
      return
    }

    setSelectedOccupant(occupant)
  }

  return (
    <>
      <div className="rounded-xl border border-danger bg-dangerBg p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-danger">
              Não pode conjurar com as mãos ocupadas
            </div>
            <p className="mt-1 text-xs leading-5 text-text">
              Todas as mãos úteis estão ocupadas. Um foco arcano segurado não
              causa esse bloqueio. Libere uma mão ou adquira a proficiência
              “Conjuração com mãos ocupadas”.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {state.blockers.map((occupant) => (
            <button
              key={occupant.key}
              type="button"
              onClick={() => handleOccupant(occupant)}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-bg px-2.5 py-1.5 text-xs font-medium text-textH hover:bg-bg-subtle"
            >
              <Hand className="h-3.5 w-3.5 text-danger" />
              <span>{occupant.name}</span>
              <span className="text-[10px] text-textMuted">
                {occupant.hands} {occupant.hands === 1 ? "mão" : "mãos"}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-2 text-[10px] leading-4 text-textMuted">
          Armas em duas mãos passam para uma mão ao serem tocadas. Outros itens
          abrem as opções de guardar ou soltar.
        </p>
      </div>

      {selectedOccupant ? (
        <Modal
          title={`Liberar mão: ${selectedOccupant.name}`}
          onClose={() => setSelectedOccupant(null)}
          className="max-w-md"
        >
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-text">
              Guardar devolve o item ao inventário pessoal. Soltar envia o item
              para o Inventário do chão, onde qualquer jogador poderá pegá-lo.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  stowHandOccupant(
                    character.get("id"),
                    selectedOccupant.reference,
                  )
                  setSelectedOccupant(null)
                }}
              >
                Guardar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  dropHandOccupant(
                    character.get("id"),
                    selectedOccupant.reference,
                  )
                  setSelectedOccupant(null)
                }}
              >
                Soltar no chão
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
