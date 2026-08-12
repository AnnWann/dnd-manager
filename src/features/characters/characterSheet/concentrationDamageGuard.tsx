import { useEffect, useRef, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import {
  endConcentration,
  getConcentrationCondition,
} from "../../../models/characters/characterConcentration"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type PendingCheck = {
  damage: number
  dc: number
  spellName?: string
}

export function ConcentrationDamageGuard({ character, updateCharacter }: Props) {
  const characterId = character.get("id")
  const currentHp = character.get("sheet").HP.current
  const previousHp = useRef(currentHp)
  const previousCharacterId = useRef(characterId)
  const [pending, setPending] = useState<PendingCheck | null>(null)
  const concentration = getConcentrationCondition(character)

  useEffect(() => {
    if (previousCharacterId.current !== characterId) {
      previousCharacterId.current = characterId
      previousHp.current = currentHp
      setPending(null)
      return
    }

    const before = previousHp.current
    previousHp.current = currentHp

    if (currentHp >= before || !concentration) return

    const damage = before - currentHp
    setPending({
      damage,
      dc: Math.max(10, Math.floor(damage / 2)),
      spellName: concentration.source || undefined,
    })
  }, [characterId, concentration?.id, concentration?.source, currentHp])

  useEffect(() => {
    if (!concentration && pending) setPending(null)
  }, [concentration, pending])

  if (!pending || !concentration) return null

  function passCheck() {
    setPending(null)
  }

  function failCheck() {
    updateCharacter(characterId, endConcentration)
    setPending(null)
  }

  return (
    <Modal
      title="Teste de concentração"
      onClose={passCheck}
      className="max-w-md"
    >
      <div className="grid gap-3">
        <p className="text-sm leading-6 text-text">
          O personagem perdeu <strong>{pending.damage} PV</strong> enquanto estava
          concentrando{pending.spellName ? ` em ${pending.spellName}` : ""}.
        </p>
        <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm text-textH">
          Faça um teste de resistência de Constituição com <strong>CD {pending.dc}</strong>.
        </div>
        <p className="text-xs leading-5 text-textMuted">
          Marque o resultado do teste. Passar mantém a concentração; falhar encerra a concentração atual.
        </p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={passCheck}>
            Passar
          </Button>
          <Button variant="primary" onClick={failCheck}>
            Falhar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
