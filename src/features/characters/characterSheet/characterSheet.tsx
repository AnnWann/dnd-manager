import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { Attribute, Character } from "../../models/types"
import { Attributes } from "./attributes"
import { Class } from "./class"
import { CharacterInfo } from "./characterInfo"
import { Skills } from "./skills"

type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  abilityShort: (ability: Attribute) => string
  addClassToActive: (classIndex: string) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
}

export function CharacterSheet({
  character,
  updateCharacter,
  abilityShort,
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
          attributeShort={abilityShort}
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