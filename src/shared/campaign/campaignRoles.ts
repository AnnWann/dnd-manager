export const CAMPAIGN_ROLES = ["PLAYER", "ASSISTANT", "MODERATOR", "MASTER"] as const

export type CampaignRoleValue = (typeof CAMPAIGN_ROLES)[number]
export type CampaignUiRole = "player" | "assistant" | "moderator" | "master"

export const CAMPAIGN_CREATION_SECTIONS = [
  "settings",
  "requests",
  "homebrew",
  "items",
  "creatures",
  "systems",
  "magic",
] as const

export type CampaignCreationSection = (typeof CAMPAIGN_CREATION_SECTIONS)[number]

export type CampaignCapability =
  | "characters.readAny"
  | "characters.writeAny"
  | "creation.content.read"
  | "creation.content.write"
  | "creation.permissions.read"
  | "creation.settings.manage"
  | "creation.requests.manage"
  | "creation.homebrew.manage"
  | "creation.items.manage"
  | "creation.creatures.manage"
  | "creation.systems.manage"
  | "creation.magic.manage"

export type CampaignCapabilityOverrides = Partial<Record<CampaignCapability, boolean>>

export const CAMPAIGN_DELEGATABLE_CAPABILITIES = [
  {
    capability: "characters.readAny" as const,
    label: "Ver todos os personagens",
    description: "Permite visualizar personagens de outros jogadores e personagens privados da sessão.",
  },
  {
    capability: "characters.writeAny" as const,
    label: "Editar todos os personagens",
    description: "Permite alterar personagens de outros jogadores. Sem isso, o membro continua restrito aos próprios personagens.",
  },
  {
    capability: "creation.settings.manage" as const,
    label: "Configuração de personagens",
    description: "Permite editar tipo, jogador atribuído, visibilidade e sistemas instalados nos personagens da Criação.",
  },
  {
    capability: "creation.requests.manage" as const,
    label: "Solicitações",
    description: "Permite revisar e aprovar solicitações de conteúdo da sessão.",
  },
  {
    capability: "creation.homebrew.manage" as const,
    label: "Homebrew",
    description: "Permite gerenciar o catálogo homebrew da campanha.",
  },
  {
    capability: "creation.items.manage" as const,
    label: "Compêndio de itens",
    description: "Permite editar os itens disponíveis na Criação.",
  },
  {
    capability: "creation.creatures.manage" as const,
    label: "Compêndio de criaturas",
    description: "Permite criar e editar criaturas da Criação.",
  },
  {
    capability: "creation.systems.manage" as const,
    label: "Sistemas personalizados",
    description: "Permite criar, editar e remover sistemas personalizados sem conceder acesso aos demais conteúdos de Criação.",
  },
  {
    capability: "creation.magic.manage" as const,
    label: "Magia",
    description: "Permite editar as configurações e conteúdos de magia da Criação.",
  },
  {
    capability: "creation.permissions.read" as const,
    label: "Ver permissões",
    description: "Permite consultar os papéis e permissões dos membros, sem permitir alterá-los.",
  },
] satisfies ReadonlyArray<{
  capability: CampaignCapability
  label: string
  description: string
}>

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

const SECTION_CAPABILITY: Record<CampaignCreationSection, CampaignCapability> = {
  settings: "creation.settings.manage",
  requests: "creation.requests.manage",
  homebrew: "creation.homebrew.manage",
  items: "creation.items.manage",
  creatures: "creation.creatures.manage",
  systems: "creation.systems.manage",
  magic: "creation.magic.manage",
}

const KNOWN_CAPABILITIES = new Set<CampaignCapability>([
  "characters.readAny",
  "characters.writeAny",
  "creation.content.read",
  "creation.content.write",
  "creation.permissions.read",
  ...Object.values(SECTION_CAPABILITY),
])

export function isCampaignRole(value: unknown): value is CampaignRoleValue {
  return CAMPAIGN_ROLES.includes(value as CampaignRoleValue)
}

export function normalizeCampaignCapabilityOverrides(
  value: unknown,
): CampaignCapabilityOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const normalized: CampaignCapabilityOverrides = {}
  for (const [key, enabled] of Object.entries(source)) {
    if (!KNOWN_CAPABILITIES.has(key as CampaignCapability)) continue
    if (typeof enabled !== "boolean") continue
    normalized[key as CampaignCapability] = enabled
  }
  return normalized
}

export function hasCampaignCapability(
  role: CampaignRoleValue,
  capability: CampaignCapability,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  const explicit = overrides[capability]
  if (typeof explicit === "boolean") return explicit

  if (isCreationSectionCapability(capability)) {
    const umbrellaOverride = overrides["creation.content.write"]
    if (typeof umbrellaOverride === "boolean") return umbrellaOverride
    return CAPABILITIES[role].has("creation.content.write")
  }

  return CAPABILITIES[role].has(capability)
}

export function resolveEffectiveCampaignCapabilities(
  role: CampaignRoleValue,
  overrides: CampaignCapabilityOverrides = {},
): CampaignCapability[] {
  return Array.from(KNOWN_CAPABILITIES).filter((capability) =>
    hasCampaignCapability(role, capability, overrides),
  )
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

export function canAccessCreation(
  role: CampaignRoleValue,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  return hasCampaignCapability(role, "creation.content.read", overrides)
    || hasCampaignCapability(role, "creation.permissions.read", overrides)
    || CAMPAIGN_CREATION_SECTIONS.some((section) =>
      canManageCreationSection(role, section, overrides),
    )
}

export function canEditCreationContent(
  role: CampaignRoleValue,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  return hasCampaignCapability(role, "creation.content.write", overrides)
}

export function canManageCreationSection(
  role: CampaignRoleValue,
  section: CampaignCreationSection,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  return hasCampaignCapability(role, SECTION_CAPABILITY[section], overrides)
}

export function canReadCreationPermissions(
  role: CampaignRoleValue,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  return hasCampaignCapability(role, "creation.permissions.read", overrides)
}

export function canReadAnyCharacter(
  role: CampaignRoleValue,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  return hasCampaignCapability(role, "characters.readAny", overrides)
}

export function canWriteAnyCharacter(
  role: CampaignRoleValue,
  overrides: CampaignCapabilityOverrides = {},
): boolean {
  return hasCampaignCapability(role, "characters.writeAny", overrides)
}

function isCreationSectionCapability(
  capability: CampaignCapability,
): boolean {
  return Object.values(SECTION_CAPABILITY).includes(capability)
}
