import { Navigate, Outlet, useParams } from "react-router-dom"

import { Button } from "../../components/ui/Button"
import { useCreatureCompendium } from "../../contexts/creatureCompendiumContext"
import { useCustomSystemsContext } from "../../contexts/customSystemsContext"
import { CreationEditorProvider, useCreationEditor } from "./CreationEditorProvider"

export function CreationEditorRouteOutlet() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  if (!campaignId) return <Navigate to="/not-found" replace />

  return (
    <CreationEditorProvider campaignId={campaignId}>
      <CreationEditorRouteContent />
    </CreationEditorProvider>
  )
}

function CreationEditorRouteContent() {
  const editor = useCreationEditor()
  const creatureCompendium = useCreatureCompendium()
  const customSystems = useCustomSystemsContext()

  if (editor.status === "loading") {
    return (
      <div className="grid min-h-48 place-items-center text-sm text-textMuted">
        Carregando Criação...
      </div>
    )
  }

  if (editor.status === "error") {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
        {editor.error || "Não foi possível carregar o estado de Criação."}
      </div>
    )
  }

  if (!creatureCompendium.hydrated || !customSystems.hydrated) {
    return (
      <div className="grid min-h-48 place-items-center text-sm text-textMuted">
        Preparando dados de Criação...
      </div>
    )
  }

  return (
    <div className="grid gap-4 pb-24">
      {editor.error ? (
        <div className="mx-auto w-full max-w-7xl rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{editor.error}</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={editor.saving}
              onClick={() => void editor.reload()}
            >
              Recarregar
            </Button>
          </div>
        </div>
      ) : null}

      <Outlet />

      {editor.dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-[9000] border-t border-border bg-bg-elevated/95 px-4 py-3 shadow-theme-lg backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-textH">
                Alterações de Criação não salvas
              </div>
              <div className="mt-0.5 text-xs text-textMuted">
                Revisão base {editor.baseRevision ?? "—"}. As alterações só entram na sessão após salvar.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={editor.saving}
                onClick={editor.cancel}
              >
                Descartar
              </Button>
              <Button
                variant="primary"
                disabled={editor.saving}
                onClick={() => void editor.save().catch(() => undefined)}
              >
                {editor.saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
