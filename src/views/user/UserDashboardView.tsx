import { LogOut } from "lucide-react"
import { Suspense, useEffect } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"

import {
  AppSidebar,
  IconCastle,
  IconCharacter,
  IconMagic,
} from "../../components/AppSidebar"
import { authClient } from "../../auth/auth-client"
import {
  clearLocalDevelopmentSession,
  getLocalUser,
  LOCAL_AUTH_BYPASS,
} from "../../auth/local-auth"

let userMagicPreload: Promise<unknown> | null = null

function preloadUserMagicRuntime(): Promise<unknown> {
  if (userMagicPreload) return userMagicPreload

  userMagicPreload = Promise.all([
    import("../../features/magic/UserMagicRouteBoundary"),
    import("./UserSpellsTab"),
  ]).catch((error) => {
    userMagicPreload = null
    throw error
  })

  return userMagicPreload
}

export function UserDashboardView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session, isPending } = authClient.useSession()

  const localUser =
    LOCAL_AUTH_BYPASS ? getLocalUser() : null

  const user = session?.user ?? localUser

  useEffect(() => {
    if (location.pathname.startsWith("/user/spells")) return

    const browser = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (browser.requestIdleCallback) {
      const handle = browser.requestIdleCallback(
        () => {
          void preloadUserMagicRuntime()
        },
        { timeout: 2000 },
      )

      return () => {
        browser.cancelIdleCallback?.(handle)
      }
    }

    const handle = window.setTimeout(() => {
      void preloadUserMagicRuntime()
    }, 750)

    return () => window.clearTimeout(handle)
  }, [location.pathname])

  if (!LOCAL_AUTH_BYPASS && isPending) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
        Verificando sessão...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/unauthorized" replace />
  }

  async function signOut() {
    if (session?.user) {
      await authClient.signOut()
    }

    clearLocalDevelopmentSession()

    navigate("/auth", {
      replace: true,
    })
  }

  const sidebarItems = [
    {
      label: "Meus personagens",
      icon: <IconCharacter />,
      active: location.pathname.startsWith("/user/characters"),
      onClick: () => navigate("/user/characters"),
    },
    {
      label: "Magias",
      icon: <IconMagic />,
      active: location.pathname.startsWith("/user/spells"),
      onIntent: () => {
        void preloadUserMagicRuntime()
      },
      onClick: () => navigate("/user/spells"),
    },
    {
      label: "Campanhas",
      icon: <IconCastle />,
      active: location.pathname.startsWith("/user/campaigns"),
      onClick: () => navigate("/user/campaigns"),
    },
    {
      label: "Sair",
      icon: <LogOut />,
      active: false,
      onClick: () => {
        void signOut()
      },
    },
  ]

  return (
    <div className="fixed inset-0 flex w-full max-w-full flex-col overflow-hidden bg-[color:var(--surface-app)] text-text">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-elevated px-4">
        <div className="min-w-0 pl-12 md:pl-0">
          <div className="truncate font-heading text-base font-semibold text-textH">
            Área do usuário
          </div>

          <div className="truncate text-xs text-textMuted">
            {user.name} · {user.email}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
        <AppSidebar items={sidebarItems} />

        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
            <Suspense fallback={<UserRouteLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

function UserRouteLoading() {
  return (
    <div className="grid min-h-64 place-items-center text-sm text-textMuted">
      Carregando...
    </div>
  )
}
