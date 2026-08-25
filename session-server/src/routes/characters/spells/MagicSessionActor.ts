import type { CharacterTemplateProps } from "../../../../../src/models/characters/CharacterTemplate";
import { CharacterTemplate } from "../../../../../src/models/characters/CharacterTemplate";
import {
  addSpellCastingDescription,
  removeSpellCastingDescription,
  updateSpellCastingDescription,
} from "../../../../../src/models/characters/characterMagic";
import {
  restoreCustomSpellSlot,
  spendCustomSpellSlot,
} from "../../../../../src/models/characters/customClassConfig";
import {
  restoreSorceryPointDerived,
  spendSorceryPointDerived,
  synchronizeSorceryPointPool,
} from "../../../../../src/models/characters/characterSorceryPoints";
import { restoreKi, spendKi } from "../../../../../src/models/characters/characterKi";
import {
  restoreChannelDivinity,
  spendChannelDivinity,
} from "../../../../../src/models/characters/characterChannelDivinity";
import { withCharacterConditions } from "../../../../../src/models/characters/characterConditionStorage";
import type { CharacterSpells } from "../../../../../src/models/magic/spells/CharacterSpells";
import type { MagicCircleLevel } from "../../../../../src/models/magic/spells/spellDefinitions";
import type { MetamagicId } from "../../../../../src/models/magic/metamagic/Metamagic";
import { SessionActor as AbilitySessionActor } from "../abilities/AbilitySessionActor";
import { parseMagicClientMessage, type SessionMagicOperation } from "./magicProtocol";
import { MAX_HP_LOG_RECORDS } from "../sheet/hpState";
import type { SessionConditionsState, SessionConnection, SessionHpState } from "../../session/protocol";
import type { SessionAbilityState } from "../abilities/abilityProtocol";
import {
  authorizeCharacterMutation,
  findRuntimeSpell,
  readRuntimeConfig,
} from "../../session/runtimeConfigAccess";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../../session/sessionLog";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const MANUAL_SOURCE_IDS = new Set([
  "manual-feat",
  "manual-race",
  "manual-equipment",
  "custom-system",
  "manual",
  "dm-granted",
]);

type KnownSpellEntry = CharacterSpells["knownSpells"][number];
type RuntimeConfigSnapshot = Awaited<ReturnType<typeof readRuntimeConfig>>;
type SpellAddValidation =
  | { ok: true }
  | { ok: false; code: string; message: string };

export class SessionActor extends AbilitySessionActor {
  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseMagicClientMessage(raw);
    if (!parsed) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    await this.handleMagicOperation(webSocket, connection, parsed.operation);
  }

  private async handleMagicOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionMagicOperation,
  ): Promise<void> {
    const [abilityState, hpState, conditionsState, runtimeConfig, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      readRuntimeConfig(this.ctx.storage),
      readSessionLog(this.ctx.storage),
    ]);

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];
    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      sendError(webSocket, "MAGIC_STATE_NOT_INITIALIZED", "Magic state for this character has not been initialized by the MASTER.");
      return;
    }

    const authorization = authorizeCharacterMutation(
      connection,
      runtimeConfig,
      operation.characterId,
    );
    if (!authorization.ok) {
      sendError(webSocket, authorization.code, authorization.message);
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change magic for this character.");
      return;
    }

    let current: CharacterTemplate;
    try {
      current = hydrateCharacter(storedAbility, hp, conditions);
    } catch {
      sendError(webSocket, "MAGIC_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    if (operation.type === "character.spell.add") {
      const validation = validateSpellAdd(
        connection,
        current,
        runtimeConfig,
        operation.spellEntry as unknown as KnownSpellEntry,
      );
      if (!validation.ok) {
        sendError(webSocket, validation.code, validation.message);
        return;
      }
    }

    const next = applyMagicOperation(current, operation);
    if (!next || JSON.stringify(current.toJSON()) === JSON.stringify(next.toJSON())) {
      sendError(webSocket, "MAGIC_OPERATION_REJECTED", "The requested magic operation is invalid for the current character state.");
      return;
    }

    const nextState: SessionAbilityState = {
      characterId: operation.characterId,
      character: next.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };
    abilityState[operation.characterId] = nextState;

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: { ability: storedAbility, hp, conditions },
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [ABILITIES_STATE_KEY]: abilityState },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
  }
}

function validateSpellAdd(
  connection: SessionConnection,
  character: CharacterTemplate,
  runtimeConfig: RuntimeConfigSnapshot,
  entry: KnownSpellEntry,
): SpellAddValidation {
  const spellIndex = entry.spells.id.trim();
  const source = entry.source;
  const acquisition = entry.acquisition;

  const alreadyKnown = character
    .getOrCreateMagic()
    .spells.knownSpells.some((known) => known.spells.id === spellIndex);
  if (alreadyKnown) {
    return {
      ok: false,
      code: "SPELL_ALREADY_KNOWN",
      message: "This character already knows this spell.",
    };
  }

  const classes = character.get("sheet").classes ?? [];
  if (source.type === "class") {
    const classEntry = classes.find((candidate) => candidate.className === source.sourceId);
    if (!classEntry) {
      return {
        ok: false,
        code: "SPELL_SOURCE_CLASS_INVALID",
        message: "The selected spell source is not one of this character's classes.",
      };
    }
    if (classEntry.castingAttribute && classEntry.castingAttribute !== source.attribute) {
      return {
        ok: false,
        code: "SPELL_SOURCE_ATTRIBUTE_INVALID",
        message: "The selected casting attribute does not match the class configuration.",
      };
    }
  }

  if (MANUAL_SOURCE_IDS.has(source.sourceId) && !acquisition) {
    return {
      ok: false,
      code: "SPELL_ACQUISITION_REQUIRED",
      message: "Manual session spell additions must include acquisition metadata.",
    };
  }

  if (!acquisition) return { ok: true };

  if (acquisition.reason !== "manual" && acquisition.reason !== "campaign-grant") {
    return { ok: true };
  }

  const characterLevel = classes.reduce((total, candidate) => total + candidate.level, 0);
  if (acquisition.characterLevel !== characterLevel) {
    return {
      ok: false,
      code: "SPELL_ACQUISITION_LEVEL_STALE",
      message: "The character level changed before this spell acquisition was committed.",
    };
  }

  if (acquisition.reason === "campaign-grant") {
    if (
      connection.role !== "MASTER"
      || source.type !== "ability"
      || source.sourceId !== "dm-granted"
      || acquisition.sourceType !== "campaign"
    ) {
      return {
        ok: false,
        code: "SPELL_CAMPAIGN_GRANT_MASTER_REQUIRED",
        message: "Only the MASTER can add a spell as a campaign grant.",
      };
    }
  } else {
    const sourceValidation = validateManualSource(character, entry);
    if (!sourceValidation.ok) return sourceValidation;
  }

  const catalogOrigin = acquisition.notes?.trim();
  if (catalogOrigin !== "spell-catalog:official" && catalogOrigin !== "spell-catalog:homebrew") {
    return {
      ok: false,
      code: "SPELL_CATALOG_ORIGIN_REQUIRED",
      message: "Manual spell acquisition must identify whether the spell came from the official or homebrew catalog.",
    };
  }

  if (catalogOrigin === "spell-catalog:homebrew" && !findRuntimeSpell(runtimeConfig, spellIndex)) {
    return {
      ok: false,
      code: "HOMEBREW_SPELL_NOT_IN_CREATION",
      message: "This homebrew spell is not part of the active saved Creation configuration.",
    };
  }

  return { ok: true };
}

function validateManualSource(
  character: CharacterTemplate,
  entry: KnownSpellEntry,
): SpellAddValidation {
  const source = entry.source;
  const acquisition = entry.acquisition;
  if (!acquisition || acquisition.reason !== "manual") {
    return {
      ok: false,
      code: "SPELL_ACQUISITION_INVALID",
      message: "The spell acquisition metadata is invalid.",
    };
  }

  if (source.type === "class") {
    const classEntry = (character.get("sheet").classes ?? []).find(
      (candidate) => candidate.className === source.sourceId,
    );
    if (
      !classEntry
      || acquisition.sourceType !== "class"
      || acquisition.className !== classEntry.className
      || acquisition.classLevel !== classEntry.level
    ) {
      return {
        ok: false,
        code: "SPELL_MANUAL_CLASS_SOURCE_INVALID",
        message: "The manual class spell acquisition does not match the character's current class.",
      };
    }
    return { ok: true };
  }

  const valid =
    (source.type === "feat" && source.sourceId === "manual-feat" && acquisition.sourceType === "feat")
    || (source.type === "race" && source.sourceId === "manual-race" && acquisition.sourceType === "race")
    || (source.type === "equipment" && source.sourceId === "manual-equipment" && acquisition.sourceType === "equipment")
    || (source.type === "ability" && source.sourceId === "custom-system" && acquisition.sourceType === "ability")
    || (source.type === "ability" && source.sourceId === "manual" && acquisition.sourceType === "manual");

  if (!valid) {
    return {
      ok: false,
      code: "SPELL_MANUAL_SOURCE_INVALID",
      message: "The selected manual spell source is not valid for session acquisition.",
    };
  }

  return { ok: true };
}

function applyMagicOperation(character: CharacterTemplate, operation: SessionMagicOperation): CharacterTemplate | null {
  switch (operation.type) {
    case "character.spell.prepare":
      return character.setSpellPrepared(operation.spellIndex, operation.prepared);
    case "character.spell.add":
      return character.addSpell(operation.spellEntry as unknown as CharacterSpells["knownSpells"][number]);
    case "character.spell.remove":
      return character.removeSpell(operation.spellIndex);
    case "character.spell.castingDescription.add":
      return addSpellCastingDescription(character, operation.spellIndex);
    case "character.spell.castingDescription.update":
      return updateSpellCastingDescription(character, operation.spellIndex, operation.descriptionIndex, operation.description);
    case "character.spell.castingDescription.remove":
      return removeSpellCastingDescription(character, operation.spellIndex, operation.descriptionIndex);
    case "character.spellSlot.spend":
      return character.spendSpellSlot(operation.level as MagicCircleLevel);
    case "character.spellSlot.restore":
      return character.restoreSpellSlot(operation.level as MagicCircleLevel);
    case "character.pactSlot.spend":
      return character.spendPactSlot();
    case "character.pactSlot.restore":
      return character.restorePactSlot();
    case "character.customSpellSlot.spend":
      return spendCustomSpellSlot(character, operation.poolId, operation.level);
    case "character.customSpellSlot.restore":
      return restoreCustomSpellSlot(character, operation.poolId, operation.level);
    case "character.metamagic.add":
      return synchronizeSorceryPointPool(character.addMetamagic(operation.metamagicId as MetamagicId));
    case "character.metamagic.remove":
      return synchronizeSorceryPointPool(character.removeMetamagic(operation.metamagicId as MetamagicId));
    case "character.sorceryPoint.spend":
      return spendSorceryPointDerived(character);
    case "character.sorceryPoint.restore":
      return restoreSorceryPointDerived(character);
    case "character.ki.spend":
      return spendKi(character);
    case "character.ki.restore":
      return restoreKi(character);
    case "character.channelDivinity.spend":
      return spendChannelDivinity(character);
    case "character.channelDivinity.restore":
      return restoreChannelDivinity(character);
  }
}

function hydrateCharacter(
  state: SessionAbilityState,
  hp: SessionHpState,
  conditions: SessionConditionsState,
): CharacterTemplate {
  let character = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>);
  const sheet = character.get("sheet");
  character = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized ? { ...hp.savingThrows } : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
      HP: {
        ...sheet.HP,
        current: hp.current,
        temporary: hp.temporary,
        max: hp.max,
        currentMax: hp.currentMax,
      },
    },
  });
  return withCharacterConditions(character, conditions.conditions as any);
}

function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection; }
  catch { return null; }
}
function sendError(webSocket: WebSocket, code: string, message: string): void {
  try { webSocket.send(JSON.stringify({ type: "session.error", code, message })); } catch {}
}
function broadcast(sockets: WebSocket[], message: unknown): void {
  const payload = JSON.stringify(message);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}
