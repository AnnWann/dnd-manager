import type { DieSides } from "../dice/Die"
import type { HitDice } from "./HitDice"

export type HP = {
  max: number
  current: number
  temporary: number
  hitDice: Partial<Record<DieSides, HitDice>>
}