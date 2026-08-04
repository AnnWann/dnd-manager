import { Navigate, Route, Routes } from "react-router-dom"

import { CharacterCreateView } from "./views/CharacterCreateView"
import {
  CharacterDetailView,
  CharacterIndexView,
} from "./views/CharacterRouteViews"
import { CreaturesCompendiumView } from "./views/CreaturesCompendiumView"
import { CustomSystemEditorView } from "./views/CustomSystemEditorView"
import { CustomSystemsListView } from "./views/CustomSystemsListView"
import { InitiativeView } from "./views/InitiativeView"
import { ItemsCompendiumView } from "./views/ItemsCompendiumView"
import { MagicView } from "./views/MagicView"
import { MissionsView } from "./views/MissionsView"
import { GroundInventoryView } from "./views/GroundInventoryView"
import { PartyInventoryView } from "./views/PartyInventoryView"
import { SyncView } from "./views/SyncView"
import { AuthView } from "./views/AuthView"
import { NotFoundView } from "./views/NotFoundView"
import { UserCharactersTab } from "./views/user/UserCharactersTab"
import { UserCampaignsTab } from "./views/user/UserCampaignTab"
import { UnauthorizedView } from "./views/UnauthorisedView"
import { RequireAuth } from "./auth/requireAuth"
import { UserDashboardView } from "./views/user/UserDashboardView"

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={ <Navigate to="/user" replace state={{ autoOpenLast: true }} /> } />
      <Route path="/auth" element={<AuthView />} />
      <Route path="/not-found" element={<NotFoundView />} />
      <Route path="/unauthorized" element={<UnauthorizedView />} />
      <Route path="*" element={<Navigate to="/not-found" replace />} />

      <Route path="/user" element={ <RequireAuth> <UserDashboardView /> </RequireAuth> } >
        <Route index element={<Navigate to="characters" replace />} />
        <Route path="characters" element={<UserCharactersTab />} />
        <Route path="campaigns" element={<UserCampaignsTab />} />
      </Route>

      <Route path="/sync" element={<SyncView />} />
      <Route path="/character" element={<CharacterIndexView />} />
      <Route path="/character/create" element={<CharacterCreateView />} />
      <Route path="/character/:characterId" element={<CharacterDetailView />} />
      <Route path="/character/:characterId/:tab" element={<CharacterDetailView />} />
      <Route path="/party-inventory" element={<PartyInventoryView />} />
      <Route path="/ground-inventory" element={<GroundInventoryView />} />
      <Route path="/items-compendium" element={<ItemsCompendiumView />} />
      <Route path="/missions" element={<MissionsView />} />
      <Route path="/creatures-compendium" element={<CreaturesCompendiumView />} />
      <Route path="/custom-systems" element={<CustomSystemsListView />} />
      <Route path="/custom-systems/:systemId" element={<CustomSystemEditorView />} />
      <Route path="/custom-systems/:systemId/:tab" element={<CustomSystemEditorView />} />
      <Route path="/initiative" element={<InitiativeView />} />
      <Route path="/magic" element={<MagicView />} />
    </Routes>
  )
}
