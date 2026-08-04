import { Check, Copy, Link2, LogOut, Plus, Unlink } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  createMyCampaign,
  getMyCampaigns,
  leaveCampaign,
  linkCharacterToCampaign,
  requestCampaignJoin,
  reviewCampaignMember,
  unlinkCharacterFromCampaign,
  type UserCampaign,
} from "../../api/user-campaigns"
import {
  getMyCharacters,
  type UserCharacterSummary,
} from "../../api/user-characters"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { Textarea } from "../../components/ui/Textarea"

export function UserCampaignsTab() {
  const [campaigns, setCampaigns] = useState<UserCampaign[]>([])
  const [characters, setCharacters] = useState<UserCharacterSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [campaignName, setCampaignName] = useState("")
  const [campaignDescription, setCampaignDescription] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [selectedCharacter, setSelectedCharacter] = useState<
    Record<string, string>
  >({})
  const [copiedCode, setCopiedCode] = useState("")

  async function reload() {
    setLoading(true)
    setErrorMessage("")

    try {
      const [nextCampaigns, nextCharacters] = await Promise.all([
        getMyCampaigns(),
        getMyCharacters(),
      ])
      setCampaigns(nextCampaigns)
      setCharacters(nextCharacters)
    } catch {
      setErrorMessage("Não foi possível carregar as campanhas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  async function createCampaign() {
    if (!campaignName.trim() || working) return
    setWorking(true)
    setErrorMessage("")

    try {
      const created = await createMyCampaign({
        name: campaignName,
        description: campaignDescription,
      })
      setCampaigns((current) => [created, ...current])
      setCampaignName("")
      setCampaignDescription("")
    } catch {
      setErrorMessage("Não foi possível criar a campanha.")
    } finally {
      setWorking(false)
    }
  }

  async function joinCampaign() {
    if (!inviteCode.trim() || working) return
    setWorking(true)
    setErrorMessage("")

    try {
      await requestCampaignJoin(inviteCode)
      setInviteCode("")
      await reload()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível solicitar entrada na campanha.",
      )
    } finally {
      setWorking(false)
    }
  }

  async function linkCharacter(campaign: UserCampaign) {
    const characterId = selectedCharacter[campaign.id]
    if (!characterId || working) return

    setWorking(true)
    setErrorMessage("")

    try {
      await linkCharacterToCampaign(campaign.id, characterId)
      const character = characterById.get(characterId)
      if (character) {
        setCampaigns((current) =>
          current.map((entry) =>
            entry.id === campaign.id
              ? {
                  ...entry,
                  characters: entry.characters.some(
                    (linked) => linked.id === characterId,
                  )
                    ? entry.characters
                    : [
                        ...entry.characters,
                        { id: character.id, name: character.name },
                      ],
                }
              : entry,
          ),
        )
      }
    } catch {
      setErrorMessage("Não foi possível vincular o personagem.")
    } finally {
      setWorking(false)
    }
  }

  async function unlinkCharacter(
    campaignId: string,
    characterId: string,
  ) {
    if (working) return
    setWorking(true)
    setErrorMessage("")

    try {
      await unlinkCharacterFromCampaign(campaignId, characterId)
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                characters: campaign.characters.filter(
                  (character) => character.id !== characterId,
                ),
              }
            : campaign,
        ),
      )
    } catch {
      setErrorMessage("Não foi possível desvincular o personagem.")
    } finally {
      setWorking(false)
    }
  }

  async function leave(campaign: UserCampaign) {
    if (
      working ||
      !window.confirm(`Sair da campanha “${campaign.name}”?`)
    ) {
      return
    }

    setWorking(true)
    setErrorMessage("")

    try {
      await leaveCampaign(campaign.id)
      setCampaigns((current) =>
        current.filter((entry) => entry.id !== campaign.id),
      )
    } catch {
      setErrorMessage("Não foi possível sair da campanha.")
    } finally {
      setWorking(false)
    }
  }

  async function reviewMember(
    campaignId: string,
    userId: string,
    status: "ACTIVE" | "REMOVED",
  ) {
    if (working) return
    setWorking(true)
    setErrorMessage("")

    try {
      await reviewCampaignMember(campaignId, userId, status)
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                pendingMembers: campaign.pendingMembers.filter(
                  (member) => member.id !== userId,
                ),
              }
            : campaign,
        ),
      )
    } catch {
      setErrorMessage("Não foi possível revisar a solicitação.")
    } finally {
      setWorking(false)
    }
  }

  async function copyInvite(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    window.setTimeout(() => setCopiedCode(""), 1500)
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h1 className="text-base font-semibold text-textH">
              Criar campanha
            </h1>
            <p className="mt-1 text-xs leading-5 text-text">
              Você será o mestre e receberá um código para convidar jogadores.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Input
                value={campaignName}
                maxLength={120}
                placeholder="Nome da campanha"
                onChange={(event) => setCampaignName(event.target.value)}
              />
              <Textarea
                value={campaignDescription}
                placeholder="Descrição opcional"
                onChange={(event) =>
                  setCampaignDescription(event.target.value)
                }
              />
              <Button
                disabled={!campaignName.trim() || working}
                onClick={() => void createCampaign()}
              >
                <Plus className="h-4 w-4" />
                Criar campanha
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-textH">
              Entrar em campanha
            </h2>
            <p className="mt-1 text-xs leading-5 text-text">
              O código envia uma solicitação que precisa ser aceita pelo mestre.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Input
                value={inviteCode}
                placeholder="Código de convite"
                onChange={(event) =>
                  setInviteCode(event.target.value.toUpperCase())
                }
              />
              <Button
                variant="secondary"
                disabled={!inviteCode.trim() || working}
                onClick={() => void joinCampaign()}
              >
                Solicitar entrada
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
          Carregando campanhas...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
          Você ainda não participa de campanhas.
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => {
            const linkedIds = new Set(
              campaign.characters.map((character) => character.id),
            )
            const availableCharacters = characters.filter(
              (character) => !linkedIds.has(character.id),
            )
            const active = campaign.status === "ACTIVE"

            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-textH">
                          {campaign.name}
                        </h2>
                        <Badge
                          label={
                            campaign.isOwner
                              ? "Mestre"
                              : campaign.status === "INVITED"
                                ? "Aguardando aprovação"
                                : campaign.role === "MASTER"
                                  ? "Mestre auxiliar"
                                  : "Jogador"
                          }
                        />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text">
                        {campaign.description || "Sem descrição."}
                      </p>
                      <p className="mt-1 text-xs text-textMuted">
                        Mestre: {campaign.owner.name}
                      </p>
                    </div>

                    {!campaign.isOwner ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={working}
                        onClick={() => void leave(campaign)}
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-4">
                    {campaign.isOwner && campaign.inviteCode ? (
                      <section className="rounded-xl border border-accentBorder bg-accentBg p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-textMuted">
                          Código de convite
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH">
                            {campaign.inviteCode}
                          </code>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void copyInvite(campaign.inviteCode ?? "")
                            }
                          >
                            {copiedCode === campaign.inviteCode ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {copiedCode === campaign.inviteCode
                              ? "Copiado"
                              : "Copiar"}
                          </Button>
                        </div>
                      </section>
                    ) : null}

                    <section>
                      <h3 className="text-sm font-semibold text-textH">
                        Homebrew da campanha
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge label={`${campaign.homebrew.approved} aprovadas`} />
                        <Badge label={`${campaign.homebrew.pending} pendentes`} />
                        <Badge label={`${campaign.homebrew.rejected} rejeitadas`} />
                        <Badge label={`${campaign.homebrew.revoked} revogadas`} />
                      </div>
                    </section>

                    {campaign.isOwner && campaign.pendingMembers.length ? (
                      <section>
                        <h3 className="text-sm font-semibold text-textH">
                          Solicitações de entrada
                        </h3>
                        <div className="mt-2 grid gap-2">
                          {campaign.pendingMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                            >
                              <div>
                                <div className="text-sm font-medium text-textH">
                                  {member.name}
                                </div>
                                {member.email ? (
                                  <div className="text-xs text-textMuted">
                                    {member.email}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={working}
                                  onClick={() =>
                                    void reviewMember(
                                      campaign.id,
                                      member.id,
                                      "ACTIVE",
                                    )
                                  }
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={working}
                                  onClick={() =>
                                    void reviewMember(
                                      campaign.id,
                                      member.id,
                                      "REMOVED",
                                    )
                                  }
                                >
                                  Rejeitar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    <section>
                      <h3 className="text-sm font-semibold text-textH">
                        Meus personagens vinculados
                      </h3>

                      {campaign.characters.length ? (
                        <div className="mt-2 grid gap-2">
                          {campaign.characters.map((character) => (
                            <div
                              key={character.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                            >
                              <span className="text-sm text-textH">
                                {character.name}
                              </span>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={working || !active}
                                onClick={() =>
                                  void unlinkCharacter(
                                    campaign.id,
                                    character.id,
                                  )
                                }
                              >
                                <Unlink className="h-4 w-4" />
                                Desvincular
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-textMuted">
                          Nenhum personagem vinculado.
                        </p>
                      )}

                      {active && availableCharacters.length ? (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <select
                            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                            value={selectedCharacter[campaign.id] ?? ""}
                            onChange={(event) =>
                              setSelectedCharacter((current) => ({
                                ...current,
                                [campaign.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Selecione um personagem</option>
                            {availableCharacters.map((character) => (
                              <option key={character.id} value={character.id}>
                                {character.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            disabled={
                              !selectedCharacter[campaign.id] || working
                            }
                            onClick={() => void linkCharacter(campaign)}
                          >
                            <Link2 className="h-4 w-4" />
                            Vincular
                          </Button>
                        </div>
                      ) : null}
                    </section>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}
