import {
  createContext,
  useContext,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
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
  const runtime = useOptionalSessionRuntime()
  const normalizedCarryCapacity = Math.max(0, carryCapacity)
  const normalizedAdditionalSupplyConsumption = Math.max(
    0,
    additionalSupplyConsumption,
  )

  useEffect(() => {
    if (
      !canEditCarryCapacity ||
      !runtime ||
      runtime.role !== "MASTER" ||
      runtime.status !== "connected" ||
      !runtime.inventoryState?.initialized
    ) {
      return
    }

    const missingCarryCapacity = runtime.inventoryState.carryCapacity === undefined
    const missingAdditionalSupplyConsumption =
      runtime.inventoryState.additionalSupplyConsumption === undefined
    if (!missingCarryCapacity && !missingAdditionalSupplyConsumption) return

    // Older session inventory snapshots did not persist these settings. Reuse
    // the idempotent MASTER bootstrap to fill only missing fields, without
    // fabricating normal user-change log entries during migration.
    runtime.initializeInventory(
      runtime.inventoryState.partyInventory,
      runtime.inventoryState.groundInventory,
      {
        carryCapacity: normalizedCarryCapacity,
        additionalSupplyConsumption: normalizedAdditionalSupplyConsumption,
      },
    )
  }, [
    canEditCarryCapacity,
    normalizedAdditionalSupplyConsumption,
    normalizedCarryCapacity,
    runtime,
  ])

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
        carryCapacity: normalizedCarryCapacity,
        canEditCarryCapacity,
        setCarryCapacity,
        additionalSupplyConsumption: normalizedAdditionalSupplyConsumption,
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
