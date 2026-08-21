import { lazy, Suspense } from "react"

import "../mobileDialogs.css"
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
      <Suspense fallback={<AuthenticatedLoading />}>
        {mode === "user" ? <UserLayout /> : <CampaignLayout />}
      </Suspense>
    </I18nProvider>
  )
}

function AuthenticatedLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-textMuted">
      Preparando seu ambiente...
    </div>
  )
}
