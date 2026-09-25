import { useEffect, useMemo } from "react"
import { Outlet, useLocation, useParams } from "react-router-dom"

import { getCreationSnapshot } from "../../api/creation"
import { authClient } from "../../auth/auth-client"
import { getLocalUser } from "../../auth/local-auth"
import { useCharacterContext } from "../../contexts/characterContext"
import { SessionMissionAuthorityProvider } from "../../contexts/missionContext"
import { useSyncContext } from "../../contexts/syncContext"
import { rememberActiveSession } from "../../lib/activeCampaign"
import {
  buildSessionRuntimeConfigSnapshot,
  collectSessionReferencedSpellIndexes,
  sessionSpellReferenceKey,
} from "./buildSessionRuntimeConfig"
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
  const isSettingsRoute =
    location.pathname.replace(/\/+$/, "") ===
    `/session/${encodedCampaignId}/creation/settings`

  return (
    <SessionRuntimeProvider
      sessionId={campaignId}
      userId={userId}
      role={userRole === "master" ? "MASTER" : "PLAYER"}
    >
      {userRole === "master" ? (
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
  const { visibleCharacters } = useCharacterContext()
  const referencedSpellIndexes = useMemo(
    () => collectSessionReferencedSpellIndexes(visibleCharacters),
    [visibleCharacters],
  )
  const spellReferenceKey = sessionSpellReferenceKey(referencedSpellIndexes)

  useEffect(() => {
    if (runtime?.role !== "MASTER" || runtime.status !== "connected") return
    let cancelled = false

    void getCreationSnapshot(campaignId)
      .then((snapshot) =>
        buildSessionRuntimeConfigSnapshot({
          creationRevision: snapshot.revision,
          creation: snapshot.data,
          referencedSpellIndexes,
        }),
      )
      .then((snapshot) => {
        if (!cancelled) runtime.publishRuntimeConfig(snapshot)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[session-runtime] failed to publish Creation config", error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    campaignId,
    runtime?.publishRuntimeConfig,
    runtime?.role,
    runtime?.status,
    spellReferenceKey,
  ])

  return null
}
