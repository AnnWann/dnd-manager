import { useState } from "react"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { DieSides } from "../../../../../../models/dice/Die"
import { AddHitDiceDialog } from "./addHitDiceDialog"
import { HitDiceRow } from "./hitDiceRow"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function GroupHitDice({ character, updateCharacter }: Props) {
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const hitDice = character.get("sheet").HP.hitDice

  const hitDiceEntries = Object.entries(hitDice).filter(
    (entry): entry is [DieSides, NonNullable<(typeof hitDice)[DieSides]>] =>
      entry[1] !== undefined,
  )

  return (
    <div className="col-span-2 lg:col-span-3">
      <div className="mt-2 flex flex-col gap-2">
        {hitDiceEntries.map(([side, hd]) => (
          <HitDiceRow
            key={side}
            side={side}
            hitDice={hd}
            character={character}
            updateCharacter={updateCharacter}
          />
        ))}

        <button
          type="button"
          className="mt-2 w-fit rounded-md border border-border px-2 py-1 text-xs text-text"
          onClick={() => setDialogOpen(true)}
        >
          + Adicionar
        </button>

        <AddHitDiceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onAdd={(die) =>
            updateCharacter(character.get("id"), (c) => c.addDice(die))
          }
        />
      </div>

    </div>
  )
}