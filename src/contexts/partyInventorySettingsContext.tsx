import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import type { AppStateV1 } from "../lib/remoteState"

export type PartyInventoryAppState = AppStateV1 & {
  partyAdditionalSupplyConsumption?: number
}

type PartyInventorySettingsContextValue = {
  carryCapacity: number
  canEditCarryCapacity: boolean
  setCarryCapacity: (value: number) => void
  additionalSupplyConsumption: number
  canEditAdditionalSupplyConsumption: boolean
  setAdditionalSupplyConsumption: (value: number) => void
}

type Props = {
  children: ReactNode
  carryCapacity: number
  additionalSupplyConsumption: number
  canEditCarryCapacity: boolean
  setAppState: Dispatch<SetStateAction<PartyInventoryAppState>>
}

const PartyInventorySettingsContext =
  createContext<PartyInventorySettingsContextValue | null>(null)

export function PartyInventorySettingsProvider({
  children,
  carryCapacity,
  additionalSupplyConsumption,
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

  function setAdditionalSupplyConsumption(value: number) {
    if (!canEditCarryCapacity) return

    const nextConsumption = Number.isFinite(value)
      ? Math.max(0, value)
      : 0

    setAppState((previous) => ({
      ...previous,
      partyAdditionalSupplyConsumption: nextConsumption,
    }))
  }

  return (
    <PartyInventorySettingsContext.Provider
      value={{
        carryCapacity: Math.max(0, carryCapacity),
        canEditCarryCapacity,
        setCarryCapacity,
        additionalSupplyConsumption: Math.max(0, additionalSupplyConsumption),
        canEditAdditionalSupplyConsumption: canEditCarryCapacity,
        setAdditionalSupplyConsumption,
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
