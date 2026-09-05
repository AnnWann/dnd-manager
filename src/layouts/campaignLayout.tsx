import { LogOut } from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  buildSessionCharacterSnapshots,
  getCampaignSessionCharacters,
  invalidateCampaignSessionCharacters,
  type CampaignSessionMember,
} from "../api/campaign-session"
import { getSessionHomebrew } from "../api/session-homebrew"
import { authClient } from "../auth/auth-client"
import { getLocalUser, LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import {
  AppSidebar,
  IconBackpack,
  IconCharacter,
  IconCompendium,
  IconEquipment,
  IconGround,
  IconInitiative,
  IconMagic,
  IconNotes,
} from "../components/AppSidebar"
import { AppHeader } from "../components/AppTopBar"
import { CharacterProvider } from "../contexts/characterContext"
import { CreatureCompendiumProvider } from "../contexts/creatureCompendiumContext"
import { CustomSystemsProvider } from "../contexts/customSystemsContext"
import { MagicProvider } from "../contexts/magicContext"
import { MissionProvider } from "../contexts/missionContext"
import { PartyInventorySettingsProvider } from "../contexts/partyInventorySettingsContext"
import { SyncProvider } from "../contexts/syncContext"
import { MasterConcentrationAlerts } from "../features/characters/characterSheet/masterConcentrationAlerts"
import { SessionActionLog } from "../features/session/SessionActionLog"
import { SessionPresenceIndicator } from "../features/session/SessionPresenceIndicator"
import { RelationalMigrationBridge } from "../features/sync/RelationalMigrationBridge"
import {
  clearActiveSession,
  readSessionStateOwner,
  rememberSessionStateOwner,
} from "../lib/activeCampaign"
import { sessionIdFromPathname, sessionPath } from "../lib/campaignRoutes"
import { normalizeAppStateInventory } from "../lib/normalizeAppStateInventory"
import { type AppStateV1 } from "../lib/remoteState"
import { useConcurrentRemoteAppState } from "../lib/remoteStateConcurrent"
import { SESSION_CONTENT_CHANGED_EVENT } from "../lib/sessionEvents"
import type { Spell } from "../models/magic/spells/Spell"
import {
  fromCampaignUiRole,
  resolveEffectiveCampaignCapabilities,
  toCampaignUiRole,
  type CampaignCapability,
  type CampaignUiRole,
} from "../shared/campaign/campaignRoles"
import {
  LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE,
  LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE,
  readLegacySessionBootstrap,
} from "../shared/legacy/legacyCampaignBackup"
import { AppRouter } from "../Router"

type SessionCompatibleAppState = AppStateV1 & {
  partyAdditionalSupplyConsumption?: number
  missions?: unknown[]
}

type CreationNavItem = {
  label: string
  path: string
  icon: React.ReactNode
  capability?: CampaignCapability
  permissionOrSettings?: boolean
}

export function CampaignLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = sessionIdFromPathname(location.pathname)
  const { data: authSession } = authClient.useSession()
  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const authenticatedUserId = authSession?.user?.id ?? localUser?.id ?? ""
  const [resolvedSessionRole, setResolvedSessionRole] = useState<CampaignUiRole | null>(null)
  const [resolvedSessionCapabilities, setResolvedSessionCapabilities] = useState<CampaignCapability[]>([])
  const [sessionMembers, setSessionMembers] = useState<CampaignSessionMember[]>([])
  const [sessionReady, setSessionReady] = useState(!sessionId)
  const [sessionLoadError, setSessionLoadError] = useState("")
  const [sessionContentRevision, setSessionContentRevision] = useState(0)

  const toSession = useCallback(
    (path: string) => sessionId ? sessionPath(sessionId, path) : "/user/campaigns",
    [sessionId],
  )

  const {
    syncKey,
    setSyncKey,
    userRole,
    setUserRole,
    userKey,
    setUserKey,
    canSync,
    state: rawAppState,
    setState: setRawAppState,
    status: syncStatus,
    pullFromServer,
  } = useConcurrentRemoteAppState()

  const appState = useMemo(
    () => normalizeAppStateInventory(rawAppState),
    [rawAppState],
  )

  const setAppState = useCallback<Dispatch<SetStateAction<AppStateV1>>>(
    (action) => {
      setRawAppState((previousRaw) => {
        const previous = normalizeAppStateInventory(previousRaw)
        const next =
          typeof action === "function"
            ? (action as (state: AppStateV1) => AppStateV1)(previous)
            : action

        return normalizeAppStateInventory(next)
      })
    },
    [setRawAppState],
  )

  useEffect(() => {
    function refreshSessionContent() {
      if (sessionId) invalidateCampaignSessionCharacters(sessionId)
      setSessionContentRevision((current) => current + 1)
    }

    window.addEventListener(
      SESSION_CONTENT_CHANGED_EVENT,
      refreshSessionContent,
    )
    return () => {
      window.removeEventListener(
        SESSION_CONTENT_CHANGED_EVENT,
        refreshSessionContent,
      )
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setResolvedSessionRole(null)
      setResolvedSessionCapabilities([])
      setSessionMembers([])
      setSessionLoadError("")
      setSessionReady(true)
      return
    }

    if (!authenticatedUserId) {
      setResolvedSessionRole(null)
      setResolvedSessionCapabilities([])
      setSessionMembers([])
      setSessionLoadError("")
      setSessionReady(false)
      return
    }

    let cancelled = false
    setResolvedSessionRole(null)
    setResolvedSessionCapabilities([])
    setSessionMembers([])
    setSessionReady(false)
    setSessionLoadError("")

    void Promise.all([
      getCampaignSessionCharacters(sessionId, authenticatedUserId),
      getSessionHomebrew(sessionId),
    ])
      .then(([data, homebrew]) => {
        if (cancelled) return

        setResolvedSessionRole(toCampaignUiRole(data.campaign.role))
        setResolvedSessionCapabilities(
          data.campaign.capabilities
          ?? resolveEffectiveCampaignCapabilities(
            data.campaign.role,
            data.campaign.permissions ?? {},
          ),
        )
        setSessionMembers(data.members ?? [])

        const sourceSnapshots = buildSessionCharacterSnapshots(data)
        const approvedSpells = homebrew.spells
          .filter((entry) => entry.status === "APPROVED")
          .map((entry) => ({
            ...entry.data,
            homebrew: true,
          }))
        const importedSpells = homebrew.assets
          .filter((asset) => asset.type === "SPELL")
          .map((asset) => asset.data as unknown as Spell)
          .filter(
            (spell) =>
              Boolean(spell) &&
              typeof spell.index === "string" &&
              spell.index.trim().length > 0,
          )
        const bootstrapAsset = homebrew.assets.find(
          (asset) =>
            asset.type === LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE &&
            asset.sourceId === LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE,
        )
        const legacyBootstrap = readLegacySessionBootstrap(bootstrapAsset?.data)
        const stateBelongsToThisSession = readSessionStateOwner() === sessionId

        setAppState((previous) => {
          const previousCompatible = previous as SessionCompatibleAppState
          const existingById = stateBelongsToThisSession
            ? new Map(previous.characters.map((character) => [character.id, character]))
            : new Map<string, (typeof previous.characters)[number]>()

          const characters = sourceSnapshots.map(
            (source) => existingById.get(source.id) ?? source,
          )
          const preferredActiveId = stateBelongsToThisSession
            ? previous.activeCharacterId
            : legacyBootstrap?.activeCharacterId ?? ""
          const activeCharacterId = characters.some(
            (character) => character.id === preferredActiveId,
          )
            ? preferredActiveId
            : characters[0]?.id ?? ""

          const spellMap = new Map(
            (stateBelongsToThisSession ? previous.spells ?? [] : importedSpells).map(
              (spell) => [spell.index, spell],
            ),
          )
          for (const spell of approvedSpells) {
            spellMap.set(spell.index, spell)
          }
          const spells = Array.from(spellMap.values())

          const partyInventory = stateBelongsToThisSession
            ? previous.partyInventory ?? []
            : legacyBootstrap?.partyInventory ?? []
          const groundInventory = stateBelongsToThisSession
            ? previous.groundInventory ?? []
            : legacyBootstrap?.groundInventory ?? []
          const partyCarryCapacity = stateBelongsToThisSession
            ? previous.partyCarryCapacity ?? 0
            : legacyBootstrap?.partyCarryCapacity ?? 0
          const partyAdditionalSupplyConsumption = stateBelongsToThisSession
            ? previousCompatible.partyAdditionalSupplyConsumption ?? 0
            : legacyBootstrap?.partyAdditionalSupplyConsumption ?? 0
          const missions = stateBelongsToThisSession
            ? previousCompatible.missions ?? []
            : legacyBootstrap?.missions ?? []

          const charactersUnchanged =
            stateBelongsToThisSession &&
            previous.activeCharacterId === activeCharacterId &&
            previous.characters.length === characters.length &&
            previous.characters.every(
              (character, index) => character.id === characters[index]?.id,
            )
          const spellsUnchanged =
            stateBelongsToThisSession &&
            JSON.stringify(previous.spells ?? []) === JSON.stringify(spells)
          const sharedStateUnchanged =
            stateBelongsToThisSession &&
            JSON.stringify(previous.partyInventory ?? []) === JSON.stringify(partyInventory) &&
            JSON.stringify(previous.groundInventory ?? []) === JSON.stringify(groundInventory) &&
            (previous.partyCarryCapacity ?? 0) === partyCarryCapacity &&
            (previousCompatible.partyAdditionalSupplyConsumption ?? 0) === partyAdditionalSupplyConsumption &&
            JSON.stringify(previousCompatible.missions ?? []) === JSON.stringify(missions)

          if (charactersUnchanged && spellsUnchanged && sharedStateUnchanged) return previous

          return {
            ...previous,
            characters,
            activeCharacterId,
            spells,
            partyInventory,
            groundInventory,
            partyCarryCapacity,
            partyAdditionalSupplyConsumption,
            missions,
          } as SessionCompatibleAppState
        })

        rememberSessionStateOwner(sessionId)
        setSessionReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setResolvedSessionRole(null)
        setResolvedSessionCapabilities([])
        setSessionMembers([])
        setSessionLoadError("Não foi possível carregar o conteúdo vinculado a esta sessão.")
        setSessionReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [authenticatedUserId, sessionContentRevision, sessionId, setAppState])

  const effectiveUserRole: CampaignUiRole = resolvedSessionRole ?? userRole
  const effectiveUserKey = authenticatedUserId || userKey
  const effectiveCapabilities = useMemo(
    () => sessionId
      ? resolvedSessionCapabilities
      : resolveEffectiveCampaignCapabilities(fromCampaignUiRole(effectiveUserRole)),
    [effectiveUserRole, resolvedSessionCapabilities, sessionId],
  )
  const capabilitySet = useMemo(
    () => new Set(effectiveCapabilities),
    [effectiveCapabilities],
  )
  const isCreationMode = Boolean(
    sessionId && location.pathname.startsWith(toSession("creation")),
  )

  const canManageSettings = capabilitySet.has("creation.settings.manage")
  const canReadPermissions = capabilitySet.has("creation.permissions.read")
  const creationNavItems = useMemo<CreationNavItem[]>(() => [
    ...(canManageSettings || canReadPermissions
      ? [{
          label: canReadPermissions && !canManageSettings ? "Permissões" : "Configuração",
          path: "creation/settings",
          icon: <IconCompendium />,
          permissionOrSettings: true,
        }]
      : []),
    ...(capabilitySet.has("creation.requests.manage")
      ? [{ label: "Solicitações", path: "creation/requests", icon: <IconNotes />, capability: "creation.requests.manage" as const }]
      : []),
    ...(capabilitySet.has("creation.homebrew.manage")
      ? [{ label: "Homebrew", path: "creation/homebrew", icon: <IconCompendium />, capability: "creation.homebrew.manage" as const }]
      : []),
    ...(capabilitySet.has("creation.items.manage")
      ? [{ label: "Compêndio de Itens", path: "creation/items-compendium", icon: <IconEquipment />, capability: "creation.items.manage" as const }]
      : []),
    ...(capabilitySet.has("creation.creatures.manage")
      ? [{ label: "Compêndio de Criaturas", path: "creation/creatures-compendium", icon: <IconCompendium />, capability: "creation.creatures.manage" as const }]
      : []),
    ...(capabilitySet.has("creation.systems.manage")
      ? [{ label: "Sistemas personalizados", path: "creation/custom-systems", icon: <IconCompendium />, capability: "creation.systems.manage" as const }]
      : []),
    ...(capabilitySet.has("creation.magic.manage")
      ? [{ label: "Magia", path: "creation/magic", icon: <IconMagic />, capability: "creation.magic.manage" as const }]
      : []),
  ], [canManageSettings, canReadPermissions, capabilitySet])

  const canAccessCreation = creationNavItems.length > 0
  const firstCreationPath = creationNavItems[0]?.path ?? "characters"

  const isAllowedCreationPath = useCallback((pathname: string) => {
    return creationNavItems.some((item) => {
      const destination = toSession(item.path)
      return item.path === "creation/custom-systems"
        ? pathname === destination || pathname.startsWith(`${destination}/`)
        : pathname === destination
    })
  }, [creationNavItems, toSession])

  useEffect(() => {
    if (!sessionReady || !isCreationMode) return
    if (!canAccessCreation) {
      navigate(toSession("characters"), { replace: true })
      return
    }
    if (!isAllowedCreationPath(location.pathname)) {
      navigate(toSession(firstCreationPath), { replace: true })
    }
  }, [
    canAccessCreation,
    firstCreationPath,
    isAllowedCreationPath,
    isCreationMode,
    location.pathname,
    navigate,
    sessionReady,
    toSession,
  ])

  useEffect(() => {
    if (appState === rawAppState) return
    setRawAppState(appState)
  }, [appState, rawAppState, setRawAppState])

  function leaveSession() {
    clearActiveSession()
    navigate("/user")
  }

  const sessionSidebarItems = [
    {
      label: "Personagens",
      icon: <IconCharacter />,
      active:
        location.pathname === toSession("characters") ||
        location.pathname.startsWith(`${toSession("character")}/`) ||
        location.pathname === toSession("character"),
      onClick: () => navigate(toSession("characters")),
    },
    {
      label: "Inventário do grupo",
      icon: <IconBackpack />,
      active: location.pathname === toSession("party-inventory"),
      onClick: () => navigate(toSession("party-inventory")),
    },
    {
      label: "Chão",
      icon: <IconGround />,
      active: location.pathname === toSession("ground-inventory"),
      onClick: () => navigate(toSession("ground-inventory")),
    },
    {
      label: "Missões",
      icon: <IconNotes />,
      active: location.pathname === toSession("missions"),
      onClick: () => navigate(toSession("missions")),
    },
    {
      label: "Iniciativa",
      icon: <IconInitiative />,
      active: location.pathname === toSession("initiative"),
      onClick: () => navigate(toSession("initiative")),
    },
  ]

  const creationSidebarItems = creationNavItems.map((item) => ({
    label: item.label,
    icon: item.icon,
    active: item.path === "creation/custom-systems"
      ? location.pathname === toSession(item.path) || location.pathname.startsWith(`${toSession(item.path)}/`)
      : location.pathname === toSession(item.path),
    onClick: () => navigate(toSession(item.path)),
  }))

  const sidebarItems = [
    ...(canAccessCreation && isCreationMode
      ? creationSidebarItems
      : sessionSidebarItems),
    {
      label: "Sair da sessão",
      icon: <LogOut />,
      active: false,
      onClick: leaveSession,
    },
  ]

  const modeSwitcher = canAccessCreation ? (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1">
      <button
        type="button"
        onClick={() => navigate(toSession("characters"))}
        className={
          !isCreationMode
            ? "rounded-md bg-accentBg px-2 py-2 text-xs font-semibold text-textH"
            : "rounded-md px-2 py-2 text-xs font-medium text-textMuted hover:bg-bg-subtle hover:text-textH"
        }
      >
        Sessão
      </button>
      <button
        type="button"
        onClick={() => navigate(toSession(firstCreationPath))}
        className={
          isCreationMode
            ? "rounded-md bg-accentBg px-2 py-2 text-xs font-semibold text-textH"
            : "rounded-md px-2 py-2 text-xs font-medium text-textMuted hover:bg-bg-subtle hover:text-textH"
        }
      >
        Criação
      </button>
    </div>
  ) : undefined

  const NoSideBar = ["/auth", "/not-found"].includes(location.pathname)

  if (NoSideBar) {
    return (
      <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
        <AppRouter />
      </div>
    )
  }

  if (sessionId && !sessionReady) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[color:var(--surface-app)] text-sm text-textMuted">
        Carregando sessão...
      </div>
    )
  }

  if (sessionId && sessionLoadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[color:var(--surface-app)] p-4">
        <div className="max-w-lg rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {sessionLoadError}
        </div>
      </div>
    )
  }

  return (
    <SyncProvider
      value={{
        syncKey,
        setSyncKey,
        userRole: effectiveUserRole,
        setUserRole: (role) => setUserRole(role === "master" ? "master" : "player"),
        campaignCapabilities: effectiveCapabilities,
        userKey: effectiveUserKey,
        setUserKey,
        canSync,
        pullFromServer,
        syncStatus,
      }}
    >
      <CustomSystemsProvider>
        <RelationalMigrationBridge state={appState} />
        <PartyInventorySettingsProvider
          carryCapacity={appState.partyCarryCapacity ?? 0}
          additionalSupplyConsumption={
            (appState as SessionCompatibleAppState).partyAdditionalSupplyConsumption ?? 0
          }
          canEditCarryCapacity={effectiveUserRole === "master"}
          setAppState={setAppState}
        >
          <MissionProvider
            state={rawAppState}
            setState={setRawAppState}
            userRole={effectiveUserRole === "master" ? "master" : "player"}
            userKey={effectiveUserKey}
          >
            <CreatureCompendiumProvider>
              <CharacterProvider
                appState={appState}
                setAppState={setAppState}
                userRole={effectiveUserRole}
                userKey={effectiveUserKey}
              >
                <MasterConcentrationAlerts />
                <MagicProvider
                  spells={appState.spells ?? []}
                  setAppState={setAppState}
                >
                  <div className="fixed inset-0 flex w-full max-w-full flex-col overflow-hidden bg-[color:var(--surface-app)] text-text">
                    <AppHeader
                      rightContent={
                        sessionId ? (
                          <SessionPresenceIndicator members={sessionMembers} />
                        ) : undefined
                      }
                    />

                    <div className="flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
                      <AppSidebar items={sidebarItems} topContent={modeSwitcher} />
                      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto has-[[aria-modal=true]]:overflow-y-hidden">
                        <div className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
                          <AppRouter />
                        </div>
                      </main>
                      {effectiveUserRole === "master" && !isCreationMode ? (
                        <SessionActionLog />
                      ) : null}
                    </div>
                  </div>
                </MagicProvider>
              </CharacterProvider>
            </CreatureCompendiumProvider>
          </MissionProvider>
        </PartyInventorySettingsProvider>
      </CustomSystemsProvider>
    </SyncProvider>
  )
}
