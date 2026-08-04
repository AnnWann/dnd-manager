import { useMemo } from "react"

import { useMagicContext } from "../../contexts/magicContext"
import { useUserMagicState } from "../../features/magic/UserMagicProvider"
import { MagicView } from "../MagicView"

export function UserSpellsTab() {
  const { spells } = useMagicContext()
  const {
    records,
    loading,
    errorMessage,
  } = useUserMagicState()

  const ownedCount = useMemo(
    () => records.filter((record) => record.ownedByCurrentUser).length,
    [records],
  )

  const campaignCount = useMemo(
    () =>
      records.filter(
        (record) =>
          !record.ownedByCurrentUser &&
          record.campaigns.some((campaign) => campaign.status === "APPROVED"),
      ).length,
    [records],
  )

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <h1 className="text-lg font-semibold text-textH">
          Biblioteca de magias
        </h1>

        <p className="mt-1 text-sm text-textMuted">
          Inclui as magias oficiais, suas magias homebrew e magias aprovadas nas campanhas das quais você participa.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <LibraryBadge label={`${spells.length} disponíveis`} />
          <LibraryBadge label={`${ownedCount} próprias`} />
          <LibraryBadge label={`${campaignCount} de campanhas`} />
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-textMuted">
            Carregando magias relacionais...
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <MagicView />
    </div>
  )
}

function LibraryBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-textH">
      {label}
    </span>
  )
}
