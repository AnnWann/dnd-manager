/** Shared wire contract for HP resolution in initiative operations. */
export type InitiativeHpApplicationResult = {
  entryId: string
  requested: number
  applied: number
  absorbedTemporary: number
  hpDelta: number
  concentrationCharacterId?: string
  concentrationDc?: number
  concentrationSource?: string
}
