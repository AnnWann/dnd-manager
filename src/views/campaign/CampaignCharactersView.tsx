import { UsersRound, UserRound } from "lucide-react"
import { useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import {
  getCampaignSessionCharacters,
  type CampaignSessionCharacter,
  type CampaignSessionCharacters,
} from "../../api/campaign-session"
import type { CampaignCharacterVisibility } from "../../api/user-campaigns"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { campaignCharacterPath } from "../../lib/campaignRoutes"

export function CampaignCharactersView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const [data, setData] = useState<CampaignSessionCharacters | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    async function loadCharacters() {
      setLoading(true)
      setErrorMessage("")

      try {
        const nextData = await getCampaignSessionCharacters(campaignId!)
        if (!cancelled) setData(nextData)
      } catch {
        if (!cancelled) {
          setData(null)
          setErrorMessage("Não foi possível carregar os personagens da sessão.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCharacters()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  if (!campaignId) return <Navigate to="/not-found" replace />

  if (loading) {
    return (
      <CampaignCharactersShell title="Personagens" subtitle="Carregando sessão...">
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
          Carregando personagens da campanha...
        </div>
      </CampaignCharactersShell>
    )
  }

  if (errorMessage || !data) {
    return (
      <CampaignCharactersShell title="Personagens" subtitle="Sessão indisponível">
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage || "Não foi possível carregar a campanha."}
        </div>
      </CampaignCharactersShell>
    )
  }

  return data.campaign.isMaster ? (
    <MasterCampaignCharactersView campaignId={campaignId} data={data} />
  ) : (
    <PlayerCampaignCharactersView campaignId={campaignId} data={data} />
  )
}

function PlayerCampaignCharactersView({
  campaignId,
  data,
}: {
  campaignId: string
  data: CampaignSessionCharacters
}) {
  const navigate = useNavigate()

  return (
    <CampaignCharactersShell
      title="Seus personagens"
      subtitle={`${data.campaign.name} · Jogador`}
    >
      <p className="text-sm leading-6 text-textMuted">
        Apenas os seus personagens vinculados a esta sessão aparecem aqui.
      </p>

      <CharacterGrid
        characters={data.characters}
        emptyTitle="Nenhum personagem seu nesta sessão"
        emptyDescription="Vincule um personagem à campanha pela sua área de usuário para que ele apareça aqui."
        onOpen={(character) =>
          navigate(campaignCharacterPath(campaignId, character.id, "sheet"))
        }
      />
    </CampaignCharactersShell>
  )
}

function MasterCampaignCharactersView({
  campaignId,
  data,
}: {
  campaignId: string
  data: CampaignSessionCharacters
}) {
  const navigate = useNavigate()

  return (
    <CampaignCharactersShell
      title="Personagens da sessão"
      subtitle={`${data.campaign.name} · Mestre`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-textMuted">
          Todos os personagens vinculados à campanha, independentemente do jogador.
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">
          <UsersRound className="h-4 w-4" />
          {data.characters.length} personagem{data.characters.length === 1 ? "" : "s"}
        </div>
      </div>

      <CharacterGrid
        characters={data.characters}
        showOwner
        emptyTitle="Nenhum personagem na sessão"
        emptyDescription="Os personagens adicionados pelos jogadores aparecerão aqui."
        onOpen={(character) =>
          navigate(campaignCharacterPath(campaignId, character.id, "sheet"))
        }
      />
    </CampaignCharactersShell>
  )
}

function CharacterGrid({
  characters,
  showOwner = false,
  emptyTitle,
  emptyDescription,
  onOpen,
}: {
  characters: CampaignSessionCharacter[]
  showOwner?: boolean
  emptyTitle: string
  emptyDescription: string
  onOpen: (character: CampaignSessionCharacter) => void
}) {
  if (!characters.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <div className="text-sm font-semibold text-textH">{emptyTitle}</div>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-textMuted">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {characters.map((character) => (
        <Card key={character.id}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-bg-subtle text-textMuted">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-textH">
                  {character.name}
                </h2>
                {showOwner ? (
                  <p className="mt-1 truncate text-xs text-textMuted">
                    Jogador: {character.owner.name}
                  </p>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-xs text-textMuted">
              {visibilityLabel(character.visibility)}
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => onOpen(character)}
            >
              Abrir ficha
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CampaignCharactersShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <header className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <h1 className="text-xl font-semibold text-textH">{title}</h1>
        <p className="mt-1 text-sm text-textMuted">{subtitle}</p>
      </header>
      {children}
    </div>
  )
}

function visibilityLabel(visibility: CampaignCharacterVisibility): string {
  switch (visibility) {
    case "PRIVATE":
      return "Visibilidade: privada"
    case "MASTER":
      return "Visibilidade: mestre"
    default:
      return "Visibilidade: grupo"
  }
}
