import { lazy, Suspense } from "react"
import { useLocation } from "react-router-dom"

const AuthView = lazy(() =>
  import("./views/AuthView").then((module) => ({ default: module.AuthView })),
)
const NotFoundView = lazy(() =>
  import("./views/NotFoundView").then((module) => ({ default: module.NotFoundView })),
)
const UnauthorizedView = lazy(() =>
  import("./views/UnauthorisedView").then((module) => ({
    default: module.UnauthorizedView,
  })),
)
const SessionRuntimeDevView = import.meta.env.DEV
  ? lazy(() =>
      import("./views/dev/SessionRuntimeDevView").then((module) => ({
        default: module.SessionRuntimeDevView,
      })),
    )
  : null
const AuthenticatedLayout = lazy(() =>
  import("./layouts/authenticatedLayout").then((module) => ({
    default: module.AuthenticatedLayout,
  })),
)

function App() {
  const location = useLocation()
  const path = location.pathname

  return (
    <Suspense fallback={<AppLoading />}>
      {path === "/auth" ? (
        <PublicPage>
          <AuthView />
        </PublicPage>
      ) : path === "/not-found" ? (
        <PublicPage>
          <NotFoundView />
        </PublicPage>
      ) : path === "/unauthorized" ? (
        <PublicPage>
          <UnauthorizedView />
        </PublicPage>
      ) : import.meta.env.DEV &&
        SessionRuntimeDevView &&
        path.startsWith("/dev/session-runtime/") ? (
        <PublicPage>
          <SessionRuntimeDevView />
        </PublicPage>
      ) : (
        <AuthenticatedLayout mode={path.startsWith("/user") ? "user" : "campaign"} />
      )}
    </Suspense>
  )
}

function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      {children}
    </div>
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
