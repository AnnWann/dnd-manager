import { useState, type FormEvent } from "react"

import { authClient } from "../auth/auth-client"

type AuthMode = "sign-in" | "sign-up"

export function AuthView() {
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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

        setMessage("Conta criada com sucesso.")
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

      setMessage("Login realizado com sucesso.")
    } catch {
      setMessage(
        "Não foi possível acessar o servidor de autenticação.",
      )
    } finally {
      setIsSubmitting(false)
    }
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
    </main>
  )
}