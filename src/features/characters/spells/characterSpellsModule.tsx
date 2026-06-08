// features/characters/spells/CharacterSpellsModule.tsx

import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { KnownSpellsList } from "./knownSpellsList"
import { SpellSlotsEditor } from "./slots"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function CharacterSpellsModule({
  character,
  updateCharacter,
}: Props) {
  const spellCount = character.getSpells().length

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">
            Magias
          </div>

          <div className="mt-1 text-xs text-text">
            Gerencie magias conhecidas, preparadas e slots.
          </div>
        </CardHeader>

        <SpellSlotsEditor
          character={character}
          updateCharacter={updateCharacter}
          />

          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-text">
              Magias conhecidas
            </div>

            <div className="mt-1 text-2xl font-semibold text-textH">
              {spellCount}
            </div>
          </div>

          <KnownSpellsList
            character={character}
            updateCharacter={updateCharacter}
          />
      </Card>


    </div>
  )
}