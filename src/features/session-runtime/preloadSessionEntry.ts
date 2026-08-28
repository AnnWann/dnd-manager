import { getCampaignSessionCharacters } from "../../api/campaign-session"
import { getCreationSnapshot } from "../../api/creation"
import { getSessionHomebrew } from "../../api/session-homebrew"
import { getSessionContentRequests } from "../../api/session-requests"
import { getSessionCreationSettings } from "../../api/session-settings"
import type { UserCampaign } from "../../api/user-campaigns"

/**
 * Loads the relational/bootstrap context while the user is still in /user.
 *
 * After navigation, gameplay reads character/inventory/etc. from the session
 * WebSocket. These requests exist only to seed a new/uninitialized Durable
 * Object and to warm the MASTER Creation context before the active session.
 */
export async function preloadSessionEntry(campaign: UserCampaign): Promise<void> {
  const isMaster = campaign.isOwner || campaign.role === "MASTER"

  const common = [
    getCampaignSessionCharacters(campaign.id),
    getSessionHomebrew(campaign.id),
  ]

  if (!isMaster) {
    await Promise.all(common)
    return
  }

  await Promise.all([
    ...common,
    getCreationSnapshot(campaign.id),
    getSessionCreationSettings(campaign.id),
    getSessionContentRequests(campaign.id, "PENDING"),
  ])
}
