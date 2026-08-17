import { ArrowLeft, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import { getMyCampaigns, type UserCampaign } from "../../api/user-campaigns"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"

export function CampaignCharactersView() {
  const navigate = useNavigate()
  const { campaignId } = useParams<{ campaignId: string }>()
  const [campaigns, setCampaigns] = useState<UserCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadCampaign() {
      setLoading(true)
      setErrorMessage("")

      try {
        const nextCampaigns = await getMyCampaigns()
        if (!cancelled) setCampaigns(nextCampaigns)
      } catch {
        if (!cancelled) {
          setErrorMessage("Não foi possível carregar a campanha.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCampaign()

    return () => {
      cancelled = true
    }
  }, [campaignId])

  const campaign = useMemo(
    () => campaigns.find((entry) => entry.id === campaignId),
    [campaignId, campaigns],
  )

  if (!campaignId) {
    return <Navigate to="/not-found" replace />
  }

  if (!loading && !errorMessage && !campaign) {
    return <Navigate to="/not-found" replace />
  }

  if (!loading && campaign && campaign.status !== "ACTIVE") {
    return <Navigate to="/unauthorized" replace />
  }

  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      <header className="border-b border-border bg-bg-elevated">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/user/campaigns")}
            >
              <ArrowLeft className="h-4 w-4" />
              Campanhas
            </Button>

            <div className="min-w-0">
              <div className="truncate font-heading text-base font-semibold text-textH">
                {campaign?.name ?? "Campanha"}
              </div>
              <div className="truncate text-xs text-textMuted">
                {campaign
                  ? campaign.isOwner || campaign.role === "MASTER"
                    ? "Sessão · Mestre"
                    : "Sessão · Jogador"
                  : "Carregando sessão..."}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-3 py-4 sm:px-4 sm:py-6">
        <div>
          <h1 className="text-xl font-semibold text-textH">Personagens</h1>
          <p className="mt-1 text-sm leading-6 text-textMuted">
            Personagens que você vinculou a esta campanha.
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
            Carregando personagens da campanha...
          </div>
        ) : campaign && campaign.characters.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaign.characters.map((character) => (
              <Card key={character.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-bg-subtle text-textMuted">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-textH">
                        {character.name}
                      </h2>
                      <p className="mt-1 text-xs text-textMuted">
                        {visibilityLabel(character.visibility)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() =>
                      navigate(
                        `/user/characters/${encodeURIComponent(character.id)}/sheet`,
                      )
                    }
                  >
                    Abrir ficha
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <div className="text-sm font-semibold text-textH">
              Nenhum personagem vinculado
            </div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-textMuted">
              Adicione um personagem à campanha pela tela de campanhas para que ele apareça aqui.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function visibilityLabel(
  visibility: UserCampaign["characters"][number]["visibility"],
): string {
  switch (visibility) {
    case "PRIVATE":
      return "Visibilidade: privada"
    case "MASTER":
      return "Visibilidade: mestre"
    default:
      return "Visibilidade: grupo"
  }
}
