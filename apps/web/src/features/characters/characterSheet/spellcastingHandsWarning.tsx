import { SpellcastingHandsNotice } from "../../../../../../packages/game-ui/src/SpellcastingHandsNotice"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getSpellcastingHandState } from "../../../models/characters/characterHands"

export function SpellcastingHandsWarning({ character }: { character: CharacterTemplate }) {
  return <SpellcastingHandsNotice blocked={!getSpellcastingHandState(character).canCast} />
}
