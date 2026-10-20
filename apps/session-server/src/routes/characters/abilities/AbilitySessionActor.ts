import type { Ability } from "../../../../../web/src/models/abilities/Ability";
import { getAbilitySelfDamageRollRequirements } from "../../../../../web/src/models/abilities/abilitySelfDamage";
import {
  canActivateAbility,
  endAbilityEffect,
  restoreAbilityUse,
  useAbilityEffect,
} from "../../../../../web/src/models/abilities/abilityActivation";
import { abilityRequiresWeaponAttributeSelection, getAbilityAttackRiderDamageChoices, optionRequiresWeaponSelection } from "../../../../../web/src/models/combat/AttackRider";
import { hasAbilityResourceCosts, spendAbilityResourceCosts } from "../../../../../web/src/models/abilities/abilityResourceCosts";
import { getChannelDivinityPool } from "../../../../../web/src/models/characters/characterChannelDivinity";
import { getKiPool } from "../../../../../web/src/models/characters/characterKi";
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../../../../../web/src/models/characters/characterConditionStorage";
import { spendGrantedSpellAbilityUse } from "../../../../../web/src/models/characters/characterGrantedSpells";
import { getCurrentMaxHp } from "../../../../../web/src/models/characters/characterHp";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../../web/src/models/characters/CharacterTemplate";
import { normalizeDamageAffinities } from "../../../../../web/src/models/combat/Damage";
import { evaluateCharacterSheetFormula } from "../../../../../web/src/lib/customSystems/CharacterSheetFormula";
import type { CompanionState } from "../../../../../web/src/shared/session-runtime/companionRuntime";
import type { SessionInitiativeState } from "../../initiative/initiativeProtocol";
import { areSelectedTargetsDistinct, applyHpToReferences, validateAbilityTargets, type MutableHpTargets } from "./abilityTargeting";
import { abilityTargetGrants, applyConditionToReferences, createTargetCondition, type MutableConditionsTargets } from "./abilityTargetConditions";
import { getEffectiveDamageAffinities } from "../../../../../web/src/models/characters/characterDamageAffinities";
import { normalizeInitiativeSession } from "../../../../../web/src/models/initiative/Initiative";
import { isValidBonusRollValue, listBonusRollRequirements, listResolvedBonusRolls } from "../../../../../web/src/models/bonuses/BonusRoll";
import { SessionActor as BaseSessionActor } from "../../session/SessionActor";
import {
  parseAbilityClientMessage,
  type SessionAbilityOperation,
  type SessionAbilitySeed,
  type SessionAbilitySource,
  type SessionAbilityState,
} from "./abilityProtocol";
import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../sheet/characterState";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpState,
} from "../../session/protocol";
import {
  characterScope,
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../../session/sessionLog";
import {
  isDigitalDiceRollingEnabled,
  readRuntimeConfig,
} from "../../session/runtimeConfigAccess";

const COMPANIONS_STATE_KEY = "companions-state";
const INITIATIVE_STATE_KEY = "initiative-state";
const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";

export class SessionActor extends BaseSessionActor {
  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const socket = this.ctx.getWebSockets().find((candidate) =>
      this.readConnection(candidate)?.clientId === clientId,
    );
    if (socket) await this.sendAbilitiesSnapshot(socket);
    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);

    const parsed = parseAbilityClientMessage(raw);
    if (!parsed) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = this.readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    this.touchConnection(webSocket, connection);

    if (parsed.type === "session.abilities.initialize") {
      await this.initializeAbilities(webSocket, connection, parsed.characters);
      return;
    }

    await this.handleAbilityOperation(webSocket, connection, parsed.operation);
  }

  private async initializeAbilities(
    webSocket: WebSocket,
    connection: SessionConnection,
    seeds: SessionAbilitySeed[],
  ): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendAbilityError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative ability state.");
      return;
    }

    const state = await this.readAbilityState();
    let changed = false;

    for (const seed of seeds) {
      if (state[seed.characterId]?.initialized) continue;

      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(
          seed.character as Partial<CharacterTemplateProps>,
        );
      } catch {
        this.sendAbilityError(webSocket, "INVALID_ABILITY_SEED", "The ability state seed contains an invalid character snapshot.");
        return;
      }

      if (character.get("id") !== seed.characterId) {
        this.sendAbilityError(webSocket, "ABILITY_SEED_ID_MISMATCH", "The ability state seed does not match the target character.");
        return;
      }

      state[seed.characterId] = {
        characterId: seed.characterId,
        character: character.toJSON() as unknown as Record<string, unknown>,
        initialized: true,
        revision: 0,
      };
      changed = true;
    }

    if (changed) {
      await this.ctx.storage.put(ABILITIES_STATE_KEY, state);
      this.broadcastAbility({
        type: "session.abilities.snapshot",
        characters: Object.values(state),
      });
    } else {
      await this.sendAbilitiesSnapshot(webSocket);
    }
  }

  private async handleAbilityOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionAbilityOperation,
  ): Promise<void> {
    const [abilityState, hpState, conditionsState, log, runtimeConfig] = await Promise.all([
      this.readAbilityState(),
      this.readAbilityHpState(),
      this.readAbilityConditionsState(),
      readSessionLog(this.ctx.storage),
      readRuntimeConfig(this.ctx.storage),
    ]);

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];

    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      this.sendAbilityError(webSocket, "ABILITY_STATE_NOT_INITIALIZED", "Ability state for this character has not been initialized by the MASTER.");
      return;
    }

    if (!canMutateCharacter(connection, hp.ownerUserId)) {
      this.sendAbilityError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change abilities for this character.");
      return;
    }

    let current: CharacterTemplate;
    try {
      current = hydrateAuthoritativeCharacter(storedAbility, hp, conditions);
    } catch {
      this.sendAbilityError(webSocket, "ABILITY_STATE_INVALID", "The authoritative ability snapshot is invalid.");
      return;
    }

    const digitalDiceEnabled = isDigitalDiceRollingEnabled(runtimeConfig);
    const abilityBeforeUse = operation.type === "character.ability.use"
      ? findAbilityForSource(current, operation.source) : undefined;
    const targetRefs = operation.type === "character.ability.use"
      ? validateAbilityTargets(abilityBeforeUse?.targeting, operation.targetRefs, operation.characterId) : [];
    if (targetRefs === null) {
      this.sendAbilityError(webSocket, "ABILITY_TARGETS_INVALID", "A seleção de alvos não corresponde à configuração da habilidade.");
      return;
    }
    if (operation.type === "character.ability.use" && targetRefs.length) {
      const storedInitiative = await this.ctx.storage.get<SessionInitiativeState>(INITIATIVE_STATE_KEY);
      const initiative = storedInitiative?.initialized ? normalizeInitiativeSession(storedInitiative.session as any) : undefined;
      const invalidTarget = targetRefs.find(ref => {
        const [kind, id] = [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)];
        if (kind === "character") return !hpState[id] || (connection.role !== "MASTER" &&
          !connection.visibleCharacterIds?.includes(id) && hpState[id].ownerUserId !== connection.userId);
        if (kind === "companion") return !(runtimeConfig?.config.creatureCompendium.some(creature => creature.id === id && creature.ownerUserId));
        if (kind === "initiative") {
          const entry = initiative?.entries.find(entry => entry.id === id);
          return !entry || (connection.role !== "MASTER" && entry.hidden);
        }
        return true;
      });
      if (!areSelectedTargetsDistinct(targetRefs, storedInitiative, runtimeConfig?.config.creatureCompendium ?? [])) {
        this.sendAbilityError(webSocket, "ABILITY_TARGET_DUPLICATE", "A mesma criatura foi selecionada mais de uma vez.");
        return;
      }
      if (invalidTarget) {
        this.sendAbilityError(webSocket, "ABILITY_TARGET_UNAVAILABLE", "Um dos alvos selecionados não está disponível nesta sessão.");
        return;
      }
    }
    if (operation.type === "character.ability.use") {
      const ability = findAbilityForSource(current, operation.source);
      if (!ability) {
        this.sendAbilityError(webSocket, "ABILITY_NOT_FOUND", "A habilidade selecionada não existe.");
        return;
      }
      const selfDamage = getAbilitySelfDamageRollRequirements(ability, operation.activationOptionId);
      if (selfDamage.some(entry => entry.minimum < 1)) {
        this.sendAbilityError(webSocket, "INVALID_SELF_DAMAGE_DICE", "Os dados de dano próprio estão configurados incorretamente.");
        return;
      }
      if (!digitalDiceEnabled) {
        const missingSelfDamage = selfDamage.filter(entry => {
          const result = operation.bonusRollValues?.[entry.key];
          return !Number.isInteger(result) || result! < entry.minimum || result! > entry.maximum;
        });
        if (missingSelfDamage.length > 0) {
          this.sendAbilityError(webSocket, "PHYSICAL_SELF_DAMAGE_ROLL_REQUIRED", "Informe um resultado válido para o dano próprio: " + missingSelfDamage.map(entry => entry.label).join(", "));
          return;
        }
      }
    }

    if (
      operation.type === "character.ability.use"
      && !digitalDiceEnabled
    ) {
      const ability = findAbilityForSource(current, operation.source);
      const requirements = [
        ...listBonusRollRequirements(ability?.bonuses),
        ...listBonusRollRequirements(ability?.activationOptions?.find(entry => entry.id === operation.activationOptionId)?.bonuses)
          .map(entry => ({ ...entry, key: `option:${operation.activationOptionId}:${entry.key}` })),
      ];
      const missing = requirements.filter((requirement) => {
        const value = operation.bonusRollValues?.[requirement.key];
        return typeof value !== "number" || !isValidBonusRollValue(requirement.dice, value);
      });
      if (missing.length > 0) {
        this.sendAbilityError(
          webSocket,
          "PHYSICAL_ROLL_REQUIRED",
          `Informe o resultado físico para: ${missing.map((entry) => entry.label).join(", ")}.`,
        );
        return;
      }
    }

    // Resolve self-damage once on the authoritative server. The same result is
    // used to change HP and to record the roll; never roll independently twice.
    const selfDamageResults: import("../../../../../web/src/models/bonuses/Bonus").BonusRollResolution[] = [];
    let operationForApply: SessionAbilityOperation = operation;
    if (operation.type === "character.ability.use") {
      const ability = findAbilityForSource(current, operation.source)!;
      const requirements = getAbilitySelfDamageRollRequirements(ability, operation.activationOptionId);
      const values = { ...(operation.bonusRollValues ?? {}) };
      if (digitalDiceEnabled) {
        const bonusRequirements = [
          ...listBonusRollRequirements(ability.bonuses),
          ...listBonusRollRequirements(ability.activationOptions?.find(entry => entry.id === operation.activationOptionId)?.bonuses)
            .map(entry => ({ ...entry, key: `option:${operation.activationOptionId}:${entry.key}` })),
        ];
        // The client may provide manual rolls, but never override digital automatic dice.
        for (const requirement of bonusRequirements) {
          if (requirement.mode === "automatic") delete values[requirement.key];
        }
      }
      for (const requirement of requirements) {
        if (digitalDiceEnabled) {
          const match = /^(\\d{1,2})d(4|6|8|10|12|20)$/i.exec(requirement.dice.trim())!;
          const count = Number(match[1]);
          const sides = Number(match[2]);
          let rolled = 0;
          for (let i = 0; i < count; i += 1) rolled += 1 + Math.floor(Math.random() * sides);
          values[requirement.key] = rolled;
        }
        const rolled = values[requirement.key];
        selfDamageResults.push({
          key: requirement.key,
          label: `${ability.name} — dano próprio (${requirement.damageType})`,
          mode: digitalDiceEnabled ? "automatic" : "manual",
          dice: requirement.dice,
          diceValue: rolled,
          formulaBonus: 0,
          total: rolled,
        });
      }
      operationForApply = { ...operation, bonusRollValues: values };
    }
    const next = applyAbilityOperation(current, operationForApply);
    if (!next) {
      this.sendAbilityError(webSocket, "ABILITY_OPERATION_INVALID", "The requested ability operation is invalid for the current character state.");
      return;
    }

    const currentJson = current.toJSON();
    const nextJson = next.toJSON();
    const selectedBefore = operation.type === "character.ability.use"
      ? abilityBeforeUse?.activationOptions?.find(option => option.id === operation.activationOptionId) : undefined;
    const hasRecipientEffects = operation.type === "character.ability.use"
      && targetRefs.length > 0 && Boolean(abilityBeforeUse)
      && (abilityBeforeUse!.targeting?.mode === "targets" || abilityBeforeUse!.targeting?.mode === "point")
      && Boolean(
        abilityBeforeUse!.bonuses?.onUseHp?.length || selectedBefore?.bonuses?.onUseHp?.length
        || abilityBeforeUse!.bonuses?.temporaryHp?.length || selectedBefore?.bonuses?.temporaryHp?.length
        || abilityTargetGrants(abilityBeforeUse!, selectedBefore).length
      );
    if (JSON.stringify(currentJson) === JSON.stringify(nextJson) && !hasRecipientEffects) {
      this.sendAbilityError(webSocket, "ABILITY_OPERATION_REJECTED", "The ability could not be changed in its current state.");
      return;
    }

    const nextAbilityState: SessionAbilityState = {
      characterId: operation.characterId,
      character: nextJson as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };

    const nextHp = extractHpState(next, hp);
    const nextConditions = extractConditionsState(next, conditions);
    const hpChanged = !sameHpRuntime(hp, nextHp);
    const conditionsChanged = JSON.stringify(conditions.conditions) !== JSON.stringify(nextConditions.conditions);

    abilityState[operation.characterId] = nextAbilityState;
    if (hpChanged) hpState[operation.characterId] = nextHp;
    if (conditionsChanged) conditionsState[operation.characterId] = nextConditions;

    let mutatedTargets: MutableConditionsTargets | undefined;
    let targetReverse: {
      hp: Record<string, SessionHpState>;
      conditions: Record<string, SessionConditionsState>;
      companions: Record<string, CompanionState>;
      initiative?: SessionInitiativeState;
      changedCharacters?: string[];
      changedConditions?: string[];
      changedCompanions?: string[];
    } | undefined;
    if (operation.type === "character.ability.use"
      && (abilityBeforeUse?.targeting?.mode === "targets" || abilityBeforeUse?.targeting?.mode === "point")) {
      const afterAbility = findAbilityForSource(next, operation.source);
      const afterOption = afterAbility?.activationOptions?.find(entry => entry.id === operation.activationOptionId);
      const effects = [...(afterAbility?.bonuses?.onUseHp ?? []), ...(afterOption?.bonuses?.onUseHp ?? [])];
      const grants = afterAbility ? abilityTargetGrants(afterAbility, afterOption) : [];
      const temporaryBonuses = [...(afterAbility?.bonuses?.temporaryHp ?? []), ...(afterOption?.bonuses?.temporaryHp ?? [])];
      if ((effects.length || grants.length || temporaryBonuses.length) && targetRefs.length) {
        const storedCompanions = (await this.ctx.storage.get<Record<string, CompanionState>>(COMPANIONS_STATE_KEY)) ?? {};
        const storedInitiative = await this.ctx.storage.get<SessionInitiativeState>(INITIATIVE_STATE_KEY);
        targetReverse = {
          hp: structuredClone(hpState),
          conditions: structuredClone(conditionsState),
          companions: structuredClone(storedCompanions),
          initiative: storedInitiative ? structuredClone(storedInitiative) : undefined,
        };
        const affinities: MutableHpTargets["affinities"] = {};
        for (const [id, targetAbility] of Object.entries(abilityState)) {
          if (!hpState[id] || !targetAbility?.initialized) continue;
          try {
            affinities[id] = getEffectiveDamageAffinities(
              hydrateAuthoritativeCharacter(targetAbility, hpState[id], conditionsState[id] ?? conditions),
            );
          } catch { affinities[id] = []; }
        }
        mutatedTargets = {
          hp: hpState, conditions: conditionsState, companions: storedCompanions, initiative: storedInitiative,
          changedConditions: new Set(),
          creatures: runtimeConfig?.config.creatureCompendium ?? [],
          affinities, changedCharacters: new Set(), changedCompanions: new Set(),
          initiativeChanged: false,
        };
        for (const effect of effects) {
          const amount = effect.bonus.rollResult?.total
            ?? (effect.bonus.formula?.trim()
              ? evaluateCharacterSheetFormula(effect.bonus.formula, current)
              : effect.bonus.value);
          if (amount === undefined || !Number.isFinite(amount)) {
            this.sendAbilityError(webSocket, "TARGET_EFFECT_INVALID", "Não foi possível calcular o valor do efeito.");
            return;
          }
          if (!applyHpToReferences(mutatedTargets, targetRefs, effect, amount)) {
            this.sendAbilityError(webSocket, "ABILITY_TARGET_UNAVAILABLE", "Um dos alvos não existe mais.");
            return;
          }
        }
        for (const bonus of temporaryBonuses) {
          const amount = bonus.rollResult?.total
            ?? (bonus.formula?.trim() ? evaluateCharacterSheetFormula(bonus.formula, current) : bonus.value);
          if (amount === undefined || !Number.isFinite(amount)) {
            this.sendAbilityError(webSocket, "TARGET_EFFECT_INVALID", "Bônus de PV temporários inválido.");
            return;
          }
          if (!applyHpToReferences(mutatedTargets, targetRefs, { kind: "temporary" }, amount)) {
            this.sendAbilityError(webSocket, "ABILITY_TARGET_UNAVAILABLE", "Um dos alvos não existe mais.");
            return;
          }
        }
        for (const grant of grants) {
          if (!applyConditionToReferences(mutatedTargets, targetRefs, createTargetCondition(operation.characterId, afterAbility!, grant))) {
            this.sendAbilityError(webSocket, "TARGET_CONDITION_INVALID", "Não foi possível aplicar a condição aos alvos.");
            return;
          }
        }
        targetReverse.changedConditions = [...mutatedTargets.changedConditions];
        targetReverse.changedCharacters = [...mutatedTargets.changedCharacters];
        targetReverse.changedCompanions = [...mutatedTargets.changedCompanions];
        if (mutatedTargets.changedConditions.has(operation.characterId)) {
          const sheet = (nextAbilityState.character as any).sheet;
          if (sheet) sheet.conditions = conditionsState[operation.characterId].conditions;
        }
        if (mutatedTargets.changedCharacters.has(operation.characterId)) {
          const latest = hpState[operation.characterId];
          const sheet = (nextAbilityState.character as any).sheet;
          if (sheet?.HP) sheet.HP = { ...sheet.HP, current: latest.current, temporary: latest.temporary };
        }
      }
    }

    let loggedOperation = operationForApply;
    if (operation.type === "character.ability.use") {
      const resolvedAbility = findAbilityForSource(next, operation.source);
      const selectedOption = resolvedAbility?.activationOptions?.find(entry => entry.id === operation.activationOptionId);
      const bonusRollResults = [
        ...listResolvedBonusRolls(resolvedAbility?.bonuses),
        ...listResolvedBonusRolls(selectedOption?.bonuses).map(result => ({
          ...result,
          key: `option:${selectedOption!.id}:${result.key}`,
          label: `${selectedOption!.name} — ${result.label}`,
        })),
      ];
      if (bonusRollResults.length > 0 || selfDamageResults.length > 0) {
        loggedOperation = { ...operation, bonusRollValues: operationForApply.type === "character.ability.use" ? operationForApply.bonusRollValues : operation.bonusRollValues, bonusRollResults: [...bonusRollResults, ...selfDamageResults] };
      }
    }

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: loggedOperation,
      affectedScopes: [
        characterScope(operation.characterId),
        ...[...new Set([...(mutatedTargets?.changedCharacters ?? []), ...(mutatedTargets?.changedConditions ?? [])])].filter(id => id !== operation.characterId).map(characterScope),
        ...(mutatedTargets?.changedCompanions.size || mutatedTargets?.initiativeChanged ? ["initiative:shared"] : []),
      ],
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: storedAbility,
          hp,
          conditions,
          targetReverse,
        },
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: {
        [ABILITIES_STATE_KEY]: abilityState,
        ...(hpChanged || mutatedTargets?.changedCharacters.size ? { [HP_STATE_KEY]: hpState } : {}),
        ...(conditionsChanged || mutatedTargets?.changedConditions.size ? { [CONDITIONS_STATE_KEY]: conditionsState } : {}),
        ...(mutatedTargets?.changedCompanions.size ? { [COMPANIONS_STATE_KEY]: mutatedTargets.companions } : {}),
        ...(mutatedTargets?.initiativeChanged && mutatedTargets.initiative ? { [INITIATIVE_STATE_KEY]: mutatedTargets.initiative } : {}),
      },
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });

    this.broadcastAbility({ type: "session.abilities.updated", character: nextAbilityState });
    if (hpChanged || mutatedTargets?.changedCharacters.has(operation.characterId)) this.broadcastRaw({ type: "session.hp.updated", character: hpState[operation.characterId] });
    for (const id of mutatedTargets?.changedCharacters ?? []) {
      if (id !== operation.characterId) this.broadcastRaw({ type: "session.hp.updated", character: hpState[id] });
    }
    if (mutatedTargets?.initiativeChanged && mutatedTargets.initiative) this.broadcastRaw({
      type: "session.initiative.updated", state: mutatedTargets.initiative,
    });
    for (const id of mutatedTargets?.changedCompanions ?? []) {
      const creature = runtimeConfig?.config.creatureCompendium.find(candidate => candidate.id === id);
      if (!creature?.ownerUserId) continue;
      for (const socket of this.ctx.getWebSockets()) {
        const viewer = this.readConnection(socket);
        if (viewer && (viewer.role === "MASTER" || viewer.userId === creature.ownerUserId)) {
          this.sendAbility(socket, { type: "session.companions.updated", companion: mutatedTargets!.companions[id] });
        }
      }
    }
    if (conditionsChanged || mutatedTargets?.changedConditions.has(operation.characterId)) {
      this.broadcastRaw({ type: "session.conditions.updated", character: conditionsState[operation.characterId] });
    }
    for (const id of mutatedTargets?.changedConditions ?? []) {
      if (id !== operation.characterId) this.broadcastRaw({ type: "session.conditions.updated", character: conditionsState[id] });
    }
  }

  private async readAbilityState(): Promise<Record<string, SessionAbilityState>> {
    return (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
  }

  private async readAbilityHpState(): Promise<Record<string, SessionHpState>> {
    return (await this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY)) ?? {};
  }

  private async readAbilityConditionsState(): Promise<Record<string, SessionConditionsState>> {
    return (await this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)) ?? {};
  }

  private async sendAbilitiesSnapshot(webSocket: WebSocket): Promise<void> {
    const state = await this.readAbilityState();
    this.sendAbility(webSocket, {
      type: "session.abilities.snapshot",
      characters: Object.values(state),
    });
  }

  private readConnection(webSocket: WebSocket): SessionConnection | null {
    try {
      const value = webSocket.deserializeAttachment() as SessionConnection | null;
      if (!value || typeof value.clientId !== "string" || typeof value.userId !== "string") {
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  private touchConnection(webSocket: WebSocket, connection: SessionConnection): void {
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);
  }

  private sendAbilityError(webSocket: WebSocket, code: string, message: string): void {
    this.sendAbility(webSocket, { type: "session.error", code, message });
  }

  private sendAbility(webSocket: WebSocket, message: unknown): void {
    try {
      webSocket.send(JSON.stringify(message));
    } catch {
      // Connection cleanup remains owned by the base SessionActor.
    }
  }

  private broadcastAbility(message: unknown): void {
    this.broadcastRaw(message);
  }

  private broadcastRaw(message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(encoded); }
      catch { /* base actor handles stale sockets */ }
    }
  }
}

function canMutateCharacter(
  connection: SessionConnection,
  ownerUserId?: string,
): boolean {
  return connection.role === "MASTER" || Boolean(ownerUserId && ownerUserId === connection.userId);
}

function hydrateAuthoritativeCharacter(
  abilityState: SessionAbilityState,
  hp: SessionHpState,
  conditions: SessionConditionsState,
): CharacterTemplate {
  let character = CharacterTemplate.fromJSON(
    abilityState.character as Partial<CharacterTemplateProps>,
  );
  const sheet = character.get("sheet");

  character = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized
        ? { ...hp.attributes }
        : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized
        ? { ...hp.savingThrows }
        : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized
        ? { ...hp.skills }
        : sheet.skills,
      stats: hp.statsInitialized
        ? {
            ...sheet.stats,
            armorClassAdjustment: hp.stats.armorClassAdjustment,
            initiativeAdjustment: hp.stats.initiativeAdjustment,
            mobilityAdjustment: hp.stats.mobilityAdjustment,
            passivePerceptionAdjustment: hp.stats.passivePerceptionAdjustment,
            exhaustion: hp.stats.exhaustion,
            inspiration: hp.stats.inspiration,
            experience: hp.stats.experience,
          }
        : sheet.stats,
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

function applyAbilityOperation(
  character: CharacterTemplate,
  operation: SessionAbilityOperation,
): CharacterTemplate | null {
  if (operation.type === "character.ability.save") {
    return character.saveAbility(operation.ability as unknown as Ability);
  }
  if (operation.type === "character.ability.remove") {
    return character.removeAbility(operation.abilityId);
  }
  if (operation.type === "character.damageAffinities.set") {
    return character.withSheet(
      "damageAffinities",
      normalizeDamageAffinities(operation.damageAffinities),
    );
  }
  if (operation.type === "character.ability.usage.spend") {
    return spendGrantedSpellAbilityUse(character, operation.source);
  }

  const { source } = operation;
  let nextCharacter = character;
  if (operation.type === "character.ability.use") {
    const ability = findAbilityForSource(character, source);
    if (!ability || !canActivateAbility(character, ability)) return null;
    if (ability.activationOptions?.length && !ability.activationOptions.some(option => option.id === operation.activationOptionId)) return null;
    if (ability.allowOptionSwitching && ability.benefitsActive && !operation.activationOptionId) return null;
    const types = getAbilityAttackRiderDamageChoices(ability, operation.activationOptionId);
    if (types.length && (!operation.resourceSelection?.damageType || !types.includes(operation.resourceSelection.damageType))) return null;
    if (operation.resourceSelection?.damageType && !types.includes(operation.resourceSelection.damageType)) return null;
    const needsAttribute = abilityRequiresWeaponAttributeSelection(ability, operation.activationOptionId);
    if (needsAttribute !== Boolean(operation.resourceSelection?.weaponAttribute)) return null;
    if (optionRequiresWeaponSelection(ability, operation.activationOptionId)) {
      const previousWeapon = ability.allowMultipleWeaponActivations ? undefined : getCharacterConditions(character)
        .filter(condition => condition.sourceAbilityId === ability.id && condition.sourceAbilityOptionId?.endsWith(":abilities"))
        .flatMap(condition => condition.grantedAbilities ?? [])
        .flatMap(granted => granted.bonuses?.attackRiders ?? [])
        .find(rider => rider.weaponSelection === "onActivation" && rider.weaponId)?.weaponId;
      if (!previousWeapon && !operation.selectedWeaponId) return null;
      if (operation.selectedWeaponId && !character.get("equipment").weapons.some(weapon => weapon.id === operation.selectedWeaponId)) return null;
    }
    if ((source.type === "character" || source.type === "condition") && ability.category === "channelDivinity" && !hasAbilityResourceCosts(ability) && (getChannelDivinityPool(character)?.current ?? 0) <= 0) return null;
    if ((source.type === "character" || source.type === "condition") && ability.category === "martialArts" && !hasAbilityResourceCosts(ability) && (getKiPool(character)?.current ?? 0) <= 0) return null;
    const payment = spendAbilityResourceCosts(character, ability, operation.resourceSelection);
    if (!payment.ok) return null;
    nextCharacter = payment.character;
  }

  switch (source.type) {
    case "character":
      if (operation.type === "character.ability.use") {
        return nextCharacter.useAbility(source.abilityId, operation.activationOptionId, operation.bonusRollValues, operation.selectedWeaponId, operation.resourceSelection?.damageType, operation.resourceSelection?.weaponAttribute);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreAbility(source.abilityId);
      }
      return character.deactivateAbility(source.abilityId);

    case "equipment":
      if (operation.type === "character.ability.use") {
        return nextCharacter.useEquipmentAbility(source.itemId, source.abilityId, operation.bonusRollValues, operation.activationOptionId, operation.selectedWeaponId, operation.resourceSelection?.damageType, operation.resourceSelection?.weaponAttribute);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreEquipmentAbility(source.itemId, source.abilityId);
      }
      return character.deactivateEquipmentAbility(source.itemId, source.abilityId);

    case "condition": {
      const projectedId = `condition:${source.conditionId}:${source.abilityId}`;
      if (operation.type === "character.ability.use") {
        return nextCharacter.useAbility(projectedId, operation.activationOptionId, operation.bonusRollValues, operation.selectedWeaponId, operation.resourceSelection?.damageType, operation.resourceSelection?.weaponAttribute);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreAbility(projectedId);
      }
      return character.deactivateAbility(projectedId);
    }

    case "race":
      return updateRaceAbilityState(
        operation.type === "character.ability.use" ? nextCharacter : character,
        source,
        operation.type === "character.ability.use"
          ? "use"
          : operation.type === "character.ability.restore"
            ? "restore"
            : "deactivate",
        operation.type === "character.ability.use"
          ? operation.activationOptionId
          : undefined,
        operation.type === "character.ability.use"
          ? operation.bonusRollValues
          : undefined,
        operation.type === "character.ability.use"
          ? operation.selectedWeaponId
          : undefined,
        operation.type === "character.ability.use" ? operation.resourceSelection?.damageType : undefined,
        operation.type === "character.ability.use" ? operation.resourceSelection?.weaponAttribute : undefined,
      );
  }
}

function findAbilityForSource(
  character: CharacterTemplate,
  source: SessionAbilitySource,
): Ability | undefined {
  if (source.type === "race") {
    return character.get("sheet").race.naturalAbilities?.find((ability) => ability.id === source.abilityId);
  }
  if (source.type === "equipment") {
    return character.getEquipmentAbilities().find((ability) =>
      ability.sourceItemId === source.itemId && ability.originalAbilityId === source.abilityId
    );
  }
  if (source.type === "condition") {
    return character.getCharacterAbilities().find((ability) =>
      ability.source === "condition" &&
      ability.sourceConditionId === source.conditionId &&
      ability.originalAbilityId === source.abilityId
    );
  }
  return character.getCharacterAbilities().find((ability) =>
    ability.id === source.abilityId && ability.source !== "equipment" && ability.source !== "condition"
  );
}

function updateRaceAbilityState(
  character: CharacterTemplate,
  source: Extract<SessionAbilitySource, { type: "race" }>,
  action: "use" | "restore" | "deactivate",
  optionId?: string,
  bonusRollValues?: Record<string, number>,
  selectedWeaponId?: string,
  selectedDamageType?: import("../../../../../web/src/models/combat/Damage").DamageType,
  selectedWeaponAttribute?: import("../../../../../web/src/models/sheet/Attribute").Attribute,
): CharacterTemplate {
  const race = character.get("sheet").race;
  const ability = (race.naturalAbilities ?? []).find(
    (current) => current.id === source.abilityId,
  );
  if (!ability) return character;

  if (action === "use") {
    return useAbilityEffect(
      character,
      ability,
      { type: "race", sourceLabel: "Raça" },
      optionId,
      bonusRollValues,
      selectedWeaponId,
      selectedDamageType,
      selectedWeaponAttribute,
    );
  }
  if (action === "deactivate") {
    return endAbilityEffect(
      character,
      ability,
      { type: "race", sourceLabel: "Raça" },
    );
  }

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((current) =>
      current.id === source.abilityId ? restoreAbilityUse(current) : current,
    ),
  });
}

function extractHpState(
  character: CharacterTemplate,
  previous: SessionHpState,
): SessionHpState {
  const hp = character.get("sheet").HP;
  const currentMax = getCurrentMaxHp(character);
  return {
    ...previous,
    current: hp.current,
    temporary: hp.temporary,
    max: hp.max,
    currentMax,
    maxHpBonus: character.getEffectiveMaxHp() - currentMax,
    revision: previous.revision + 1,
  };
}

function extractConditionsState(
  character: CharacterTemplate,
  previous: SessionConditionsState,
): SessionConditionsState {
  return {
    ...previous,
    conditions: getCharacterConditions(character) as any,
    revision: previous.revision + 1,
  };
}

function sameHpRuntime(left: SessionHpState, right: SessionHpState): boolean {
  return (
    left.current === right.current &&
    left.temporary === right.temporary &&
    left.max === right.max &&
    left.currentMax === right.currentMax &&
    left.maxHpBonus === right.maxHpBonus
  );
}