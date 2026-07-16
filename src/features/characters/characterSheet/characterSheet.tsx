import type { Player } from "../../../models/player/Player"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

import { Attributes } from "./attributes"
import { Skills } from "./skills/skills"
import { CharacterIdentity } from "./character_info/characterIdentity"
import { GroupActions } from "./character_info/components/actions/GroupActions"
import { GroupHP } from "./character_info/components/hp/GroupHP"
import { GroupStats } from "./character_info/components/stats/GroupStats"
import { AttributeCalculators } from "./attributeCalculators"
import { CharacterConditions } from "./characterConditions"
import { SavingThrows } from "./savingThrows"


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

export function CharacterSheetTab({
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner,
}: Props) {
  const showActionEconomy = canAssignOwners

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

      <GroupHP character={character} updateCharacter={updateCharacter} />
      <GroupStats character={character} updateCharacter={updateCharacter} />
      <CharacterConditions character={character} updateCharacter={updateCharacter} />

      <div
        className={
          showActionEconomy
            ? "grid items-start gap-4 xl:grid-cols-[280px_minmax(360px,1fr)_minmax(320px,0.9fr)]"
            : "grid items-start gap-4 xl:grid-cols-[280px_minmax(360px,1fr)]"
        }
      >
        <div className="grid gap-4">
          <Attributes character={character} updateCharacter={updateCharacter} />
          <SavingThrows character={character} updateCharacter={updateCharacter} />
        </div>

        <Skills character={character} updateCharacter={updateCharacter} />

        {showActionEconomy ? (
          <GroupActions character={character} updateCharacter={updateCharacter} />
        ) : null}
      </div>

      <AttributeCalculators character={character} />
    </div>
  )
}
