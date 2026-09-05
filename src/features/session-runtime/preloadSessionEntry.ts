import { getCampaignSessionCharacters } from "../../api/campaign-session"
import { getCreationSnapshot } from "../../api/creation"
import { getSessionHomebrew } from "../../api/session-homebrew"
import { getSessionContentRequests } from "../../api/session-requests"
import { getSessionCreationSettings } from "../../api/session-settings"
import type { UserCampaign } from "../../api/user-campaigns"
import {
  resolveEffectiveCampaignCapabilities,
  type CampaignCapability,
} from "../../shared/campaign/campaignRoles"

/**
 * Loads the relational/bootstrap context while the user is still in /user.
 *
 * Explicit entry always revalidates campaign membership/role/overrides first.
 * After navigation, gameplay reads character/inventory/etc. from the session
 * WebSocket; these requests seed/warm only the authorized Creation context.
 */
export async function preloadSessionEntry(
  campaign: UserCampaign,
  viewerId: string,
): Promise<void> {
  const [sessionData] = await Promise.all([
    getCampaignSessionCharacters(campaign.id, viewerId, { force: true }),
    getSessionHomebrew(campaign.id, { force: true }),
  ])

  const capabilities = new Set<CampaignCapability>(
    sessionData.campaign.capabilities
    ?? resolveEffectiveCampaignCapabilities(
      sessionData.campaign.role,
      sessionData.campaign.permissions ?? {},
    ),
  )

  const needsCreationDocument = [
    "creation.settings.manage",
    "creation.items.manage",
    "creation.creatures.manage",
    "creation.systems.manage",
    "creation.magic.manage",
  ].some((capability) => capabilities.has(capability as CampaignCapability))
  const needsRequests = capabilities.has("creation.requests.manage")
  const needsSettings =
    capabilities.has("creation.settings.manage")
    || capabilities.has("creation.permissions.read")

  await Promise.all([
    ...(needsCreationDocument
      ? [getCreationSnapshot(campaign.id, { force: true })]
      : []),
    ...(needsRequests
      ? [getSessionContentRequests(campaign.id, "PENDING", { force: true })]
      : []),
    ...(needsSettings
      ? [getSessionCreationSettings(campaign.id, { force: true })]
      : []),
  ])
}
