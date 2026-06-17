// features/characters/spells/SpellSlotsEditor.tsx

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

const SLOT_LEVELS: MagicCircleLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function SpellSlotsEditor({
  character,
  updateCharacter,
}: Props) {
  const slots = character.getSpellSlots()
  const pactSlots = character.getPactSlots()

  function spendSlot(level: MagicCircleLevel) {
    updateCharacter(character.get("id"), (c) =>
      c.spendSpellSlot(level),
    )
  }

  function restoreSlot(level: MagicCircleLevel) {
    updateCharacter(character.get("id"), (c) =>
      c.restoreSpellSlot(level),
    )
  }

  function spendPactSlot() {
    updateCharacter(character.get("id"), (c) =>
      c.spendPactSlot(),
    )
  }

  function restorePactSlot() {
    updateCharacter(character.get("id"), (c) =>
      c.restorePactSlot(),
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Espaços de magia
        </div>

        <div className="mt-1 text-xs text-text">
          Slots derivados das classes do personagem.
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3">
          {SLOT_LEVELS.map((level) => {
            const slot = slots[level]

            if (!slot || slot.max <= 0) return null

            return (
              <div
                key={level}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div>
                  <div className="text-sm font-medium text-textH">
                    Nível {level}
                  </div>

                  <div className="text-xs text-text">
                    {slot.current}/{slot.max} disponíveis
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={slot.current <= 0}
                    onClick={() => spendSlot(level)}
                  >
                    Gastar
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={slot.current >= slot.max}
                    onClick={() => restoreSlot(level)}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            )
          })}

          {pactSlots ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium text-textH">
                  Pacto — Nível {pactSlots.level}
                </div>

                <div className="text-xs text-text">
                  {pactSlots.current}/{pactSlots.max} disponíveis
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pactSlots.current <= 0}
                  onClick={spendPactSlot}
                >
                  Gastar
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pactSlots.current >= pactSlots.max}
                  onClick={restorePactSlot}
                >
                  Restaurar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}