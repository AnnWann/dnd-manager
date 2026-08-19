import type { CharacterTemplateProps } from "../../src/models/characters/CharacterTemplate";
import { CharacterTemplate } from "../../src/models/characters/CharacterTemplate";
import {
  addSpellCastingDescription,
  removeSpellCastingDescription,
  updateSpellCastingDescription,
} from "../../src/models/characters/characterMagic";
import {
  restoreCustomSpellSlot,
  spendCustomSpellSlot,
} from "../../src/models/characters/customClassConfig";
import {
  restoreSorceryPointDerived,
  spendSorceryPointDerived,
  synchronizeSorceryPointPool,
} from "../../src/models/characters/characterSorceryPoints";
import { restoreKi, spendKi } from "../../src/models/characters/characterKi";
import {
  restoreChannelDivinity,
  spendChannelDivinity,
} from "../../src/models/characters/characterChannelDivinity";
import { withCharacterConditions } from "../../src/models/characters/characterConditionStorage";
import type { CharacterSpells } from "../../src/models/magic/spells/CharacterSpells";
import type { MagicCircleLevel } from "../../src/models/magic/spells/spellDefinitions";
import type { MetamagicId } from "../../src/models/magic/metamagic/Metamagic";
import { SessionActor as AbilitySessionActor } from "./AbilitySessionActor";
import { parseMagicClientMessage, type SessionMagicOperation } from "./magicProtocol";
import { MAX_HP_LOG_RECORDS } from "./hpState";
import type { SessionConditionsState, SessionConnection, SessionHpState } from "./protocol";
import type { SessionAbilityState } from "./abilityProtocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const HP_LOG_KEY = "hp-log";

type UnifiedLogRecord = {
  id: string;
  actorId: string;
  createdAt: string;
  operation: { type: string; characterId: string; [key: string]: unknown };
  reverseOperation: {
    type: "character.ability.restore";
    characterId: string;
    snapshot: {
      ability: SessionAbilityState;
      hp: SessionHpState;
      conditions: SessionConditionsState;
    };
  } | { type: string; characterId: string; [key: string]: unknown };
  undoneAt?: string;
  undoneBy?: string;
};

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
    const [abilityState, hpState, conditionsState, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY).then((value) => value ?? []),
    ]);

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];
    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      sendError(webSocket, "MAGIC_STATE_NOT_INITIALIZED", "Magic state for this character has not been initialized by the MASTER.");
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

    log.push({
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation,
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: { ability: storedAbility, hp, conditions },
      },
    });
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilityState,
      [HP_LOG_KEY]: nextLog,
    });

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: nextState });
    broadcastToMasters(this.ctx.getWebSockets(), nextLog);
  }
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

function hydrateCharacter(state: SessionAbilityState, hp: SessionHpState, conditions: SessionConditionsState): CharacterTemplate {
  let character = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>);
  const sheet = character.get("sheet");
  character = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized ? { ...hp.savingThrows } : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
      HP: { ...sheet.HP, current: hp.current, temporary: hp.temporary, max: hp.max, currentMax: hp.currentMax },
    },
  });
  return withCharacterConditions(character, conditions.conditions as any);
}

function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection; } catch { return null; }
}
function sendError(webSocket: WebSocket, code: string, message: string): void {
  try { webSocket.send(JSON.stringify({ type: "session.error", code, message })); } catch {}
}
function broadcast(sockets: WebSocket[], message: unknown): void {
  const payload = JSON.stringify(message);
  for (const socket of sockets) { try { socket.send(payload); } catch {} }
}
function broadcastToMasters(sockets: WebSocket[], records: UnifiedLogRecord[]): void {
  const payload = JSON.stringify({ type: "session.hp.log", records });
  for (const socket of sockets) {
    const connection = readConnection(socket);
    if (connection?.role === "MASTER") { try { socket.send(payload); } catch {} }
  }
}
