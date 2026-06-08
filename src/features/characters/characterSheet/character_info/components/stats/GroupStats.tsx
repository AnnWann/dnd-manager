import { useState } from "react"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import { SelectStatModule } from "./selectStatModule"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function GroupStats({
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
        <span>Estatísticas</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SelectStatModule
            name="CA"
            statKey="armorClass"
            character={character}
            updateCharacter={updateCharacter}
            fallback={10}
          />

          <SelectStatModule
            name="Iniciativa"
            statKey="initiative"
            character={character}
            updateCharacter={updateCharacter}
            fallback={0}
          />

          <SelectStatModule
            name="Mobilidade"
            statKey="mobility"
            character={character}
            updateCharacter={updateCharacter}
            fallback={9}
          />

          <SelectStatModule
            name="Percepção Passiva"
            statKey="passive_perception"
            character={character}
            updateCharacter={updateCharacter}
            fallback={10}
          />
        </div>
      )}
    </div>
  )
}