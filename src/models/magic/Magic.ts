import type { CharacterMetamagics } from "./metamagic/CharacterMetamagics"
import type { CharacterSpells } from "./spells/CharacterSpells"

export interface Magic {
  spells: CharacterSpells
  metamagic: CharacterMetamagics[]
}