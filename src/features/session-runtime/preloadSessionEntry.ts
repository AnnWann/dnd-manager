import { getCampaignSessionCharacters } from "../../api/campaign-session"
import { getCreationSnapshot } from "../../api/creation"
import { getSessionHomebrew } from "../../api/session-homebrew"
import { getSessionContentRequests } from "../../api/session-requests"
import { getSessionCreationSettings } from "../../api/session-settings"
import type { UserCampaign } from "../../api/user-campaigns"

/**
 * Loads the relational/bootstrap context while the user is still in /user.
 *
 * Explicit entry always revalidates campaign membership/role first. That role
 * can be promoted or demoted while the browser still has a valid cache entry.
 * After navigation, gameplay reads character/inventory/etc. from the session
 * WebSocket; these requests seed/warm the relational Creation context only.
 */
export async function preloadSessionEntry(
  campaign: UserCampaign,
  viewerId: string,
): Promise<void> {
  const [sessionData] = await Promise.all([
    getCampaignSessionCharacters(campaign.id, viewerId, { force: true }),
    getSessionHomebrew(campaign.id, { force: true }),
  ])

  const role = sessionData.campaign.role
  const canEditCreationContent = role === "MASTER" || role === "ASSISTANT"
  const canOpenCreationSettings =
    role === "MASTER" || role === "ASSISTANT" || role === "MODERATOR"

  if (!canEditCreationContent && !canOpenCreationSettings) return

  await Promise.all([
    ...(canEditCreationContent
      ? [
          getCreationSnapshot(campaign.id, { force: true }),
          getSessionContentRequests(campaign.id, "PENDING", { force: true }),
        ]
      : []),
    ...(canOpenCreationSettings
      ? [getSessionCreationSettings(campaign.id, { force: true })]
      : []),
  ])
}
