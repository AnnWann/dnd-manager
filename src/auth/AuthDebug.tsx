import { authClient } from "./auth-client"

export function AuthDebug() {
  const { data: session, isPending, error } =
    authClient.useSession()

  if (isPending) {
    return <div>Verificando sessão...</div>
  }

  if (error) {
    return <div>Erro ao consultar sessão.</div>
  }

  if (!session) {
    return <div>Nenhuma sessão ativa.</div>
  }

  return (
    <div>
      <div>Usuário: {session.user.name}</div>
      <div>Email: {session.user.email}</div>

      <button
        type="button"
        onClick={() => authClient.signOut()}
      >
        Sair
      </button>
    </div>
  )
}