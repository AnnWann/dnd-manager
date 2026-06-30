import { Navigate, Route, Routes } from "react-router-dom"

import { CharacterView } from "./views/CharacterView"
import { CreaturesCompendiumView } from "./views/CreaturesCompendiumView"
import { InitiativeView } from "./views/InitiativeView"
import { MagicView } from "./views/MagicView"
import { MissionsView } from "./views/MissionsView"
import { PartyInventoryView } from "./views/PartyInventoryView"
import { SyncView } from "./views/SyncView"

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/character/sheet" replace />} />
      <Route path="/sync" element={<SyncView />} />
      <Route path="/character" element={<Navigate to="/character/sheet" replace />} />
      <Route path="/character/:tab" element={<CharacterView />} />
      <Route path="/party-inventory" element={<PartyInventoryView />} />
      <Route path="/missions" element={<MissionsView />} />
      <Route path="/creatures-compendium" element={<CreaturesCompendiumView />} />
      <Route path="/initiative" element={<InitiativeView />} />
      <Route path="/magic" element={<MagicView />} />
    </Routes>
  )
}
