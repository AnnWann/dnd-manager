import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Player } from "../../../models/player/Player"
import { Attributes } from "./attributes"
import { CharacterInfo } from "./character_info/characterInfo"
import { Classes } from "./classes/class"
import { Skills } from "./skills/skills"

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate) => void
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
  createOwner
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Ficha rápida</div>
        <div className="mt-1 text-xs text-text">Nome, atributos e regra de proficiência.</div>
      </CardHeader>
      <CardContent>
        
        <CharacterInfo
          character={character}
          updateCharacter={updateCharacter}
          canAssignOwners={canAssignOwners}
          canEditCharacterType={canEditCharacterType}
          playerKeys={playerKeys}
          getOwner={getOwner}
          createOwner={createOwner}

        />

        <Attributes
          character={character}
          updateCharacter={updateCharacter}
        />

        <Skills
          character={character}
          updateCharacter={updateCharacter}
        />
      </CardContent>

      {character.get("sheet").type === "pc" && (
        <Classes
          character={character}
          updateCharacter={updateCharacter}
        />
      )}
      
    </Card>
  )
}