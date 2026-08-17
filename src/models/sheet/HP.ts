import type { DieSides } from "../dice/Die"
import type { HitDice } from "./HitDice"

export type HP = {
  /** Vida máxima real/base do personagem. */
  max: number
  /**
   * Vida máxima atualmente disponível após reduções temporárias de máximo.
   * Personagens antigos podem não possuir o campo; nesse caso `max` é usado.
   */
  currentMax?: number
  current: number
  temporary: number
  hitDice: Partial<Record<DieSides, HitDice>>
}