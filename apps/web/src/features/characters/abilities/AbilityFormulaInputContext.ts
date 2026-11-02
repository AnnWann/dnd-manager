import { createContext, useContext } from "react"
import type { AbilityManualInput } from "../../../models/abilities/Ability"

export const AbilityFormulaInputContext = createContext<AbilityManualInput[]>([])
export function useAbilityFormulaInputs() { return useContext(AbilityFormulaInputContext) }
