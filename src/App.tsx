import { lazy, Suspense } from "react"
import { useLocation } from "react-router-dom"

const PublicLayout = lazy(() =>
  import("./layouts/publicLayout").then((module) => ({
    default: module.PublicLayout,
  })),
)

const UserLayout = lazy(() =>
  import("./layouts/userLayout").then((module) => ({
    default: module.UserLayout,
  })),
)

const CampaignLayout = lazy(() =>
  import("./layouts/campaignLayout").then((module) => ({
    default: module.CampaignLayout,
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
      ) : usesUserLayout ? (
        <UserLayout />
      ) : (
        <CampaignLayout />
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
