import { useLocation } from "react-router-dom"

import { AppRouter } from "../Router"
import { SessionRuntimeDevView } from "../views/dev/SessionRuntimeDevView"

export function PublicLayout() {
  const location = useLocation()
  const isSessionRuntimeDevRoute =
    import.meta.env.DEV &&
    location.pathname.startsWith("/dev/session-runtime/")

  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      {isSessionRuntimeDevRoute ? <SessionRuntimeDevView /> : <AppRouter />}
    </div>
  )
}