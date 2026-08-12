import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import { CharacterHpControls } from "../../../characterHpControls"
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
  const hp = character.get("sheet").HP

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <HpValue name="Vida Atual" value={hp.current} />

        <SelectHpModule
          name="Vida Máxima"
          hpKey="max"
          character={character}
          updateCharacter={updateCharacter}
        />

        <HpValue name="Vida Temporária" value={hp.temporary} />
      </div>

      <div className="mt-4">
        <CharacterHpControls
          character={character}
          updateCharacter={updateCharacter}
        />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <GroupHitDice
          character={character}
          updateCharacter={updateCharacter}
        />
      </div>
    </section>
  )
}

function HpValue({ name, value }: { name: string; value: number }) {
  return (
    <div className="grid min-h-16 place-items-center rounded-xl border border-border bg-bg-subtle px-3 py-2 text-center">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-textMuted">{name}</div>
        <div className="mt-1 text-lg font-bold text-textH">{value}</div>
      </div>
    </div>
  )
}
