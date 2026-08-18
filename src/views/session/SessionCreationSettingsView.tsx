import {
  Copy,
  Inbox,
  Settings2,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import {
  getSessionCreationSettings,
  updateSessionMember,
  type SessionCreationSettings,
  type SessionSettingsMember,
} from "../../api/session-settings"
import { Button } from "../../components/ui/Button"
import { useCharacterContext } from "../../contexts/characterContext"
import { CharacterSettingsModal } from "../../features/characters/settings/CharacterSettingsModal"
import { sessionPath } from "../../lib/campaignRoutes"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { Player } from "../../models/player/Player"

export function SessionCreationSettingsView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const navigate = useNavigate()
  const {
    visibleCharacters,
    updateCharacter,
    canAssignOwners,
    canEditCharacterType,
    knownPlayerKeys,
    getOwner,
    createOwner,
  } = useCharacterContext()
  const [settings, setSettings] = useState<SessionCreationSettings | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState("")
  const [loading, setLoading] = useState(true)
  const [workingUserId, setWorkingUserId] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage("")
      try {
        const next = await getSessionCreationSettings(campaignId!)
        if (!cancelled) setSettings(next)
      } catch (error) {
        if (!cancelled) {
          setSettings(null)
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as configurações da sessão.",
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const selectedCharacter = useMemo(
    () => visibleCharacters.find((entry) => entry.get("id") === selectedCharacterId),
    [selectedCharacterId, visibleCharacters],
  )

  const activeMembers = useMemo(
    () => settings?.members.filter((member) => member.status === "ACTIVE") ?? [],
    [settings],
  )
  const pendingMemberCount = useMemo(
    () => settings?.members.filter((member) => member.status === "INVITED").length ?? 0,
    [settings],
  )

  const configuredPlayers = useMemo(() => {
    const byId = new Map<string, Player>()

    for (const key of knownPlayerKeys) {
      const player = getOwner(key)
      if (player.id) byId.set(player.id, player)
    }

    if (settings) {
      const users = [settings.owner, ...settings.members].filter(
        (member) => member.status === "ACTIVE",
      )
      for (const member of users) {
        byId.set(member.id, {
          id: member.id,
          name: member.name,
          role: member.role === "MASTER" ? "master" : "player",
        })
      }
    }

    return byId
  }, [getOwner, knownPlayerKeys, settings])

  const configuredPlayerKeys = useMemo(
    () => Array.from(configuredPlayers.keys()).sort((left, right) =>
      configuredPlayers.get(left)!.name.localeCompare(
        configuredPlayers.get(right)!.name,
        "pt-BR",
      ),
    ),
    [configuredPlayers],
  )

  function resolveConfiguredOwner(ownerId: string): Player {
    return configuredPlayers.get(ownerId) ?? getOwner(ownerId)
  }

  if (!campaignId) return <Navigate to="/not-found" replace />

  async function reloadUsers() {
    if (!campaignId) return
    setSettings(await getSessionCreationSettings(campaignId))
  }

  async function changeMember(
    member: SessionSettingsMember,
    input: { status: "ACTIVE" | "REMOVED"; role?: "MASTER" | "PLAYER" },
  ) {
    if (!campaignId || workingUserId) return
    setWorkingUserId(member.id)
    setErrorMessage("")
    try {
      await updateSessionMember(campaignId, member.id, input)
      await reloadUsers()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o usuário.",
      )
    } finally {
      setWorkingUserId("")
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="rounded-xl border border-border bg-bg p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-textH">Configuração</h1>
            <p className="mt-1 text-sm text-textMuted">
              Configure as cópias de personagem e os usuários ativos desta sessão. Novas entradas são revisadas em Solicitações.
            </p>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <header className="border-b border-border p-4">
          <h2 className="font-semibold text-textH">Personagens da sessão</h2>
          <p className="mt-1 text-xs text-textMuted">
            Estas configurações afetam apenas a cópia usada nesta sessão.
          </p>
        </header>

        <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleCharacters.length ? (
            visibleCharacters.map((character) => (
              <CharacterConfigurationCard
                key={character.get("id")}
                character={character}
                onConfigure={() => setSelectedCharacterId(character.get("id"))}
              />
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-textMuted">
              Nenhum personagem está carregado nesta sessão.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-accent" />
              <h2 className="font-semibold text-textH">Usuários da sessão</h2>
            </div>
            <p className="mt-1 text-xs text-textMuted">
              Gerencie papéis e acesso dos membros já aprovados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {pendingMemberCount ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(sessionPath(campaignId, "creation/requests"))}
              >
                <Inbox className="h-4 w-4" />
                {pendingMemberCount} solicitação(ões)
              </Button>
            ) : null}

            {settings?.campaign.inviteCode ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(settings.campaign.inviteCode ?? "")}
              >
                <Copy className="h-4 w-4" />
                Copiar convite
              </Button>
            ) : null}
          </div>
        </header>

        <div className="p-4">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-textMuted">
              Carregando usuários...
            </div>
          ) : settings ? (
            <div className="grid gap-3">
              <MemberRow member={settings.owner} owner />
              {activeMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  working={workingUserId === member.id}
                  onRoleChange={(role) =>
                    void changeMember(member, {
                      status: "ACTIVE",
                      role,
                    })
                  }
                  onRemove={() => {
                    if (
                      window.confirm(
                        `Remover ${member.name} da sessão? Os personagens vinculados desse usuário também serão desvinculados da campanha.`,
                      )
                    ) {
                      void changeMember(member, { status: "REMOVED" })
                    }
                  }}
                />
              ))}
              {!activeMembers.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-textMuted">
                  Nenhum outro usuário ativo participa desta sessão.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {selectedCharacter ? (
        <CharacterSettingsModal
          open
          onClose={() => setSelectedCharacterId("")}
          character={selectedCharacter}
          updateCharacter={updateCharacter}
          canAssignOwners={canAssignOwners}
          canEditCharacterType={canEditCharacterType}
          playerKeys={configuredPlayerKeys}
          getOwner={resolveConfiguredOwner}
          createOwner={createOwner}
        />
      ) : null}
    </div>
  )
}

function CharacterConfigurationCard({
  character,
  onConfigure,
}: {
  character: CharacterTemplate
  onConfigure: () => void
}) {
  const owner = character.get("owner")
  const type = character.get("sheet").type

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-border bg-bg-subtle p-4">
      <div className="min-w-0">
        <div className="truncate font-semibold text-textH">{character.get("name")}</div>
        <div className="mt-1 truncate text-xs text-textMuted">
          {owner?.name || owner?.id || "Sem jogador"} · {type || "personagem"}
        </div>
      </div>
      <div className="mt-4">
        <Button className="w-full" variant="secondary" onClick={onConfigure}>
          <Settings2 className="h-4 w-4" />
          Configurar personagem
        </Button>
      </div>
    </article>
  )
}

function MemberRow({
  member,
  owner = false,
  working = false,
  onRoleChange,
  onRemove,
}: {
  member: SessionSettingsMember
  owner?: boolean
  working?: boolean
  onRoleChange?: (role: "MASTER" | "PLAYER") => void
  onRemove?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-textH">{member.name}</span>
          {owner ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
              <ShieldCheck className="h-3 w-3" /> Mestre principal
            </span>
          ) : null}
        </div>
        {member.email ? (
          <div className="mt-1 truncate text-xs text-textMuted">{member.email}</div>
        ) : null}
      </div>

      {owner ? (
        <div className="text-xs font-medium text-textMuted">Mestre</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={member.role}
            disabled={working}
            onChange={(event) =>
              onRoleChange?.(event.target.value as "MASTER" | "PLAYER")
            }
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH outline-none"
          >
            <option value="PLAYER">Jogador</option>
            <option value="MASTER">Mestre</option>
          </select>

          <Button
            size="sm"
            variant="secondary"
            disabled={working}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        </div>
      )}
    </div>
  )
}
