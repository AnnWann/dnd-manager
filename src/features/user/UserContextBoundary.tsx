import { useEffect, useState, type ReactNode } from "react"

import { preloadAllOfficialSpellSummaries } from "../../api/spell-compendium"
import { AppLoadingScreen } from "../../components/AppLoadingScreen"
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
  const [staticContentReady, setStaticContentReady] = useState(false)
  const [staticContentError, setStaticContentError] = useState(false)

  useEffect(() => {
    let active = true
    setStaticContentReady(false)
    setStaticContentError(false)

    Promise.all([
      preloadUserNavigation(),
      preloadAllOfficialSpellSummaries(),
    ])
      .then(() => {
        if (active) setStaticContentReady(true)
      })
      .catch((error) => {
        console.error("[user-context] Failed to preload user context.", error)
        if (active) setStaticContentError(true)
      })

    return () => {
      active = false
    }
  }, [])

  const bootstrapError = userDataBootstrapError || magicBootstrapError

  if (staticContentError) {
    return (
      <UserContextError
        message="Não foi possível carregar os módulos ou o compêndio de magias da área do usuário."
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
    !staticContentReady ||
    charactersLoading ||
    campaignsLoading ||
    magicLoading
  ) {
    return (
      <AppLoadingScreen
        title="Carregando seus dados..."
        detail="Preparando personagens, campanhas, magias e descrições."
      />
    )
  }

  return children
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
