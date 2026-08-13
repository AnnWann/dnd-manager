import type { CharacterMetamagics } from "./metamagic/CharacterMetamagics"
import type { CharacterSpells } from "./spells/CharacterSpells"

export type ChannelDivinityResource = {
  used: number
}

export type KiResource = {
  used: number
}

export interface Magic {
  spells: CharacterSpells
  metamagic?: CharacterMetamagics
  channelDivinity?: ChannelDivinityResource
  ki?: KiResource
}
