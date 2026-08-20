import { Navigate, Outlet, useParams } from "react-router-dom"

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

  return <Outlet />
}
