import { Select as SharedSelect } from "../../components/ui/Select"
import {
  Copy,
  Inbox,
  Settings2,
  ShieldCheck,
  UserMinus,
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
import { useSyncContext } from "../../contexts/syncContext"
import { CharacterSettingsModal } from "../../features/characters/settings/CharacterSettingsModal"
import { useOptionalCreationEditor } from "../../features/creation/CreationEditorProvider"
import {
  isSuppressedConfiguredCustomSystemState,
  reconcileConfiguredCustomSystemStates,
} from "../../lib/customSystems/CustomSystemConfigurationReconciliation"
import { sessionPath } from "../../lib/campaignRoutes"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import type { Player } from "../../models/player/Player"
import {
  CAMPAIGN_DELEGATABLE_CAPABILITIES,
  type CampaignCapability,
  type CampaignCapabilityOverrides,
} from "../../shared/campaign/campaignRoles"
import type {
  CreationCharacterConfiguration,
  CreationCharacterCustomSystemConfiguration,
} from "../../shared/creation/creation.types"

export function SessionCreationSettingsView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const navigate = useNavigate()
  const { campaignCapabilities } = useSyncContext()
  const editor = useOptionalCreationEditor()
  const canViewPermissions = campaignCapabilities.includes("creation.permissions.read")
  const canManageRequests = campaignCapabilities.includes("creation.requests.manage")
  const {
    visibleCharacters: sessionCharacters,
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
        // Ownership and permission editing are security-sensitive and must use
        // current campaign membership instead of a potentially stale preload.
        const next = await getSessionCreationSettings(campaignId!, { force: true })
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

  const creationConfigurationById = useMemo(
    () => new Map(
      (editor?.draft?.characters ?? []).map((configuration) => [
        configuration.characterId,
        configuration,
      ]),
    ),
    [editor?.draft?.characters],
  )

  const customSystemDefinitions = editor?.draft?.customSystems ?? []

  const visibleCharacters = useMemo(
    () => sessionCharacters.map((character) => {
      const configuration = creationConfigurationById.get(character.get("id"))
      if (!configuration) return character

      const configuredOwner =
        resolveActiveCampaignOwner(settings, configuration.ownerId)
        ?? getOwner(configuration.ownerId)

      return applyCreationConfiguration(
        character,
        configuration,
        customSystemDefinitions,
        configuredOwner,
      )
    }),
    [
      creationConfigurationById,
      customSystemDefinitions,
      getOwner,
      sessionCharacters,
      settings,
    ],
  )

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

    if (settings) {
      const users = [settings.owner, ...settings.members].filter(
        (member) => member.status === "ACTIVE",
      )
      for (const member of users) {
        byId.set(member.id, sessionMemberToPlayer(member))
      }
      return byId
    }

    for (const key of knownPlayerKeys) {
      const player = getOwner(key)
      if (player.id) byId.set(player.id, player)
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
    setSettings(await getSessionCreationSettings(campaignId, { force: true }))
  }

  async function changeMember(
    member: SessionSettingsMember,
    input: {
      status: "ACTIVE" | "REMOVED"
      role?: SessionSettingsMember["role"]
      permissions?: CampaignCapabilityOverrides
    },
  ) {
    if (!campaignId || workingUserId || !settings?.canManageMembers) return
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

  function updateCreationCharacter(
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) {
    if (!editor) return
    const source = sessionCharacters.find(
      (character) => character.get("id") === characterId,
    )
    const currentConfiguration = creationConfigurationById.get(characterId)
    if (!source || !currentConfiguration) return

    const current = applyCreationConfiguration(
      source,
      currentConfiguration,
      customSystemDefinitions,
      resolveConfiguredOwner(currentConfiguration.ownerId),
    )
    const updated = updater(current)
    const nextConfiguration = toCreationConfiguration(
      updated,
      currentConfiguration,
    )

    editor.updateDraft((draft) => ({
      ...draft,
      characters: draft.characters.map((configuration) =>
        configuration.characterId === characterId
          ? nextConfiguration
          : configuration,
      ),
    }))
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
              {editor
                ? "Configure as cópias de personagem desta sessão. Alterações de Criação ficam no rascunho até salvar."
                : "Consulte as permissões e os usuários ativos desta sessão."}
            </p>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      {editor ? (
        <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
          <header className="border-b border-border p-4">
            <h2 className="font-semibold text-textH">Personagens da sessão</h2>
            <p className="mt-1 text-xs text-textMuted">
              Alterações de personagem ficam no rascunho de Criação até você salvar.
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
      ) : null}

      {canViewPermissions ? (
        <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-accent" />
                <h2 className="font-semibold text-textH">Usuários da sessão</h2>
              </div>
              <p className="mt-1 text-xs text-textMuted">
                {settings?.canManageMembers
                  ? "Use o papel como perfil base e personalize capacidades individuais quando necessário."
                  : "Visualização dos papéis e capacidades efetivas atuais da sessão."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canManageRequests && pendingMemberCount ? (
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
                    canEdit={settings.canManageMembers}
                    onRoleChange={settings.canManageMembers
                      ? (role) =>
                          void changeMember(member, {
                            status: "ACTIVE",
                            role,
                            // Role change intentionally returns to that role's
                            // documented baseline instead of carrying hidden
                            // exceptions from the previous role.
                            permissions: {},
                          })
                      : undefined}
                    onCapabilityChange={settings.canManageMembers
                      ? (capability, enabled) =>
                          void changeMember(member, {
                            status: "ACTIVE",
                            permissions: {
                              ...member.permissions,
                              [capability]: enabled,
                            },
                          })
                      : undefined}
                    onResetCapabilities={settings.canManageMembers
                      ? () =>
                          void changeMember(member, {
                            status: "ACTIVE",
                            permissions: {},
                          })
                      : undefined}
                    onRemove={settings.canManageMembers
                      ? () => {
                          if (
                            window.confirm(
                              `Expulsar ${member.name} da sessão? A participação será removida, os personagens vinculados serão retirados da campanha e as conexões abertas desse usuário serão encerradas.`,
                            )
                          ) {
                            void changeMember(member, { status: "REMOVED" })
                          }
                        }
                      : undefined}
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
      ) : null}

      {editor && selectedCharacter ? (
        <CharacterSettingsModal
          open
          onClose={() => setSelectedCharacterId("")}
          character={selectedCharacter}
          updateCharacter={updateCreationCharacter}
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
  canEdit = false,
  onRoleChange,
  onCapabilityChange,
  onResetCapabilities,
  onRemove,
}: {
  member: SessionSettingsMember
  owner?: boolean
  working?: boolean
  canEdit?: boolean
  onRoleChange?: (role: SessionSettingsMember["role"]) => void
  onCapabilityChange?: (capability: CampaignCapability, enabled: boolean) => void
  onResetCapabilities?: () => void
  onRemove?: () => void
}) {
  const customizedCount = Object.keys(member.permissions ?? {}).length

  return (
    <article className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-textH">{member.name}</span>
            {owner ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                <ShieldCheck className="h-3 w-3" /> Mestre principal
              </span>
            ) : null}
            {!owner && customizedCount > 0 ? (
              <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                {customizedCount} acesso{customizedCount === 1 ? "" : "s"} personalizado{customizedCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {member.email ? (
            <div className="mt-1 truncate text-xs text-textMuted">{member.email}</div>
          ) : null}
        </div>

        {owner ? (
          <div className="text-xs font-medium text-textMuted">Mestre</div>
        ) : canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <SharedSelect
              value={member.role}
              disabled={working}
              onChange={(event) =>
                onRoleChange?.(event.target.value as SessionSettingsMember["role"])
              }
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH outline-none"
            >
              <option value="PLAYER">Jogador</option>
              <option value="ASSISTANT">Assistente</option>
              <option value="MODERATOR">Moderador</option>
              <option value="MASTER">Mestre</option>
            </SharedSelect>

            {onRemove ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={working}
                onClick={onRemove}
              >
                <UserMinus className="h-4 w-4" />
                Expulsar
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="text-xs font-medium text-textMuted">
            {roleLabel(member.role)}
          </div>
        )}
      </div>

      {!owner ? (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-textH">
            Acessos detalhados
          </summary>
          <p className="mt-2 text-xs leading-5 text-textMuted">
            O papel define o padrão. Cada opção abaixo pode ser concedida ou retirada individualmente sem alterar o restante do papel.
          </p>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {CAMPAIGN_DELEGATABLE_CAPABILITIES.map((entry) => {
              const enabled = member.capabilities.includes(entry.capability)
              const customized = Object.prototype.hasOwnProperty.call(
                member.permissions,
                entry.capability,
              )
              return (
                <label
                  key={entry.capability}
                  className="flex gap-3 rounded-lg border border-border bg-bg-subtle p-3"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!canEdit || working}
                    onChange={(event) =>
                      onCapabilityChange?.(entry.capability, event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-textH">
                      {entry.label}
                      {customized ? (
                        <span className="rounded-full border border-accentBorder px-1.5 py-0.5 text-[9px] font-medium text-accent">
                          personalizado
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-textMuted">
                      {entry.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          {canEdit && customizedCount > 0 ? (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={working}
                onClick={onResetCapabilities}
              >
                Restaurar padrão do papel
              </Button>
            </div>
          ) : null}
        </details>
      ) : null}
    </article>
  )
}

function roleLabel(role: SessionSettingsMember["role"]): string {
  if (role === "MASTER") return "Mestre"
  if (role === "ASSISTANT") return "Assistente"
  if (role === "MODERATOR") return "Moderador"
  return "Jogador"
}

function resolveActiveCampaignOwner(
  settings: SessionCreationSettings | null,
  ownerId: string,
): Player | undefined {
  if (!settings) return undefined
  const member = [settings.owner, ...settings.members].find(
    (entry) => entry.id === ownerId && entry.status === "ACTIVE",
  )
  return member ? sessionMemberToPlayer(member) : undefined
}

function sessionMemberToPlayer(member: SessionSettingsMember): Player {
  return {
    id: member.id,
    name: member.name,
    role: member.role === "MASTER" ? "master" : "player",
  }
}

function applyCreationConfiguration(
  character: CharacterTemplate,
  configuration: CreationCharacterConfiguration,
  definitions: CustomSystemDefinition[],
  owner: Player,
): CharacterTemplate {
  const currentSystems = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const reconciledSystems = reconcileConfiguredCustomSystemStates(
    currentSystems,
    configuration.customSystems,
    definitions,
  )

  return character
    .with("visibility", configuration.visibility)
    .with("unique", configuration.unique)
    .with("owner", {
      ...owner,
      id: configuration.ownerId,
    })
    .withSheet("type", configuration.type)
    .withSheet("hiddenCharacterTabs", [...configuration.hiddenCharacterTabs])
    .withSheet("customSystems", reconciledSystems)
}

function toCreationConfiguration(
  character: CharacterTemplate,
  previous: CreationCharacterConfiguration,
): CreationCharacterConfiguration {
  const sheet = character.get("sheet")
  const states = (sheet.customSystems ?? []) as CharacterCustomSystemState[]

  return {
    characterId: character.get("id"),
    type: sheet.type,
    visibility: character.get("visibility"),
    unique: character.get("unique"),
    ownerId: character.get("owner")?.id || previous.ownerId,
    hiddenCharacterTabs: [...(sheet.hiddenCharacterTabs ?? [])],
    customSystems: states.map(toCreationCustomSystemConfiguration),
  }
}

function toCreationCustomSystemConfiguration(
  state: CharacterCustomSystemState,
): CreationCharacterCustomSystemConfiguration {
  return {
    systemId: state.systemId,
    systemVersion: state.systemVersion,
    enabled: state.enabled,
    suppressed: isSuppressedConfiguredCustomSystemState(state) || undefined,
    abilityAcquisitionExceptions: state.abilityAcquisitionExceptions,
    installationSource: state.installationSource,
  }
}
