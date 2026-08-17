import { useEffect } from "react"
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom"

import { RequireAuth } from "./auth/requireAuth"
import { useSyncContext } from "./contexts/syncContext"
import { readActiveCampaign, rememberActiveCampaign } from "./lib/activeCampaign"
import { campaignPath } from "./lib/campaignRoutes"
import { CharacterCreateView } from "./views/CharacterCreateView"
import {
  CharacterDetailView,
  CharacterIndexView,
} from "./views/CharacterRouteViews"
import { CreaturesCompendiumView } from "./views/CreaturesCompendiumView"
import { CustomSystemEditorView } from "./views/CustomSystemEditorView"
import { CustomSystemsListView } from "./views/CustomSystemsListView"
import { GroundInventoryView } from "./views/GroundInventoryView"
import { InitiativePlayerView } from "./views/InitiativePlayerView"
import { InitiativeView } from "./views/InitiativeView"
import { ItemsCompendiumView } from "./views/ItemsCompendiumView"
import { MagicView } from "./views/MagicView"
import { MissionsView } from "./views/MissionsView"
import { NotFoundView } from "./views/NotFoundView"
import { PartyInventoryView } from "./views/PartyInventoryView"
import { AuthView } from "./views/AuthView"
import { UnauthorizedView } from "./views/UnauthorisedView"
import { CampaignCharactersView } from "./views/campaign/CampaignCharactersView"
import { UserCampaignsRouteView } from "./views/user/UserCampaignsRouteView"
import { UserCharacterAddSpellsView } from "./views/user/UserCharacterAddSpellsView"
import { UserCharacterCreateItemView } from "./views/user/UserCharacterCreateItemView"
import { UserCharacterCreateView } from "./views/user/UserCharacterCreateView"
import { UserCharacterDetailView } from "./views/user/UserCharacterDetailView"
import { UserCharacterLevelUpView } from "./views/user/UserCharacterLevelUpView"
import { UserCharactersTab } from "./views/user/UserCharactersTab"
import { UserDashboardView } from "./views/user/UserDashboardView"
import { UserSpellsTab } from "./views/user/UserSpellsTab"

export function AppRouter() {
  return (
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
        <Route path="characters/create" element={<UserCharacterCreateView />} />
        <Route path="characters/:characterId" element={<Navigate to="sheet" replace />} />
        <Route path="characters/:characterId/level-up" element={<UserCharacterLevelUpView />} />
        <Route path="characters/:characterId/spells-list/add-spells" element={<UserCharacterAddSpellsView />} />
        <Route path="characters/:characterId/inventory/add-item" element={<UserCharacterCreateItemView />} />
        <Route path="characters/:characterId/:tab" element={<UserCharacterDetailView />} />
        <Route path="spells" element={<UserSpellsTab />} />
        <Route path="campaigns" element={<UserCampaignsRouteView />} />
      </Route>

      <Route
        path="/campaign/:campaignId"
        element={
          <RequireAuth>
            <CampaignRouteOutlet />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="characters" replace />} />
        <Route path="characters" element={<CampaignCharactersView />} />
        <Route path="character" element={<CharacterIndexView />} />
        <Route path="character/create" element={<CharacterCreateView />} />
        <Route path="character/:characterId" element={<CharacterDetailView />} />
        <Route path="character/:characterId/:tab" element={<CharacterDetailView />} />
        <Route path="party-inventory" element={<PartyInventoryView />} />
        <Route path="ground-inventory" element={<GroundInventoryView />} />
        <Route path="items-compendium" element={<ItemsCompendiumView />} />
        <Route path="missions" element={<MissionsView />} />
        <Route path="creatures-compendium" element={<CreaturesCompendiumView />} />
        <Route path="custom-systems" element={<CustomSystemsListView />} />
        <Route path="custom-systems/:systemId" element={<CustomSystemEditorView />} />
        <Route path="custom-systems/:systemId/:tab" element={<CustomSystemEditorView />} />
        <Route path="initiative" element={<InitiativeRoute />} />
        <Route path="magic" element={<MagicView />} />
      </Route>

      <Route path="/character/*" element={<LegacyCampaignRedirect />} />
      <Route path="/party-inventory" element={<LegacyCampaignRedirect />} />
      <Route path="/ground-inventory" element={<LegacyCampaignRedirect />} />
      <Route path="/items-compendium" element={<LegacyCampaignRedirect />} />
      <Route path="/missions" element={<LegacyCampaignRedirect />} />
      <Route path="/creatures-compendium" element={<LegacyCampaignRedirect />} />
      <Route path="/custom-systems/*" element={<LegacyCampaignRedirect />} />
      <Route path="/initiative" element={<LegacyCampaignRedirect />} />
      <Route path="/magic" element={<LegacyCampaignRedirect />} />

      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  )
}

function CampaignRouteOutlet() {
  const { campaignId } = useParams<{ campaignId?: string }>()

  useEffect(() => {
    if (campaignId) rememberActiveCampaign(campaignId)
  }, [campaignId])

  return <Outlet />
}

function LegacyCampaignRedirect() {
  const location = useLocation()
  const campaignId = readActiveCampaign()
  if (!campaignId) return <Navigate to="/user/campaigns" replace />

  const suffix = location.pathname.replace(/^\/+/, "")
  return (
    <Navigate
      to={`${campaignPath(campaignId, suffix)}${location.search}${location.hash}`}
      replace
    />
  )
}

function InitiativeRoute() {
  const { userRole } = useSyncContext()
  return userRole === "master" ? <InitiativeView /> : <InitiativePlayerView />
}
