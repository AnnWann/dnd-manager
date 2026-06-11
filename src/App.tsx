import { useLocation, useNavigate } from "react-router-dom"

import {
  AppSidebar,
  IconCharacter,
  IconSync,
  IconMagic,
} from "./components/AppSidebar"

import { AppRouter } from "./Router"
import { CharacterProvider } from "./contexts/characterContext"
import { SyncProvider } from "./contexts/syncContext"
import { useRemoteAppState } from "./lib/remoteState"
import { TopBar } from "./components/AppTopBar"

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
        <div className="min-h-svh bg-[color:var(--social-bg)] text-text">
          <TopBar />

          <div className="flex min-h-[calc(100svh-73px)]">
            <AppSidebar items={sidebarItems} />

            <main className="min-w-0 flex-1 overflow-auto">
              <div className="px-4 py-6">
                <AppRouter />
              </div>
            </main>
          </div>
        </div>
      </CharacterProvider>
    </SyncProvider>
  )
}

export default App