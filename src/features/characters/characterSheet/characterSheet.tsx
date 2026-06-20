import type { Player } from "../../../models/player/Player"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

import { Attributes } from "./attributes"
import { Classes } from "./classes/class"
import { Skills } from "./skills/skills"
import { CharacterIdentity } from "./character_info/characterIdentity"
import { GroupActions } from "./character_info/components/actions/GroupActions"
import { GroupHP } from "./character_info/components/hp/GroupHP"
import { GroupStats } from "./character_info/components/stats/GroupStats"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

export function CharacterSheet({
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner,
}: Props) {
  return (
    <div className="grid gap-4">
      <CharacterIdentity
        character={character}
        updateCharacter={updateCharacter}
        canAssignOwners={canAssignOwners}
        canEditCharacterType={canEditCharacterType}
        playerKeys={playerKeys}
        getOwner={getOwner}
        createOwner={createOwner}
      />

      <GroupStats
        character={character}
        updateCharacter={updateCharacter}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(360px,1fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-4">
          <Attributes
            character={character}
            updateCharacter={updateCharacter}
          />
        </div>

        <div className="grid gap-4">
          <GroupHP
            character={character}
            updateCharacter={updateCharacter}
          />
        </div>

        <div className="grid gap-4">
          <Skills
            character={character}
            updateCharacter={updateCharacter}
          />
        </div>

        <GroupActions
            character={character}
            updateCharacter={updateCharacter}
          />
      </div>

      {character.get("sheet").type === "pc" && (
        <Classes
          character={character}
          updateCharacter={updateCharacter}
        />
      )}
    </div>
  )
}