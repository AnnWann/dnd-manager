import { useEffect } from "react"
import { Outlet, useParams } from "react-router-dom"

import { authClient } from "../../auth/auth-client"
import { getLocalUser } from "../../auth/local-auth"
import { useSyncContext } from "../../contexts/syncContext"
import { rememberActiveSession } from "../../lib/activeCampaign"
import { SessionRuntimeProvider } from "./SessionRuntimeProvider"

export function SessionRouteOutlet() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const { userRole } = useSyncContext()
  const { data: authSession } = authClient.useSession()
  const localUser = getLocalUser()
  const userId = authSession?.user?.id ?? localUser?.id

  useEffect(() => {
    if (campaignId) rememberActiveSession(campaignId)
  }, [campaignId])

  if (!campaignId || !userId) return <Outlet />

  return (
    <SessionRuntimeProvider
      sessionId={campaignId}
      userId={userId}
      role={userRole === "master" ? "MASTER" : "PLAYER"}
    >
      <Outlet />
    </SessionRuntimeProvider>
  )
}
