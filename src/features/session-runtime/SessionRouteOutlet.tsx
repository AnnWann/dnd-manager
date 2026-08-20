import { useEffect, type ReactNode } from "react"
import { Outlet, useLocation, useParams } from "react-router-dom"

import { authClient } from "../../auth/auth-client"
import { getLocalUser } from "../../auth/local-auth"
import { SessionMissionAuthorityProvider } from "../../contexts/missionContext"
import { useSyncContext } from "../../contexts/syncContext"
import { CreationEditorProvider } from "../creation/CreationEditorProvider"
import { rememberActiveSession } from "../../lib/activeCampaign"
import { SessionRuntimeProvider } from "./SessionRuntimeProvider"

export function SessionRouteOutlet() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const location = useLocation()
  const { userRole } = useSyncContext()
  const { data: authSession } = authClient.useSession()
  const localUser = getLocalUser()
  const userId = authSession?.user?.id ?? localUser?.id

  useEffect(() => {
    if (campaignId) rememberActiveSession(campaignId)
  }, [campaignId])

  if (!campaignId || !userId) return <Outlet />

  const isCreationRoute = location.pathname.startsWith(
    `/session/${encodeURIComponent(campaignId)}/creation`,
  )

  const routeContent = (
    <SessionMissionAuthorityProvider>
      <Outlet />
    </SessionMissionAuthorityProvider>
  )

  return (
    <SessionRuntimeProvider
      sessionId={campaignId}
      userId={userId}
      role={userRole === "master" ? "MASTER" : "PLAYER"}
    >
      {isCreationRoute && userRole === "master" ? (
        <CreationRouteEditor campaignId={campaignId}>
          {routeContent}
        </CreationRouteEditor>
      ) : routeContent}
    </SessionRuntimeProvider>
  )
}

function CreationRouteEditor({
  campaignId,
  children,
}: {
  campaignId: string
  children: ReactNode
}) {
  return (
    <CreationEditorProvider campaignId={campaignId}>
      {children}
    </CreationEditorProvider>
  )
}
