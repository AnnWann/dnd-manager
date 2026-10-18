import { CharacterHpPanel } from "../../../../../../../packages/game-ui/src/CharacterHpPanel"
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
  return <CharacterHpPanel
    hp={<CharacterHpControls character={character} updateCharacter={updateCharacter} />}
    hitDice={<GroupHitDice character={character} updateCharacter={updateCharacter} />}
  />
}
