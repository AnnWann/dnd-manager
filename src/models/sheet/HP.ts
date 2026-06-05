import type { HitDice } from "./HitDice"

export type HP = {
  max: number
  current: number
  temporary: number
  hitDice: HitDice
}