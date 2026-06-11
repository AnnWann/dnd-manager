import { Navigate, Route, Routes } from "react-router-dom"

import { CharacterView } from "./views/CharacterView"
import { SyncView } from "./views/SyncView"
import { MagicView } from "./views/MagicView"

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/character" replace />} />

      <Route path="/sync" element={<SyncView />} />

      <Route path="/character" element={<CharacterView />} />

      <Route path="/magic" element={<MagicView />} />
    </Routes>
  )
}