import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { getMyCampaigns, type UserCampaign } from "../../api/user-campaigns"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { UserCampaignsTab } from "./UserCampaignTab"

export function UserCampaignsRouteView() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<UserCampaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCampaigns() {
      try {
        const nextCampaigns = await getMyCampaigns()
        if (!cancelled) setCampaigns(nextCampaigns)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCampaigns()

    return () => {
      cancelled = true
    }
  }, [])

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE",
  )

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <h1 className="text-base font-semibold text-textH">Sessões</h1>
          <p className="mt-1 text-xs leading-5 text-text">
            Entre em uma campanha ativa para acessar os personagens vinculados a ela.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-textMuted">Carregando campanhas...</div>
          ) : activeCampaigns.length === 0 ? (
            <div className="text-sm text-textMuted">
              Nenhuma campanha ativa disponível para entrar.
            </div>
          ) : (
            <div className="grid gap-2">
              {activeCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-bg-subtle p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {campaign.name}
                    </div>
                    <div className="mt-1 text-xs text-textMuted">
                      {campaign.isOwner || campaign.role === "MASTER"
                        ? "Mestre"
                        : "Jogador"}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/campaign/${encodeURIComponent(campaign.id)}/characters`)
                    }
                  >
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UserCampaignsTab />
    </div>
  )
}
