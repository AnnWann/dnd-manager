import { KeyRound, LogOut } from "lucide-react"
import { Suspense, useState } from "react"
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
import { Button } from "../../components/ui/Button"

export function UserDashboardView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = authClient.useSession()
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

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
      label: "Alterar senha",
      icon: <KeyRound />,
      active: false,
      onClick: () => {
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setPasswordMessage("")
        setPasswordModalOpen(true)
      },
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
      {passwordModalOpen && !LOCAL_AUTH_BYPASS ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <section className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-textH">Alterar senha</h2>
            <p className="mt-1 text-sm text-textMuted">
              Informe sua senha atual e escolha uma nova senha.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-sm text-text">Senha atual</span>
                <input type="password" autoComplete="current-password" className="rounded-lg border border-border bg-bg px-3 py-2 text-textH" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-text">Nova senha</span>
                <input type="password" minLength={8} autoComplete="new-password" className="rounded-lg border border-border bg-bg px-3 py-2 text-textH" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-text">Confirmar nova senha</span>
                <input type="password" minLength={8} autoComplete="new-password" className="rounded-lg border border-border bg-bg px-3 py-2 text-textH" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
            </div>
            {passwordMessage ? <p className="mt-3 text-sm text-danger">{passwordMessage}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={changingPassword} onClick={() => setPasswordModalOpen(false)}>Cancelar</Button>
              <Button
                disabled={changingPassword || currentPassword.length === 0 || newPassword.length < 8 || confirmPassword.length < 8}
                onClick={async () => {
                  if (newPassword !== confirmPassword) {
                    setPasswordMessage("As novas senhas não coincidem.")
                    return
                  }
                  setChangingPassword(true)
                  setPasswordMessage("")
                  try {
                    const { error } = await authClient.changePassword({
                      currentPassword,
                      newPassword,
                      revokeOtherSessions: true,
                    })
                    if (error) {
                      setPasswordMessage(error.message ?? "Não foi possível alterar a senha.")
                      return
                    }
                    setPasswordModalOpen(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                  } catch {
                    setPasswordMessage("Não foi possível acessar o servidor de autenticação.")
                  } finally {
                    setChangingPassword(false)
                  }
                }}
              >
                {changingPassword ? "Alterando..." : "Alterar senha"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
