import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import { CharacterHpControls } from "../../../characterHpControls"
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
  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-textH">
          Pontos de Vida
        </h2>

        <span className="text-xs text-textMuted">
          Combate
        </span>
      </div>

      <CharacterHpControls
        character={character}
        updateCharacter={updateCharacter}
      />

      <div className="mt-4 border-t border-border pt-3">
        <GroupHitDice
          character={character}
          updateCharacter={updateCharacter}
        />
      </div>
    </section>
  )
}
