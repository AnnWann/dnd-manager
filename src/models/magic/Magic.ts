import type { Ability } from "../abilities/Ability"
import type { CharacterMetamagics } from "./metamagic/CharacterMetamagics"
import type { CharacterSpells } from "./spells/CharacterSpells"

export type ChannelDivinityResource = {
  used: number
}

export interface Magic {
  spells: CharacterSpells
  metamagic?: CharacterMetamagics
  /** Eldritch invocations are ability-shaped, but belong to magical class configuration. */
  invocations?: Ability[]
  channelDivinity?: ChannelDivinityResource
}
