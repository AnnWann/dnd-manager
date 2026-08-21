import { lazy, Suspense } from "react"
import { useLocation } from "react-router-dom"

const PublicLayout = lazy(() =>
  import("./layouts/publicLayout").then((module) => ({
    default: module.PublicLayout,
  })),
)

const AuthenticatedLayout = lazy(() =>
  import("./layouts/authenticatedLayout").then((module) => ({
    default: module.AuthenticatedLayout,
  })),
)

function App() {
  const location = useLocation()

  const usesPublicLayout =
    location.pathname.startsWith("/auth") ||
    (import.meta.env.DEV && location.pathname.startsWith("/dev/session-runtime")) ||
    location.pathname === "/not-found" ||
    location.pathname === "/unauthorized"

  const usesUserLayout = location.pathname.startsWith("/user")

  return (
    <Suspense fallback={<AppLoading />}>
      {usesPublicLayout ? (
        <PublicLayout />
      ) : (
        <AuthenticatedLayout mode={usesUserLayout ? "user" : "campaign"} />
      )}
    </Suspense>
  )
}

function AppLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
      <div className="text-center">
        <div className="font-medium text-textH">Preparando seu ambiente...</div>
        <div className="mt-1 text-xs text-textMuted">Carregando a aplicação.</div>
      </div>
    </div>
  )
}

export default App
