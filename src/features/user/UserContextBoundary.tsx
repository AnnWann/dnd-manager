import { useEffect, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"

import { useUserMagicState } from "../magic/UserMagicProvider"
import { useUserData } from "./UserDataProvider"

const routePreloads = new Map<string, Promise<void>>()

function preloadCurrentUserRoute(pathname: string): Promise<void> {
  const key = userRoutePreloadKey(pathname)
  const existing = routePreloads.get(key)
  if (existing) return existing

  const routeImport = (() => {
    if (key === "characters") return import("../../views/user/UserCharactersTab")
    if (key === "character-create") return import("../../views/user/UserCharacterCreateView")
    if (key === "character-level-up") return import("../../views/user/UserCharacterLevelUpView")
    if (key === "character-add-spells") return import("../../views/user/UserCharacterAddSpellsView")
    if (key === "character-add-item") return import("../../views/user/UserCharacterCreateItemView")
    if (key === "character-detail") return import("../../views/user/UserCharacterDetailView")
    if (key === "spells") return import("../../views/user/UserSpellsTab")
    if (key === "campaigns") return import("../../views/user/UserCampaignsRouteView")
    return Promise.resolve(undefined)
  })()

  const preload = Promise.all([
    import("../../views/user/UserDashboardView"),
    routeImport,
  ]).then(() => undefined)

  routePreloads.set(key, preload)
  return preload
}

function userRoutePreloadKey(pathname: string): string {
  if (pathname === "/user" || pathname === "/user/characters") return "characters"
  if (pathname === "/user/characters/create") return "character-create"
  if (/^\/user\/characters\/[^/]+\/level-up\/?$/.test(pathname)) return "character-level-up"
  if (/^\/user\/characters\/[^/]+\/spells-list\/add-spells\/?$/.test(pathname)) return "character-add-spells"
  if (/^\/user\/characters\/[^/]+\/inventory\/add-item\/?$/.test(pathname)) return "character-add-item"
  if (/^\/user\/characters\/[^/]+(?:\/[^/]+)?\/?$/.test(pathname)) return "character-detail"
  if (pathname.startsWith("/user/spells")) return "spells"
  if (pathname.startsWith("/user/campaigns")) return "campaigns"
  return "user-shell"
}

export function UserContextBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
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
    setModulesReady(false)
    setModuleError(false)

    preloadCurrentUserRoute(location.pathname)
      .then(() => {
        if (active) setModulesReady(true)
      })
      .catch((error) => {
        console.error("[user-context] Failed to preload active protected user route.", error)
        routePreloads.delete(userRoutePreloadKey(location.pathname))
        if (active) setModuleError(true)
      })

    return () => {
      active = false
    }
  }, [location.pathname])

  if (moduleError) {
    return (
      <UserContextError
        message="Não foi possível carregar a rota da área do usuário."
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
