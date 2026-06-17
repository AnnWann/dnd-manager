import { useState } from "react"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import { SelectHpModule } from "./SelectHpModule"
import { GroupHitDice } from "../hitdice/groupHitDice"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function GroupHP({
  character,
  updateCharacter,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          flex items-center gap-2
          text-sm font-medium text-textH
          transition-opacity hover:opacity-80
        "
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>Pontos de Vida</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <SelectHpModule
            name="Vida Máxima"
            hpKey="max"
            character={character}
            updateCharacter={updateCharacter}
          />

          <SelectHpModule
            name="Vida Atual"
            hpKey="current"
            character={character}
            updateCharacter={updateCharacter}
          />

          <SelectHpModule
            name="Vida Temporária"
            hpKey="temporary"
            character={character}
            updateCharacter={updateCharacter}
          />

          <GroupHitDice
            character={character}
            updateCharacter={updateCharacter}
          />
        </div>
      )}
    </div>
  )
}