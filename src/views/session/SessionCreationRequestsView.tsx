import { Check, FileQuestion, ShieldQuestion, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

import {
  getSessionHomebrew,
  reviewSessionHomebrewSpell,
  type SessionHomebrewCatalog,
  type SessionHomebrewSpell,
} from "../../api/session-homebrew"
import {
  getSessionCreationSettings,
  updateSessionMember,
  type SessionCreationSettings,
  type SessionSettingsMember,
} from "../../api/session-settings"
import { Button } from "../../components/ui/Button"
import type { Spell } from "../../models/magic/spells/Spell"

export function SessionCreationRequestsView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const [settings, setSettings] = useState<SessionCreationSettings | null>(null)
  const [homebrew, setHomebrew] = useState<SessionHomebrewCatalog | null>(null)
  const [viewingSpell, setViewingSpell] = useState<SessionHomebrewSpell | null>(null)
  const [workingKey, setWorkingKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const pendingMembers = useMemo(
    () => settings?.members.filter((member) => member.status === "INVITED") ?? [],
    [settings],
  )
  const pendingSpells = useMemo(
    () => homebrew?.spells.filter((spell) => spell.status === "PENDING") ?? [],
    [homebrew],
  )
  const totalPending = pendingMembers.length + pendingSpells.length

  useEffect(() => {
    if (!campaignId) return
    void reload()
  }, [campaignId])

  if (!campaignId) return <Navigate to="/not-found" replace />

  async function reload() {
    if (!campaignId) return
    setLoading(true)
    setErrorMessage("")
    try {
      const [nextSettings, nextHomebrew] = await Promise.all([
        getSessionCreationSettings(campaignId),
        getSessionHomebrew(campaignId),
      ])
      setSettings(nextSettings)
      setHomebrew(nextHomebrew)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as solicitações da sessão.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function reviewMember(
    member: SessionSettingsMember,
    status: "ACTIVE" | "REMOVED",
  ) {
    if (!campaignId || workingKey) return
    setWorkingKey(`member:${member.id}`)
    setErrorMessage("")
    try {
      await updateSessionMember(campaignId, member.id, {
        status,
        role: "PLAYER",
      })
      await reload()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível revisar a solicitação do usuário.",
      )
    } finally {
      setWorkingKey("")
    }
  }

  async function reviewSpell(
    spell: SessionHomebrewSpell,
    status: "APPROVED" | "REJECTED",
  ) {
    if (!campaignId || workingKey) return
    setWorkingKey(`spell:${spell.id}`)
    setErrorMessage("")
    try {
      await reviewSessionHomebrewSpell(campaignId, spell.id, status)
      if (viewingSpell?.id === spell.id) setViewingSpell(null)
      await reload()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível revisar a magia homebrew.",
      )
    } finally {
      setWorkingKey("")
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
              <ShieldQuestion className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-textH">Solicitações</h1>
              <p className="mt-1 text-sm text-textMuted">
                Caixa central de aprovação para entradas e conteúdo enviado à sessão.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-accentBorder bg-accentBg px-3 py-1 text-xs font-medium text-textH">
            {totalPending} pendente(s)
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <RequestCount label="Usuários" count={pendingMembers.length} />
          <RequestCount label="Personagens" count={0} />
          <RequestCount label="Magias" count={pendingSpells.length} />
          <RequestCount label="Sistemas" count={0} />
          <RequestCount label="Classes" count={0} />
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-10 text-center text-sm text-textMuted">
          Carregando solicitações...
        </div>
      ) : (
        <>
          <RequestSection
            title="Entrada de usuários"
            description="Pedidos de entrada na sessão. Depois de aprovados, o usuário passa a ser membro ativo."
            empty="Nenhuma solicitação de entrada pendente."
          >
            {pendingMembers.map((member) => (
              <article
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-subtle p-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-textH">{member.name}</div>
                  {member.email ? (
                    <div className="mt-1 truncate text-xs text-textMuted">
                      {member.email}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={workingKey === `member:${member.id}`}
                    onClick={() => void reviewMember(member, "ACTIVE")}
                  >
                    <Check className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={Boolean(workingKey)}
                    onClick={() => void reviewMember(member, "REMOVED")}
                  >
                    <X className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </article>
            ))}
          </RequestSection>

          <RequestSection
            title="Magias homebrew"
            description="Magias enviadas por jogadores precisam de aprovação antes de entrarem no acervo homebrew da sessão."
            empty="Nenhuma magia homebrew aguardando aprovação."
          >
            {pendingSpells.map((spell) => (
              <article
                key={spell.linkId}
                className="rounded-xl border border-border bg-bg-subtle p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-textH">{spell.name}</h3>
                      <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                        Magia homebrew
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-textMuted">
                      Autor: {spell.author.name} · Enviado por {spell.submittedBy.name}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-text">
                      {spell.data.description?.trim() || "Sem descrição."}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setViewingSpell(spell)}
                    >
                      <FileQuestion className="h-4 w-4" /> Visualizar
                    </Button>
                    <Button
                      size="sm"
                      loading={workingKey === `spell:${spell.id}`}
                      onClick={() => void reviewSpell(spell, "APPROVED")}
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={Boolean(workingKey)}
                      onClick={() => void reviewSpell(spell, "REJECTED")}
                    >
                      <X className="h-4 w-4" /> Rejeitar
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </RequestSection>
        </>
      )}

      {viewingSpell ? (
        <SpellRequestDetails
          request={viewingSpell}
          working={workingKey === `spell:${viewingSpell.id}`}
          onClose={() => setViewingSpell(null)}
          onApprove={() => void reviewSpell(viewingSpell, "APPROVED")}
          onReject={() => void reviewSpell(viewingSpell, "REJECTED")}
        />
      ) : null}
    </div>
  )
}

function RequestSection({
  title,
  description,
  empty,
  children,
}: {
  title: string
  description: string
  empty: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
      <header className="border-b border-border p-4">
        <h2 className="font-semibold text-textH">{title}</h2>
        <p className="mt-1 text-xs text-textMuted">{description}</p>
      </header>
      <div className="grid gap-3 p-4">
        {hasChildren ? children : (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-textMuted">
            {empty}
          </div>
        )}
      </div>
    </section>
  )
}

function RequestCount({ label, count }: { label: string; count: number }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-textMuted">
      {label}: {count}
    </span>
  )
}

function SpellRequestDetails({
  request,
  working,
  onClose,
  onApprove,
  onReject,
}: {
  request: SessionHomebrewSpell
  working: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const spell: Spell = request.data
  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-bg shadow-xl">
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-bg p-4">
          <div>
            <h2 className="text-lg font-semibold text-textH">{request.name}</h2>
            <p className="mt-1 text-xs text-textMuted">
              {spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} · {spell.school}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button>
        </header>

        <div className="grid gap-4 p-4 text-sm text-text">
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Autor" value={request.author.name} />
            <Info label="Enviado por" value={request.submittedBy.name} />
            <Info label="Concentração" value={spell.concentration ? "Sim" : "Não"} />
            <Info label="Ritual" value={spell.ritual ? "Sim" : "Não"} />
          </div>
          <section>
            <h3 className="font-semibold text-textH">Descrição</h3>
            <p className="mt-2 whitespace-pre-wrap leading-6">
              {spell.description?.trim() || "Sem descrição."}
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-textH">Em níveis superiores</h3>
            <p className="mt-2 whitespace-pre-wrap leading-6">
              {spell.higherLevelText?.trim() || "Sem efeito adicional."}
            </p>
          </section>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-bg p-4">
          <Button variant="danger" disabled={working} onClick={onReject}>
            Rejeitar
          </Button>
          <Button loading={working} onClick={onApprove}>
            Aprovar e adicionar ao homebrew
          </Button>
        </footer>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-sm text-textH">{value}</div>
    </div>
  )
}
