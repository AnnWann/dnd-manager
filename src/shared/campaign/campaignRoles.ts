export const CAMPAIGN_ROLES = ["PLAYER", "ASSISTANT", "MODERATOR", "MASTER"] as const

export type CampaignRoleValue = (typeof CAMPAIGN_ROLES)[number]
export type CampaignUiRole = "player" | "assistant" | "moderator" | "master"

export type CampaignCapability =
  | "characters.readAny"
  | "characters.writeAny"
  | "creation.content.read"
  | "creation.content.write"
  | "creation.permissions.read"

const CAPABILITIES: Record<CampaignRoleValue, ReadonlySet<CampaignCapability>> = {
  PLAYER: new Set(),
  ASSISTANT: new Set([
    "creation.content.read",
    "creation.content.write",
  ]),
  MODERATOR: new Set([
    "characters.readAny",
    "characters.writeAny",
    "creation.permissions.read",
  ]),
  MASTER: new Set([
    "characters.readAny",
    "characters.writeAny",
    "creation.content.read",
    "creation.content.write",
    "creation.permissions.read",
  ]),
}

export function isCampaignRole(value: unknown): value is CampaignRoleValue {
  return CAMPAIGN_ROLES.includes(value as CampaignRoleValue)
}

export function hasCampaignCapability(
  role: CampaignRoleValue,
  capability: CampaignCapability,
): boolean {
  return CAPABILITIES[role].has(capability)
}

export function toCampaignUiRole(role: CampaignRoleValue): CampaignUiRole {
  switch (role) {
    case "MASTER": return "master"
    case "ASSISTANT": return "assistant"
    case "MODERATOR": return "moderator"
    default: return "player"
  }
}

export function fromCampaignUiRole(role: CampaignUiRole): CampaignRoleValue {
  switch (role) {
    case "master": return "MASTER"
    case "assistant": return "ASSISTANT"
    case "moderator": return "MODERATOR"
    default: return "PLAYER"
  }
}

export function canAccessCreation(role: CampaignRoleValue): boolean {
  return hasCampaignCapability(role, "creation.content.read")
    || hasCampaignCapability(role, "creation.permissions.read")
}

export function canEditCreationContent(role: CampaignRoleValue): boolean {
  return hasCampaignCapability(role, "creation.content.write")
}

export function canReadCreationPermissions(role: CampaignRoleValue): boolean {
  return hasCampaignCapability(role, "creation.permissions.read")
}

export function canReadAnyCharacter(role: CampaignRoleValue): boolean {
  return hasCampaignCapability(role, "characters.readAny")
}

export function canWriteAnyCharacter(role: CampaignRoleValue): boolean {
  return hasCampaignCapability(role, "characters.writeAny")
}
