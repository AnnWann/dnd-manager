import { Link } from "react-router-dom"

export function UnauthorizedView() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <section className="w-full max-w-lg text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-textMuted">
          Erro 403
        </div>

        <h1 className="mt-3 text-3xl font-semibold text-textH">
          Acesso não autorizado
        </h1>

        <p className="mt-3 text-sm leading-6 text-textMuted">
          Sua conta não possui permissão para acessar este recurso.
        </p>

        <Link
          to="/user"
          className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Voltar para minha conta
        </Link>
      </section>
    </main>
  )
}