import type { Metamagic } from "./Metamagic"


export type CharacterMetamagics = {
  metamagics: Metamagic[]
  sorceryPoints: {
    max: number,
    current: number
  }
}