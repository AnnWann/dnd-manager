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
          <div className="flex h-svh flex-col overflow-hidden bg-[color:var(--surface-app)] text-text">
            <AppHeader />

            <div className="flex min-h-0 flex-1">
              <AppSidebar items={sidebarItems} />

              <main className="min-w-0 flex-1 overflow-auto">
                <div className="px-4 py-6">
                  <AppRouter />
                </div>
              </main>
            </div>
          </div>
        </MagicProvider>
      </CharacterProvider>
    </SyncProvider>
  )
}

export default App
