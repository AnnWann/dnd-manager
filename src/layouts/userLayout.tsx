import { lazy, Suspense, type ReactNode } from "react"
import { useLocation } from "react-router-dom"

import { RequireAuth } from "../auth/requireAuth"
import { UserContextBoundary } from "../features/user/UserContextBoundary"
import { UserDataProvider } from "../features/user/UserDataProvider"
import { AppRouter } from "../Router"

const LazyUserMagicProvider = lazy(() =>
  import("../features/magic/UserMagicProvider").then((module) => ({
    default: module.UserMagicProvider,
  })),
)

export function UserLayout() {
  const location = useLocation()
  const content = (
    <UserContextBoundary>
      <AppRouter />
    </UserContextBoundary>
  )

  return (
    <RequireAuth>
      <UserDataProvider>
        {routeNeedsMagicRuntime(location.pathname) ? (
          <Suspense fallback={<UserRuntimeLoading />}>
            <LazyUserMagicProvider>{content}</LazyUserMagicProvider>
          </Suspense>
        ) : (
          content
        )}
      </UserDataProvider>
    </RequireAuth>
  )
}

function routeNeedsMagicRuntime(pathname: string): boolean {
  if (pathname.startsWith("/user/spells")) return true

  return (
    pathname.startsWith("/user/characters/") &&
    pathname !== "/user/characters/"
  )
}

function UserRuntimeLoading(): ReactNode {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
      <div className="text-center">
        <div className="font-medium text-textH">Preparando seu ambiente...</div>
        <div className="mt-1 text-xs text-textMuted">Carregando recursos da ficha.</div>
      </div>
    </div>
  )
}
