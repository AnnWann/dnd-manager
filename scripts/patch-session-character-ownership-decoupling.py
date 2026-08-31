from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"regex anchor count={count} in {path}: {pattern[:160]!r}")
    write(path, next_text)


# ---------------------------------------------------------------------------
# Prisma: campaign/session assignment is independent from personal ownership.
# ---------------------------------------------------------------------------
replace_once(
    "prisma/schema.prisma",
    "  ownedCampaigns      Campaign[]       @relation(\"CampaignOwner\")\n  campaignMemberships CampaignMember[]\n",
    "  ownedCampaigns      Campaign[]       @relation(\"CampaignOwner\")\n  campaignMemberships CampaignMember[]\n  assignedCampaignCharacters CampaignCharacter[] @relation(\"CampaignCharacterAssignedUser\")\n",
)
regex_once(
    "prisma/schema.prisma",
    r'model CampaignCharacter \{.*?\n\}',
    '''model CampaignCharacter {
  id         String              @id @default(uuid())
  visibility CharacterVisibility @default(PARTY)

  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  characterId String
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  /// Session/campaign assignment. This must never change Character.ownerId.
  assignedUserId String?
  assignedUser   User? @relation("CampaignCharacterAssignedUser", fields: [assignedUserId], references: [id], onDelete: SetNull)

  /// Session-only character configuration authored in Creation.
  configuration Json?

  addedAt DateTime @default(now())

  @@unique([campaignId, characterId])
  @@index([campaignId])
  @@index([characterId])
  @@index([assignedUserId], map: "campaign_character_assignedUserId_idx")
  @@map("campaign_character")
}''',
    re.S,
)

# ---------------------------------------------------------------------------
# Creation model: cache the display name with the session assignment. The DB
# user relation remains authoritative and buildCreationSnapshot refreshes it.
# ---------------------------------------------------------------------------
replace_once(
    "src/shared/creation/creation.types.ts",
    "  ownerId: string\n  hiddenCharacterTabs: string[]",
    "  ownerId: string\n  /** Display projection for the session assignment; refreshed from campaign membership. */\n  ownerName?: string\n  hiddenCharacterTabs: string[]",
)

# Runtime config carries every session-owned character setting used by sheets.
replace_once(
    "src/shared/session-runtime/sessionRuntimeConfig.ts",
    "  ownerId: string\n  customSystems: CreationCharacterCustomSystemConfiguration[]",
    "  ownerId: string\n  ownerName?: string\n  hiddenCharacterTabs: string[]\n  customSystems: CreationCharacterCustomSystemConfiguration[]",
)
replace_once(
    "src/shared/session-runtime/sessionRuntimeConfig.ts",
    "      ownerId: character.ownerId,\n      customSystems: character.customSystems,",
    "      ownerId: character.ownerId,\n      ownerName: character.ownerName,\n      hiddenCharacterTabs: [...character.hiddenCharacterTabs],\n      customSystems: character.customSystems,",
)

# ---------------------------------------------------------------------------
# Creation API: STOP mutating Character.ownerId / Character.data. Persist the
# whole session character configuration on CampaignCharacter instead.
# ---------------------------------------------------------------------------
path = "api-handlers/campaigns/[campaignId]/_creation.ts"
text = read(path)
text = text.replace(
    '''          characters: {
            select: {
              characterId: true,
              character: {
                select: { data: true },
              },
            },
          },''',
    '''          characters: {
            select: {
              characterId: true,
            },
          },''',
    1,
)
pattern = re.compile(
    r'''      const characterDataById = new Map\(.*?\n      for \(const configuration of incomingCharacters\) \{.*?\n      \}\n\n      await tx\.campaignItemCompendium\.deleteMany''',
    re.S,
)
replacement = '''      for (const configuration of incomingCharacters) {
        if (!allowedOwnerIds.has(configuration.ownerId)) {
          throw new ApiError(
            400,
            "CREATION_CHARACTER_OWNER_INVALID",
            "O jogador atribuído precisa ser membro ativo da campanha.",
          )
        }

        await tx.campaignCharacter.update({
          where: {
            campaignId_characterId: {
              campaignId,
              characterId: configuration.characterId,
            },
          },
          data: {
            visibility: toDatabaseVisibility(configuration.visibility),
            assignedUserId: configuration.ownerId,
            configuration: configuration as never,
          },
        })
      }

      await tx.campaignItemCompendium.deleteMany'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("failed to replace Creation character persistence loop")
write(path, text)

# Build Creation from campaign-link configuration, not personal character data.
replace_once(
    path,
    '''      select: {
        visibility: true,
        character: {
          select: {
            id: true,
            data: true,
            ownerId: true,
            updatedAt: true,
          },
        },
      },''',
    '''      select: {
        visibility: true,
        assignedUserId: true,
        configuration: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
          },
        },
        character: {
          select: {
            id: true,
            data: true,
            ownerId: true,
            owner: {
              select: {
                name: true,
              },
            },
            updatedAt: true,
          },
        },
      },''',
)
replace_once(
    path,
    '''    return toCreationCharacter(
      link.character.id,
      link.character.ownerId,
      link.visibility,
      link.character.data,
    )''',
    '''    return toCreationCharacterLink(
      link.character.id,
      link.assignedUserId,
      link.assignedUser?.name,
      link.character.ownerId,
      link.character.owner.name,
      link.visibility,
      link.character.data,
      link.configuration,
    )''',
)

# Parse optional owner display name in saved session configuration.
replace_once(
    path,
    '''  return {
    characterId,
    ownerId,
    type: type as CreationCharacterConfiguration["type"],''',
    '''  return {
    characterId,
    ownerId,
    ownerName:
      typeof configuration.ownerName === "string"
        ? configuration.ownerName.trim() || undefined
        : undefined,
    type: type as CreationCharacterConfiguration["type"],''',
)

# Legacy fallback + new link configuration resolver.
helper = '''function toCreationCharacterLink(
  characterId: string,
  assignedUserId: string | null,
  assignedUserName: string | undefined,
  personalOwnerId: string,
  personalOwnerName: string,
  visibility: CharacterVisibility,
  rawData: unknown,
  rawConfiguration: unknown,
): CreationCharacterConfiguration {
  const ownerId = assignedUserId?.trim() || personalOwnerId
  const ownerName = assignedUserName?.trim() || personalOwnerName || ownerId
  const fallback = {
    ...toCreationCharacter(characterId, ownerId, visibility, rawData),
    ownerId,
    ownerName,
  }
  const persisted = asRecord(rawConfiguration)
  if (!persisted) return fallback

  try {
    return readCreationCharacterConfiguration({
      ...persisted,
      characterId,
      ownerId,
      ownerName,
      visibility: toCreationVisibility(visibility),
    })
  } catch {
    // Old/partial link data should never prevent the MASTER from opening
    // Creation. It is normalized on the next successful save.
    return fallback
  }
}

'''
replace_once(path, "function toCreationCharacter(\n", helper + "function toCreationCharacter(\n")

# The old merge function was the actual User<->Session coupling. Remove it.
text = read(path)
text, count = re.subn(
    r'function mergeCharacterCreationConfiguration\(.*?\n\}\n\n(?=function toCreationCharacterLink|function toCreationCharacter)',
    '',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("failed to remove mergeCharacterCreationConfiguration")
# Remove its now-unused reconciliation import if present.
text = text.replace(
    '''import {
  CUSTOM_SYSTEM_SUPPRESSED_FIELD,
  reconcileConfiguredCustomSystemStates,
} from "../../../src/lib/customSystems/CustomSystemConfigurationReconciliation.js"''',
    '''import {
  CUSTOM_SYSTEM_SUPPRESSED_FIELD,
} from "../../../src/lib/customSystems/CustomSystemConfigurationReconciliation.js"''',
)
write(path, text)

# ---------------------------------------------------------------------------
# Campaign session bootstrap: access and owner projection use the campaign link.
# ---------------------------------------------------------------------------
path = "api-handlers/campaigns/[campaignId]/_characters.ts"
replace_once(
    path,
    '''import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../generated/prisma/client.js"''',
    '''import {
  CampaignMemberStatus,
  CampaignRole,
  CharacterVisibility,
} from "../../../generated/prisma/client.js"''',
)
replace_once(
    path,
    '''    const canAccessAllCharacters = isMaster || role === CampaignRole.MODERATOR

    const links = await prisma.campaignCharacter.findMany({
      where: {
        campaignId,
        ...(canAccessAllCharacters
          ? {}
          : {
              character: {
                ownerId: session.user.id,
              },
            }),
      },''',
    '''    const canAccessAllCharacters = isMaster || role === CampaignRole.MODERATOR
    const scopedCharacterAccess = canAccessAllCharacters
      ? {}
      : role === CampaignRole.ASSISTANT
        ? {
            OR: [
              { assignedUserId: session.user.id },
              { assignedUserId: null, character: { ownerId: session.user.id } },
            ],
          }
        : {
            OR: [
              { assignedUserId: session.user.id },
              { visibility: CharacterVisibility.PARTY },
              { assignedUserId: null, character: { ownerId: session.user.id } },
            ],
          }

    const links = await prisma.campaignCharacter.findMany({
      where: {
        campaignId,
        ...scopedCharacterAccess,
      },''',
)
replace_once(
    path,
    '''      select: {
        visibility: true,
        addedAt: true,
        character: {''',
    '''      select: {
        visibility: true,
        addedAt: true,
        assignedUserId: true,
        configuration: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
          },
        },
        character: {''',
)
replace_once(
    path,
    '''        owner: link.character.owner,
        addedAt: link.addedAt,''',
    '''        owner: link.assignedUser ?? link.character.owner,
        configuration: link.configuration,
        addedAt: link.addedAt,''',
)

# ---------------------------------------------------------------------------
# Connection tokens: initial ownership claims also come from CampaignCharacter.
# ---------------------------------------------------------------------------
path = "api/session-connection.ts"
replace_once(
    path,
    '''          where: {
            campaignId: sessionId,
            character: {
              ownerId: session.user.id,
            },
          },''',
    '''          where: {
            campaignId: sessionId,
            assignedUserId: session.user.id,
          },''',
)

# ---------------------------------------------------------------------------
# Every new campaign link receives an initial session assignment.
# ---------------------------------------------------------------------------
path = "api-handlers/me/campaigns/[campaignId]/characters/_character.ts"
replace_once(
    path,
    '''        create: {
          campaignId,
          characterId,
          visibility,
        },''',
    '''        create: {
          campaignId,
          characterId,
          visibility,
          assignedUserId: session.user.id,
        },''',
)

path = "api-handlers/campaigns/[campaignId]/requests/_request.ts"
replace_once(
    path,
    '''        create: {
          campaignId: entry.campaignId,
          characterId: entry.sourceId,
          visibility: parseVisibility(data.visibility),
        },''',
    '''        create: {
          campaignId: entry.campaignId,
          characterId: entry.sourceId,
          visibility: parseVisibility(data.visibility),
          assignedUserId: entry.submittedById,
        },''',
)

path = "api-handlers/me/campaigns/_import-legacy.ts"
replace_once(
    path,
    '''          data: {
            campaignId: createdCampaign.id,
            characterId: entry.newId,
            visibility: entry.visibility,
          },''',
    '''          data: {
            campaignId: createdCampaign.id,
            characterId: entry.newId,
            visibility: entry.visibility,
            assignedUserId: session.user.id,
          },''',
)

# ---------------------------------------------------------------------------
# Bootstrap DTO carries link configuration. It is session data, not User data.
# ---------------------------------------------------------------------------
path = "src/api/campaign-session.ts"
replace_once(
    path,
    '''import type { UserCharacterDomain } from "./user-characters"''',
    '''import type { UserCharacterDomain } from "./user-characters"
import type { CreationCharacterConfiguration } from "../shared/creation/creation.types"''',
)
replace_once(
    path,
    '''  owner: {
    id: string
    name: string
  }
  addedAt?: string''',
    '''  owner: {
    id: string
    name: string
  }
  configuration?: CreationCharacterConfiguration | null
  addedAt?: string''',
)
# Apply simple session-only fields already available in the bootstrap. Custom
# systems are reconciled from authoritative runtime config after the socket opens.
replace_once(
    path,
    '''    return CharacterTemplate.fromJSON(
      applyCharacterDomains(legacyBase, character.domains ?? []),
    ).toJSON()''',
    '''    let snapshot = CharacterTemplate.fromJSON(
      applyCharacterDomains(legacyBase, character.domains ?? []),
    )
    const configuration = character.configuration
    if (configuration) {
      snapshot = snapshot
        .with("visibility", configuration.visibility)
        .with("unique", configuration.unique)
        .with("owner", {
          id: configuration.ownerId,
          name: configuration.ownerName?.trim() || character.owner.name || configuration.ownerId,
          role: "player",
        })
        .withSheet("type", configuration.type)
        .withSheet("hiddenCharacterTabs", [...configuration.hiddenCharacterTabs])
    }
    return snapshot.toJSON()''',
)

# ---------------------------------------------------------------------------
# Creation settings UI: stop mixing a new owner id with the old owner's name.
# ---------------------------------------------------------------------------
path = "src/views/session/SessionCreationSettingsView.tsx"
replace_once(
    path,
    '''        ? applyCreationConfiguration(
            character,
            configuration,
            customSystemDefinitions,
          )''',
    '''        ? applyCreationConfiguration(
            character,
            configuration,
            customSystemDefinitions,
            resolveSessionOwner(settings, configuration.ownerId, getOwner),
          )''',
)
replace_once(
    path,
    '''    [creationConfigurationById, customSystemDefinitions, sessionCharacters],''',
    '''    [creationConfigurationById, customSystemDefinitions, getOwner, sessionCharacters, settings],''',
)
# Signature + owner application.
replace_once(
    path,
    '''function applyCreationConfiguration(
  character: CharacterTemplate,
  configuration: CreationCharacterConfiguration,
  definitions: CustomSystemDefinition[],
): CharacterTemplate {''',
    '''function applyCreationConfiguration(
  character: CharacterTemplate,
  configuration: CreationCharacterConfiguration,
  definitions: CustomSystemDefinition[],
  configuredOwner?: Player,
): CharacterTemplate {''',
)
replace_once(
    path,
    '''    .with("owner", {
      ...currentOwner,
      id: configuration.ownerId,
    })''',
    '''    .with("owner", configuredOwner ?? {
      id: configuration.ownerId,
      name: configuration.ownerName?.trim() || currentOwner?.name || configuration.ownerId,
      role: "player",
    })''',
)
replace_once(
    path,
    '''    ownerId: character.get("owner")?.id || previous.ownerId,
    hiddenCharacterTabs:''',
    '''    ownerId: character.get("owner")?.id || previous.ownerId,
    ownerName: character.get("owner")?.name || previous.ownerName,
    hiddenCharacterTabs:''',
)
# Current call inside updateCreationCharacter needs the resolved owner too.
replace_once(
    path,
    '''    const current = applyCreationConfiguration(
      source,
      currentConfiguration,
      customSystemDefinitions,
    )''',
    '''    const current = applyCreationConfiguration(
      source,
      currentConfiguration,
      customSystemDefinitions,
      resolveSessionOwner(settings, currentConfiguration.ownerId, getOwner),
    )''',
)
# Add a small session-member resolver before the card component.
replace_once(
    path,
    '''function CharacterConfigurationCard({''',
    '''function resolveSessionOwner(
  settings: SessionCreationSettings | null,
  ownerId: string,
  fallback: (ownerId: string) => Player,
): Player {
  const member = settings
    ? [settings.owner, ...settings.members].find(
        (entry) => entry.status === "ACTIVE" && entry.id === ownerId,
      )
    : undefined
  if (!member) return fallback(ownerId)
  return {
    id: member.id,
    name: member.name,
    role: member.role === "MASTER" ? "master" : "player",
  }
}

function CharacterConfigurationCard({''',
)

# ---------------------------------------------------------------------------
# Session server: current runtime config wins over stale connection-token claims.
# This makes transfers grant/revoke access immediately without reconnecting.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/session/runtimeConfigAccess.ts"
regex_once(
    path,
    r'export function authorizeCharacterMutation\(.*?\n\}\n\nexport function canViewRuntimeCharacter',
    '''export function authorizeCharacterMutation(
  connection: SessionConnection,
  snapshot: SessionRuntimeConfigSnapshot | null,
  characterId: string,
): { ok: true; character: SessionRuntimeCharacterConfig | null } | { ok: false; code: string; message: string } {
  if (connection.role === "MASTER") {
    return {
      ok: true,
      character: getRuntimeCharacterConfig(snapshot, characterId),
    };
  }

  // Once Creation configuration exists, it is the live session authority.
  // Token ownership is only an initial/fallback claim and must not keep access
  // after a character is transferred to another player.
  if (snapshot) {
    const character = getRuntimeCharacterConfig(snapshot, characterId);
    if (!character) {
      return {
        ok: false,
        code: "CHARACTER_NOT_IN_CREATION",
        message: "This character is not part of the active Creation configuration.",
      };
    }
    if (character.ownerId === connection.userId) return { ok: true, character };
    return {
      ok: false,
      code: "CHARACTER_ACCESS_DENIED",
      message: "You cannot change a character assigned to another player.",
    };
  }

  const ownedCharacterIds = readOwnedCharacterIds(connection);
  if (ownedCharacterIds?.includes(characterId)) {
    return { ok: true, character: null };
  }

  return {
    ok: false,
    code: "RUNTIME_CONFIG_NOT_INITIALIZED",
    message: "The MASTER must publish the saved Creation configuration before players can change character state.",
  };
}

export function canViewRuntimeCharacter''',
    re.S,
)
regex_once(
    path,
    r'export function canViewRuntimeCharacter\(.*?\n\}\n\nexport function visibleRuntimeConfigSnapshot',
    '''export function canViewRuntimeCharacter(
  connection: SessionConnection,
  character: SessionRuntimeCharacterConfig,
): boolean {
  if (connection.role === "MASTER") return true;
  if (character.ownerId === connection.userId) return true;
  return character.visibility === "party";
}

export function visibleRuntimeConfigSnapshot''',
    re.S,
)

path = "session-server/src/routes/session/visibilityDelivery.ts"
replace_once(
    path,
    '''  const ownedCharacterIds = readOwnedCharacterIds(connection) ?? [];
  const configuredCharacterIds = snapshot
    ? snapshot.config.characters
        .filter((character) => canViewRuntimeCharacter(connection, character))
        .map((character) => character.characterId)
    : [];

  connection.runtimeConfigRevision = snapshot?.creationRevision;
  connection.visibleCharacterIds = Array.from(new Set([
    ...ownedCharacterIds,
    ...configuredCharacterIds,
  ]));''',
    '''  const configuredCharacterIds = snapshot
    ? snapshot.config.characters
        .filter((character) => canViewRuntimeCharacter(connection, character))
        .map((character) => character.characterId)
    : readOwnedCharacterIds(connection) ?? [];

  connection.runtimeConfigRevision = snapshot?.creationRevision;
  connection.visibleCharacterIds = Array.from(new Set(configuredCharacterIds));''',
)

# ---------------------------------------------------------------------------
# CharacterProvider: in a session, the DO lifecycle snapshot is the character
# list. User/campaign REST data is only a bootstrap seed for MASTER. This removes
# the selector duplication and selector->route "not found" race.
# ---------------------------------------------------------------------------
path = "src/contexts/characterContext.tsx"
replace_once(
    path,
    '''import { getChangedCharacterDomains } from "../lib/characterDomains"''',
    '''import { getChangedCharacterDomains } from "../lib/characterDomains"
import { reconcileConfiguredCustomSystemStates } from "../lib/customSystems/CustomSystemConfigurationReconciliation"
import type { SessionRuntimeCharacterConfig } from "../shared/session-runtime/sessionRuntimeConfig"''',
)
text = read(path)
pattern = re.compile(r'  const characters = useMemo\(.*?\n\n  const canAssignOwners =', re.S)
replacement = '''  const sessionLifecycleCharacters = useMemo(() => {
    if (!sessionRuntime?.characterSnapshotReady) return null

    const lifecycleEntries = Object.values(sessionRuntime.sessionCharactersById)
    const knownIds = new Set(lifecycleEntries.map((entry) => entry.characterId))
    const result = new Map<string, CharacterTemplate>()

    for (const entry of lifecycleEntries) {
      if (entry.active === false) continue
      try {
        const character = CharacterTemplate.fromJSON(entry.character)
        result.set(entry.characterId, character)
      } catch (error) {
        console.error("[session-runtime] invalid authoritative character snapshot", {
          characterId: entry.characterId,
          error,
        })
      }
    }

    // MASTER keeps relational seeds only for characters the Durable Object has
    // never seen. SessionAuthoritativeBootstrap will add those missing ids.
    if (sessionRuntime.role === "MASTER") {
      for (const character of sourceCharacters) {
        const characterId = character.get("id")
        if (!knownIds.has(characterId)) result.set(characterId, character)
      }
    }

    return Array.from(result.values())
  }, [
    sessionRuntime?.characterSnapshotReady,
    sessionRuntime?.role,
    sessionRuntime?.sessionCharactersById,
    sourceCharacters,
  ])

  const characters = useMemo(
    () => (sessionLifecycleCharacters ?? sourceCharacters).map((character) => {
      const characterId = character.get("id")
      const authoritativeAbility = sessionRuntime?.abilitiesByCharacterId[characterId]
      const authoritative = sessionRuntime?.hpByCharacterId[characterId]
      const authoritativeConditions = sessionRuntime?.conditionsByCharacterId[characterId]
      const runtimeCharacterConfig = sessionRuntime?.runtimeConfigSnapshot?.config.characters.find(
        (entry) => entry.characterId === characterId,
      )
      let projected = authoritativeAbility?.initialized
        ? CharacterTemplate.fromJSON(authoritativeAbility.character)
        : character

      if (runtimeCharacterConfig && sessionRuntime?.runtimeConfigSnapshot) {
        projected = applySessionCharacterConfiguration(
          projected,
          runtimeCharacterConfig,
          sessionRuntime.runtimeConfigSnapshot.config.customSystems,
        )
      }

      if (authoritative) {
        const sheet = projected.get("sheet")
        const authoritativeHitDice = Object.fromEntries(
          Object.entries(authoritative.hitDice ?? {}).flatMap(([side, pool]) =>
            pool ? [[side, {
              current: { quantity: pool.current, sides: side as SessionDieSides },
              max: { quantity: pool.max, sides: side as SessionDieSides },
            }]] : [],
          ),
        ) as typeof sheet.HP.hitDice

        projected = projected.withPatch({
          sheet: {
            ...sheet,
            attributes: authoritative.attributesInitialized ? { ...authoritative.attributes } : sheet.attributes,
            savingThrowProficiencies: authoritative.savingThrowsInitialized
              ? { ...authoritative.savingThrows }
              : sheet.savingThrowProficiencies,
            skills: authoritative.skillsInitialized
              ? { ...authoritative.skills }
              : sheet.skills,
            stats: authoritative.statsInitialized ? {
              ...sheet.stats,
              armorClassAdjustment: authoritative.stats.armorClassAdjustment,
              initiativeAdjustment: authoritative.stats.initiativeAdjustment,
              mobilityAdjustment: authoritative.stats.mobilityAdjustment,
              passivePerceptionAdjustment: authoritative.stats.passivePerceptionAdjustment,
              exhaustion: authoritative.stats.exhaustion,
              inspiration: authoritative.stats.inspiration,
              experience: authoritative.stats.experience,
            } : sheet.stats,
            HP: {
              ...sheet.HP,
              current: authoritative.current,
              temporary: authoritative.temporary,
              max: authoritative.max,
              currentMax: authoritative.currentMax,
              hitDice: authoritativeHitDice,
            },
          },
        })
      }

      if (authoritativeConditions?.initialized) {
        projected = withCharacterConditions(
          projected,
          authoritativeConditions.conditions as CharacterCondition[],
        )
      }

      return projected
    }),
    [
      sessionLifecycleCharacters,
      sessionRuntime?.abilitiesByCharacterId,
      sessionRuntime?.conditionsByCharacterId,
      sessionRuntime?.hpByCharacterId,
      sessionRuntime?.runtimeConfigSnapshot,
      sourceCharacters,
    ],
  )

  const canAssignOwners ='''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("failed to replace CharacterProvider character projection")
write(path, text)

# Add config projection helper before exported hook/function tail.
helper = '''function applySessionCharacterConfiguration(
  character: CharacterTemplate,
  configuration: SessionRuntimeCharacterConfig,
  definitions: import("../models/customSystems/CustomSystemDefinition").CustomSystemDefinition[],
): CharacterTemplate {
  const currentOwner = character.get("owner")
  const currentSystems = character.get("sheet").customSystems ?? []
  const customSystems = reconcileConfiguredCustomSystemStates(
    currentSystems,
    configuration.customSystems,
    definitions,
  )

  return character
    .with("visibility", configuration.visibility)
    .with("unique", configuration.unique)
    .with("owner", {
      id: configuration.ownerId,
      name: configuration.ownerName?.trim()
        || (currentOwner?.id === configuration.ownerId ? currentOwner.name : "")
        || configuration.ownerId,
      role: "player",
    })
    .withSheet("type", configuration.type)
    .withSheet("hiddenCharacterTabs", [...configuration.hiddenCharacterTabs])
    .withSheet("customSystems", customSystems)
}

'''
# Place helper immediately before useCharacterContext export.
if "export function useCharacterContext" in read(path):
    replace_once(path, "export function useCharacterContext", helper + "export function useCharacterContext")
else:
    # Older naming fallback.
    replace_once(path, "export function useCharacters", helper + "export function useCharacters")

print("session character ownership decoupling patch applied")
