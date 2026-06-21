import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import type { AppStateV1 } from "../lib/remoteState"

type PartyInventorySettingsContextValue = {
  carryCapacity: number
  canEditCarryCapacity: boolean
  setCarryCapacity: (value: number) => void
}

type Props = {
  children: ReactNode
  carryCapacity: number
  canEditCarryCapacity: boolean
  setAppState: Dispatch<SetStateAction<AppStateV1>>
}

const PartyInventorySettingsContext =
  createContext<PartyInventorySettingsContextValue | null>(null)

export function PartyInventorySettingsProvider({
  children,
  carryCapacity,
  canEditCarryCapacity,
  setAppState,
}: Props) {
  function setCarryCapacity(value: number) {
    if (!canEditCarryCapacity) return

    const nextCapacity = Number.isFinite(value)
      ? Math.max(0, value)
      : 0

    setAppState((previous) => ({
      ...previous,
      partyCarryCapacity: nextCapacity,
    }))
  }

  return (
    <PartyInventorySettingsContext.Provider
      value={{
        carryCapacity: Math.max(0, carryCapacity),
        canEditCarryCapacity,
        setCarryCapacity,
      }}
    >
      {children}
    </PartyInventorySettingsContext.Provider>
  )
}

export function usePartyInventorySettings() {
  const context = useContext(PartyInventorySettingsContext)

  if (!context) {
    throw new Error(
      "usePartyInventorySettings must be used inside PartyInventorySettingsProvider",
    )
  }

  return context
}
