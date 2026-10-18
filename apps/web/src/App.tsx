import { lazy, Suspense, type ReactNode } from "react"
import { useLocation } from "react-router-dom"

import { AppLoadingScreen } from "./components/AppLoadingScreen"

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
  const isPublicPath =
    path === "/auth" ||
    path === "/not-found" ||
    path === "/unauthorized" ||
    (import.meta.env.DEV && path.startsWith("/dev/session-runtime/"))

  return (
    <Suspense
      fallback={
        isPublicPath ? (
          <AppLoadingScreen
            title="Carregando aplicação..."
            detail="Preparando a página."
          />
        ) : (
          <AppLoadingScreen
            title="Verificando autenticação..."
            detail="Confirmando sua sessão."
          />
        )
      }
    >
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

function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      {children}
    </div>
  )
}

export default App
