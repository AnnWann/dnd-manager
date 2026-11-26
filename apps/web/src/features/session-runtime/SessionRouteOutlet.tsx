import { useEffect, useState } from "react"
import { Outlet, useLocation, useParams } from "react-router-dom"

import { getCreationSnapshot } from "../../api/creation"
import { authClient } from "../../auth/auth-client"
import { getLocalUser } from "../../auth/local-auth"
import { useCharacterContext } from "../../contexts/characterContext"
import { SessionMissionAuthorityProvider } from "../../contexts/missionContext"
import { useSyncContext } from "../../contexts/syncContext"
import { SESSION_CONTENT_CHANGED_EVENT } from "../../lib/sessionEvents"
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
  const [contentRevision, setContentRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setContentRevision(revision => revision + 1)
    window.addEventListener(SESSION_CONTENT_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SESSION_CONTENT_CHANGED_EVENT, refresh)
  }, [])
  const { visibleCharacters } = useCharacterContext()
  // CharacterTemplate instances can be updated while the surrounding
  // collection keeps the same reference. Recompute spell references on every
  // render so newly hydrated/imported magic domains are published to the
  // authoritative session configuration.
  const referencedSpellIndexes = collectSessionReferencedSpellIndexes(visibleCharacters)
  const spellReferenceKey = sessionSpellReferenceKey(referencedSpellIndexes)

  useEffect(() => {
    if (runtime?.role !== "MASTER" || runtime.status !== "connected") return
    let cancelled = false

    // A MASTER is the publisher of the authoritative runtime configuration.
    // Do not seed the session server from an arbitrarily old SPA cache.
    void getCreationSnapshot(campaignId, { force: true })
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
    contentRevision,
    runtime?.publishRuntimeConfig,
    runtime?.role,
    runtime?.status,
    spellReferenceKey,
  ])

  return null
}
