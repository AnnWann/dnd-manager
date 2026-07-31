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
} from "./components/AppSidebar"
import { AppHeader } from "./components/AppTopBar"
import { CharacterProvider } from "./contexts/characterContext"
import { CreatureCompendiumProvider } from "./contexts/creatureCompendiumContext"
import { CustomSystemsProvider } from "./contexts/customSystemsContext"
import { MagicProvider } from "./contexts/magicContext"
import { MissionProvider } from "./contexts/missionContext"
import { PartyInventorySettingsProvider } from "./contexts/partyInventorySettingsContext"
import { SyncProvider } from "./contexts/syncContext"
import { RelationalMigrationBridge } from "./features/sync/RelationalMigrationBridge"
import { normalizeAppStateInventory } from "./lib/normalizeAppStateInventory"
import { type AppStateV1 } from "./lib/remoteState"
import { useConcurrentRemoteAppState } from "./lib/remoteStateConcurrent"
import { AppRouter } from "./Router"

function App() {
  const navigate = useNavigate()
  const location = useLocation()

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
      active: location.pathname === "/sync",
      onClick: () => navigate("/sync"),
    },
    {
      label: "Ficha",
      icon: <IconCharacter />,
      active: location.pathname.startsWith("/character"),
      onClick: () =>
        navigate("/character", { state: { autoOpenLast: true } }),
    },
    {
      label: "Inventário do grupo",
      icon: <IconBackpack />,
      active: location.pathname === "/party-inventory",
      onClick: () => navigate("/party-inventory"),
    },
    {
      label: "Chão",
      icon: <IconGround />,
      active: location.pathname === "/ground-inventory",
      onClick: () => navigate("/ground-inventory"),
    },
    {
      label: "Compêndio de Itens",
      icon: <IconEquipment />,
      active: location.pathname === "/items-compendium",
      onClick: () => navigate("/items-compendium"),
    },
    {
      label: "Missões",
      icon: <IconNotes />,
      active: location.pathname === "/missions",
      onClick: () => navigate("/missions"),
    },
    ...(userRole === "master"
      ? [
          {
            label: "Compêndio de Criaturas",
            icon: <IconCompendium />,
            active: location.pathname === "/creatures-compendium",
            onClick: () => navigate("/creatures-compendium"),
          },
          {
            label: "Sistemas personalizados",
            icon: <IconCompendium />,
            active: location.pathname.startsWith("/custom-systems"),
            onClick: () => navigate("/custom-systems"),
          },
          {
            label: "Iniciativa",
            icon: <IconInitiative />,
            active: location.pathname === "/initiative",
            onClick: () => navigate("/initiative"),
          },
        ]
      : []),
    {
      label: "Magia",
      icon: <IconMagic />,
      active: location.pathname === "/magic",
      onClick: () => navigate("/magic"),
    },
  ]

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

export default App