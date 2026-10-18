import {
  CampaignMemberStatus,
  CampaignRole,
} from "../generated/prisma/client.js"
import { prisma } from "./prisma.js"
import {
  canAccessCreation,
  canManageCreationSection,
  canReadAnyCharacter,
  canReadCreationPermissions,
  canWriteAnyCharacter,
  hasCampaignCapability,
  normalizeCampaignCapabilityOverrides,
  resolveEffectiveCampaignCapabilities,
  type CampaignCapability,
  type CampaignCapabilityOverrides,
  type CampaignCreationSection,
} from "../src/shared/campaign/campaignRoles.js"

export type CampaignAccess = {
  isOwner: boolean
  role: CampaignRole
  permissions: CampaignCapabilityOverrides
  capabilities: CampaignCapability[]
  canAccessCreation: boolean
  canReadAnyCharacter: boolean
  canWriteAnyCharacter: boolean
  canReadCreationPermissions: boolean
}

export async function getCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<CampaignAccess | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      ownerId: true,
      members: {
        where: {
          userId,
          status: CampaignMemberStatus.ACTIVE,
        },
        select: {
          role: true,
          permissions: true,
        },
        take: 1,
      },
    },
  })

  if (!campaign) return null
  const isOwner = campaign.ownerId === userId
  const membership = campaign.members[0]
  if (!isOwner && !membership) return null

  const role = isOwner ? CampaignRole.MASTER : membership!.role
  const permissions = isOwner
    ? {}
    : normalizeCampaignCapabilityOverrides(membership!.permissions)

  return {
    isOwner,
    role,
    permissions,
    capabilities: resolveEffectiveCampaignCapabilities(role, permissions),
    canAccessCreation: canAccessCreation(role, permissions),
    canReadAnyCharacter: canReadAnyCharacter(role, permissions),
    canWriteAnyCharacter: canWriteAnyCharacter(role, permissions),
    canReadCreationPermissions: canReadCreationPermissions(role, permissions),
  }
}

export function accessHasCapability(
  access: CampaignAccess,
  capability: CampaignCapability,
): boolean {
  return access.isOwner || hasCampaignCapability(
    access.role,
    capability,
    access.permissions,
  )
}

export function accessCanManageCreationSection(
  access: CampaignAccess,
  section: CampaignCreationSection,
): boolean {
  return access.isOwner || canManageCreationSection(
    access.role,
    section,
    access.permissions,
  )
}
