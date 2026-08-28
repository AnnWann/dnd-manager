import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
  CharacterVisibility,
  HomebrewSpellStatus,
} from "../../../generated/prisma/client.js"
import type { Prisma } from "../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api.js"
import { prisma } from "../../../server/prisma.js"
import { requireSession } from "../../../server/session.js"
import { CHARACTER_TYPES } from "../../../src/models/characters/CharacterType.js"
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from "../../../src/models/customSystems/CustomSystemDefinition.js"
import type { CompendiumCreature } from "../../../src/models/creatures/CompendiumCreature.js"
import type { Itemmable } from "../../../src/models/items/item.js"
import type { Spell } from "../../../src/models/magic/spells/Spell.js"
import {
  CUSTOM_SYSTEM_SUPPRESSED_FIELD,
  reconcileConfiguredCustomSystemStates,
} from "../../../src/lib/customSystems/CustomSystemConfigurationReconciliation.js"
import type {
  CreationCharacterConfiguration,
  CreationCharacterCustomSystemConfiguration,
  CreationItemCompendiumEntry,
  CreationState,
} from "../../../src/shared/creation/creation.types.js"

type RouteContext = {
  params?:
    | Promise<{ campaignId?: string }>
    | { campaignId?: string }
}

type JsonRecord = Record<string, unknown>

type CreationAsset = {
  type: string
  sourceId: string
  data: unknown
  updatedAt: Date
}

const CREATION_META_TYPE = "CREATION_STATE"
const CREATION_META_SOURCE = "v1"

export async function GET(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    await requireCreationMaster(campaignId, session.user.id)
    return jsonResponse(await buildCreationSnapshot(campaignId))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    await requireCreationMaster(campaignId, session.user.id)

    const body = await readJsonObject(request)
    const baseRevision = readRevision(body.baseRevision)
    const data = readCreationState(body.data)

    const systems = data.customSystems.map(readCreationCustomSystem)
    ensureUniqueIds(
      systems.map((system) => system.id),
      "CREATION_SYSTEM_DUPLICATE",
      "A Criação contém ids de sistema personalizado duplicados.",
    )
    const knownSystemIds = new Set(systems.map((system) => system.id))

    const incomingCharacters = data.characters
      .map(readCreationCharacterConfiguration)
      .sort((left, right) => left.characterId.localeCompare(right.characterId))
    ensureUniqueIds(
      incomingCharacters.map((character) => character.characterId),
      "CREATION_CHARACTER_DUPLICATE",
      "A Criação contém personagens duplicados.",
    )

    for (const configuration of incomingCharacters) {
      for (const installedSystem of configuration.customSystems) {
        if (!knownSystemIds.has(installedSystem.systemId)) {
          throw new ApiError(
            400,
            "CREATION_CHARACTER_SYSTEM_UNKNOWN",
            `O sistema ${installedSystem.systemId} instalado em ${configuration.characterId} não existe na Criação.`,
          )
        }
      }
    }

    const itemEntries = data.itemCompendium.map(readCreationItemEntry)
    const templateIds = itemEntries.map((entry) => entry.templateId)
    ensureUniqueIds(
      templateIds,
      "CREATION_ITEM_DUPLICATE",
      "O compêndio contém ids de item duplicados.",
    )

    const spells = data.spells.map(readCreationSpell)
    ensureUniqueIds(
      spells.map((spell) => spell.index),
      "CREATION_SPELL_DUPLICATE",
      "A Criação contém ids de magia duplicados.",
    )

    const creatures = data.creatureCompendium.map(readCreationCreature)
    ensureUniqueIds(
      creatures.map((creature) => creature.id),
      "CREATION_CREATURE_DUPLICATE",
      "O compêndio contém ids de criatura duplicados.",
    )

    await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          ownerId: true,
          creationRevision: true,
          members: {
            where: { status: CampaignMemberStatus.ACTIVE },
            select: { userId: true },
          },
          characters: {
            select: {
              characterId: true,
              character: {
                select: { data: true },
              },
            },
          },
        },
      })

      if (!campaign) {
        throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
      }

      if (campaign.creationRevision !== baseRevision) {
        throw new ApiError(
          409,
          "CREATION_REVISION_CONFLICT",
          "A Criação foi alterada desde que esta edição foi iniciada.",
        )
      }

      const currentCharacterIds = campaign.characters
        .map((link) => link.characterId)
        .sort((left, right) => left.localeCompare(right))

      if (
        incomingCharacters.length !== currentCharacterIds.length ||
        incomingCharacters.some(
          (character, index) => character.characterId !== currentCharacterIds[index],
        )
      ) {
        throw new ApiError(
          400,
          "CREATION_CHARACTER_SET_CHANGED",
          "A lista de personagens mudou. Recarregue a Criação antes de salvar.",
        )
      }

      const allowedOwnerIds = new Set([
        campaign.ownerId,
        ...campaign.members.map((member) => member.userId),
      ])
      const characterDataById = new Map(
        campaign.characters.map((link) => [link.characterId, link.character.data]),
      )

      for (const configuration of incomingCharacters) {
        if (!allowedOwnerIds.has(configuration.ownerId)) {
          throw new ApiError(
            400,
            "CREATION_CHARACTER_OWNER_INVALID",
            "O jogador atribuído precisa ser membro ativo da campanha.",
          )
        }

        const currentData = characterDataById.get(configuration.characterId)
        if (currentData === undefined) {
          throw new ApiError(
            400,
            "CREATION_CHARACTER_NOT_FOUND",
            "Um personagem da Criação não pertence mais à campanha.",
          )
        }

        await tx.character.update({
          where: { id: configuration.characterId },
          data: {
            ownerId: configuration.ownerId,
            data: mergeCharacterCreationConfiguration(
              currentData,
              configuration,
              systems,
            ) as never,
          },
        })

        await tx.campaignCharacter.update({
          where: {
            campaignId_characterId: {
              campaignId,
              characterId: configuration.characterId,
            },
          },
          data: {
            visibility: toDatabaseVisibility(configuration.visibility),
          },
        })
      }

      await tx.campaignItemCompendium.deleteMany({
        where: {
          campaignId,
          ...(templateIds.length ? { templateId: { notIn: templateIds } } : {}),
        },
      })

      for (const entry of itemEntries) {
        await tx.campaignItemCompendium.upsert({
          where: {
            campaignId_templateId: {
              campaignId,
              templateId: entry.templateId,
            },
          },
          create: {
            id: crypto.randomUUID(),
            campaignId,
            templateId: entry.templateId,
            item: entry.item as never,
            custom: entry.custom,
            visibility: entry.visibility,
            createdById: session.user.id,
          },
          update: {
            item: entry.item as never,
            custom: entry.custom,
            visibility: entry.visibility,
            createdById: session.user.id,
          },
        })
      }

      await replaceCreationAssets(tx, {
        campaignId,
        userId: session.user.id,
        type: "SPELL",
        entries: spells.map((spell) => ({
          sourceId: spell.index,
          name: spell.name,
          data: spell,
        })),
      })
      await replaceCreationAssets(tx, {
        campaignId,
        userId: session.user.id,
        type: "CREATURE",
        entries: creatures.map((creature) => ({
          sourceId: creature.id,
          name: creature.name,
          data: creature,
        })),
      })
      await replaceCreationAssets(tx, {
        campaignId,
        userId: session.user.id,
        type: "SYSTEM",
        entries: systems.map((system) => ({
          sourceId: system.id,
          name: system.name,
          data: system,
        })),
      })

      await tx.campaignHomebrewAsset.upsert({
        where: {
          campaignId_type_sourceId: {
            campaignId,
            type: CREATION_META_TYPE,
            sourceId: CREATION_META_SOURCE,
          },
        },
        create: {
          id: crypto.randomUUID(),
          campaignId,
          type: CREATION_META_TYPE,
          sourceId: CREATION_META_SOURCE,
          name: "Creation State v1",
          data: {
            spells: true,
            creatureCompendium: true,
            customSystems: true,
          },
          addedById: session.user.id,
        },
        update: {
          data: {
            spells: true,
            creatureCompendium: true,
            customSystems: true,
          },
          addedById: session.user.id,
        },
      })

      const revisionUpdate = await tx.campaign.updateMany({
        where: {
          id: campaignId,
          creationRevision: baseRevision,
        },
        data: {
          creationRevision: { increment: 1 },
        },
      })

      if (revisionUpdate.count !== 1) {
        throw new ApiError(
          409,
          "CREATION_REVISION_CONFLICT",
          "A Criação foi alterada desde que esta edição foi iniciada.",
        )
      }
    })

    return jsonResponse(await buildCreationSnapshot(campaignId))
  } catch (error) {
    return handleApiError(error)
  }
}

async function requireCreationMaster(
  campaignId: string,
  userId: string,
): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      ownerId: true,
      members: {
        where: {
          userId,
          status: CampaignMemberStatus.ACTIVE,
        },
        select: { role: true },
      },
    },
  })

  if (!campaign) {
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
  }

  const isMaster =
    campaign.ownerId === userId ||
    campaign.members.some((member) => member.role === CampaignRole.MASTER)

  if (!isMaster) {
    throw new ApiError(
      403,
      "CREATION_ACCESS_FORBIDDEN",
      "Somente o mestre pode acessar o estado de Criação da sessão.",
    )
  }
}

async function buildCreationSnapshot(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      creationRevision: true,
      updatedAt: true,
    },
  })

  if (!campaign) {
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
  }

  const [characterLinks, spellLinks, itemRows, assets] = await Promise.all([
    prisma.campaignCharacter.findMany({
      where: { campaignId },
      select: {
        visibility: true,
        character: {
          select: {
            id: true,
            data: true,
            ownerId: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { addedAt: "asc" },
    }),
    prisma.campaignHomebrewSpell.findMany({
      where: {
        campaignId,
        status: CampaignSpellApprovalStatus.APPROVED,
        spell: { status: HomebrewSpellStatus.ACTIVE },
      },
      select: {
        spell: {
          select: {
            data: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.campaignItemCompendium.findMany({
      where: { campaignId },
      select: {
        templateId: true,
        item: true,
        custom: true,
        visibility: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.campaignHomebrewAsset.findMany({
      where: {
        campaignId,
        type: { in: ["SPELL", "CREATURE", "SYSTEM", CREATION_META_TYPE] },
      },
      select: {
        type: true,
        sourceId: true,
        data: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }) as unknown as Promise<CreationAsset[]>,
  ])

  let updatedAt = campaign.updatedAt
  const marker = assets.find(
    (asset) => asset.type === CREATION_META_TYPE && asset.sourceId === CREATION_META_SOURCE,
  )
  const markerData = asRecord(marker?.data)
  const managedDomains = {
    spells: markerData?.spells === true,
    creatureCompendium: markerData?.creatureCompendium === true,
    customSystems: markerData?.customSystems === true,
  }

  const characters = characterLinks.map((link) => {
    updatedAt = laterDate(updatedAt, link.character.updatedAt)
    return toCreationCharacter(
      link.character.id,
      link.character.ownerId,
      link.visibility,
      link.character.data,
    )
  })

  for (const asset of assets) updatedAt = laterDate(updatedAt, asset.updatedAt)

  const spellAssets = assets.filter((asset) => asset.type === "SPELL")
  const spells = managedDomains.spells
    ? spellAssets.map((asset) => asset.data as Spell)
    : spellLinks.map((link) => {
        updatedAt = laterDate(updatedAt, link.spell.updatedAt)
        return link.spell.data as unknown as Spell
      })

  const itemCompendium: CreationItemCompendiumEntry[] = itemRows.map((entry) => {
    updatedAt = laterDate(updatedAt, entry.updatedAt)
    return {
      templateId: entry.templateId,
      item: entry.item as unknown as Itemmable,
      custom: entry.custom,
      visibility: entry.visibility === "MASTER" ? "MASTER" : "PUBLIC",
    }
  })

  const creatureCompendium = managedDomains.creatureCompendium
    ? assets
        .filter((asset) => asset.type === "CREATURE")
        .map((asset) => asset.data as CompendiumCreature)
    : []

  const customSystems = managedDomains.customSystems
    ? assets
        .filter((asset) => asset.type === "SYSTEM")
        .map((asset) => asset.data as CustomSystemDefinition)
    : []

  const data: CreationState = {
    version: 1,
    characters,
    spells,
    itemCompendium,
    creatureCompendium,
    customSystems,
  }

  return {
    revision: Math.max(1, campaign.creationRevision),
    updatedAt: updatedAt.toISOString(),
    data,
    managedDomains,
  }
}

async function replaceCreationAssets(
  tx: Prisma.TransactionClient,
  input: {
    campaignId: string
    userId: string
    type: "SPELL" | "CREATURE" | "SYSTEM"
    entries: Array<{
      sourceId: string
      name: string
      data: unknown
    }>
  },
): Promise<void> {
  const sourceIds = input.entries.map((entry) => entry.sourceId)
  ensureUniqueIds(
    sourceIds,
    "CREATION_ASSET_DUPLICATE",
    `A Criação contém ids duplicados no domínio ${input.type}.`,
  )

  await tx.campaignHomebrewAsset.deleteMany({
    where: {
      campaignId: input.campaignId,
      type: input.type,
      ...(sourceIds.length ? { sourceId: { notIn: sourceIds } } : {}),
    },
  })

  for (const entry of input.entries) {
    await tx.campaignHomebrewAsset.upsert({
      where: {
        campaignId_type_sourceId: {
          campaignId: input.campaignId,
          type: input.type,
          sourceId: entry.sourceId,
        },
      },
      create: {
        id: crypto.randomUUID(),
        campaignId: input.campaignId,
        type: input.type,
        sourceId: entry.sourceId,
        name: entry.name,
        data: entry.data as never,
        addedById: input.userId,
      },
      update: {
        name: entry.name,
        data: entry.data as never,
        addedById: input.userId,
      },
    })
  }
}

function readRevision(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ApiError(
      400,
      "CREATION_REVISION_INVALID",
      "A revisão base da Criação é inválida.",
    )
  }
  return Number(value)
}

function readCreationState(value: unknown): CreationState {
  const state = asRecord(value)
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.characters) ||
    !Array.isArray(state.spells) ||
    !Array.isArray(state.itemCompendium) ||
    !Array.isArray(state.creatureCompendium) ||
    !Array.isArray(state.customSystems)
  ) {
    throw new ApiError(
      400,
      "CREATION_STATE_INVALID",
      "O estado de Criação é inválido.",
    )
  }
  return state as unknown as CreationState
}

function readCreationCharacterConfiguration(
  value: unknown,
): CreationCharacterConfiguration {
  const configuration = asRecord(value)
  if (!configuration) {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_INVALID",
      "Configuração de personagem inválida.",
    )
  }

  const characterId = readRequiredString(configuration.characterId)
  const ownerId = readRequiredString(configuration.ownerId)
  const type = readRequiredString(configuration.type)
  if (!CHARACTER_TYPES.some((candidate) => candidate === type)) {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_TYPE_INVALID",
      "Tipo de personagem inválido.",
    )
  }

  const visibility = configuration.visibility
  if (
    visibility !== "private" &&
    visibility !== "party" &&
    visibility !== "master"
  ) {
    throw new ApiError(
      400,
      "CREATION_VISIBILITY_INVALID",
      "Visibilidade de personagem inválida.",
    )
  }

  if (typeof configuration.unique !== "boolean") {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_UNIQUE_INVALID",
      "A configuração de unicidade do personagem é inválida.",
    )
  }

  if (
    !Array.isArray(configuration.hiddenCharacterTabs) ||
    configuration.hiddenCharacterTabs.some((entry) => typeof entry !== "string")
  ) {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_TABS_INVALID",
      "As abas ocultas do personagem são inválidas.",
    )
  }

  if (!Array.isArray(configuration.customSystems)) {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_SYSTEMS_INVALID",
      "A configuração de sistemas personalizados do personagem é inválida.",
    )
  }

  const customSystems = configuration.customSystems.map(
    readCreationCharacterCustomSystemConfiguration,
  )
  ensureUniqueIds(
    customSystems.map((entry) => entry.systemId),
    "CREATION_CHARACTER_SYSTEM_DUPLICATE",
    "O personagem possui o mesmo sistema personalizado mais de uma vez.",
  )

  return {
    characterId,
    ownerId,
    type: type as CreationCharacterConfiguration["type"],
    visibility,
    unique: configuration.unique,
    hiddenCharacterTabs: configuration.hiddenCharacterTabs,
    customSystems,
  }
}

function readCreationCharacterCustomSystemConfiguration(
  value: unknown,
): CreationCharacterCustomSystemConfiguration {
  const state = asRecord(value)
  if (!state) {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_SYSTEM_INVALID",
      "Configuração de sistema personalizado inválida.",
    )
  }

  const systemId = readRequiredString(state.systemId)
  if (
    typeof state.systemVersion !== "number" ||
    !Number.isInteger(state.systemVersion) ||
    state.systemVersion < 1
  ) {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_SYSTEM_VERSION_INVALID",
      "A versão instalada do sistema personalizado precisa ser um inteiro positivo.",
    )
  }

  if (typeof state.enabled !== "boolean") {
    throw new ApiError(
      400,
      "CREATION_CHARACTER_SYSTEM_ENABLED_INVALID",
      "O estado habilitado do sistema personalizado é inválido.",
    )
  }

  const configuration: CreationCharacterCustomSystemConfiguration = {
    systemId,
    systemVersion: state.systemVersion,
    enabled: state.enabled,
  }

  if (state.suppressed !== undefined) {
    if (typeof state.suppressed !== "boolean") {
      throw new ApiError(
        400,
        "CREATION_CHARACTER_SYSTEM_SUPPRESSED_INVALID",
        "O estado de remoção do sistema personalizado é inválido.",
      )
    }
    configuration.suppressed = state.suppressed
  }

  if (state.abilityAcquisitionExceptions !== undefined) {
    const exceptions = asRecord(state.abilityAcquisitionExceptions)
    if (!exceptions) {
      throw new ApiError(
        400,
        "CREATION_CHARACTER_SYSTEM_EXCEPTIONS_INVALID",
        "As exceções de aquisição de habilidades do sistema são inválidas.",
      )
    }
    configuration.abilityAcquisitionExceptions =
      exceptions as CreationCharacterCustomSystemConfiguration["abilityAcquisitionExceptions"]
  }

  if (state.installationSource !== undefined) {
    if (
      state.installationSource !== "master" &&
      state.installationSource !== "automatic"
    ) {
      throw new ApiError(
        400,
        "CREATION_CHARACTER_SYSTEM_SOURCE_INVALID",
        "A origem de instalação do sistema personalizado é inválida.",
      )
    }
    configuration.installationSource = state.installationSource
  }

  return configuration
}

function readCreationItemEntry(value: unknown): CreationItemCompendiumEntry {
  const entry = asRecord(value)
  if (!entry) {
    throw new ApiError(400, "CREATION_ITEM_INVALID", "Item do compêndio inválido.")
  }

  const templateId = readRequiredString(entry.templateId)
  const item = asRecord(entry.item)
  if (!item || readRequiredString(item.id) !== templateId) {
    throw new ApiError(
      400,
      "CREATION_ITEM_ID_INVALID",
      "O id do item precisa corresponder ao id do template.",
    )
  }
  readRequiredString(item.name)

  if (typeof entry.custom !== "boolean") {
    throw new ApiError(
      400,
      "CREATION_ITEM_CUSTOM_INVALID",
      "A flag custom do item é inválida.",
    )
  }

  if (entry.visibility !== "PUBLIC" && entry.visibility !== "MASTER") {
    throw new ApiError(
      400,
      "CREATION_ITEM_VISIBILITY_INVALID",
      "A visibilidade do item é inválida.",
    )
  }

  return {
    templateId,
    item: item as unknown as Itemmable,
    custom: entry.custom,
    visibility: entry.visibility,
  }
}

function readCreationSpell(value: unknown): Spell {
  const spell = asRecord(value)
  if (!spell) {
    throw new ApiError(400, "CREATION_SPELL_INVALID", "Magia de Criação inválida.")
  }
  const index = readRequiredString(spell.index)
  const name = readRequiredString(spell.name)
  return {
    ...spell,
    index,
    name,
  } as unknown as Spell
}

function readCreationCreature(value: unknown): CompendiumCreature {
  const creature = asRecord(value)
  if (!creature) {
    throw new ApiError(400, "CREATION_CREATURE_INVALID", "Criatura de Criação inválida.")
  }
  const id = readRequiredString(creature.id)
  const name = readRequiredString(creature.name)
  return {
    ...creature,
    id,
    name,
  } as unknown as CompendiumCreature
}

function readCreationCustomSystem(value: unknown): CustomSystemDefinition {
  const system = asRecord(value)
  if (!system) {
    throw new ApiError(400, "CREATION_SYSTEM_INVALID", "Sistema de Criação inválido.")
  }

  const id = readRequiredString(system.id)
  const name = readRequiredString(system.name)
  if (
    typeof system.version !== "number" ||
    !Number.isInteger(system.version) ||
    system.version < 1
  ) {
    throw new ApiError(
      400,
      "CREATION_SYSTEM_VERSION_INVALID",
      "A versão do sistema personalizado precisa ser um inteiro positivo.",
    )
  }

  for (const field of ["fields", "resources", "abilityTypes", "panels", "automations"] as const) {
    if (!Array.isArray(system[field])) {
      throw new ApiError(
        400,
        "CREATION_SYSTEM_STRUCTURE_INVALID",
        `O campo ${field} do sistema personalizado precisa ser uma lista.`,
      )
    }
  }

  for (const field of ["nativeStatOverrides", "actions", "standardActionOverrides"] as const) {
    if (system[field] !== undefined && !Array.isArray(system[field])) {
      throw new ApiError(
        400,
        "CREATION_SYSTEM_STRUCTURE_INVALID",
        `O campo ${field} do sistema personalizado precisa ser uma lista.`,
      )
    }
  }

  if (
    system.tags !== undefined &&
    (!Array.isArray(system.tags) || system.tags.some((tag) => typeof tag !== "string"))
  ) {
    throw new ApiError(
      400,
      "CREATION_SYSTEM_TAGS_INVALID",
      "As tags do sistema personalizado são inválidas.",
    )
  }

  if (
    system.hiddenFromSheet !== undefined &&
    typeof system.hiddenFromSheet !== "boolean"
  ) {
    throw new ApiError(
      400,
      "CREATION_SYSTEM_VISIBILITY_INVALID",
      "A configuração hiddenFromSheet do sistema personalizado é inválida.",
    )
  }

  return {
    ...system,
    id,
    name,
    version: system.version,
  } as unknown as CustomSystemDefinition
}

function mergeCharacterCreationConfiguration(
  rawData: unknown,
  configuration: CreationCharacterConfiguration,
  definitions: CustomSystemDefinition[],
): JsonRecord {
  const data = asRecord(rawData) ?? {}
  const sheet = asRecord(data.sheet) ?? {}
  const owner = asRecord(data.owner) ?? {}
  const currentSystems = (Array.isArray(sheet.customSystems)
    ? sheet.customSystems
    : []) as CharacterCustomSystemState[]
  const reconciledSystems = reconcileConfiguredCustomSystemStates(
    currentSystems,
    configuration.customSystems,
    definitions,
  )

  return {
    ...data,
    unique: configuration.unique,
    owner: {
      ...owner,
      id: configuration.ownerId,
    },
    sheet: {
      ...sheet,
      type: configuration.type,
      hiddenCharacterTabs: configuration.hiddenCharacterTabs,
      customSystems: reconciledSystems,
    },
  }
}

function toCreationCharacter(
  characterId: string,
  ownerId: string,
  visibility: CharacterVisibility,
  rawData: unknown,
): CreationCharacterConfiguration {
  const data = asRecord(rawData) ?? {}
  const sheet = asRecord(data.sheet) ?? {}
  const customSystems = Array.isArray(sheet.customSystems)
    ? sheet.customSystems
        .map(toCustomSystemConfiguration)
        .filter(
          (
            entry,
          ): entry is CreationCharacterCustomSystemConfiguration => Boolean(entry),
        )
    : []

  return {
    characterId,
    type:
      typeof sheet.type === "string" &&
      CHARACTER_TYPES.some((candidate) => candidate === sheet.type)
        ? sheet.type as CreationCharacterConfiguration["type"]
        : "pc",
    visibility: toCreationVisibility(visibility),
    unique: typeof data.unique === "boolean" ? data.unique : false,
    ownerId,
    hiddenCharacterTabs: Array.isArray(sheet.hiddenCharacterTabs)
      ? sheet.hiddenCharacterTabs.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    customSystems,
  }
}

function toCustomSystemConfiguration(
  value: unknown,
): CreationCharacterCustomSystemConfiguration | null {
  const state = asRecord(value)
  if (!state || typeof state.systemId !== "string") return null

  const configuration: CreationCharacterCustomSystemConfiguration = {
    systemId: state.systemId,
    systemVersion:
      typeof state.systemVersion === "number" &&
      Number.isInteger(state.systemVersion) &&
      state.systemVersion >= 1
        ? state.systemVersion
        : 1,
    enabled: state.enabled !== false,
  }

  const fields = asRecord(state.fields)
  if (state.enabled === false && fields?.[CUSTOM_SYSTEM_SUPPRESSED_FIELD] === true) {
    configuration.suppressed = true
  }

  if (
    state.abilityAcquisitionExceptions &&
    typeof state.abilityAcquisitionExceptions === "object" &&
    !Array.isArray(state.abilityAcquisitionExceptions)
  ) {
    configuration.abilityAcquisitionExceptions =
      state.abilityAcquisitionExceptions as CreationCharacterCustomSystemConfiguration["abilityAcquisitionExceptions"]
  }

  if (
    state.installationSource === "master" ||
    state.installationSource === "automatic"
  ) {
    configuration.installationSource = state.installationSource
  }

  return configuration
}

function toCreationVisibility(
  value: CharacterVisibility,
): CreationCharacterConfiguration["visibility"] {
  if (value === CharacterVisibility.PRIVATE) return "private"
  if (value === CharacterVisibility.MASTER) return "master"
  return "party"
}

function toDatabaseVisibility(
  value: CreationCharacterConfiguration["visibility"],
): CharacterVisibility {
  if (value === "private") return CharacterVisibility.PRIVATE
  if (value === "master") return CharacterVisibility.MASTER
  return CharacterVisibility.PARTY
}

function ensureUniqueIds(
  ids: string[],
  code: string,
  message: string,
): void {
  if (new Set(ids).size !== ids.length) {
    throw new ApiError(400, code, message)
  }
}

function readRequiredString(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized) {
    throw new ApiError(
      400,
      "CREATION_FIELD_REQUIRED",
      "Um campo obrigatório da Criação está vazio.",
    )
  }
  return normalized
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function laterDate(left: Date, right: Date): Date {
  return right > left ? right : left
}

async function resolveCampaignId(
  request: Request,
  context?: RouteContext,
): Promise<string> {
  const params = context?.params ? await context.params : undefined
  const fromContext = params?.campaignId?.trim()
  if (fromContext) return fromContext

  const match = new URL(request.url).pathname.match(/\/api\/campaigns\/([^/]+)/)
  if (match?.[1]) return decodeURIComponent(match[1])

  throw new ApiError(
    400,
    "CAMPAIGN_ID_REQUIRED",
    "O identificador da campanha não foi informado.",
  )
}
