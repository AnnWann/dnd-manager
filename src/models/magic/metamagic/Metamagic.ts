import type { Spell } from "../spells/Spell"
import type { MagicCircleLevel } from "../spells/spellDefinitions"

export type MetamagicId = 
  | 'careful-spell'
  | 'distant-spell'
  | 'empowered-spell'
  | 'extended-spell'
  | 'heightened-spell'
  | 'quickened-spell'
  | 'seeking-spell'
  | 'subtle-spell'
  | 'transmuted-spell'
  | 'twinned-spell'

export type Metamagic = {
  id: MetamagicId
  name: string
  desc: string[]

  sorceryPointCost: number | 'spell-level'

  timing: 'on-cast' | 'on-damage-roll' | 'on-miss'

  canCombineWithOtherMetamagic: boolean

  isAvailableForSpell?: (spell: Spell, castLevel: MagicCircleLevel) => boolean
}

