// src/contexts/SyncContext.tsx

import { createContext, useContext, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { SessionRuntimeProvider } from "../features/session-runtime/SessionRuntimeProvider"
import { sessionIdFromPathname } from "../lib/campaignRoutes"
import type { SyncStatus } from "../lib/remoteState"
import type { CampaignUiRole } from "../shared/campaign/campaignRoles"

export type SyncContextValue = {
  syncKey: string
  setSyncKey: (value: string) => void

  userRole: CampaignUiRole
  setUserRole: (value: CampaignUiRole) => void

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

export function SyncProvider({
  value,
  children,
}: {
  value: SyncContextValue
  children: ReactNode
}) {
  const location = useLocation()
  const sessionId = sessionIdFromPathname(location.pathname)
  const content = sessionId && value.userKey.trim() ? (
    <SessionRuntimeProvider
      sessionId={sessionId}
      userId={value.userKey.trim()}
      role={value.userRole === "master" ? "MASTER" : "PLAYER"}
    >
      {children}
    </SessionRuntimeProvider>
  ) : children

  return (
    <SyncContext.Provider value={value}>
      {content}
    </SyncContext.Provider>
  )
}
