import { useMemo } from "react"

import {
  SpellLibraryView,
  type SpellLibraryRecord,
} from "../../features/magic/library/SpellLibraryView"
import { useUserMagicState } from "../../features/magic/UserMagicProvider"

export function UserSpellsTab() {
  const { records, loading, errorMessage } = useUserMagicState()

  const libraryRecords = useMemo<SpellLibraryRecord[]>(
    () =>
      records.map((record) => ({
        index: record.index,
        owned: record.ownedByCurrentUser,
        updatedAt: record.updatedAt,
        campaignNames: record.campaigns
          .filter((campaign) => campaign.status === "APPROVED")
          .map((campaign) => campaign.name),
        characterNames: record.characters.map((character) => character.name),
      })),
    [records],
  )

  return (
    <SpellLibraryView
      variant="user"
      records={libraryRecords}
      loading={loading}
      errorMessage={errorMessage}
    />
  )
}
