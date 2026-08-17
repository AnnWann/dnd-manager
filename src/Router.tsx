import { Navigate, Route, Routes } from "react-router-dom"

import { RequireAuth } from "./auth/requireAuth"
import { useSyncContext } from "./contexts/syncContext"
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
import { SyncView } from "./views/SyncView"
import { AuthView } from "./views/AuthView"
import { UnauthorizedView } from "./views/UnauthorisedView"
import { UserCampaignsTab } from "./views/user/UserCampaignTab"
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
        <Route
          path="characters/:characterId"
          element={<Navigate to="sheet" replace />}
        />
        <Route
          path="characters/:characterId/level-up"
          element={<UserCharacterLevelUpView />}
        />
        <Route
          path="characters/:characterId/spells-list/add-spells"
          element={<UserCharacterAddSpellsView />}
        />
        <Route
          path="characters/:characterId/inventory/add-item"
          element={<UserCharacterCreateItemView />}
        />
        <Route
          path="characters/:characterId/:tab"
          element={<UserCharacterDetailView />}
        />
        <Route path="spells" element={<UserSpellsTab />} />
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
      <Route path="/initiative" element={<InitiativeRoute />} />
      <Route path="/magic" element={<MagicView />} />

      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  )
}

function InitiativeRoute() {
  const { userRole } = useSyncContext()
  return userRole === "master" ? <InitiativeView /> : <InitiativePlayerView />
}
