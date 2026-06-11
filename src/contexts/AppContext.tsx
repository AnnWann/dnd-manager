import { createContext, useContext } from "react"
import type { CharacterTemplate } from "../models/characters/CharacterTemplate"

export type AppContextValue = {
  activeCharacter: CharacterTemplate
  visibleCharacters: CharacterTemplate[]
  updateCharacter: (character: CharacterTemplate) => void
  addCharacter: () => void
  deleteCharacter: (id: string) => void
  setSelectedCharacterId: (id: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppContext must be used inside AppContext.Provider")
  return ctx
}

export const AppProvider = AppContext.Provider