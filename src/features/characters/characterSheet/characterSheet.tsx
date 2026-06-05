import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Attributes } from "./attributes"
import { Class } from "./class"
import { CharacterInfo } from "./character_info/characterInfo"
import { Skills } from "./skills"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Attribute } from "../../../models/sheet/Attribute"

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate) => void
  addClassToActive: (classIndex: string) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
}

export function CharacterSheet({
  character,
  updateCharacter,
  addClassToActive,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
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
         />

        <Attributes
          character={character}
          updateCharacter={updateCharacter}
          />

        <Skills
          character={character}
          updateCharacter={updateCharacter}
          abilityShort={abilityShort}
         />

      </CardContent>

      
      <Class
        character={character}
        updateCharacter={updateCharacter}
        abilityShort={abilityShort}
        addClassToActive={addClassToActive}
      />
      
    </Card>
  )
}