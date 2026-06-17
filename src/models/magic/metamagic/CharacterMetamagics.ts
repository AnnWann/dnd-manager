import type { MetamagicId } from "./Metamagic"


export type CharacterMetamagics = {
  metamagics: MetamagicId[]
  sorceryPoints: {
    max: number,
    current: number
  }
}

