import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom"
import type { ReactNode } from "react"

import { authClient } from "../../auth/auth-client"
import { Button } from "../../components/ui/Button"
import { clearLocalDevelopmentSession, getLocalUser, LOCAL_AUTH_BYPASS } from "../../auth/local-auth"

export function UserDashboardView() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const localUser =
    LOCAL_AUTH_BYPASS ? getLocalUser() : null

  const user = session?.user ?? localUser

if (!user) {
  return <Navigate to="/unauthorized" replace />
}

  const userName = session?.user?.name ?? "Usuário local"
  const userEmail =
    session?.user?.email ?? "Ambiente de desenvolvimento"

  async function signOut() {
  if (session?.user) {
    await authClient.signOut()
  }

  clearLocalDevelopmentSession()

  navigate("/auth", {
    replace: true,
  })
}

  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      <header className="border-b border-border bg-bg-elevated">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-textH">
              D&D Manager
            </h1>

            <p className="truncate text-xs text-textMuted">
              {userName} · {userEmail}
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={signOut}
          >
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6">
        <nav className="flex gap-2 overflow-x-auto">
          <DashboardTab to="/user/characters">
            Meus personagens
          </DashboardTab>

          <DashboardTab to="/user/campaigns">
            Campanhas
          </DashboardTab>
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function DashboardTab({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "shrink-0 rounded-lg border px-4 py-2 text-sm font-medium",
          isActive
            ? "border-accentBorder bg-accentBg text-textH"
            : "border-border bg-bg text-text hover:bg-bg-subtle",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  )
}