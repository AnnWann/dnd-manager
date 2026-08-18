import { useLocation } from "react-router-dom"
import { PublicLayout } from "./layouts/publicLayout"
import { UserLayout } from "./layouts/userLayout"
import { CampaignLayout } from "./layouts/campaignLayout"

function App() {
  const location = useLocation()

  const usesPublicLayout =
    location.pathname.startsWith("/auth") ||
    (import.meta.env.DEV && location.pathname.startsWith("/dev/session-runtime")) ||
    location.pathname === "/not-found" ||
    location.pathname === "/unauthorized"

  const usesUserLayout =
    location.pathname.startsWith("/user")

  if (usesPublicLayout) {
    return <PublicLayout />
  }

  if (usesUserLayout) {
    return <UserLayout/>
  }

  return <CampaignLayout/>
}

export default App