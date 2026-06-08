import { Input } from "../../../../components/ui/Input"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { SelectCharacterUniqueness } from "./components/selectCharacterUniqueness"
import { SelectCharacterVisibility } from "./components/selectCharacterVisibility"
import { SelectCharacterType } from "./components/selectCharacterType"
import { SelectCharacterOwner } from "./components/selectCharacterOwner"
import type { Player } from "../../../../models/player/Player"
import { GroupActions } from "./components/actions/GroupActions"
import { GroupStats } from "./components/stats/GroupStats"
import { GroupHP } from "./components/hp/GroupHP"
import { GroupHitDice } from "./components/hitdice/groupHitDice"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

export function CharacterInfo({
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner
}: Props) {

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full">
          <label className="text-xs text-text">
            Nome do personagem
          </label>

          <Input
            className="mt-1"
            value={character.get('name')}
            onChange={(e) =>
              updateCharacter(character.get('id'), (c) => c.with('name', e.target.value))
            }
          />
        </div>

        <SelectCharacterType
          character={character}
          updateCharacter={updateCharacter}
          canEditCharacterType={canEditCharacterType}
        />
      </div>

      {canAssignOwners ? (
        <SelectCharacterVisibility 
          character={character}
          updateCharacter={updateCharacter}
        />
      ) : null}

      {canAssignOwners ? (
        <SelectCharacterOwner
          character={character}
          updateCharacter={updateCharacter}
          playerKeys={playerKeys}
          getOwner={getOwner}
          createOwner={createOwner}
        />
      ) : null}

      {canAssignOwners ? (
        <SelectCharacterUniqueness 
          character={character}
          updateCharacter={updateCharacter}
        />
      ) : null}

      <GroupActions
        character={character}
        updateCharacter={updateCharacter}
      />

      <GroupStats
        character={character}
        updateCharacter={updateCharacter}
      />

      <GroupHP
        character={character}
        updateCharacter={updateCharacter}
      />

    </div>
  )
}