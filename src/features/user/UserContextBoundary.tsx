import { useEffect, useState, type ReactNode } from "react"

import { useUserMagicState } from "../magic/UserMagicProvider"
import { useUserData } from "./UserDataProvider"

let userContextPreload: Promise<void> | null = null

function preloadUserContextModules(): Promise<void> {
  if (userContextPreload) return userContextPreload

  userContextPreload = Promise.all([
    import("../../views/user/UserDashboardView"),
    import("../../views/user/UserCharactersTab"),
    import("../../views/user/UserCharacterCreateView"),
    import("../../views/user/UserCharacterLevelUpView"),
    import("../../views/user/UserCharacterAddSpellsView"),
    import("../../views/user/UserCharacterCreateItemView"),
    import("../../views/user/UserCharacterDetailView"),
    import("../../views/user/UserSpellsTab"),
    import("../../views/user/UserCampaignsRouteView"),
  ]).then(() => undefined)

  return userContextPreload
}

export function UserContextBoundary({ children }: { children: ReactNode }) {
  const {
    charactersLoading,
    campaignsLoading,
    charactersError,
    campaignsError,
    refreshAll,
  } = useUserData()
  const {
    loading: magicLoading,
    errorMessage: magicError,
    reload: reloadMagic,
  } = useUserMagicState()
  const [modulesReady, setModulesReady] = useState(false)
  const [moduleError, setModuleError] = useState(false)

  useEffect(() => {
    let active = true

    preloadUserContextModules()
      .then(() => {
        if (active) setModulesReady(true)
      })
      .catch((error) => {
        console.error("[user-context] Failed to preload protected user modules.", error)
        userContextPreload = null
        if (active) setModuleError(true)
      })

    return () => {
      active = false
    }
  }, [])

  if (moduleError) {
    return (
      <UserContextError
        message="Não foi possível carregar os módulos do ambiente do usuário."
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (charactersError && charactersLoading) {
    return <UserContextError message={charactersError} onRetry={() => void refreshAll()} />
  }

  if (campaignsError && campaignsLoading) {
    return <UserContextError message={campaignsError} onRetry={() => void refreshAll()} />
  }

  if (magicError && magicLoading) {
    return <UserContextError message={magicError} onRetry={() => void reloadMagic()} />
  }

  if (!modulesReady || charactersLoading || campaignsLoading || magicLoading) {
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
          Usando dados locais quando disponíveis e sincronizando com o servidor.
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
