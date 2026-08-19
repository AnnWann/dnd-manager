import { useEffect, useState, type ReactNode } from "react"

import { getMyCampaigns } from "../../api/user-campaigns"
import { getMyCharacters } from "../../api/user-characters"
import { useUserMagicState } from "../magic/UserMagicProvider"

let userContextPreload: Promise<void> | null = null

function preloadUserContext(): Promise<void> {
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
    getMyCharacters(),
    getMyCampaigns(),
  ]).then(() => undefined)

  return userContextPreload
}

export function UserContextBoundary({ children }: { children: ReactNode }) {
  const {
    loading: magicLoading,
    errorMessage: magicError,
    reload: reloadMagic,
  } = useUserMagicState()
  const [contextReady, setContextReady] = useState(false)
  const [contextError, setContextError] = useState(false)

  useEffect(() => {
    let active = true

    preloadUserContext()
      .then(() => {
        if (active) setContextReady(true)
      })
      .catch((error) => {
        console.error("[user-context] Failed to preload protected user context.", error)
        userContextPreload = null
        if (active) setContextError(true)
      })

    return () => {
      active = false
    }
  }, [])

  if (contextError) {
    return (
      <UserContextError
        message="Não foi possível carregar os dados iniciais do ambiente do usuário."
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (magicError && !magicLoading) {
    return (
      <UserContextError
        message={magicError}
        onRetry={() => void reloadMagic()}
      />
    )
  }

  if (!contextReady || magicLoading) {
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
          Carregando personagens, campanhas, magias e módulos da área do usuário.
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
