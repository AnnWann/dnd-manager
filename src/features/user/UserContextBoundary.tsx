import { useEffect, useState, type ReactNode } from "react"

import { useUserMagicState } from "../magic/UserMagicProvider"
import { preloadUserNavigation } from "./userNavigationPreload"
import { useUserData } from "./UserDataProvider"

export function UserContextBoundary({ children }: { children: ReactNode }) {
  const {
    charactersLoading,
    campaignsLoading,
    bootstrapError: userDataBootstrapError,
  } = useUserData()
  const {
    loading: magicLoading,
    bootstrapError: magicBootstrapError,
  } = useUserMagicState()
  const [modulesReady, setModulesReady] = useState(false)
  const [moduleError, setModuleError] = useState(false)

  useEffect(() => {
    let active = true
    setModulesReady(false)
    setModuleError(false)

    preloadUserNavigation()
      .then(() => {
        if (active) setModulesReady(true)
      })
      .catch((error) => {
        console.error("[user-context] Failed to preload user navigation.", error)
        if (active) setModuleError(true)
      })

    return () => {
      active = false
    }
  }, [])

  const bootstrapError = userDataBootstrapError || magicBootstrapError

  if (moduleError) {
    return (
      <UserContextError
        message="Não foi possível carregar os módulos da área do usuário."
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (bootstrapError) {
    return (
      <UserContextError
        message={bootstrapError}
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (
    !modulesReady ||
    charactersLoading ||
    campaignsLoading ||
    magicLoading
  ) {
    return <UserContextLoading />
  }

  return children
}

function UserContextLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
      <div className="text-center">
        <div className="font-medium text-textH">Preparando seu ambiente...</div>
        <div className="mt-1 text-xs text-textMuted">
          Carregando personagens, campanhas, magias e navegação.
        </div>
      </div>
    </div>
  )
}

function UserContextError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="grid min-h-dvh place-items-center p-4 text-center text-sm text-danger">
      <div>
        <p>{message}</p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-border px-3 py-2 text-textH"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
