import { LogOut } from "lucide-react"
import { Suspense } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"

import { authClient } from "../../auth/auth-client"
import {
  clearLocalDevelopmentSession,
  getLocalUser,
  LOCAL_AUTH_BYPASS,
} from "../../auth/local-auth"
import {
  AppSidebar,
  IconCastle,
  IconCharacter,
  IconMagic,
} from "../../components/AppSidebar"
import { AppLoadingScreen } from "../../components/AppLoadingScreen"

export function UserDashboardView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = authClient.useSession()

  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const user = session?.user ?? localUser

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
          <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
            <Suspense
              fallback={
                <AppLoadingScreen
                  title="Carregando página..."
                  detail="Preparando o conteúdo solicitado."
                />
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
