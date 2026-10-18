import { useEffect, useState } from "react"

import {
  getMyCharacterAccess,
  type CharacterVisibility,
  type UserCharacterAccess,
} from "../../../api/user-characters"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

export function CharacterAccessTab({
  character,
}: {
  character: CharacterTemplate
}) {
  const [access, setAccess] = useState<UserCharacterAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setErrorMessage("")

      try {
        const result = await getMyCharacterAccess(character.get("id"))
        if (active) setAccess(result)
      } catch {
        if (active) {
          setErrorMessage(
            "Não foi possível carregar as permissões deste personagem.",
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [character])

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
        Carregando acessos...
      </div>
    )
  }

  if (errorMessage || !access) {
    return (
      <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
        {errorMessage || "Acessos indisponíveis."}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-textH">
            Campanhas vinculadas
          </h2>
          <p className="mt-1 text-xs leading-5 text-text">
            Cada vínculo possui sua própria visibilidade, independente da configuração geral da ficha.
          </p>
        </CardHeader>
        <CardContent>
          {access.campaigns.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {access.campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-xl border border-border bg-bg-subtle p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-textH">
                      {campaign.name}
                    </div>
                    <Badge
                      label={
                        campaign.role === "MASTER" ? "Mestre" : "Jogador"
                      }
                    />
                    <Badge label={statusLabel(campaign.status)} />
                    <Badge label={visibilityLabel(campaign.visibility)} />
                  </div>
                  <div className="mt-2 text-xs text-textMuted">
                    Mestre principal: {campaign.master.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-textMuted">
              Este personagem não está vinculado a campanhas.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-textH">
            Permissões de magias homebrew
          </h2>
          <p className="mt-1 text-xs leading-5 text-text">
            Cada entrada mostra quem criou a magia e por que ela está disponível para esta ficha.
          </p>
        </CardHeader>
        <CardContent>
          {access.homebrewSpells.length ? (
            <div className="grid gap-3">
              {access.homebrewSpells.map((spell) => (
                <article
                  key={spell.id}
                  className="rounded-xl border border-border bg-bg-subtle p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-textH">
                        {spell.name}
                      </h3>
                      <div className="mt-1 text-xs text-textMuted">
                        Índice: {spell.index} · Autor: {spell.author.name}
                      </div>
                    </div>
                    <Badge
                      label={
                        spell.ownedByCurrentUser
                          ? "Criada por você"
                          : spell.sourceCampaign
                            ? `Concedida por ${spell.sourceCampaign.name}`
                            : "Concedida ao personagem"
                      }
                    />
                  </div>

                  {spell.approvedCampaigns.length ? (
                    <div className="mt-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
                        Aprovada nas campanhas
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {spell.approvedCampaigns.map((campaign) => (
                          <Badge key={campaign.id} label={campaign.name} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-textMuted">
                      Sem aprovação ativa de campanha. O acesso existe por propriedade ou concessão direta.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-textMuted">
              Nenhuma magia homebrew está vinculada a este personagem.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function statusLabel(status: "ACTIVE" | "INVITED" | "REMOVED"): string {
  if (status === "ACTIVE") return "Ativa"
  if (status === "INVITED") return "Pendente"
  return "Removida"
}

function visibilityLabel(visibility: CharacterVisibility): string {
  if (visibility === "PRIVATE") return "Privado"
  if (visibility === "MASTER") return "Somente mestres"
  return "Toda a campanha"
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}
