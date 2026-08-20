import { lazy, Suspense } from "react"
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom"

import { RequireAuth } from "./auth/requireAuth"
import { readActiveSession } from "./lib/activeCampaign"
import { sessionPath } from "./lib/campaignRoutes"

const AuthView = lazy(() => import("./views/AuthView").then((module) => ({ default: module.AuthView })))
const NotFoundView = lazy(() => import("./views/NotFoundView").then((module) => ({ default: module.NotFoundView })))
const UnauthorizedView = lazy(() => import("./views/UnauthorisedView").then((module) => ({ default: module.UnauthorizedView })))
const UserDashboardView = lazy(() => import("./views/user/UserDashboardView").then((module) => ({ default: module.UserDashboardView })))
const UserCharactersTab = lazy(() => import("./views/user/UserCharactersTab").then((module) => ({ default: module.UserCharactersTab })))
const UserCharacterCreateView = lazy(() => import("./views/user/UserCharacterCreateView").then((module) => ({ default: module.UserCharacterCreateView })))
const UserCharacterLevelUpView = lazy(() => import("./views/user/UserCharacterLevelUpView").then((module) => ({ default: module.UserCharacterLevelUpView })))
const UserCharacterAddSpellsView = lazy(() => import("./views/user/UserCharacterAddSpellsView").then((module) => ({ default: module.UserCharacterAddSpellsView })))
const UserCharacterCreateItemView = lazy(() => import("./views/user/UserCharacterCreateItemView").then((module) => ({ default: module.UserCharacterCreateItemView })))
const UserCharacterDetailView = lazy(() => import("./views/user/UserCharacterDetailView").then((module) => ({ default: module.UserCharacterDetailView })))
const UserSpellsTab = lazy(() => import("./views/user/UserSpellsTab").then((module) => ({ default: module.UserSpellsTab })))
const UserCampaignsRouteView = lazy(() => import("./views/user/UserCampaignsRouteView").then((module) => ({ default: module.UserCampaignsRouteView })))
const UserMagicRouteBoundary = lazy(() => import("./features/magic/UserMagicRouteBoundary").then((module) => ({ default: module.UserMagicRouteBoundary })))
const SessionRouteOutlet = lazy(() => import("./features/session-runtime/SessionRouteOutlet").then((module) => ({ default: module.SessionRouteOutlet })))
const CreationEditorRouteOutlet = lazy(() => import("./features/creation/CreationEditorRouteOutlet").then((module) => ({ default: module.CreationEditorRouteOutlet })))
const CampaignCharactersView = lazy(() => import("./views/campaign/CampaignCharactersView").then((module) => ({ default: module.CampaignCharactersView })))
const CharacterIndexView = lazy(() => import("./views/CharacterRouteViews").then((module) => ({ default: module.CharacterIndexView })))
const CharacterDetailView = lazy(() => import("./views/CharacterRouteViews").then((module) => ({ default: module.CharacterDetailView })))
const CharacterCreateView = lazy(() => import("./views/CharacterCreateView").then((module) => ({ default: module.CharacterCreateView })))
const SessionCharacterLevelUpView = lazy(() => import("./views/session/SessionCharacterLevelUpView").then((module) => ({ default: module.SessionCharacterLevelUpView })))
const PartyInventoryView = lazy(() => import("./views/PartyInventoryView").then((module) => ({ default: module.PartyInventoryView })))
const GroundInventoryView = lazy(() => import("./views/GroundInventoryView").then((module) => ({ default: module.GroundInventoryView })))
const MissionsView = lazy(() => import("./views/MissionsView").then((module) => ({ default: module.MissionsView })))
const InitiativeRoleView = lazy(() => import("./views/InitiativeRoleView").then((module) => ({ default: module.InitiativeRoleView })))
const SessionCreationSettingsView = lazy(() => import("./views/session/SessionCreationSettingsView").then((module) => ({ default: module.SessionCreationSettingsView })))
const SessionCreationRequestsView = lazy(() => import("./views/session/SessionCreationRequestsView").then((module) => ({ default: module.SessionCreationRequestsView })))
const SessionHomebrewView = lazy(() => import("./views/session/SessionHomebrewView").then((module) => ({ default: module.SessionHomebrewView })))
const ItemsCompendiumView = lazy(() => import("./views/ItemsCompendiumView").then((module) => ({ default: module.ItemsCompendiumView })))
const CreaturesCompendiumView = lazy(() => import("./views/CreaturesCompendiumView").then((module) => ({ default: module.CreaturesCompendiumView })))
const CustomSystemsListView = lazy(() => import("./views/CustomSystemsListView").then((module) => ({ default: module.CustomSystemsListView })))
const CustomSystemEditorView = lazy(() => import("./views/CustomSystemEditorView").then((module) => ({ default: module.CustomSystemEditorView })))
const MagicView = lazy(() => import("./views/MagicView").then((module) => ({ default: module.MagicView })))

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/user" replace />} />
        <Route path="/auth" element={<AuthView />} />
        <Route path="/not-found" element={<NotFoundView />} />
        <Route path="/unauthorized" element={<UnauthorizedView />} />

        <Route
          path="/user"
          element={
            <RequireAuth>
              <UserDashboardView />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="characters" replace />} />
          <Route path="characters" element={<UserCharactersTab />} />

          <Route element={<UserMagicRouteBoundary />}>
            <Route path="campaigns" element={<UserCampaignsRouteView />} />
            <Route path="characters/create" element={<UserCharacterCreateView />} />
            <Route path="characters/:characterId" element={<Navigate to="sheet" replace />} />
            <Route path="characters/:characterId/level-up" element={<UserCharacterLevelUpView />} />
            <Route path="characters/:characterId/spells-list/add-spells" element={<UserCharacterAddSpellsView />} />
            <Route path="characters/:characterId/inventory/add-item" element={<UserCharacterCreateItemView />} />
            <Route path="characters/:characterId/:tab" element={<UserCharacterDetailView />} />
            <Route path="spells" element={<UserSpellsTab />} />
          </Route>
        </Route>

        <Route
          path="/session/:campaignId"
          element={
            <RequireAuth>
              <SessionRouteOutlet />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="characters" replace />} />

          <Route path="characters" element={<CampaignCharactersView />} />
          <Route path="character" element={<CharacterIndexView />} />
          <Route path="character/create" element={<CharacterCreateView />} />
          <Route path="character/:characterId" element={<CharacterDetailView />} />
          <Route path="character/:characterId/level-up" element={<SessionCharacterLevelUpView />} />
          <Route path="character/:characterId/:tab" element={<CharacterDetailView />} />
          <Route path="party-inventory" element={<PartyInventoryView />} />
          <Route path="ground-inventory" element={<GroundInventoryView />} />
          <Route path="missions" element={<MissionsView />} />
          <Route path="initiative" element={<InitiativeRoleView />} />

          <Route path="creation" element={<CreationEditorRouteOutlet />}>
            <Route index element={<Navigate to="settings" replace />} />
            <Route path="settings" element={<SessionCreationSettingsView />} />
            <Route path="requests" element={<SessionCreationRequestsView />} />
            <Route path="homebrew" element={<SessionHomebrewView />} />
            <Route path="items-compendium" element={<ItemsCompendiumView />} />
            <Route path="creatures-compendium" element={<CreaturesCompendiumView />} />
            <Route path="custom-systems" element={<CustomSystemsListView />} />
            <Route path="custom-systems/:systemId" element={<CustomSystemEditorView />} />
            <Route path="custom-systems/:systemId/:tab" element={<CustomSystemEditorView />} />
            <Route path="magic" element={<MagicView />} />
          </Route>

          <Route path="requests" element={<LegacyCreationRouteRedirect suffix="requests" />} />
          <Route path="homebrew" element={<LegacyCreationRouteRedirect suffix="homebrew" />} />
          <Route path="items-compendium" element={<LegacyCreationRouteRedirect suffix="items-compendium" />} />
          <Route path="creatures-compendium" element={<LegacyCreationRouteRedirect suffix="creatures-compendium" />} />
          <Route path="custom-systems" element={<LegacyCreationRouteRedirect suffix="custom-systems" />} />
          <Route path="custom-systems/:systemId" element={<LegacyCreationCustomSystemRedirect />} />
          <Route path="custom-systems/:systemId/:tab" element={<LegacyCreationCustomSystemRedirect />} />
          <Route path="magic" element={<LegacyCreationRouteRedirect suffix="magic" />} />
        </Route>

        <Route path="/campaign/:campaignId/*" element={<LegacyCampaignNamespaceRedirect />} />
        <Route path="/character/*" element={<LegacySessionRedirect />} />
        <Route path="/party-inventory" element={<LegacySessionRedirect />} />
        <Route path="/ground-inventory" element={<LegacySessionRedirect />} />
        <Route path="/items-compendium" element={<LegacyCreationRootRedirect suffix="items-compendium" />} />
        <Route path="/missions" element={<LegacySessionRedirect />} />
        <Route path="/creatures-compendium" element={<LegacyCreationRootRedirect suffix="creatures-compendium" />} />
        <Route path="/custom-systems/*" element={<LegacyCreationRootRedirect suffix="custom-systems" preserveTail />} />
        <Route path="/initiative" element={<LegacySessionRedirect />} />
        <Route path="/magic" element={<LegacyCreationRootRedirect suffix="magic" />} />
        <Route path="/requests" element={<LegacyCreationRootRedirect suffix="requests" />} />
        <Route path="/homebrew" element={<LegacyCreationRootRedirect suffix="homebrew" />} />

        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </Suspense>
  )
}

function RouteLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
      Carregando...
    </div>
  )
}

function LegacyCampaignNamespaceRedirect() {
  const location = useLocation()
  const { campaignId } = useParams<{ campaignId?: string }>()
  if (!campaignId) return <Navigate to="/user/campaigns" replace />

  const prefix = `/campaign/${encodeURIComponent(campaignId)}`
  const suffix = location.pathname.startsWith(prefix)
    ? location.pathname.slice(prefix.length).replace(/^\/+/, "")
    : ""

  return (
    <Navigate
      to={`${sessionPath(campaignId, suffix)}${location.search}${location.hash}`}
      replace
    />
  )
}

function LegacySessionRedirect() {
  const location = useLocation()
  const campaignId = readActiveSession()
  if (!campaignId) return <Navigate to="/user/campaigns" replace />

  const suffix = location.pathname.replace(/^\/+/, "")
  return (
    <Navigate
      to={`${sessionPath(campaignId, suffix)}${location.search}${location.hash}`}
      replace
    />
  )
}

function LegacyCreationRouteRedirect({ suffix }: { suffix: string }) {
  const { campaignId } = useParams<{ campaignId?: string }>()
  if (!campaignId) return <Navigate to="/user/campaigns" replace />
  return <Navigate to={sessionPath(campaignId, `creation/${suffix}`)} replace />
}

function LegacyCreationCustomSystemRedirect() {
  const { campaignId, systemId, tab } = useParams<{
    campaignId?: string
    systemId?: string
    tab?: string
  }>()
  if (!campaignId) return <Navigate to="/user/campaigns" replace />

  const suffix = [
    "creation/custom-systems",
    systemId ? encodeURIComponent(systemId) : "",
    tab ? encodeURIComponent(tab) : "",
  ].filter(Boolean).join("/")

  return <Navigate to={sessionPath(campaignId, suffix)} replace />
}

function LegacyCreationRootRedirect({
  suffix,
  preserveTail = false,
}: {
  suffix: string
  preserveTail?: boolean
}) {
  const location = useLocation()
  const campaignId = readActiveSession()
  if (!campaignId) return <Navigate to="/user/campaigns" replace />

  let resolvedSuffix = suffix
  if (preserveTail) {
    const tail = location.pathname.replace(/^\/custom-systems\/?/, "")
    resolvedSuffix = tail ? `${suffix}/${tail}` : suffix
  }

  return (
    <Navigate
      to={`${sessionPath(campaignId, `creation/${resolvedSuffix}`)}${location.search}${location.hash}`}
      replace
    />
  )
}
