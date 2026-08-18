import { lazy, Suspense } from "react"

import { useSyncContext } from "../contexts/syncContext"

const InitiativeView = lazy(() =>
  import("./InitiativeView").then((module) => ({ default: module.InitiativeView })),
)
const InitiativePlayerView = lazy(() =>
  import("./InitiativePlayerView").then((module) => ({ default: module.InitiativePlayerView })),
)

export function InitiativeRoleView() {
  const { userRole } = useSyncContext()

  return (
    <Suspense fallback={<RouteLoading />}>
      {userRole === "master" ? <InitiativeView /> : <InitiativePlayerView />}
    </Suspense>
  )
}

function RouteLoading() {
  return (
    <div className="grid min-h-[12rem] place-items-center text-sm text-textMuted">
      Carregando...
    </div>
  )
}
