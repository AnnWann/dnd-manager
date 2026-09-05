import { Navigate, Outlet, useLocation, useParams } from "react-router-dom"

import { Button } from "../../components/ui/Button"
import { useCreatureCompendium } from "../../contexts/creatureCompendiumContext"
import { useCustomSystemsContext } from "../../contexts/customSystemsContext"
import { useSyncContext } from "../../contexts/syncContext"
import { sessionPath } from "../../lib/campaignRoutes"
import type { CampaignCapability } from "../../shared/campaign/campaignRoles"
import { CreationEditorProvider, useCreationEditor } from "./CreationEditorProvider"

export function CreationEditorRouteOutlet() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const location = useLocation()
  const { campaignCapabilities } = useSyncContext()
  if (!campaignId) return <Navigate to="/not-found" replace />

  const capabilities = new Set(campaignCapabilities)
  const route = resolveCreationRoute(location.pathname, campaignId)
  if (!route) return <Navigate to={sessionPath(campaignId, "characters")} replace />

  if (!canAccessRoute(capabilities, route.capability, route.permissionsAlternative)) {
    return <Navigate to={sessionPath(campaignId, "characters")} replace />
  }

  // Requests/homebrew use their own APIs. Permissions-only access to settings
  // must likewise not instantiate the full Creation document editor.
  if (!route.needsEditor) return <Outlet />
  if (
    route.capability === "creation.settings.manage" &&
    !capabilities.has("creation.settings.manage")
  ) {
    return <Outlet />
  }

  return (
    <CreationEditorProvider key={campaignId} campaignId={campaignId}>
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

type CreationRouteAccess = {
  capability: CampaignCapability
  permissionsAlternative?: boolean
  needsEditor: boolean
}

function resolveCreationRoute(
  pathname: string,
  campaignId: string,
): CreationRouteAccess | null {
  const root = sessionPath(campaignId, "creation")
  const tail = pathname.startsWith(root)
    ? pathname.slice(root.length).replace(/^\/+/, "")
    : ""

  if (!tail || tail === "settings") {
    return {
      capability: "creation.settings.manage",
      permissionsAlternative: true,
      needsEditor: true,
    }
  }
  if (tail === "requests") {
    return { capability: "creation.requests.manage", needsEditor: false }
  }
  if (tail === "homebrew") {
    return { capability: "creation.homebrew.manage", needsEditor: false }
  }
  if (tail === "items-compendium") {
    return { capability: "creation.items.manage", needsEditor: true }
  }
  if (tail === "creatures-compendium") {
    return { capability: "creation.creatures.manage", needsEditor: true }
  }
  if (tail === "magic") {
    return { capability: "creation.magic.manage", needsEditor: true }
  }
  if (tail === "custom-systems" || tail.startsWith("custom-systems/")) {
    return { capability: "creation.systems.manage", needsEditor: true }
  }
  return null
}

function canAccessRoute(
  capabilities: ReadonlySet<CampaignCapability>,
  capability: CampaignCapability,
  permissionsAlternative = false,
): boolean {
  return capabilities.has(capability)
    || (permissionsAlternative && capabilities.has("creation.permissions.read"))
}
