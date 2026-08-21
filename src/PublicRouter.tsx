import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

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

export function PublicRouter() {
  return (
    <Suspense fallback={<PublicRouteLoading />}>
      <Routes>
        <Route path="/auth" element={<AuthView />} />
        <Route path="/not-found" element={<NotFoundView />} />
        <Route path="/unauthorized" element={<UnauthorizedView />} />
        {SessionRuntimeDevView ? (
          <Route path="/dev/session-runtime/*" element={<SessionRuntimeDevView />} />
        ) : null}
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </Suspense>
  )
}

function PublicRouteLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
      Carregando...
    </div>
  )
}
