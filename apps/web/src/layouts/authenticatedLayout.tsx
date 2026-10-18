import { lazy, Suspense } from "react"

import "../mobileDialogs.css"
import { AppLoadingScreen } from "../components/AppLoadingScreen"
import { I18nProvider } from "../i18n/I18nContext"

const UserLayout = lazy(() =>
  import("./userLayout").then((module) => ({ default: module.UserLayout })),
)
const CampaignLayout = lazy(() =>
  import("./campaignLayout").then((module) => ({ default: module.CampaignLayout })),
)

export function AuthenticatedLayout({ mode }: { mode: "user" | "campaign" }) {
  return (
    <I18nProvider locale="pt-BR">
      <Suspense
        fallback={
          <AppLoadingScreen
            title="Verificando autenticação..."
            detail="Confirmando sua sessão."
          />
        }
      >
        {mode === "user" ? <UserLayout /> : <CampaignLayout />}
      </Suspense>
    </I18nProvider>
  )
}
