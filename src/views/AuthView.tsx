import { useState, type FormEvent } from "react"

import { authClient } from "../auth/auth-client"
import { useLocation, useNavigate } from "react-router-dom"
import { createLocalDevelopmentSession, LOCAL_AUTH_BYPASS } from "../auth/local-auth"

type AuthMode = "sign-in" | "sign-up"

type AuthLocationState = {
  returnTo?: unknown
}

export function AuthView() {
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const requestedReturnTo = (location.state as AuthLocationState | null)?.returnTo
  const returnTo =
    typeof requestedReturnTo === "string" && requestedReturnTo.startsWith("/")
      ? requestedReturnTo
      : "/user/characters"

  async function confirmSession(): Promise<boolean> {
    const { data, error } = await authClient.getSession()

    if (error || !data?.user) {
      setMessage(
        error?.message ??
          "A autenticação foi aceita, mas a sessão não pôde ser carregada.",
      )
      return false
    }

    return true
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setIsSubmitting(true)

    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        })

        if (error) {
          setMessage(error.message ?? "Não foi possível criar a conta.")
          return
        }

        if (!(await confirmSession())) return

        navigate(returnTo, { replace: true })
        return
      }

      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      })

      if (error) {
        setMessage(error.message ?? "Não foi possível entrar.")
        return
      }

      if (!(await confirmSession())) return

      navigate(returnTo, { replace: true })
    } catch {
      setMessage(
        "Não foi possível acessar o servidor de autenticação.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function enterLocalDevelopmentMode() {
    createLocalDevelopmentSession()

    navigate(returnTo, {
      replace: true,
    })
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center p-4">
      <section className="w-full rounded-xl border border-border bg-bg-elevated p-5">
        <h1 className="text-xl font-semibold text-textH">
          {mode === "sign-in" ? "Entrar" : "Criar conta"}
        </h1>

        <form className="mt-5 grid gap-4" onSubmit={submit}>
          {mode === "sign-up" ? (
            <label className="grid gap-1.5">
              <span className="text-sm text-text">Nome</span>
              <input
                required
                autoComplete="name"
                className="rounded-lg border border-border bg-bg px-3 py-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-sm text-text">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              className="rounded-lg border border-border bg-bg px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm text-text">Senha</span>
            <input
              required
              type="password"
              minLength={8}
              autoComplete={
                mode === "sign-up"
                  ? "new-password"
                  : "current-password"
              }
              className="rounded-lg border border-border bg-bg px-3 py-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {message ? (
            <p className="text-sm text-text">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {isSubmitting
              ? "Enviando..."
              : mode === "sign-in"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-accent"
          onClick={() => {
            setMode((current) =>
              current === "sign-in" ? "sign-up" : "sign-in",
            )
            setMessage("")
          }}
        >
          {mode === "sign-in"
            ? "Ainda não tenho uma conta"
            : "Já tenho uma conta"}
        </button>
      </section>

      {LOCAL_AUTH_BYPASS ? (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-border bg-bg-subtle px-4 py-2 text-sm font-medium text-textH"
          onClick={enterLocalDevelopmentMode}
        >
          Entrar em modo local
        </button>
      ) : null}
    </main>
  )
}