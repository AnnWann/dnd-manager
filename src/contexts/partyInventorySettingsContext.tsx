import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { readSyncKey, type AppStateV1 } from "../lib/remoteState"

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
  canEditCarryCapacity: boolean
  setAppState: Dispatch<SetStateAction<AppStateV1>>
}

const PartyInventorySettingsContext =
  createContext<PartyInventorySettingsContextValue | null>(null)

function storageKey() {
  const syncKey = readSyncKey().trim()
  return `dndmm.partyAdditionalSupplyConsumption.v1:${syncKey || "local"}`
}

function readAdditionalSupplyConsumption(): number {
  if (typeof window === "undefined") return 0
  const parsed = Number(window.localStorage.getItem(storageKey()))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function PartyInventorySettingsProvider({
  children,
  carryCapacity,
  canEditCarryCapacity,
  setAppState,
}: Props) {
  const [additionalSupplyConsumption, setAdditionalSupplyConsumptionState] =
    useState(readAdditionalSupplyConsumption)

  useEffect(() => {
    setAdditionalSupplyConsumptionState(readAdditionalSupplyConsumption())
  }, [])

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
    const next = Number.isFinite(value) ? Math.max(0, value) : 0
    setAdditionalSupplyConsumptionState(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(), String(next))
    }
  }

  const value = useMemo<PartyInventorySettingsContextValue>(() => ({
    carryCapacity: Math.max(0, carryCapacity),
    canEditCarryCapacity,
    setCarryCapacity,
    additionalSupplyConsumption,
    canEditAdditionalSupplyConsumption: canEditCarryCapacity,
    setAdditionalSupplyConsumption,
  }), [carryCapacity, canEditCarryCapacity, additionalSupplyConsumption])

  return (
    <PartyInventorySettingsContext.Provider value={value}>
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
