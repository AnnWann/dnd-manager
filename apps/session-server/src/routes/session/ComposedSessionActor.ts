import { getCharacterGrantedSpells } from "../../../../web/src/models/characters/characterGrantedSpells";
import { parseHiddenSpellClientMessage, projectHiddenSpell, type HiddenSpellCommitment } from "../../../../../packages/session-protocol/src/hiddenSpellcasting";
import { SessionActor as BaseSessionActor } from "./SessionActor";
import { authorizeCharacterMutation, findRuntimeSpell, readRuntimeConfig } from "./runtimeConfigAccess";
import { isSessionPlayerOperationBlocked, parseSessionPauseMessage, type SessionPauseState } from "../../../../web/src/shared/session-runtime/sessionPause";
import type { CompanionState } from "../../../../web/src/shared/session-runtime/companionRuntime";
import type { SessionInitiativeState } from "../initiative/initiativeProtocol";
import type { InitiativeSession } from "../../../../web/src/models/initiative/Initiative";
import { SessionActor as AbilitySessionActor } from "../characters/abilities/AbilitySessionActor";
import { SessionActor as MagicSessionActor } from "../characters/spells/MagicSessionActor";
import { SessionActor as EquipmentSessionActor } from "../characters/equipment/EquipmentSessionActor";
import { SessionActor as InventorySessionActor } from "../characters/inventory/InventorySessionActor";
import { SessionActor as ProficiencySessionActor } from "../characters/proficiencies/ProficiencySessionActor";
import { SessionActor as RaceSessionActor } from "../characters/race/RaceSessionActor";
import { SessionActor as ProfileSessionActor } from "../characters/profile/ProfileSessionActor";
import { parseAbilityClientMessage, type SessionAbilityState } from "../characters/abilities/abilityProtocol";
import { parseMagicClientMessage } from "../characters/spells/magicProtocol";
import { parseEquipmentClientMessage } from "../characters/equipment/equipmentProtocol";
import { parseInventoryClientMessage } from "../characters/inventory/inventoryProtocol";
import { parseProficiencyClientMessage } from "../characters/proficiencies/proficiencyProtocol";
import { parseRaceClientMessage } from "../characters/race/raceProtocol";
import { parseProfileClientMessage } from "../characters/profile/profileProtocol";
import {
  applyCharacterStateUndo,
  defaultSavingThrows,
  defaultSkills,
  MAX_CHARACTER_STATE_LOG_RECORDS,
} from "../characters/sheet/characterState";
import { applyConditionUndo } from "../characters/sheet/conditionState";
import { applyConcentrationUndo } from "../characters/sheet/concentrationState";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpLogRecord,
  SessionHpState,
} from "./protocol";
import {
  parseCharacterLifecycleClientMessage,
  type SessionCharacterLifecycleOperation,
  type SessionCharacterLifecycleState,
} from "./characterLifecycleProtocol";
import {
  commitSessionMutation,
  commitSessionUndo,
  createSessionLogRecord,
  readSessionLog,
  validateUndoOrdering,
  type SessionLogRecord,
} from "./sessionLog";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../web/src/models/characters/CharacterTemplate";
import { getCurrentMaxHp } from "../../../../web/src/models/characters/characterHp";
import { getCharacterConditions } from "../../../../web/src/models/characters/characterConditionStorage";
import {
  broadcastVisibilityFiltered,
  createVisibilityFilteredContext,
  sendVisibilityFiltered,
} from "./visibilityDelivery";

const SESSION_PAUSE_STATE_KEY = "session-pause-state";
const HIDDEN_SPELL_STATE_KEY = "hidden-spell-commitments-v1";
const COMPANIONS_STATE_KEY = "companions-state";
const INITIATIVE_STATE_KEY = "initiative-state";
const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const INVENTORY_STATE_KEY = "inventory-state";
const CHARACTER_LIFECYCLE_STATE_KEY = "characters-state";

type DomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

type SharedInventoryState = {
  initialized: boolean;
  revision: number;
  partyInventory: unknown[];
  groundInventory: unknown[];
  carryCapacity?: number;
  additionalSupplyConsumption?: number;
  partyInventoryAccessible?: boolean;
};

type CharacterLifecycleReverse = {
  type: "session.character.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    lifecycle?: SessionCharacterLifecycleState;
    ability?: SessionAbilityState;
    hp?: SessionHpState;
    conditions?: SessionConditionsState;
  };
};

type AbilityReverse = {
  type: "character.ability.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    ability: SessionAbilityState;
    hp: SessionHpState;
    conditions: SessionConditionsState;
    targetReverse?: {
      hp: Record<string, SessionHpState>;
      conditions: Record<string, SessionConditionsState>;
      companions: Record<string, CompanionState>;
      initiative?: SessionInitiativeState;
      changedCharacters?: string[];
      changedConditions?: string[];
      changedCompanions?: string[];
    };
  };
};

type RestReverse = {
  type: "session.rest.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    ability: SessionAbilityState;
    hp: SessionHpState;
    conditions: SessionConditionsState;
    inventory?: SharedInventoryState;
  };
};

type InventoryReverse = {
  type: "session.inventory.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    abilities: Record<string, SessionAbilityState>;
    hp: Record<string, SessionHpState>;
    conditions: Record<string, SessionConditionsState>;
    inventory: SharedInventoryState;
  };
};

type ProficiencyReverse = {
  type: "session.proficiency.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: SessionAbilityState;
};

type RaceOrProfileReverse = {
  type: "session.race.restore" | "session.profile.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: { ability: SessionAbilityState; hp: SessionHpState };
};

type CentrallyRestorableReverse =
  | CharacterLifecycleReverse
  | AbilityReverse
  | RestReverse
  | InventoryReverse
  | ProficiencyReverse
  | RaceOrProfileReverse;

/**
 * The only Durable Object exported by the worker.
 *
 * Domain actors are isolated forward-operation containers. This class owns
 * routing, lifecycle, unified timeline ordering and every undo path.
 */
export class SessionActor extends BaseSessionActor {
  private pauseStateCache: SessionPauseState | undefined;

  private async readPauseState(): Promise<SessionPauseState> {
    if (!this.pauseStateCache) {
      this.pauseStateCache = (await this.ctx.storage.get<SessionPauseState>(SESSION_PAUSE_STATE_KEY))
        ?? { paused: false, updatedAt: "", updatedBy: null };
    }
    return this.pauseStateCache;
  }

  private readonly abilityRoute = bindDomainActor(AbilitySessionActor.prototype, this.ctx);
  private readonly magicRoute = bindDomainActor(MagicSessionActor.prototype, this.ctx);
  private readonly equipmentRoute = bindDomainActor(EquipmentSessionActor.prototype, this.ctx);
  private readonly inventoryRoute = bindDomainActor(InventorySessionActor.prototype, this.ctx);
  private readonly proficiencyRoute = bindDomainActor(ProficiencySessionActor.prototype, this.ctx);
  private readonly raceRoute = bindDomainActor(RaceSessionActor.prototype, this.ctx);
  private readonly profileRoute = bindDomainActor(ProfileSessionActor.prototype, this.ctx);

  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const socket = this.ctx.getWebSockets().find((candidate) => {
      try {
        const connection = candidate.deserializeAttachment() as { clientId?: unknown } | null;
        return connection?.clientId === clientId;
      } catch {
        return false;
      }
    });
    if (!socket) return response;
    sendVisibilityFiltered(socket, { type: "session.pause.state", state: await this.readPauseState() });

    await Promise.all([
      this.sendHiddenSpellSnapshot(socket),
      this.sendAbilitySnapshot(socket),
      this.sendInventorySnapshot(socket),
      this.sendCharacterLifecycleSnapshot(socket),
    ]);
    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const hiddenSpell = parseHiddenSpellClientMessage(raw);
    if (hiddenSpell) {
      await this.handleHiddenSpell(webSocket, hiddenSpell);
      return;
    }
    const sessionControl = parseSessionPauseMessage(raw);
    if (sessionControl) {
      const connection = readSessionConnection(webSocket);
      if (!connection || connection.role !== "MASTER") {
        sendError(webSocket, "MASTER_REQUIRED", "Somente o mestre pode pausar ou retomar a sessão.");
        return;
      }
      const state: SessionPauseState = { paused: sessionControl.paused, updatedAt: new Date().toISOString(), updatedBy: connection.userId };
      await this.ctx.storage.put(SESSION_PAUSE_STATE_KEY, state);
      this.pauseStateCache = state;
      broadcast(this.ctx.getWebSockets(), { type: "session.pause.state", state });
      return;
    }

    const connection = readSessionConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    const storedPause = await this.readPauseState();
    let messageType: string | undefined;
    try {
      const envelope: unknown = JSON.parse(raw);
      if (envelope && typeof envelope === "object" && !Array.isArray(envelope)) {
        const type = (envelope as { type?: unknown }).type;
        if (typeof type === "string") messageType = type;
      }
    } catch { /* malformed packets are rejected by normal routing */ }
    if (isSessionPlayerOperationBlocked(Boolean(storedPause?.paused), connection.role, messageType)) {
      sendError(webSocket, "SESSION_PAUSED", "A sessão está pausada pelo mestre. Apenas ações do mestre podem alterar a sessão.");
      return;
    }

    const undoLogId = parseUndoLogId(raw);
    if (undoLogId) {
      await this.handleCentralUndo(webSocket, undoLogId);
      return;
    }

    const lifecycle = parseCharacterLifecycleClientMessage(raw);
    if (lifecycle) {
      const connection = readSessionConnection(webSocket);
      if (!connection) {
        webSocket.close(1011, "Missing connection attachment");
        return;
      }
      connection.lastHeartbeatAt = Date.now();
      webSocket.serializeAttachment(connection);
      await this.handleCharacterLifecycleOperation(webSocket, connection, lifecycle.operation);
      return;
    }

    const route = resolveMessageRoute(raw, {
      ability: this.abilityRoute,
      magic: this.magicRoute,
      equipment: this.equipmentRoute,
      inventory: this.inventoryRoute,
      proficiency: this.proficiencyRoute,
      race: this.raceRoute,
      profile: this.profileRoute,
    });

    if (route) {
      await route.webSocketMessage(webSocket, message);
      return;
    }

    await super.webSocketMessage(webSocket, message);
  }

  private async sendHiddenSpellSnapshot(socket: WebSocket): Promise<void> {
    const entries = (await this.ctx.storage.get<HiddenSpellCommitment[]>(HIDDEN_SPELL_STATE_KEY)) ?? [];
    send(socket, { type: "session.hiddenSpell.snapshot", entries: entries.map(projectHiddenSpell) });
  }

  private async broadcastHiddenSpellSnapshot(): Promise<void> {
    const entries = (await this.ctx.storage.get<HiddenSpellCommitment[]>(HIDDEN_SPELL_STATE_KEY)) ?? [];
    broadcast(this.ctx.getWebSockets(), { type: "session.hiddenSpell.snapshot", entries: entries.map(projectHiddenSpell) });
  }

  private async handleHiddenSpell(
    socket: WebSocket,
    operation: NonNullable<ReturnType<typeof parseHiddenSpellClientMessage>>,
  ): Promise<void> {
    const connection = readSessionConnection(socket);
    if (!connection) return;
    if (connection.role !== "MASTER" && (await this.readPauseState()).paused) {
      sendError(socket, "SESSION_PAUSED", "A sessão está pausada.");
      return;
    }
    const entries = (await this.ctx.storage.get<HiddenSpellCommitment[]>(HIDDEN_SPELL_STATE_KEY)) ?? [];

    if (operation.type === "session.hiddenSpell.resolve" || operation.type === "session.hiddenSpell.reveal") {
      if (connection.role !== "MASTER") {
        sendError(socket, "HIDDEN_SPELL_MASTER_REQUIRED", "Somente o mestre pode revelar conjurações.");
        return;
      }
      const requested = entries.find(candidate => candidate.id === operation.id);
      if (!requested || requested.revealedAt) {
        sendError(socket, "HIDDEN_SPELL_NOT_PENDING", "Conjuração inexistente ou já revelada.");
        return;
      }
      // Counterspells may themselves be counterspelled. Reveal an entire
      // dependency chain, rather than allowing partial disclosure of levels.
      let root = requested;
      while (root.counterspellTargetId) {
        const target = entries.find(candidate => candidate.id === root.counterspellTargetId);
        if (!target || target.revealedAt) {
          sendError(socket, "HIDDEN_SPELL_CHAIN_INVALID", "A cadeia de Contramágica não está disponível.");
          return;
        }
        root = target;
      }
      const chain: HiddenSpellCommitment[] = [];
      const visit = (candidate: HiddenSpellCommitment) => {
        for (const reaction of entries.filter(entry => entry.counterspellTargetId === candidate.id && !entry.revealedAt)) {
          visit(reaction);
        }
        chain.push(candidate);
      };
      visit(root);
      if (operation.type === "session.hiddenSpell.reveal") {
        if (!chain.every(cast => Boolean(cast.resolvedAt) && Boolean(cast.privateResult))) {
          sendError(socket, "HIDDEN_SPELL_UNRESOLVED", "Resolva as conjurações ocultamente antes de revelá-las.");
          return;
        }
        const abilityState = (await this.ctx.storage.get<Record<string, SessionAbilityState>>("abilities-state")) ?? {};
        const runtimeConfig = await readRuntimeConfig(this.ctx.storage);
        // Determine Counterspell outcomes at disclosure; all cast dice have
        // already been calculated privately at declaration time.
        for (const cast of chain) {
          const counters = chain.filter(candidate => candidate.counterspellTargetId === cast.id);
          cast.counterspelled = counters.some(counter => {
            if (counter.counterspelled) return false;
            if (counter.castLevel >= cast.castLevel) return true;
            const modifier = this.hiddenCounterspellModifier(counter, abilityState, runtimeConfig);
            const die = Math.floor(Math.random() * 20) + 1;
            const dc = 10 + cast.castLevel;
            const total = die + modifier;
            counter.counterspellCheck = { die, modifier, total, dc, success: total >= dc };
            return total >= dc;
          });
        }
        const now = new Date().toISOString();
        for (const cast of chain) cast.revealedAt = now;
        await this.ctx.storage.put(HIDDEN_SPELL_STATE_KEY, entries);
        await this.broadcastHiddenSpellSnapshot();
      for (const cast of chain) {
        if (cast.actor.kind === "character") {
          await this.magicRoute.webSocketMessage(socket, JSON.stringify({
            type: "session.magic.operation",
            operation: {
              type: "character.spell.cast",
              characterId: cast.actor.characterId,
              requestId: cast.id,
              spellIndex: cast.spellIndex,
              sourceId: cast.sourceId,
              castLevel: cast.castLevel,
              mode: cast.mode,
              visibility: "public",
              payment: cast.payment,
              targetEntryId: cast.targetEntryId,
              selectedDamageType: cast.selectedDamageType,
              selectedWeaponId: cast.selectedWeaponId,
              counterspelled: Boolean(cast.counterspelled),
              preResolvedResult: cast.privateResult,
            },
          }));
        } else {
          await super.webSocketMessage(socket, JSON.stringify({
            type: "session.creature.roll",
            request: {
              requestId: cast.id,
              creatureId: cast.actor.creatureId,
              initiativeEntryId: cast.actor.initiativeEntryId,
              mode: cast.mode,
              visibility: "public",
              source: {
                type: "spell",
                spellIndex: cast.spellIndex,
                castLevel: cast.castLevel,
                intent: "resolve",
                counterspelled: Boolean(cast.counterspelled),
                preResolvedResult: cast.privateResult,
              },
            },
          }));
        }
      }
        return;
      }
      if (chain.some(cast => Boolean(cast.resolvedAt))) {
        sendError(socket, "HIDDEN_SPELL_ALREADY_RESOLVED", "Esta cadeia já foi resolvida.");
        return;
      }
      const abilityState = (await this.ctx.storage.get<Record<string, SessionAbilityState>>("abilities-state")) ?? {};
      const runtimeConfig = await readRuntimeConfig(this.ctx.storage);
      for (const cast of chain) {
        const attackers = chain.filter(candidate => candidate.counterspellTargetId === cast.id);
        cast.counterspelled = attackers.some(attacker => {
          if (attacker.counterspelled) return false;
          if (attacker.castLevel >= cast.castLevel) return true;
          const modifier = this.hiddenCounterspellModifier(attacker, abilityState, runtimeConfig);
          const die = Math.floor(Math.random() * 20) + 1;
          const dc = 10 + cast.castLevel;
          const total = die + modifier;
          attacker.counterspellCheck = { die, modifier, total, dc, success: total >= dc };
          return total >= dc;
        });
      }
      // Seal the resolution before spending any resources so duplicate resolve
      // messages cannot apply the same spell twice. Details stay redacted.
      const now = new Date().toISOString();
      for (const cast of chain) cast.resolvedAt = now;
      await this.ctx.storage.put(HIDDEN_SPELL_STATE_KEY, entries);
      await this.broadcastHiddenSpellSnapshot();
      for (const cast of chain) {
        if (cast.actor.kind === "character") {
          await this.magicRoute.webSocketMessage(socket, JSON.stringify({
            type: "session.magic.operation",
            operation: {
              type: "character.spell.cast",
              characterId: cast.actor.characterId,
              requestId: cast.id,
              spellIndex: cast.spellIndex,
              sourceId: cast.sourceId,
              castLevel: cast.castLevel,
              mode: cast.mode,
              visibility: "public",
              payment: cast.payment,
              targetEntryId: cast.targetEntryId,
              selectedDamageType: cast.selectedDamageType,
              selectedWeaponId: cast.selectedWeaponId,
              counterspelled: Boolean(cast.counterspelled),
              hiddenResolution: true,
            },
          }));
        } else {
          await super.webSocketMessage(socket, JSON.stringify({
            type: "session.creature.roll",
            request: {
              requestId: cast.id,
              creatureId: cast.actor.creatureId,
              initiativeEntryId: cast.actor.initiativeEntryId,
              mode: cast.mode,
              visibility: "public",
              source: {
                type: "spell",
                spellIndex: cast.spellIndex,
                castLevel: cast.castLevel,
                intent: "resolve",
                counterspelled: Boolean(cast.counterspelled),
                hiddenResolution: true,
              },
            },
          }));
        }
      }
      return;
    }

    if (entries.some(candidate => candidate.id === operation.requestId)) {
      sendError(socket, "HIDDEN_SPELL_DUPLICATE", "Esta conjuração já foi registrada.");
      return;
    }
    if (entries.length >= 250) {
      sendError(socket, "HIDDEN_SPELL_LIMIT", "Limite de conjurações registradas atingido.");
      return;
    }
    const config = await readRuntimeConfig(this.ctx.storage);
    const spell = findRuntimeSpell(config, operation.spellIndex);
    if (!spell || operation.castLevel < spell.slotLevel
      || (spell.slotLevel === 0 && operation.castLevel !== 0)) {
      sendError(socket, "HIDDEN_SPELL_INVALID", "Magia ou círculo inválido na sessão.");
      return;
    }
    const actor = operation.actor;
    let actorLabel: string;
    if (actor.kind === "character") {
      const authorized = authorizeCharacterMutation(connection, config, actor.characterId);
      const hp = (await this.ctx.storage.get<Record<string, SessionHpState>>("hp-state"))?.[actor.characterId];
      const ability = (await this.ctx.storage.get<Record<string, SessionAbilityState>>("abilities-state"))?.[actor.characterId];
      if (!authorized.ok || !hp || !ability?.initialized || (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId)) {
        sendError(socket, "HIDDEN_SPELL_ACCESS_DENIED", "Este conjurador não pertence a você.");
        return;
      }
      if (!operation.sourceId || !operation.payment) {
        sendError(socket, "HIDDEN_SPELL_SOURCE_INVALID", "Fonte e recurso da magia são obrigatórios.");
        return;
      }
      const character = CharacterTemplate.fromJSON(ability.character as Partial<CharacterTemplateProps>);
      const known = character.getOrCreateMagic().spells.knownSpells.some(item =>
        item.spells.id === spell.index && item.source.sourceId === operation.sourceId)
        || getCharacterGrantedSpells(character).some(item =>
          item.index === spell.index && item.source.sourceId === operation.sourceId);
      if (!known) {
        sendError(socket, "HIDDEN_SPELL_UNKNOWN", "A magia escolhida não consta nas magias deste personagem.");
        return;
      }
      if (operation.payment.type === "slot") {
        const level = Number(operation.payment.level);
        const slots = operation.payment.pool === "pact"
          ? character.getPactSlots()
          : character.getSpellSlots()[level as keyof ReturnType<typeof character.getSpellSlots>];
        const current = slots?.current ?? 0;
        const reserved = entries.filter(other => !other.revealedAt
          && other.actor.kind === "character"
          && other.actor.characterId === actor.characterId
          && other.payment?.type === "slot"
          && other.payment.pool === operation.payment?.pool
          && other.payment.level === level).length;
        if (current <= reserved) {
          sendError(socket, "HIDDEN_SPELL_SLOTS", "Espaços de magia insuficientes.");
          return;
        }
      }
      actorLabel = character.get("name") || "Personagem";
    } else {
      const creature = config?.config.creatureCompendium.find(candidate => candidate.id === actor.creatureId);
      if (!creature || (connection.role !== "MASTER" && creature.ownerUserId !== connection.userId)
        || !creature.spellcasting?.spells.some(item => item.spellIndex === spell.index)) {
        sendError(socket, "HIDDEN_SPELL_CREATURE_DENIED", "A criatura não pode conjurar esta magia.");
        return;
      }
      const configuredSpell = creature.spellcasting.spells.find(item => item.spellIndex === spell.index);
      if (configuredSpell && configuredSpell.usage.type !== "slots"
        && operation.castLevel !== (configuredSpell.castLevel ?? spell.slotLevel)) {
        sendError(socket, "HIDDEN_SPELL_FIXED_LEVEL", "Esta magia possui círculo fixo.");
        return;
      }
      if (actor.initiativeEntryId) {
        const initiative = await this.ctx.storage.get<SessionInitiativeState>("initiative-state");
        const initiativeSession = initiative?.session as Partial<InitiativeSession> | undefined;
        const entry = initiativeSession?.entries?.find(item => item.id === actor.initiativeEntryId);
        if (!entry || entry.sourceId !== "compendium:" + actor.creatureId) {
          sendError(socket, "HIDDEN_SPELL_ENTRY_INVALID", "Combatente inválido para a criatura.");
          return;
        }
        const usage = creature.spellcasting.spells.find(item => item.spellIndex === spell.index);
        if (usage?.usage.type === "slots") {
          const slotLevel = operation.castLevel as keyof NonNullable<typeof entry.creatureSpellResources>["slots"];
          const available = entry.creatureSpellResources?.slots?.[slotLevel]?.current ?? 0;
          const reserved = entries.filter(other => !other.revealedAt
            && other.actor.kind === "creature"
            && other.actor.initiativeEntryId === actor.initiativeEntryId
            && other.castLevel === operation.castLevel).length;
          if (available <= reserved) {
            sendError(socket, "HIDDEN_SPELL_SLOTS", "Espaços de magia insuficientes.");
            return;
          }
        }
      } else if (!creature.ownerUserId) {
        sendError(socket, "HIDDEN_SPELL_ENTRY_REQUIRED", "Adicione a criatura à iniciativa antes de conjurar ocultamente.");
        return;
      }
      actorLabel = creature.basicName || "Criatura";
    }

    const initiative = await this.ctx.storage.get<SessionInitiativeState>("initiative-state");
    const initiativeSession = initiative?.session as Partial<InitiativeSession> | undefined;
    const round = typeof initiativeSession?.round === "number" ? initiativeSession.round : 0;
    if (operation.counterspellTargetId) {
      const target = entries.find(candidate => candidate.id === operation.counterspellTargetId && !candidate.revealedAt);
      if (!target || spell.index !== "counterspell" || spell.slotLevel > operation.castLevel) {
        sendError(socket, "HIDDEN_SPELL_REACTION_INVALID", "A reação deve ser Contramágica contra uma conjuração pendente.");
        return;
      }
      if (entries.some(candidate => candidate.counterspellTargetId && candidate.round === round
          && candidate.actor.kind === actor.kind && (
            actor.kind === "character"
              ? candidate.actor.kind === "character" && candidate.actor.characterId === actor.characterId
              : candidate.actor.kind === "creature" && candidate.actor.creatureId === actor.creatureId && candidate.actor.initiativeEntryId === actor.initiativeEntryId
          ))) {
        sendError(socket, "HIDDEN_SPELL_REACTION_SPENT", "Esta criatura já utilizou uma reação de Contramágica nesta rodada.");
        return;
      }
    }
    entries.push({
      id: operation.requestId, ownerUserId: connection.userId, actor, actorLabel,
      spellIndex: spell.index, spellName: spell.displayName || spell.name,
      castLevel: operation.castLevel,
      sourceId: operation.sourceId, payment: operation.payment,
      targetEntryId: operation.targetEntryId,
      selectedDamageType: operation.selectedDamageType,
      selectedWeaponId: operation.selectedWeaponId,
      mode: operation.mode ?? "normal",
      counterspellTargetId: operation.counterspellTargetId,
      createdAt: new Date().toISOString(), round,
    });
    await this.ctx.storage.put(HIDDEN_SPELL_STATE_KEY, entries);
    await this.broadcastHiddenSpellSnapshot();
    // Compute and seal the actual dice immediately; no public roll, damage,
    // slot consumption or identifiable concentration information is sent.
    const last = entries[entries.length - 1]!;
    await this.preRollHiddenSpell(socket, connection, last);
  }

  private async preRollHiddenSpell(
    socket: WebSocket,
    connection: SessionConnection,
    cast: HiddenSpellCommitment,
  ): Promise<void> {
    const entries = (await this.ctx.storage.get<HiddenSpellCommitment[]>(HIDDEN_SPELL_STATE_KEY)) ?? [];
    const saved = entries.find(entry => entry.id === cast.id);
    if (!saved || saved.resolvedAt) return;
    saved.resolvedAt = new Date().toISOString();
    await this.ctx.storage.put(HIDDEN_SPELL_STATE_KEY, entries);
    const internal = {
      deserializeAttachment: () => ({ ...connection, role: "MASTER" }),
      serializeAttachment: () => {},
      send: (raw: string) => socket.send(raw),
      close: (code?: number, reason?: string) => socket.close(code, reason),
    } as unknown as WebSocket;
    if (cast.actor.kind === "character") {
      await this.magicRoute.webSocketMessage(internal, JSON.stringify({
        type: "session.magic.operation",
        operation: {
          type: "character.spell.cast",
          characterId: cast.actor.characterId,
          requestId: cast.id,
          spellIndex: cast.spellIndex,
          sourceId: cast.sourceId,
          castLevel: cast.castLevel,
          mode: cast.mode,
          visibility: "public",
          payment: cast.payment,
          targetEntryId: cast.targetEntryId,
          selectedDamageType: cast.selectedDamageType,
          selectedWeaponId: cast.selectedWeaponId,
          hiddenResolution: true,
        },
      }));
    } else {
      await super.webSocketMessage(internal, JSON.stringify({
        type: "session.creature.roll",
        request: {
          requestId: cast.id,
          creatureId: cast.actor.creatureId,
          initiativeEntryId: cast.actor.initiativeEntryId,
          mode: cast.mode,
          visibility: "public",
          source: {
            type: "spell",
            spellIndex: cast.spellIndex,
            castLevel: cast.castLevel,
            intent: "resolve",
            hiddenResolution: true,
          },
        },
      }));
    }
    await this.broadcastHiddenSpellSnapshot();
  }

  private hiddenCounterspellModifier(
    cast: HiddenSpellCommitment,
    abilities: Record<string, SessionAbilityState>,
    config: Awaited<ReturnType<typeof readRuntimeConfig>>,
  ): number {
    if (cast.actor.kind === "creature") {
      const creatureId = cast.actor.creatureId;
      const creature = config?.config.creatureCompendium.find(item => item.id === creatureId);
      const attr = creature?.spellcasting?.ability;
      return attr && creature?.abilityScores
        ? Math.floor(((creature.abilityScores[attr] ?? 10) - 10) / 2) : 0;
    }
    const state = abilities[cast.actor.characterId];
    if (!state) return 0;
    try {
      const character = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>);
      const known = character.getOrCreateMagic().spells.knownSpells.find(item =>
        item.spells.id === "counterspell" && item.source.sourceId === cast.sourceId);
      return character.getEffectiveAttributeModifier(known?.source.attribute || "int");
    } catch { return 0; }
  }

  private async handleCentralUndo(webSocket: WebSocket, logId: string): Promise<void> {
    const connection = readSessionConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const log = await readSessionLog(this.ctx.storage);
    const validation = validateUndoOrdering(log, logId);
    if (!validation.ok) {
      sendError(webSocket, validation.code, validation.message);
      return;
    }

    const reverseType = validation.record.reverseOperation.type;
    if (isCentrallyRestorable(validation.record.reverseOperation)) {
      await this.restoreCentralSnapshot(
        webSocket,
        connection,
        log,
        validation.index,
        validation.record,
        validation.affectedScopes,
      );
      return;
    }

    if (
      reverseType === "character.condition.delete"
      || reverseType === "character.condition.restore"
      || reverseType === "character.concentration.restore"
    ) {
      await this.restoreConditionState(
        webSocket,
        connection,
        log,
        validation.index,
        validation.record,
      );
      return;
    }

    await this.restoreHpState(
      webSocket,
      connection,
      log,
      validation.index,
      validation.record,
    );
  }

  private async restoreHpState(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: SessionLogRecord[],
    sourceIndex: number,
    source: SessionLogRecord,
  ): Promise<void> {
    const state = await this.readComposedHpState();
    const characterId = source.reverseOperation.characterId;
    const current = state[characterId];
    if (!current) {
      sendError(webSocket, "HP_NOT_INITIALIZED", "Authoritative state for this character is missing.");
      return;
    }

    const result = applyCharacterStateUndo(
      current,
      source as unknown as SessionHpLogRecord,
      connection,
    );
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    state[characterId] = result.next;
    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [HP_STATE_KEY]: state },
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord: result.record as unknown as SessionLogRecord,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
      undoneAt: result.record.createdAt,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: result.next });
  }

  private async restoreConditionState(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: SessionLogRecord[],
    sourceIndex: number,
    source: SessionLogRecord,
  ): Promise<void> {
    const state = await this.readComposedConditionsState();
    const characterId = source.reverseOperation.characterId;
    const current = state[characterId];
    if (!current?.initialized) {
      sendError(webSocket, "CONDITIONS_NOT_INITIALIZED", "Authoritative conditions for this character are missing.");
      return;
    }

    const legacySource = source as unknown as SessionHpLogRecord;
    const result = source.reverseOperation.type === "character.concentration.restore"
      ? applyConcentrationUndo(current, legacySource, connection)
      : applyConditionUndo(current, legacySource, connection);
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    state[characterId] = result.next;
    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [CONDITIONS_STATE_KEY]: state },
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord: result.record as unknown as SessionLogRecord,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
      undoneAt: result.record.createdAt,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: result.next });
  }

  private async restoreCentralSnapshot(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: SessionLogRecord[],
    sourceIndex: number,
    source: SessionLogRecord,
    affectedScopes: string[],
  ): Promise<void> {
    const reverse = source.reverseOperation as CentrallyRestorableReverse;
    const [abilities, hp, conditions, inventory, lifecycle] = await Promise.all([
      this.readAbilitiesState(),
      this.readComposedHpState(),
      this.readComposedConditionsState(),
      this.readInventoryState(),
      this.readCharacterLifecycleState(),
    ]);

    const characterId = reverse.characterId;
    let inverseReverse: CentrallyRestorableReverse;
    const writes: Record<string, unknown> = {};

    switch (reverse.type) {
      case "character.ability.restore": {
        const currentAbility = abilities[characterId];
        const currentHp = hp[characterId];
        const currentConditions = conditions[characterId];
        if (!currentAbility || !currentHp || !currentConditions) {
          sendError(webSocket, "ABILITY_STATE_NOT_INITIALIZED", "The current ability state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: { ability: currentAbility, hp: currentHp, conditions: currentConditions },
        };
        abilities[characterId] = reverse.snapshot.ability;
        hp[characterId] = reverse.snapshot.hp;
        conditions[characterId] = reverse.snapshot.conditions;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        if (reverse.snapshot.targetReverse) {
          const targets = reverse.snapshot.targetReverse;
          const currentCompanions = (await this.ctx.storage.get<Record<string, CompanionState>>(COMPANIONS_STATE_KEY)) ?? {};
          const currentInitiative = await this.ctx.storage.get<SessionInitiativeState>(INITIATIVE_STATE_KEY);
          const inverseTargets = {
            hp: Object.fromEntries((targets.changedCharacters ?? []).map(id => [id, hp[id]]).filter(([,state]) => state)),
            conditions: Object.fromEntries((targets.changedConditions ?? []).map(id => [id, conditions[id]]).filter(([,state]) => state)),
            companions: Object.fromEntries((targets.changedCompanions ?? []).map(id => [id, currentCompanions[id]]).filter(([,state]) => state)),
            initiative: targets.initiative && currentInitiative ? currentInitiative : undefined,
            changedCharacters: targets.changedCharacters,
            changedConditions: targets.changedConditions,
            changedCompanions: targets.changedCompanions,
          };
          (inverseReverse as AbilityReverse).snapshot.targetReverse = inverseTargets;
          for (const id of targets.changedCharacters ?? []) {
            if (id !== characterId && targets.hp[id]) hp[id] = targets.hp[id];
          }
          writes[HP_STATE_KEY] = hp;
          for (const id of targets.changedConditions ?? []) {
            if (id !== characterId && targets.conditions[id]) conditions[id] = targets.conditions[id];
          }
          if (targets.changedConditions?.length) writes[CONDITIONS_STATE_KEY] = conditions;
          for (const id of targets.changedCompanions ?? []) {
            if (targets.companions[id]) currentCompanions[id] = targets.companions[id];
            else delete currentCompanions[id];
          }
          if (targets.changedCompanions?.length) writes[COMPANIONS_STATE_KEY] = currentCompanions;
          if (targets.initiative) writes[INITIATIVE_STATE_KEY] = targets.initiative;
        }
        break;
      }
      case "session.rest.restore": {
        const currentAbility = abilities[characterId];
        const currentHp = hp[characterId];
        const currentConditions = conditions[characterId];
        if (!currentAbility || !currentHp || !currentConditions) {
          sendError(webSocket, "REST_STATE_NOT_INITIALIZED", "The current rest state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: {
            ability: currentAbility,
            hp: currentHp,
            conditions: currentConditions,
            inventory: reverse.snapshot.inventory ? structuredClone(inventory) : undefined,
          },
        };
        abilities[characterId] = reverse.snapshot.ability;
        hp[characterId] = reverse.snapshot.hp;
        conditions[characterId] = reverse.snapshot.conditions;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        if (reverse.snapshot.inventory) writes[INVENTORY_STATE_KEY] = reverse.snapshot.inventory;
        break;
      }
      case "session.inventory.restore": {
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: {
            abilities: structuredClone(abilities),
            hp: structuredClone(hp),
            conditions: structuredClone(conditions),
            inventory: structuredClone(inventory),
          },
        };
        Object.assign(abilities, reverse.snapshot.abilities);
        Object.assign(hp, reverse.snapshot.hp);
        Object.assign(conditions, reverse.snapshot.conditions);
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        writes[INVENTORY_STATE_KEY] = reverse.snapshot.inventory;
        break;
      }
      case "session.proficiency.restore": {
        const currentAbility = abilities[characterId];
        if (!currentAbility) {
          sendError(webSocket, "PROFICIENCY_STATE_NOT_INITIALIZED", "The current proficiency state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: currentAbility,
        };
        abilities[characterId] = reverse.snapshot;
        writes[ABILITIES_STATE_KEY] = abilities;
        break;
      }
      case "session.race.restore":
      case "session.profile.restore": {
        const currentAbility = abilities[characterId];
        const currentHp = hp[characterId];
        if (!currentAbility || !currentHp) {
          sendError(webSocket, "CHARACTER_STATE_NOT_INITIALIZED", "The current character state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: { ability: currentAbility, hp: currentHp },
        };
        abilities[characterId] = reverse.snapshot.ability;
        hp[characterId] = reverse.snapshot.hp;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        break;
      }
      case "session.character.restore": {
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: {
            lifecycle: lifecycle[characterId],
            ability: abilities[characterId],
            hp: hp[characterId],
            conditions: conditions[characterId],
          },
        };
        restoreOptionalEntry(lifecycle, characterId, reverse.snapshot.lifecycle);
        restoreOptionalEntry(abilities, characterId, reverse.snapshot.ability);
        restoreOptionalEntry(hp, characterId, reverse.snapshot.hp);
        restoreOptionalEntry(conditions, characterId, reverse.snapshot.conditions);
        writes[CHARACTER_LIFECYCLE_STATE_KEY] = lifecycle;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        break;
      }
    }

    const now = new Date().toISOString();
    const undoRecord = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId, sourceLogId: source.id },
      reverseOperation: inverseReverse,
      affectedScopes,
    });

    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
      undoneAt: now,
    });
    await this.broadcastAuthoritativeStateForReverse(reverse);
    if (reverse.type === "character.ability.restore" && reverse.snapshot.targetReverse) {
      for (const id of reverse.snapshot.targetReverse.changedCharacters ?? []) {
        if (id !== characterId && hp[id]) broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: hp[id] });
      }
      for (const id of reverse.snapshot.targetReverse.changedConditions ?? []) {
        if (id !== characterId && conditions[id]) broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: conditions[id] });
      }
      if (reverse.snapshot.targetReverse.initiative) {
        broadcast(this.ctx.getWebSockets(), { type: "session.initiative.updated", state: reverse.snapshot.targetReverse.initiative });
      }
      const config = await readRuntimeConfig(this.ctx.storage);
      const persistedCompanions = (await this.ctx.storage.get<Record<string, CompanionState>>(COMPANIONS_STATE_KEY)) ?? {};
      for (const id of reverse.snapshot.targetReverse.changedCompanions ?? []) {
        const owner = config?.config?.creatureCompendium?.find(creature => creature.id === id)?.ownerUserId;
        for (const socket of this.ctx.getWebSockets()) {
          const viewer = readSessionConnection(socket);
          if (viewer && (viewer.role === "MASTER" || (owner && viewer.userId === owner))) {
            send(socket, { type: "session.companions.updated", companion: persistedCompanions[id] });
          }
        }
      }
    }
  }

  private async handleCharacterLifecycleOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionCharacterLifecycleOperation,
  ): Promise<void> {
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can change session character lifecycle state.");
      return;
    }

    const [lifecycle, abilities, hp, conditions, log] = await Promise.all([
      this.readCharacterLifecycleState(),
      this.readAbilitiesState(),
      this.readComposedHpState(),
      this.readComposedConditionsState(),
      readSessionLog(this.ctx.storage),
    ]);
    const characterId = operation.characterId;
    const snapshot: CharacterLifecycleReverse["snapshot"] = {
      lifecycle: lifecycle[characterId] ? structuredClone(lifecycle[characterId]) : undefined,
      ability: abilities[characterId] ? structuredClone(abilities[characterId]) : undefined,
      hp: hp[characterId] ? structuredClone(hp[characterId]) : undefined,
      conditions: conditions[characterId] ? structuredClone(conditions[characterId]) : undefined,
    };

    if (operation.type === "character.session.remove") {
      const currentLifecycle = lifecycle[characterId];
      const currentAbility = abilities[characterId];
      const currentHp = hp[characterId];
      if ((!currentLifecycle || !currentLifecycle.active) && !currentAbility && !currentHp) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "The character is not active in this session.");
        return;
      }
      lifecycle[characterId] = {
        characterId,
        character: currentLifecycle?.character ?? currentAbility?.character ?? {},
        ownerUserId: currentLifecycle?.ownerUserId ?? currentHp?.ownerUserId,
        active: false,
        revision: (currentLifecycle?.revision ?? 0) + 1,
      };
      delete abilities[characterId];
      delete hp[characterId];
      delete conditions[characterId];
    } else if (operation.type === "character.session.rename") {
      const storedAbility = abilities[characterId];
      if (!storedAbility?.initialized || lifecycle[characterId]?.active === false) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "The character is not active in this session.");
        return;
      }
      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(storedAbility.character as Partial<CharacterTemplateProps>);
      } catch {
        sendError(webSocket, "CHARACTER_STATE_INVALID", "The authoritative character snapshot is invalid.");
        return;
      }
      const nextCharacter = character.with("name", operation.name);
      abilities[characterId] = {
        ...storedAbility,
        character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
        revision: storedAbility.revision + 1,
      };
      lifecycle[characterId] = {
        characterId,
        character: abilities[characterId].character,
        ownerUserId: lifecycle[characterId]?.ownerUserId ?? hp[characterId]?.ownerUserId,
        active: true,
        revision: (lifecycle[characterId]?.revision ?? 0) + 1,
      };
    } else if (operation.type === "character.session.owner.set") {
      const storedAbility = abilities[characterId];
      const storedHp = hp[characterId];
      if (!storedAbility?.initialized || !storedHp || lifecycle[characterId]?.active === false) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "The character is not active in this session.");
        return;
      }
      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(storedAbility.character as Partial<CharacterTemplateProps>);
      } catch {
        sendError(webSocket, "CHARACTER_STATE_INVALID", "The authoritative character snapshot is invalid.");
        return;
      }
      const nextCharacter = character.withPatch({ owner: operation.owner });
      const nextAbility: SessionAbilityState = {
        ...storedAbility,
        character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
        revision: storedAbility.revision + 1,
      };
      abilities[characterId] = nextAbility;
      hp[characterId] = {
        ...storedHp,
        ownerUserId: operation.owner.id,
        revision: storedHp.revision + 1,
      };
      lifecycle[characterId] = {
        characterId,
        character: nextAbility.character,
        ownerUserId: operation.owner.id,
        active: true,
        revision: (lifecycle[characterId]?.revision ?? 0) + 1,
      };
    } else {
      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(operation.character as Partial<CharacterTemplateProps>);
      } catch {
        sendError(webSocket, "CHARACTER_SNAPSHOT_INVALID", "The supplied character snapshot is invalid.");
        return;
      }
      if (character.get("id") !== characterId) {
        sendError(webSocket, "CHARACTER_ID_MISMATCH", "The supplied character does not match the target character id.");
        return;
      }
      if (operation.type === "character.session.add" && (lifecycle[characterId]?.active || abilities[characterId]?.initialized)) {
        sendError(webSocket, "CHARACTER_ALREADY_IN_SESSION", "The character is already active in this session.");
        return;
      }
      if (operation.type === "character.session.resync" && lifecycle[characterId]?.active === false) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "A removed character must be added again before it can be resynchronized.");
        return;
      }

      const runtime = runtimeStateFromCharacter(character, abilities[characterId], hp[characterId], conditions[characterId]);
      abilities[characterId] = runtime.ability;
      hp[characterId] = runtime.hp;
      conditions[characterId] = runtime.conditions;
      lifecycle[characterId] = {
        characterId,
        character: runtime.ability.character,
        ownerUserId: runtime.hp.ownerUserId,
        active: true,
        revision: (lifecycle[characterId]?.revision ?? -1) + 1,
      };
    }

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,
      reverseOperation: {
        type: "session.character.restore",
        characterId,
        snapshot,
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: {
        [CHARACTER_LIFECYCLE_STATE_KEY]: lifecycle,
        [ABILITIES_STATE_KEY]: abilities,
        [HP_STATE_KEY]: hp,
        [CONDITIONS_STATE_KEY]: conditions,
      },
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });

    if (operation.type === "character.session.remove") {
      broadcast(this.ctx.getWebSockets(), { type: "session.character.removed", characterId });
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.snapshot", characters: Object.values(abilities) });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.snapshot", characters: Object.values(hp) });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.snapshot", characters: Object.values(conditions) });
      return;
    }

    broadcast(this.ctx.getWebSockets(), { type: "session.character.updated", character: lifecycle[characterId] });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: abilities[characterId] });
    broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: hp[characterId] });
    broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: conditions[characterId] });
  }

  private async broadcastAuthoritativeStateForReverse(reverse: CentrallyRestorableReverse): Promise<void> {
    if (reverse.type === "session.rest.restore") {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot.ability });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: reverse.snapshot.hp });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: reverse.snapshot.conditions });
      if (reverse.snapshot.inventory) {
        broadcast(this.ctx.getWebSockets(), { type: "session.inventory.updated", state: reverse.snapshot.inventory });
      }
      return;
    }

    if (reverse.type === "session.inventory.restore") {
      const [abilities, hp, conditions, inventory] = await Promise.all([
        this.readAbilitiesState(),
        this.readComposedHpState(),
        this.readComposedConditionsState(),
        this.readInventoryState(),
      ]);
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.snapshot", characters: Object.values(abilities) });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.snapshot", characters: Object.values(hp) });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.snapshot", characters: Object.values(conditions) });
      broadcast(this.ctx.getWebSockets(), { type: "session.inventory.updated", state: inventory });
      return;
    }

    if (reverse.type === "session.character.restore") {
      const snapshot = reverse.snapshot;
      if (snapshot.lifecycle) {
        broadcast(this.ctx.getWebSockets(), { type: "session.character.updated", character: snapshot.lifecycle });
        if (!snapshot.lifecycle.active) {
          broadcast(this.ctx.getWebSockets(), { type: "session.character.removed", characterId: reverse.characterId });
        }
      } else {
        broadcast(this.ctx.getWebSockets(), { type: "session.character.removed", characterId: reverse.characterId });
      }
      const [abilities, hp, conditions] = await Promise.all([
        this.readAbilitiesState(),
        this.readComposedHpState(),
        this.readComposedConditionsState(),
      ]);
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.snapshot", characters: Object.values(abilities) });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.snapshot", characters: Object.values(hp) });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.snapshot", characters: Object.values(conditions) });
      return;
    }

    if (reverse.type === "session.proficiency.restore") {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot });
      return;
    }

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot.ability });
    if ("hp" in reverse.snapshot) {
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: reverse.snapshot.hp });
    }
    if ("conditions" in reverse.snapshot) {
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: reverse.snapshot.conditions });
    }
  }

  private async readAbilitiesState(): Promise<Record<string, SessionAbilityState>> {
    return (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
  }

  private async readComposedHpState(): Promise<Record<string, SessionHpState>> {
    return (await this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY)) ?? {};
  }

  private async readComposedConditionsState(): Promise<Record<string, SessionConditionsState>> {
    return (await this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)) ?? {};
  }

  private async readInventoryState(): Promise<SharedInventoryState> {
    return (await this.ctx.storage.get<SharedInventoryState>(INVENTORY_STATE_KEY)) ?? {
      initialized: false,
      revision: 0,
      partyInventory: [],
      groundInventory: [],
    };
  }

  private async readCharacterLifecycleState(): Promise<Record<string, SessionCharacterLifecycleState>> {
    const stored = (await this.ctx.storage.get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)) ?? {};
    if (Object.keys(stored).length) return stored;

    const [abilities, hp] = await Promise.all([this.readAbilitiesState(), this.readComposedHpState()]);
    const migrated = Object.fromEntries(
      Object.values(abilities)
        .filter((entry) => entry.initialized)
        .map((entry) => [entry.characterId, {
          characterId: entry.characterId,
          character: entry.character,
          ownerUserId: hp[entry.characterId]?.ownerUserId,
          active: true,
          revision: entry.revision,
        } satisfies SessionCharacterLifecycleState]),
    );
    if (Object.keys(migrated).length) await this.ctx.storage.put(CHARACTER_LIFECYCLE_STATE_KEY, migrated);
    return migrated;
  }

  private async sendAbilitySnapshot(socket: WebSocket): Promise<void> {
    const state = await this.readAbilitiesState();
    send(socket, { type: "session.abilities.snapshot", characters: Object.values(state) });
  }

  private async sendInventorySnapshot(socket: WebSocket): Promise<void> {
    const state = await this.readInventoryState();
    send(socket, { type: "session.inventory.snapshot", state });
  }

  private async sendCharacterLifecycleSnapshot(socket: WebSocket): Promise<void> {
    const state = await this.readCharacterLifecycleState();
    send(socket, { type: "session.characters.snapshot", characters: Object.values(state) });
  }
}

function runtimeStateFromCharacter(
  character: CharacterTemplate,
  previousAbility?: SessionAbilityState,
  previousHp?: SessionHpState,
  previousConditions?: SessionConditionsState,
): { ability: SessionAbilityState; hp: SessionHpState; conditions: SessionConditionsState } {
  const characterId = character.get("id");
  const sheet = character.get("sheet");
  const rawHp = sheet.HP;
  const currentMax = getCurrentMaxHp(character);
  const hitDice = Object.fromEntries(
    Object.entries(rawHp.hitDice).flatMap(([side, pool]) =>
      pool ? [[side, { current: pool.current.quantity, max: pool.max.quantity }]] : [],
    ),
  ) as SessionHpState["hitDice"];

  return {
    ability: {
      characterId,
      character: character.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: (previousAbility?.revision ?? -1) + 1,
    },
    hp: {
      characterId,
      ownerUserId: character.get("owner")?.id?.trim() || undefined,
      current: rawHp.current,
      temporary: rawHp.temporary,
      max: rawHp.max,
      currentMax,
      maxHpBonus: character.getEffectiveMaxHp() - currentMax,
      hitDice,
      stats: {
        armorClassAdjustment: sheet.stats.armorClassAdjustment ?? 0,
        initiativeAdjustment: sheet.stats.initiativeAdjustment ?? 0,
        mobilityAdjustment: sheet.stats.mobilityAdjustment ?? 0,
        passivePerceptionAdjustment: sheet.stats.passivePerceptionAdjustment ?? 0,
        exhaustion: sheet.stats.exhaustion ?? 0,
        inspiration: sheet.stats.inspiration ?? false,
        experience: sheet.stats.experience ?? 0,
      },
      statsInitialized: true,
      attributes: { ...sheet.attributes },
      attributesInitialized: true,
      savingThrows: { ...defaultSavingThrows(), ...sheet.savingThrowProficiencies },
      savingThrowsInitialized: true,
      skills: { ...defaultSkills(), ...sheet.skills },
      skillsInitialized: true,
      revision: (previousHp?.revision ?? -1) + 1,
    },
    conditions: {
      characterId,
      conditions: getCharacterConditions(character),
      initialized: true,
      revision: (previousConditions?.revision ?? -1) + 1,
    },
  };
}

function restoreOptionalEntry<T>(state: Record<string, T>, characterId: string, value?: T): void {
  if (value === undefined) delete state[characterId];
  else state[characterId] = value;
}

function isCentrallyRestorable(reverse: SessionLogRecord["reverseOperation"]): reverse is CentrallyRestorableReverse {
  return reverse.type === "character.ability.restore"
    || reverse.type === "session.rest.restore"
    || reverse.type === "session.inventory.restore"
    || reverse.type === "session.proficiency.restore"
    || reverse.type === "session.race.restore"
    || reverse.type === "session.profile.restore"
    || reverse.type === "session.character.restore";
}

function resolveMessageRoute(
  raw: string,
  routes: {
    ability: DomainActor;
    magic: DomainActor;
    equipment: DomainActor;
    inventory: DomainActor;
    proficiency: DomainActor;
    race: DomainActor;
    profile: DomainActor;
  },
): DomainActor | null {
  if (parseAbilityClientMessage(raw)) return routes.ability;
  if (parseMagicClientMessage(raw)) return routes.magic;
  if (parseEquipmentClientMessage(raw)) return routes.equipment;
  if (parseInventoryClientMessage(raw)) return routes.inventory;
  if (parseProficiencyClientMessage(raw)) return routes.proficiency;
  if (parseRaceClientMessage(raw)) return routes.race;
  if (parseProfileClientMessage(raw)) return routes.profile;
  return null;
}

function bindDomainActor<T extends DomainActor>(prototype: T, ctx: DurableObjectState): T {
  const actor = Object.create(null) as T;
  for (const key of Reflect.ownKeys(prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (descriptor) Object.defineProperty(actor, key, descriptor);
  }
  Object.defineProperty(actor, "ctx", {
    value: createVisibilityFilteredContext(ctx),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return actor;
}

function parseUndoLogId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; logId?: unknown };
    return value.type === "session.log.undo" && typeof value.logId === "string"
      ? value.logId
      : null;
  } catch {
    return null;
  }
}

function readSessionConnection(socket: WebSocket): SessionConnection | null {
  try {
    return socket.deserializeAttachment() as SessionConnection | null;
  } catch {
    return null;
  }
}

function sendError(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: "session.error", code, message });
}

function send(socket: WebSocket, value: unknown): void {
  sendVisibilityFiltered(socket, value);
}

function broadcast(sockets: WebSocket[], value: unknown): void {
  broadcastVisibilityFiltered(sockets, value);
}
