import { useEffect, useState, type ReactNode } from "react"

import { useUserMagicState } from "../magic/UserMagicProvider"

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
  const { loading: magicLoading } = useUserMagicState()
  const [modulesReady, setModulesReady] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    preloadUserContextModules()
      .then(() => {
        if (active) setModulesReady(true)
      })
      .catch((error) => {
        console.error("[user-context] Failed to preload user modules.", error)
        userContextPreload = null
        if (active) setLoadError(true)
      })

    return () => {
      active = false
    }
  }, [])

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center p-4 text-center text-sm text-danger">
        <div>
          <p>Não foi possível carregar o contexto do usuário.</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-border px-3 py-2 text-textH"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!modulesReady || magicLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
        Carregando seu ambiente...
      </div>
    )
  }

  return children
}
