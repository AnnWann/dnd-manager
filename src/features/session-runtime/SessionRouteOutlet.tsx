import { useEffect } from "react"
import { Outlet, useLocation, useParams } from "react-router-dom"

import { getCreationSnapshot } from "../../api/creation"
import { authClient } from "../../auth/auth-client"
import { getLocalUser } from "../../auth/local-auth"
import { SessionMissionAuthorityProvider } from "../../contexts/missionContext"
import { useSyncContext } from "../../contexts/syncContext"
import { rememberActiveSession } from "../../lib/activeCampaign"
import { toSessionRuntimeConfig } from "../../shared/session-runtime/sessionRuntimeConfig"
import { SessionAuthoritativeBootstrap } from "./SessionAuthoritativeBootstrap"
import { SessionRenameControl } from "./SessionRenameControl"
import {
  SessionRuntimeProvider,
  useOptionalSessionRuntime,
} from "./SessionRuntimeProvider"

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

  const encodedCampaignId = encodeURIComponent(campaignId)
  const isCreationRoute = location.pathname.startsWith(
    `/session/${encodedCampaignId}/creation`,
  )
  const isSettingsRoute =
    location.pathname.replace(/\/+$/, "") ===
    `/session/${encodedCampaignId}/creation/settings`

  return (
    <SessionRuntimeProvider
      sessionId={campaignId}
      userId={userId}
      role={userRole === "master" ? "MASTER" : "PLAYER"}
    >
      {userRole === "master" && !isCreationRoute ? (
        <MasterRuntimeConfigPublisher campaignId={campaignId} />
      ) : null}
      <SessionAuthoritativeBootstrap campaignId={campaignId} />
      <SessionMissionAuthorityProvider>
        {userRole === "master" && isSettingsRoute ? (
          <SessionRenameControl campaignId={campaignId} />
        ) : null}
        <Outlet />
      </SessionMissionAuthorityProvider>
    </SessionRuntimeProvider>
  )
}

function MasterRuntimeConfigPublisher({ campaignId }: { campaignId: string }) {
  const runtime = useOptionalSessionRuntime()

  useEffect(() => {
    if (runtime?.role !== "MASTER" || runtime.status !== "connected") return
    let cancelled = false

    void getCreationSnapshot(campaignId)
      .then((snapshot) => {
        if (cancelled) return
        runtime.publishRuntimeConfig({
          creationRevision: snapshot.revision,
          config: toSessionRuntimeConfig(snapshot.data),
        })
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[session-runtime] failed to publish Creation config", error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [campaignId, runtime?.publishRuntimeConfig, runtime?.role, runtime?.status])

  return null
}
