import { useLocation, useNavigate } from "react-router-dom"

import {
  AppSidebar,
  IconBackpack,
  IconCharacter,
  IconMagic,
  IconSync,
} from "./components/AppSidebar"
import { AppHeader } from "./components/AppTopBar"
import { CharacterProvider } from "./contexts/characterContext"
import { MagicProvider } from "./contexts/magicContext"
import { PartyInventorySettingsProvider } from "./contexts/partyInventorySettingsContext"
import { SyncProvider } from "./contexts/syncContext"
import { useRemoteAppState } from "./lib/remoteState"
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
    state: appState,
    setState: setAppState,
    status: syncStatus,
    pullFromServer,
  } = useRemoteAppState()

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
      active: location.pathname === "/character",
      onClick: () => navigate("/character"),
    },
    {
      label: "Inventário do grupo",
      icon: <IconBackpack />,
      active: location.pathname === "/party-inventory",
      onClick: () => navigate("/party-inventory"),
    },
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
      <PartyInventorySettingsProvider
        carryCapacity={appState.partyCarryCapacity ?? 0}
        canEditCarryCapacity={userRole === "master"}
        setAppState={setAppState}
      >
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
            <div className="flex h-svh max-w-full flex-col overflow-hidden bg-[color:var(--surface-app)] text-text">
              <AppHeader />

              <div className="flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
                <AppSidebar items={sidebarItems} />

                <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto">
                  <div className="w-full min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
                    <AppRouter />
                  </div>
                </main>
              </div>
            </div>
          </MagicProvider>
        </CharacterProvider>
      </PartyInventorySettingsProvider>
    </SyncProvider>
  )
}

export default App
