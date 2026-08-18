import { Check, FileQuestion, ShieldQuestion, X } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Navigate, useParams } from "react-router-dom"

import {
  getSessionHomebrew,
  reviewSessionHomebrewSpell,
  type SessionHomebrewCatalog,
  type SessionHomebrewSpell,
} from "../../api/session-homebrew"
import {
  getSessionContentRequests,
  reviewSessionContentRequest,
  type SessionContentRequest,
  type SessionContentRequestType,
} from "../../api/session-requests"
import {
  getSessionCreationSettings,
  updateSessionMember,
  type SessionCreationSettings,
  type SessionSettingsMember,
} from "../../api/session-settings"
import { Button } from "../../components/ui/Button"
import { useCustomSystemsContext } from "../../contexts/customSystemsContext"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { Spell } from "../../models/magic/spells/Spell"

export function SessionCreationRequestsView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const { saveDefinitions } = useCustomSystemsContext()
  const [settings, setSettings] = useState<SessionCreationSettings | null>(null)
  const [homebrew, setHomebrew] = useState<SessionHomebrewCatalog | null>(null)
  const [contentRequests, setContentRequests] = useState<SessionContentRequest[]>([])
  const [viewingSpell, setViewingSpell] = useState<SessionHomebrewSpell | null>(null)
  const [viewingContent, setViewingContent] = useState<SessionContentRequest | null>(null)
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
  const requestsByType = useMemo(() => {
    const result = new Map<SessionContentRequestType, SessionContentRequest[]>()
    for (const entry of contentRequests) {
      const current = result.get(entry.type) ?? []
      current.push(entry)
      result.set(entry.type, current)
    }
    return result
  }, [contentRequests])
  const pendingCharacters = requestsByType.get("CHARACTER") ?? []
  const pendingSystems = requestsByType.get("SYSTEM") ?? []
  const pendingClasses = requestsByType.get("CLASS") ?? []
  const pendingOther = requestsByType.get("OTHER") ?? []
  const totalPending =
    pendingMembers.length + pendingSpells.length + contentRequests.length

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
      const [nextSettings, nextHomebrew, nextContentRequests] = await Promise.all([
        getSessionCreationSettings(campaignId),
        getSessionHomebrew(campaignId),
        getSessionContentRequests(campaignId, "PENDING"),
      ])
      setSettings(nextSettings)
      setHomebrew(nextHomebrew)
      setContentRequests(nextContentRequests)
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

  async function reviewContent(
    request: SessionContentRequest,
    status: "APPROVED" | "REJECTED",
  ) {
    if (!campaignId || workingKey) return
    setWorkingKey(`content:${request.id}`)
    setErrorMessage("")
    try {
      await reviewSessionContentRequest(campaignId, request.id, status)

      if (status === "APPROVED" && request.type === "SYSTEM") {
        const definition = toCustomSystemDefinition(request.data)
        if (definition) saveDefinitions([definition])
      }

      if (viewingContent?.id === request.id) setViewingContent(null)
      await reload()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível revisar a solicitação.",
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
                Caixa central de aprovação para usuários, personagens e conteúdo homebrew enviado à sessão.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-accentBorder bg-accentBg px-3 py-1 text-xs font-medium text-textH">
            {totalPending} pendente(s)
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <RequestCount label="Usuários" count={pendingMembers.length} />
          <RequestCount label="Personagens" count={pendingCharacters.length} />
          <RequestCount label="Magias" count={pendingSpells.length} />
          <RequestCount label="Sistemas" count={pendingSystems.length} />
          <RequestCount label="Classes" count={pendingClasses.length} />
          {pendingOther.length ? (
            <RequestCount label="Outros" count={pendingOther.length} />
          ) : null}
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
                <RequestButtons
                  working={workingKey === `member:${member.id}`}
                  onApprove={() => void reviewMember(member, "ACTIVE")}
                  onReject={() => void reviewMember(member, "REMOVED")}
                />
              </article>
            ))}
          </RequestSection>

          <ContentRequestSection
            title="Personagens"
            description="Personagens enviados por jogadores só entram na sessão depois da aprovação do mestre."
            empty="Nenhum personagem aguardando aprovação."
            requests={pendingCharacters}
            workingKey={workingKey}
            onView={setViewingContent}
            onReview={reviewContent}
          />

          <RequestSection
            title="Magias homebrew"
            description="Magias enviadas por jogadores precisam de aprovação antes de entrarem no acervo Homebrew da sessão."
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
                      <RequestTypeBadge label="Magia homebrew" />
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
                    <RequestButtons
                      working={workingKey === `spell:${spell.id}`}
                      onApprove={() => void reviewSpell(spell, "APPROVED")}
                      onReject={() => void reviewSpell(spell, "REJECTED")}
                    />
                  </div>
                </div>
              </article>
            ))}
          </RequestSection>

          <ContentRequestSection
            title="Sistemas homebrew"
            description="Sistemas aprovados entram no acervo Homebrew e são instalados na sessão."
            empty="Nenhum sistema homebrew aguardando aprovação."
            requests={pendingSystems}
            workingKey={workingKey}
            onView={setViewingContent}
            onReview={reviewContent}
          />

          <ContentRequestSection
            title="Classes homebrew"
            description="Classes aprovadas entram no acervo Homebrew central da sessão."
            empty="Nenhuma classe homebrew aguardando aprovação."
            requests={pendingClasses}
            workingKey={workingKey}
            onView={setViewingContent}
            onReview={reviewContent}
          />

          {pendingOther.length ? (
            <ContentRequestSection
              title="Outros conteúdos"
              description="Outros tipos de conteúdo homebrew enviados para esta sessão."
              empty=""
              requests={pendingOther}
              workingKey={workingKey}
              onView={setViewingContent}
              onReview={reviewContent}
            />
          ) : null}
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

      {viewingContent ? (
        <ContentRequestDetails
          request={viewingContent}
          working={workingKey === `content:${viewingContent.id}`}
          onClose={() => setViewingContent(null)}
          onApprove={() => void reviewContent(viewingContent, "APPROVED")}
          onReject={() => void reviewContent(viewingContent, "REJECTED")}
        />
      ) : null}
    </div>
  )
}

function ContentRequestSection({
  title,
  description,
  empty,
  requests,
  workingKey,
  onView,
  onReview,
}: {
  title: string
  description: string
  empty: string
  requests: SessionContentRequest[]
  workingKey: string
  onView: (request: SessionContentRequest) => void
  onReview: (
    request: SessionContentRequest,
    status: "APPROVED" | "REJECTED",
  ) => Promise<void>
}) {
  return (
    <RequestSection title={title} description={description} empty={empty}>
      {requests.map((request) => (
        <article
          key={request.id}
          className="rounded-xl border border-border bg-bg-subtle p-4"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-textH">{request.title}</h3>
                <RequestTypeBadge label={requestTypeLabel(request.type)} />
              </div>
              <div className="mt-1 text-xs text-textMuted">
                Enviado por {request.submittedBy.name}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onView(request)}
              >
                <FileQuestion className="h-4 w-4" /> Visualizar
              </Button>
              <RequestButtons
                working={workingKey === `content:${request.id}`}
                onApprove={() => void onReview(request, "APPROVED")}
                onReject={() => void onReview(request, "REJECTED")}
              />
            </div>
          </div>
        </article>
      ))}
    </RequestSection>
  )
}

function RequestButtons({
  working,
  onApprove,
  onReject,
}: {
  working: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <>
      <Button size="sm" loading={working} onClick={onApprove}>
        <Check className="h-4 w-4" /> Aprovar
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={working}
        onClick={onReject}
      >
        <X className="h-4 w-4" /> Rejeitar
      </Button>
    </>
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
  children: ReactNode
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

function RequestTypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {label}
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
    <RequestDetailsFrame
      title={request.name}
      subtitle={`${spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} · ${spell.school}`}
      working={working}
      approveLabel="Aprovar e adicionar ao Homebrew"
      onClose={onClose}
      onApprove={onApprove}
      onReject={onReject}
    >
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
    </RequestDetailsFrame>
  )
}

function ContentRequestDetails({
  request,
  working,
  onClose,
  onApprove,
  onReject,
}: {
  request: SessionContentRequest
  working: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const characterRequest = request.type === "CHARACTER"
  return (
    <RequestDetailsFrame
      title={request.title}
      subtitle={`${requestTypeLabel(request.type)} · enviado por ${request.submittedBy.name}`}
      working={working}
      approveLabel={
        characterRequest
          ? "Aprovar e adicionar à sessão"
          : "Aprovar e adicionar ao Homebrew"
      }
      onClose={onClose}
      onApprove={onApprove}
      onReject={onReject}
    >
      {characterRequest ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Info label="Personagem" value={request.title} />
          <Info
            label="Visibilidade"
            value={String(request.data.visibility ?? "PARTY")}
          />
        </div>
      ) : (
        <section>
          <h3 className="font-semibold text-textH">Dados enviados</h3>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {JSON.stringify(request.data, null, 2)}
          </pre>
        </section>
      )}
    </RequestDetailsFrame>
  )
}

function RequestDetailsFrame({
  title,
  subtitle,
  working,
  approveLabel,
  onClose,
  onApprove,
  onReject,
  children,
}: {
  title: string
  subtitle: string
  working: boolean
  approveLabel: string
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-bg shadow-xl">
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-bg p-4">
          <div>
            <h2 className="text-lg font-semibold text-textH">{title}</h2>
            <p className="mt-1 text-xs text-textMuted">{subtitle}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button>
        </header>

        <div className="grid gap-4 p-4 text-sm text-text">{children}</div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-bg p-4">
          <Button variant="danger" disabled={working} onClick={onReject}>
            Rejeitar
          </Button>
          <Button loading={working} onClick={onApprove}>
            {approveLabel}
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

function requestTypeLabel(type: SessionContentRequestType): string {
  if (type === "CHARACTER") return "Personagem"
  if (type === "SYSTEM") return "Sistema homebrew"
  if (type === "CLASS") return "Classe homebrew"
  return "Homebrew"
}

function toCustomSystemDefinition(
  value: Record<string, unknown>,
): CustomSystemDefinition | null {
  if (typeof value.id !== "string" || typeof value.name !== "string") return null
  return value as unknown as CustomSystemDefinition
}
