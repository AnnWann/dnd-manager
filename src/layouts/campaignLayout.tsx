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
  IconSync,
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
import { CharacterRelationalPersistenceBridge } from "../features/sync/CharacterRelationalPersistenceBridge"
import { RelationalMigrationBridge } from "../features/sync/RelationalMigrationBridge"
import { campaignIdFromPathname, campaignPath } from "../lib/campaignRoutes"
import { normalizeAppStateInventory } from "../lib/normalizeAppStateInventory"
import { type AppStateV1 } from "../lib/remoteState"
import { useConcurrentRemoteAppState } from "../lib/remoteStateConcurrent"
import { AppRouter } from "../Router"

export function CampaignLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const campaignId = campaignIdFromPathname(location.pathname)
  const toCampaign = useCallback(
    (path: string) => campaignId ? campaignPath(campaignId, path) : "/user/campaigns",
    [campaignId],
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

  const sidebarItems = [
    {
      label: "Sync",
      icon: <IconSync />,
      active: location.pathname === toCampaign("sync"),
      onClick: () => navigate(toCampaign("sync")),
    },
    {
      label: "Ficha",
      icon: <IconCharacter />,
      active: location.pathname.startsWith(toCampaign("character")),
      onClick: () =>
        navigate(toCampaign("character"), { state: { autoOpenLast: true } }),
    },
    {
      label: "Inventário do grupo",
      icon: <IconBackpack />,
      active: location.pathname === toCampaign("party-inventory"),
      onClick: () => navigate(toCampaign("party-inventory")),
    },
    {
      label: "Chão",
      icon: <IconGround />,
      active: location.pathname === toCampaign("ground-inventory"),
      onClick: () => navigate(toCampaign("ground-inventory")),
    },
    {
      label: "Missões",
      icon: <IconNotes />,
      active: location.pathname === toCampaign("missions"),
      onClick: () => navigate(toCampaign("missions")),
    },
    ...(userRole === "master"
      ? [
          {
            label: "Compêndio de Itens",
            icon: <IconEquipment />,
            active: location.pathname === toCampaign("items-compendium"),
            onClick: () => navigate(toCampaign("items-compendium")),
          },
          {
            label: "Compêndio de Criaturas",
            icon: <IconCompendium />,
            active: location.pathname === toCampaign("creatures-compendium"),
            onClick: () => navigate(toCampaign("creatures-compendium")),
          },
          {
            label: "Sistemas personalizados",
            icon: <IconCompendium />,
            active: location.pathname.startsWith(toCampaign("custom-systems")),
            onClick: () => navigate(toCampaign("custom-systems")),
          },
          {
            label: "Iniciativa",
            icon: <IconInitiative />,
            active: location.pathname === toCampaign("initiative"),
            onClick: () => navigate(toCampaign("initiative")),
          },
        ]
      : []),
    {
      label: "Magia",
      icon: <IconMagic />,
      active: location.pathname === toCampaign("magic"),
      onClick: () => navigate(toCampaign("magic")),
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
        <CharacterRelationalPersistenceBridge
          state={appState}
          syncKey={syncKey}
          actorKey={userKey.trim() || userRole}
        />
        <PartyInventorySettingsProvider
          carryCapacity={appState.partyCarryCapacity ?? 0}
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
