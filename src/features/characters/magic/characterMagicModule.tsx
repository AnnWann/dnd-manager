// features/characters/spells/CharacterSpellsModule.tsx

import { Card, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { KnownSpellsList } from "./knownSpellsList"
import { SpellSlotsEditor } from "./slots"
import { MetamagicModule } from "./metamagicModule"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function CharacterMagicTab({
  character,
  updateCharacter,
}: Props) {
  const hasSorcerer = character
  .get("sheet")
  .classes?.some((classData) => classData.className === "sorcerer" && classData.level > 1)

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

        {hasSorcerer ? (
          <MetamagicModule
            character={character}
            updateCharacter={updateCharacter}
          />
        ) : null}

        <SpellSlotsEditor
          character={character}
          updateCharacter={updateCharacter}
        />

        <KnownSpellsList
          character={character}
          updateCharacter={updateCharacter}
        />
      </Card>


    </div>
  )
}