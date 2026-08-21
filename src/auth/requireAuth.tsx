import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { AppLoadingScreen } from "../components/AppLoadingScreen"
import { authClient } from "./auth-client"
import {
  getLocalUser,
  LOCAL_AUTH_BYPASS,
} from "./local-auth"

export function RequireAuth({
  children,
}: {
  children: ReactNode
}) {
  const location = useLocation()
  const { data: session, isPending } = authClient.useSession()

  const localUser =
    LOCAL_AUTH_BYPASS ? getLocalUser() : null

  if (!LOCAL_AUTH_BYPASS && isPending) {
    return (
      <AppLoadingScreen
        title="Verificando autenticação..."
        detail="Confirmando sua sessão."
      />
    )
  }

  if (!session?.user && !localUser) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{
          returnTo: location.pathname,
        }}
      />
    )
  }

  return children
}
