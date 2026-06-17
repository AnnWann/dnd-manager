// src/contexts/SyncContext.tsx

import { createContext, useContext } from "react"
import type { SyncStatus } from "../lib/remoteState"

export type SyncContextValue = {
  syncKey: string
  setSyncKey: (value: string) => void

  userRole: "master" | "player"
  setUserRole: (value: "master" | "player") => void

  userKey: string
  setUserKey: (value: string) => void

  canSync: boolean
  pullFromServer: () => void | Promise<void>
  syncStatus: SyncStatus
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useSyncContext() {
  const ctx = useContext(SyncContext)

  if (!ctx) {
    throw new Error("useSyncContext must be used inside SyncProvider")
  }

  return ctx
}

export const SyncProvider = SyncContext.Provider