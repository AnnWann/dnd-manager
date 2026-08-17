import { UsersRound, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import {
  getCampaignSessionCharacters,
  type CampaignSessionCharacters,
} from "../../api/campaign-session"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { useCharacterContext } from "../../contexts/characterContext"
import { sessionCharacterPath } from "../../lib/campaignRoutes"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"

export function CampaignCharactersView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const { visibleCharacters } = useCharacterContext()
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

  const sessionCharacters = useMemo(() => {
    if (!data) return []
    if (data.campaign.isMaster) return visibleCharacters

    const ownedSourceIds = new Set(data.characters.map((character) => character.id))
    return visibleCharacters.filter((character) =>
      ownedSourceIds.has(character.get("id")),
    )
  }, [data, visibleCharacters])

  if (!campaignId) return <Navigate to="/not-found" replace />

  if (loading) {
    return (
      <CampaignCharactersShell title="Personagens" subtitle="Carregando sessão...">
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
          Carregando personagens da sessão...
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
    <MasterSessionCharactersView
      sessionId={campaignId}
      data={data}
      characters={sessionCharacters}
    />
  ) : (
    <PlayerSessionCharactersView
      sessionId={campaignId}
      data={data}
      characters={sessionCharacters}
    />
  )
}

function PlayerSessionCharactersView({
  sessionId,
  data,
  characters,
}: {
  sessionId: string
  data: CampaignSessionCharacters
  characters: CharacterTemplate[]
}) {
  const navigate = useNavigate()

  return (
    <CampaignCharactersShell
      title="Seus personagens"
      subtitle={`${data.campaign.name} · Jogador`}
    >
      <p className="text-sm leading-6 text-textMuted">
        Estas são as cópias de sessão dos seus personagens. Alterações feitas aqui não modificam a ficha da sua área de usuário.
      </p>

      <CharacterGrid
        characters={characters}
        emptyTitle="Nenhum personagem seu carregado nesta sessão"
        emptyDescription="Vincular um personagem à campanha define quem pode participar; a sessão mantém sua própria cópia mutável da ficha."
        onOpen={(character) =>
          navigate(sessionCharacterPath(sessionId, character.get("id"), "sheet"))
        }
      />
    </CampaignCharactersShell>
  )
}

function MasterSessionCharactersView({
  sessionId,
  data,
  characters,
}: {
  sessionId: string
  data: CampaignSessionCharacters
  characters: CharacterTemplate[]
}) {
  const navigate = useNavigate()

  return (
    <CampaignCharactersShell
      title="Personagens da sessão"
      subtitle={`${data.campaign.name} · Mestre`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-textMuted">
          Todas as cópias de personagem atualmente carregadas nesta sessão.
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textMuted">
          <UsersRound className="h-4 w-4" />
          {characters.length} personagem{characters.length === 1 ? "" : "s"}
        </div>
      </div>

      <CharacterGrid
        characters={characters}
        showOwner
        emptyTitle="Nenhum personagem carregado na sessão"
        emptyDescription="Quando a sessão carregar suas cópias de personagem, elas aparecerão aqui."
        onOpen={(character) =>
          navigate(sessionCharacterPath(sessionId, character.get("id"), "sheet"))
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
  characters: CharacterTemplate[]
  showOwner?: boolean
  emptyTitle: string
  emptyDescription: string
  onOpen: (character: CharacterTemplate) => void
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
      {characters.map((character) => {
        const owner = character.get("owner")
        return (
          <Card key={character.get("id")}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-bg-subtle text-textMuted">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-textH">
                    {character.get("name")}
                  </h2>
                  {showOwner ? (
                    <p className="mt-1 truncate text-xs text-textMuted">
                      Jogador: {owner?.name || owner?.id || "Sem jogador"}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 text-xs text-textMuted">
                {visibilityLabel(character.get("visibility"))}
              </div>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => onOpen(character)}
              >
                Abrir ficha da sessão
              </Button>
            </CardContent>
          </Card>
        )
      })}
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

function visibilityLabel(visibility: "private" | "party" | "master"): string {
  switch (visibility) {
    case "private":
      return "Visibilidade: privada"
    case "master":
      return "Visibilidade: mestre"
    default:
      return "Visibilidade: grupo"
  }
}
