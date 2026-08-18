import { LogOut } from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  buildSessionCharacterSnapshots,
  getCampaignSessionCharacters,
} from "../api/campaign-session"
import { authClient } from "../auth/auth-client"
import { getLocalUser, LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import {
  AppSidebar,
  IconBackpack,
  IconCharacter,
  IconCompendium,
  IconEquipment,
  IconGround,
  IconInitiative,
  IconMagic,
  IconNotes,
} from "../components/AppSidebar"
import { AppHeader } from "../components/AppTopBar"
import { CharacterProvider } from "../contexts/characterContext"
import { CreatureCompendiumProvider } from "../contexts/creatureCompendiumContext"
import { CustomSystemsProvider } from "../contexts/customSystemsContext"
import { MagicProvider } from "../contexts/magicContext"
import { MissionProvider } from "../contexts/missionContext"
import { PartyInventorySettingsProvider } from "../contexts/partyInventorySettingsContext"
import { SyncProvider } from "../contexts/syncContext"
import { MasterConcentrationAlerts } from "../features/characters/characterSheet/masterConcentrationAlerts"
import { SessionActionLog } from "../features/session/SessionActionLog"
import { RelationalMigrationBridge } from "../features/sync/RelationalMigrationBridge"
import {
  clearActiveSession,
  readSessionStateOwner,
  rememberSessionStateOwner,
} from "../lib/activeCampaign"
import { sessionIdFromPathname, sessionPath } from "../lib/campaignRoutes"
import { normalizeAppStateInventory } from "../lib/normalizeAppStateInventory"
import { type AppStateV1 } from "../lib/remoteState"
import { useConcurrentRemoteAppState } from "../lib/remoteStateConcurrent"
import { AppRouter } from "../Router"

export function CampaignLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = sessionIdFromPathname(location.pathname)
  const { data: authSession } = authClient.useSession()
  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const authenticatedUserId = authSession?.user?.id ?? localUser?.id ?? ""
  const [resolvedSessionRole, setResolvedSessionRole] = useState<
    "master" | "player" | null
  >(null)
  const [sessionReady, setSessionReady] = useState(!sessionId)
  const [sessionLoadError, setSessionLoadError] = useState("")

  const toSession = useCallback(
    (path: string) => sessionId ? sessionPath(sessionId, path) : "/user/campaigns",
    [sessionId],
  )

  const {
    syncKey,
    setSyncKey,
    userRole,
    setUserRole,
    userKey,
    setUserKey,
    canSync,
    state: rawAppState,
    setState: setRawAppState,
    status: syncStatus,
    pullFromServer,
  } = useConcurrentRemoteAppState()

  const appState = useMemo(
    () => normalizeAppStateInventory(rawAppState),
    [rawAppState],
  )

  const setAppState = useCallback<Dispatch<SetStateAction<AppStateV1>>>(
    (action) => {
      setRawAppState((previousRaw) => {
        const previous = normalizeAppStateInventory(previousRaw)
        const next =
          typeof action === "function"
            ? (action as (state: AppStateV1) => AppStateV1)(previous)
            : action

        return normalizeAppStateInventory(next)
      })
    },
    [setRawAppState],
  )

  useEffect(() => {
    if (!sessionId) {
      setResolvedSessionRole(null)
      setSessionLoadError("")
      setSessionReady(true)
      return
    }

    let cancelled = false
    setSessionReady(false)
    setSessionLoadError("")

    void getCampaignSessionCharacters(sessionId)
      .then((data) => {
        if (cancelled) return

        setResolvedSessionRole(data.campaign.isMaster ? "master" : "player")

        const sourceSnapshots = buildSessionCharacterSnapshots(data)
        const stateBelongsToThisSession = readSessionStateOwner() === sessionId

        setAppState((previous) => {
          const existingById = stateBelongsToThisSession
            ? new Map(previous.characters.map((character) => [character.id, character]))
            : new Map<string, (typeof previous.characters)[number]>()

          const characters = sourceSnapshots.map(
            (source) => existingById.get(source.id) ?? source,
          )
          const activeCharacterId = characters.some(
            (character) => character.id === previous.activeCharacterId,
          )
            ? previous.activeCharacterId
            : characters[0]?.id ?? ""

          const unchanged =
            stateBelongsToThisSession &&
            previous.activeCharacterId === activeCharacterId &&
            previous.characters.length === characters.length &&
            previous.characters.every(
              (character, index) => character.id === characters[index]?.id,
            )

          if (unchanged) return previous

          return {
            ...previous,
            characters,
            activeCharacterId,
          }
        })

        rememberSessionStateOwner(sessionId)
        setSessionReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setResolvedSessionRole(null)
        setSessionLoadError("Não foi possível carregar os personagens vinculados a esta sessão.")
        setSessionReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, setAppState])

  const effectiveUserRole = resolvedSessionRole ?? userRole
  const effectiveUserKey = authenticatedUserId || userKey
  const isCreationMode = Boolean(
    sessionId && location.pathname.startsWith(toSession("creation")),
  )

  useEffect(() => {
    if (!sessionReady || effectiveUserRole === "master" || !isCreationMode) return
    navigate(toSession("characters"), { replace: true })
  }, [effectiveUserRole, isCreationMode, navigate, sessionReady, toSession])

  useEffect(() => {
    if (appState === rawAppState) return
    setRawAppState(appState)
  }, [appState, rawAppState, setRawAppState])

  function leaveSession() {
    clearActiveSession()
    navigate("/user")
  }

  const sessionSidebarItems = [
    {
      label: "Personagens",
      icon: <IconCharacter />,
      active:
        location.pathname === toSession("characters") ||
        location.pathname.startsWith(`${toSession("character")}/`) ||
        location.pathname === toSession("character"),
      onClick: () => navigate(toSession("characters")),
    },
    {
      label: "Inventário do grupo",
      icon: <IconBackpack />,
      active: location.pathname === toSession("party-inventory"),
      onClick: () => navigate(toSession("party-inventory")),
    },
    {
      label: "Chão",
      icon: <IconGround />,
      active: location.pathname === toSession("ground-inventory"),
      onClick: () => navigate(toSession("ground-inventory")),
    },
    {
      label: "Missões",
      icon: <IconNotes />,
      active: location.pathname === toSession("missions"),
      onClick: () => navigate(toSession("missions")),
    },
    ...(effectiveUserRole === "master"
      ? [
          {
            label: "Iniciativa",
            icon: <IconInitiative />,
            active: location.pathname === toSession("initiative"),
            onClick: () => navigate(toSession("initiative")),
          },
        ]
      : []),
  ]

  const creationSidebarItems = [
    {
      label: "Configuração",
      icon: <IconCompendium />,
      active: location.pathname === toSession("creation/settings"),
      onClick: () => navigate(toSession("creation/settings")),
    },
    {
      label: "Solicitações",
      icon: <IconNotes />,
      active: location.pathname === toSession("creation/requests"),
      onClick: () => navigate(toSession("creation/requests")),
    },
    {
      label: "Homebrew",
      icon: <IconCompendium />,
      active: location.pathname === toSession("creation/homebrew"),
      onClick: () => navigate(toSession("creation/homebrew")),
    },
    {
      label: "Compêndio de Itens",
      icon: <IconEquipment />,
      active: location.pathname === toSession("creation/items-compendium"),
      onClick: () => navigate(toSession("creation/items-compendium")),
    },
    {
      label: "Compêndio de Criaturas",
      icon: <IconCompendium />,
      active: location.pathname === toSession("creation/creatures-compendium"),
      onClick: () => navigate(toSession("creation/creatures-compendium")),
    },
    {
      label: "Sistemas personalizados",
      icon: <IconCompendium />,
      active: location.pathname.startsWith(toSession("creation/custom-systems")),
      onClick: () => navigate(toSession("creation/custom-systems")),
    },
    {
      label: "Magia",
      icon: <IconMagic />,
      active: location.pathname === toSession("creation/magic"),
      onClick: () => navigate(toSession("creation/magic")),
    },
  ]

  const sidebarItems = [
    ...(effectiveUserRole === "master" && isCreationMode
      ? creationSidebarItems
      : sessionSidebarItems),
    {
      label: "Sair da sessão",
      icon: <LogOut />,
      active: false,
      onClick: leaveSession,
    },
  ]

  const modeSwitcher = effectiveUserRole === "master" ? (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1">
      <button
        type="button"
        onClick={() => navigate(toSession("characters"))}
        className={
          !isCreationMode
            ? "rounded-md bg-accentBg px-2 py-2 text-xs font-semibold text-textH"
            : "rounded-md px-2 py-2 text-xs font-medium text-textMuted hover:bg-bg-subtle hover:text-textH"
        }
      >
        Sessão
      </button>
      <button
        type="button"
        onClick={() => navigate(toSession("creation/settings"))}
        className={
          isCreationMode
            ? "rounded-md bg-accentBg px-2 py-2 text-xs font-semibold text-textH"
            : "rounded-md px-2 py-2 text-xs font-medium text-textMuted hover:bg-bg-subtle hover:text-textH"
        }
      >
        Criação
      </button>
    </div>
  ) : undefined

  const NoSideBar = ["/auth", "/not-found"].includes(location.pathname)

  if (NoSideBar) {
    return (
      <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
        <AppRouter />
      </div>
    )
  }

  if (sessionId && !sessionReady) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[color:var(--surface-app)] text-sm text-textMuted">
        Carregando sessão...
      </div>
    )
  }

  if (sessionId && sessionLoadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[color:var(--surface-app)] p-4">
        <div className="max-w-lg rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {sessionLoadError}
        </div>
      </div>
    )
  }

  return (
    <SyncProvider
      value={{
        syncKey,
        setSyncKey,
        userRole: effectiveUserRole,
        setUserRole,
        userKey: effectiveUserKey,
        setUserKey,
        canSync,
        pullFromServer,
        syncStatus,
      }}
    >
      <CustomSystemsProvider>
        <RelationalMigrationBridge state={appState} />
        <PartyInventorySettingsProvider
          carryCapacity={appState.partyCarryCapacity ?? 0}
          additionalSupplyConsumption={
            (
              appState as AppStateV1 & {
                partyAdditionalSupplyConsumption?: number
              }
            ).partyAdditionalSupplyConsumption ?? 0
          }
          canEditCarryCapacity={effectiveUserRole === "master"}
          setAppState={setAppState}
        >
          <MissionProvider
            state={rawAppState}
            setState={setRawAppState}
            userRole={effectiveUserRole}
            userKey={effectiveUserKey}
          >
            <CreatureCompendiumProvider>
              <CharacterProvider
                appState={appState}
                setAppState={setAppState}
                userRole={effectiveUserRole}
                userKey={effectiveUserKey}
              >
                <MasterConcentrationAlerts />
                <MagicProvider
                  spells={appState.spells ?? []}
                  setAppState={setAppState}
                >
                  <div className="fixed inset-0 flex w-full max-w-full flex-col overflow-hidden bg-[color:var(--surface-app)] text-text">
                    <AppHeader />

                    <div className="flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
                      <AppSidebar items={sidebarItems} topContent={modeSwitcher} />
                      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto has-[[aria-modal=true]]:overflow-y-hidden">
                        <div className="w-full min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
                          <AppRouter />
                        </div>
                      </main>
                      {effectiveUserRole === "master" && !isCreationMode ? (
                        <SessionActionLog />
                      ) : null}
                    </div>
                  </div>
                </MagicProvider>
              </CharacterProvider>
            </CreatureCompendiumProvider>
          </MissionProvider>
        </PartyInventorySettingsProvider>
      </CustomSystemsProvider>
    </SyncProvider>
  )
}
