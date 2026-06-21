import { useLocation } from "react-router-dom"

type PageMetadata = {
  title: string
  description: string
}

const PAGE_METADATA: Record<string, PageMetadata> = {
  "/character": {
    title: "Personagens",
    description: "Ficha, habilidades, equipamentos, inventário e magias.",
  },
  "/party-inventory": {
    title: "Inventário do Grupo",
    description: "Itens compartilhados, transferências e suprimentos da equipe.",
  },
  "/magic": {
    title: "Biblioteca de Magias",
    description: "Pesquise, consulte e gerencie magias.",
  },
  "/sync": {
    title: "Sessão",
    description: "Configure o acesso e a sincronização do grupo.",
  },
}

const DEFAULT_PAGE: PageMetadata = {
  title: "D&D Manager",
  description: "Ferramentas para administrar sua mesa.",
}

export function AppHeader() {
  const location = useLocation()
  const page = PAGE_METADATA[location.pathname] ?? DEFAULT_PAGE

  return (
    <header className="shrink-0 border-b border-border bg-bg-elevated">
      <div className="flex min-h-16 w-full items-center px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-semibold text-textH">
            {page.title}
          </h1>

          <p className="mt-0.5 truncate text-xs text-textMuted">
            {page.description}
          </p>
        </div>
      </div>
    </header>
  )
}
