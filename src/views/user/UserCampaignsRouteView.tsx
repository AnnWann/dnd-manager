import { ArrowRight, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  deleteCampaign,
  type UserCampaign,
} from "../../api/user-campaigns"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { preloadSessionEntry } from "../../features/session-runtime/preloadSessionEntry"
import { useUserData } from "../../features/user/UserDataProvider"
import { sessionPath } from "../../lib/campaignRoutes"
import { LegacyCampaignImportButton } from "./LegacyCampaignImportButton"
import { UserCampaignsTab } from "./UserCampaignTab"

export function UserCampaignsRouteView() {
  const navigate = useNavigate()
  const { userId, campaigns, campaignsLoading, setCampaigns } = useUserData()
  const [preparingCampaignId, setPreparingCampaignId] = useState("")
  const [deletingCampaignId, setDeletingCampaignId] = useState("")
  const [entryError, setEntryError] = useState("")

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE",
  )

  async function enterCampaign(campaign: UserCampaign) {
    if (preparingCampaignId || deletingCampaignId) return
    setPreparingCampaignId(campaign.id)
    setEntryError("")

    try {
      await preloadSessionEntry(campaign, userId)
      navigate(sessionPath(campaign.id, "characters"))
    } catch (error) {
      setEntryError(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a sessão antes da entrada.",
      )
    } finally {
      setPreparingCampaignId("")
    }
  }

  async function deleteOwnedCampaign(campaign: UserCampaign) {
    if (!campaign.isOwner || preparingCampaignId || deletingCampaignId) return

    const confirmed = window.confirm(
      `Excluir permanentemente a campanha “${campaign.name}”?\n\n` +
        "Os vínculos, membros e conteúdos exclusivos da campanha serão removidos. " +
        "As fichas de personagens continuarão existindo na área do usuário. Esta ação não pode ser desfeita.",
    )
    if (!confirmed) return

    setDeletingCampaignId(campaign.id)
    setEntryError("")

    try {
      await deleteCampaign(campaign.id)
      setCampaigns((current) =>
        current.filter((entry) => entry.id !== campaign.id),
      )
    } catch (error) {
      setEntryError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a campanha.",
      )
    } finally {
      setDeletingCampaignId("")
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-base font-semibold text-textH">Sessões</h1>
              <p className="mt-1 text-xs leading-5 text-text">
                A entrada prepara os dados relacionais uma vez; durante a sessão, o estado de jogo é servido pelo Session Server.
              </p>
            </div>
            <LegacyCampaignImportButton />
          </div>
        </CardHeader>
        <CardContent>
          {entryError ? (
            <div className="mb-3 rounded-xl border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
              {entryError}
            </div>
          ) : null}

          {campaignsLoading ? (
            <div className="text-sm text-textMuted">Carregando campanhas...</div>
          ) : activeCampaigns.length === 0 ? (
            <div className="text-sm text-textMuted">
              Nenhuma campanha ativa disponível para entrar.
            </div>
          ) : (
            <div className="grid gap-2">
              {activeCampaigns.map((campaign) => {
                const preparing = preparingCampaignId === campaign.id
                const deleting = deletingCampaignId === campaign.id
                const busy = Boolean(preparingCampaignId || deletingCampaignId)

                return (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-subtle p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-textH">
                        {campaign.name}
                      </div>
                      <div className="mt-1 text-xs text-textMuted">
                        {campaign.isOwner || campaign.role === "MASTER"
                          ? "Mestre"
                          : "Jogador"}
                      </div>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {campaign.isOwner ? (
                        <Button
                          size="sm"
                          variant="danger"
                          className="w-8 px-0 sm:w-auto sm:px-3"
                          disabled={busy}
                          loading={deleting}
                          aria-label={`Excluir ${campaign.name}`}
                          title="Excluir campanha"
                          onClick={() => void deleteOwnedCampaign(campaign)}
                        >
                          {!deleting ? (
                            <>
                              <X className="h-4 w-4 sm:hidden" />
                              <Trash2 className="hidden h-4 w-4 sm:block" />
                            </>
                          ) : null}
                          <span className="hidden sm:inline">
                            {deleting ? "Excluindo..." : "Excluir"}
                          </span>
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        className="w-8 px-0 sm:w-auto sm:px-3"
                        disabled={busy}
                        aria-label={`Entrar em ${campaign.name}`}
                        title="Entrar na sessão"
                        onClick={() => void enterCampaign(campaign)}
                      >
                        <span className="hidden sm:inline">
                          {preparing ? "Preparando..." : "Entrar"}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <UserCampaignsTab />
    </div>
  )
}
