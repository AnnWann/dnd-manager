import { Link, useLocation } from "react-router-dom"

import { Button } from "../components/ui/Button"

export function NotFoundView() {
  const location = useLocation()

  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 py-10">
      <section className="w-full max-w-lg text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-textMuted">
          Erro 404
        </div>

        <h1 className="mt-3 text-3xl font-semibold text-textH">
          Página não encontrada
        </h1>

        <p className="mt-3 text-sm leading-6 text-textMuted">
          O endereço informado não existe ou foi removido.
        </p>

        <div className="mt-3 break-all rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">
          {location.pathname}
        </div>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.history.back()}
          >
            Voltar
          </Button>

          <Link
            to="/character"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Ir para a ficha
          </Link>
        </div>
      </section>
    </main>
  )
}