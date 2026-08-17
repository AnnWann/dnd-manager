import { LogOut } from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"

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
import { RelationalMigrationBridge } from "../features/sync/RelationalMigrationBridge"
import { clearActiveSession } from "../lib/activeCampaign"
import { sessionIdFromPathname, sessionPath } from "../lib/campaignRoutes"
import { normalizeAppStateInventory } from "../lib/normalizeAppStateInventory"
import { type AppStateV1 } from "../lib/remoteState"
import { useConcurrentRemoteAppState } from "../lib/remoteStateConcurrent"
import { AppRouter } from "../Router"

export function CampaignLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = sessionIdFromPathname(location.pathname)
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
    if (appState === rawAppState) return
    setRawAppState(appState)
  }, [appState, rawAppState, setRawAppState])

  function leaveSession() {
    clearActiveSession()
    navigate("/user")
  }

  const sidebarItems = [
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
    ...(userRole === "master"
      ? [
          {
            label: "Compêndio de Itens",
            icon: <IconEquipment />,
            active: location.pathname === toSession("items-compendium"),
            onClick: () => navigate(toSession("items-compendium")),
          },
          {
            label: "Compêndio de Criaturas",
            icon: <IconCompendium />,
            active: location.pathname === toSession("creatures-compendium"),
            onClick: () => navigate(toSession("creatures-compendium")),
          },
          {
            label: "Sistemas personalizados",
            icon: <IconCompendium />,
            active: location.pathname.startsWith(toSession("custom-systems")),
            onClick: () => navigate(toSession("custom-systems")),
          },
          {
            label: "Iniciativa",
            icon: <IconInitiative />,
            active: location.pathname === toSession("initiative"),
            onClick: () => navigate(toSession("initiative")),
          },
        ]
      : []),
    {
      label: "Magia",
      icon: <IconMagic />,
      active: location.pathname === toSession("magic"),
      onClick: () => navigate(toSession("magic")),
    },
    {
      label: "Sair da sessão",
      icon: <LogOut />,
      active: false,
      onClick: leaveSession,
    },
  ]

  const NoSideBar = ["/auth", "/not-found"].includes(location.pathname)

  if (NoSideBar) {
    return (
      <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
        <AppRouter />
      </div>
    )
  }

  return (
    <SyncProvider
      value={{
        syncKey,
        setSyncKey,
        userRole,
        setUserRole,
        userKey,
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
          canEditCarryCapacity={userRole === "master"}
          setAppState={setAppState}
        >
          <MissionProvider
            state={rawAppState}
            setState={setRawAppState}
            userRole={userRole}
            userKey={userKey}
          >
            <CreatureCompendiumProvider>
              <CharacterProvider
                appState={appState}
                setAppState={setAppState}
                userRole={userRole}
                userKey={userKey}
              >
                <MasterConcentrationAlerts />
                <MagicProvider
                  spells={appState.spells ?? []}
                  setAppState={setAppState}
                >
                  <div className="fixed inset-0 flex w-full max-w-full flex-col overflow-hidden bg-[color:var(--surface-app)] text-text">
                    <AppHeader />

                    <div className="flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
                      <AppSidebar items={sidebarItems} />
                      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto has-[[aria-modal=true]]:overflow-y-hidden">
                        <div className="w-full min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
                          <AppRouter />
                        </div>
                      </main>
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
