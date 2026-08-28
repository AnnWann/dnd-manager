import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import type {
  SessionCondition,
  SessionConditionsState,
  SessionHpState,
} from "../session/protocol";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import type { CharacterCondition } from "../../../../src/models/characters/CharacterCondition";
import { withCharacterConditions } from "../../../../src/models/characters/characterConditionStorage";
import {
  getCalculatedArmorClassWithShield,
  getEffectiveArmorClassWithShield,
} from "../../../../src/models/items/equipment/Shield";
import type {
  InitiativeCondition,
  InitiativeConditionDuration,
  InitiativeEntry,
  InitiativeSession,
} from "../../../../src/models/initiative/Initiative";

export type InitiativeCharacterStateMaps = {
  abilities: Record<string, SessionAbilityState>;
  hp: Record<string, SessionHpState>;
  conditions: Record<string, SessionConditionsState>;
};

export type InitiativeSourceSyncResult =
  | {
      ok: true;
      session: InitiativeSession;
      previousHp: Record<string, SessionHpState>;
      previousConditions: Record<string, SessionConditionsState>;
      changedHpIds: Set<string>;
      changedConditionIds: Set<string>;
    }
  | { ok: false; code: string; message: string };

export function linkedCharacterIdForInitiativeEntry(
  entry: InitiativeEntry | undefined,
): string | undefined {
  const sourceId = entry?.sourceId?.trim();
  if (!sourceId || sourceId.startsWith("compendium:")) return undefined;
  return sourceId;
}

export function synchronizeInitiativeEditsToCharacterState(
  before: InitiativeSession,
  requested: InitiativeSession,
  state: InitiativeCharacterStateMaps,
): InitiativeSourceSyncResult {
  const previousHp: Record<string, SessionHpState> = {};
  const previousConditions: Record<string, SessionConditionsState> = {};
  const changedHpIds = new Set<string>();
  const changedConditionIds = new Set<string>();

  for (const beforeEntry of before.entries) {
    const nextEntry = requested.entries.find((entry) => entry.id === beforeEntry.id);
    if (!nextEntry) continue;
    const characterId = linkedCharacterIdForInitiativeEntry(beforeEntry);
    if (!characterId) continue;

    const hp = state.hp[characterId];
    const ability = state.abilities[characterId];
    const conditions = state.conditions[characterId];
    if (!hp || !ability?.initialized) continue;

    let hpChanged = false;
    let conditionsChanged = false;

    if (
      beforeEntry.currentHp !== nextEntry.currentHp
      || beforeEntry.temporaryHp !== nextEntry.temporaryHp
      || beforeEntry.maxHp !== nextEntry.maxHp
    ) {
      previousHp[characterId] ??= structuredClone(hp);
      if (nextEntry.maxHp !== undefined && Number.isFinite(nextEntry.maxHp)) {
        const desiredEffectiveMax = Math.max(1, Math.trunc(nextEntry.maxHp));
        const desiredBase = Math.max(1, desiredEffectiveMax - hp.maxHpBonus);
        if (desiredBase > hp.max) hp.max = desiredBase;
        hp.currentMax = clamp(desiredBase, 1, hp.max);
      }
      if (nextEntry.currentHp !== undefined && Number.isFinite(nextEntry.currentHp)) {
        hp.current = clamp(Math.trunc(nextEntry.currentHp), 0, effectiveMax(hp));
      }
      if (nextEntry.temporaryHp !== undefined && Number.isFinite(nextEntry.temporaryHp)) {
        hp.temporary = Math.max(0, Math.trunc(nextEntry.temporaryHp));
      }
      hpChanged = true;
    }

    if (
      conditions?.initialized
      && JSON.stringify(beforeEntry.conditions) !== JSON.stringify(nextEntry.conditions)
    ) {
      const sync = synchronizeConditions(conditions, nextEntry.conditions, nextEntry.id);
      if (!sync.ok) return sync;
      if (sync.changed) {
        previousConditions[characterId] ??= structuredClone(conditions);
        conditions.conditions = sync.conditions;
        conditions.revision += 1;
        conditionsChanged = true;
      }
    }

    if (beforeEntry.armorClass !== nextEntry.armorClass && nextEntry.armorClass !== undefined) {
      previousHp[characterId] ??= structuredClone(hp);
      const hydrated = hydrateCharacter(ability, hp, conditions);
      const calculated = getCalculatedArmorClassWithShield(hydrated);
      hp.stats.armorClassAdjustment = cleanNumber(nextEntry.armorClass - calculated);
      hp.statsInitialized = true;
      hpChanged = true;
    }

    if (hpChanged) {
      hp.revision += 1;
      changedHpIds.add(characterId);
    }
    if (conditionsChanged) changedConditionIds.add(characterId);
  }

  const projection = projectInitiativeSessionFromCharacterState(requested, state);
  return {
    ok: true,
    session: projection.session,
    previousHp,
    previousConditions,
    changedHpIds,
    changedConditionIds,
  };
}

export function projectInitiativeSessionFromCharacterState(
  session: InitiativeSession,
  state: InitiativeCharacterStateMaps,
): { session: InitiativeSession; changed: boolean } {
  let changed = false;
  const entries = session.entries.map((entry) => {
    const characterId = linkedCharacterIdForInitiativeEntry(entry);
    if (!characterId) return entry;
    const hp = state.hp[characterId];
    const ability = state.abilities[characterId];
    if (!hp || !ability?.initialized) return entry;
    const conditionsState = state.conditions[characterId];
    const hydrated = hydrateCharacter(ability, hp, conditionsState);
    const projectedConditions = conditionsState?.initialized
      ? conditionsState.conditions.map((condition) => toInitiativeCondition(condition, entry.id))
      : entry.conditions;
    const projected = normalizeProjectedZeroHp({
      ...entry,
      currentHp: hp.current,
      temporaryHp: hp.temporary,
      maxHp: effectiveMax(hp),
      armorClass: getEffectiveArmorClassWithShield(hydrated),
      conditions: projectedConditions,
    });
    if (JSON.stringify(projected) !== JSON.stringify(entry)) changed = true;
    return projected;
  });
  return {
    changed,
    session: changed ? { ...session, entries, updatedAt: Date.now() } : session,
  };
}

function hydrateCharacter(
  state: SessionAbilityState,
  hp: SessionHpState,
  conditionsState?: SessionConditionsState,
): CharacterTemplate {
  const character = CharacterTemplate.fromJSON(
    state.character as Partial<CharacterTemplateProps>,
  );
  const sheet = character.get("sheet");
  let next = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized
        ? { ...hp.savingThrows }
        : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
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
  if (conditionsState?.initialized) {
    next = withCharacterConditions(
      next,
      conditionsState.conditions as unknown as CharacterCondition[],
    );
  }
  return next;
}

function synchronizeConditions(
  state: SessionConditionsState,
  requested: InitiativeCondition[],
  entryId: string,
):
  | { ok: true; changed: boolean; conditions: SessionCondition[] }
  | { ok: false; code: string; message: string } {
  const existingById = new Map(state.conditions.map((condition) => [condition.id, condition]));

  for (const existing of state.conditions) {
    if (!isConcentration(existing)) continue;
    const requestedCondition = requested.find((condition) => condition.id === existing.id);
    if (!requestedCondition) {
      return {
        ok: false,
        code: "CONCENTRATION_DOMAIN_REQUIRED",
        message: "Concentration must be changed through the concentration controls, not the initiative condition editor.",
      };
    }
  }

  const next = requested.map((condition) => {
    const existing = existingById.get(condition.id);
    if (existing && isConcentration(existing)) return structuredClone(existing);
    return toSessionCondition(condition, existing, entryId);
  });
  return {
    ok: true,
    changed: JSON.stringify(next) !== JSON.stringify(state.conditions),
    conditions: next,
  };
}

function toInitiativeCondition(
  condition: SessionCondition,
  entryId: string,
): InitiativeCondition {
  return {
    id: condition.id,
    name: condition.name,
    description: condition.description || undefined,
    behavior: condition.behavior || undefined,
    source: condition.source || undefined,
    notes: condition.notes || undefined,
    tags: condition.tags,
    bonuses: condition.bonuses as InitiativeCondition["bonuses"],
    grantedSpells: condition.grantedSpells as InitiativeCondition["grantedSpells"],
    grantedProficiencies: condition.grantedProficiencies as InitiativeCondition["grantedProficiencies"],
    grantedAbilities: condition.grantedAbilities as InitiativeCondition["grantedAbilities"],
    duration: toInitiativeDuration(condition, entryId),
  };
}

function toInitiativeDuration(
  condition: SessionCondition,
  entryId: string,
): InitiativeConditionDuration {
  const duration = condition.duration;
  if (duration.type === "rounds") {
    return { type: "rounds", remaining: Math.max(0, duration.remaining ?? duration.total ?? 1) };
  }
  if (duration.type === "turns") {
    return { type: "turns", remaining: Math.max(0, duration.remaining ?? duration.total ?? 1) };
  }
  if (duration.type === "until-start-of-turn") {
    return { type: "untilTurnStart", ownerEntryId: condition.linkedCombatantId || entryId };
  }
  if (duration.type === "until-end-of-turn") {
    return { type: "untilTurnEnd", ownerEntryId: condition.linkedCombatantId || entryId };
  }
  return { type: "manual" };
}

function toSessionCondition(
  condition: InitiativeCondition,
  existing: SessionCondition | undefined,
  entryId: string,
): SessionCondition {
  const now = new Date().toISOString();
  return {
    ...(existing ?? {
      id: condition.id,
      name: condition.name,
      description: "",
      behavior: "",
      source: "Iniciativa",
      notes: "",
      tags: ["initiative"],
      duration: { type: "custom", customLabel: "Remoção manual" },
      createdAt: now,
      linkedCombatantId: entryId,
    }),
    id: condition.id,
    name: condition.name.trim(),
    description: condition.description ?? existing?.description ?? "",
    behavior: condition.behavior ?? existing?.behavior ?? "",
    source: condition.source ?? existing?.source ?? "Iniciativa",
    notes: condition.notes ?? existing?.notes ?? "",
    tags: condition.tags ?? existing?.tags ?? ["initiative"],
    bonuses: condition.bonuses ?? existing?.bonuses,
    grantedSpells: condition.grantedSpells ?? existing?.grantedSpells,
    grantedProficiencies: condition.grantedProficiencies ?? existing?.grantedProficiencies,
    grantedAbilities: condition.grantedAbilities ?? existing?.grantedAbilities,
    duration: toSessionDuration(condition.duration, existing?.duration),
    linkedCombatantId: entryId,
  };
}

function toSessionDuration(
  duration: InitiativeConditionDuration,
  previous?: SessionCondition["duration"],
): SessionCondition["duration"] {
  switch (duration.type) {
    case "rounds":
      return {
        type: "rounds",
        total: Math.max(0, duration.remaining),
        remaining: Math.max(0, duration.remaining),
        tickOn: "end-of-turn",
        tickOwner: "affected",
        autoRemoveAtZero: true,
      };
    case "turns":
      return {
        type: "turns",
        total: Math.max(0, duration.remaining),
        remaining: Math.max(0, duration.remaining),
        tickOn: "end-of-turn",
        tickOwner: "affected",
        autoRemoveAtZero: true,
      };
    case "untilTurnStart":
      return { type: "until-start-of-turn", tickOn: "start-of-turn", tickOwner: "source" };
    case "untilTurnEnd":
      return { type: "until-end-of-turn", tickOn: "end-of-turn", tickOwner: "source" };
    default:
      if (previous?.type === "concentration") return previous;
      return { type: "custom", customLabel: "Remoção manual", autoRemoveAtZero: false };
  }
}

function normalizeProjectedZeroHp(entry: InitiativeEntry): InitiativeEntry {
  if (entry.currentHp === undefined) return entry;
  if (entry.currentHp <= 0) {
    if (entry.sourceType === "character") {
      return {
        ...entry,
        downed: true,
        defeated: entry.defeatReason === "manual" ? entry.defeated : false,
        deathSaves: entry.deathSaves ?? { successes: 0, failures: 0 },
      };
    }
    if (entry.defeatReason === "manual") return entry;
    return { ...entry, defeated: true, downed: false, defeatReason: "zeroHp" };
  }
  return {
    ...entry,
    downed: false,
    defeated: entry.defeatReason === "zeroHp" ? false : entry.defeated,
    defeatReason: entry.defeatReason === "zeroHp" ? undefined : entry.defeatReason,
  };
}

function isConcentration(condition: SessionCondition): boolean {
  return condition.duration.type === "concentration"
    || condition.tags.includes("dnd-manager:concentrating")
    || normalize(condition.name) === "concentrando";
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}
function effectiveMax(state: SessionHpState): number {
  return Math.max(1, state.currentMax + state.maxHpBonus);
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
function cleanNumber(value: number): number {
  return Math.abs(value) < 0.000001 ? 0 : Number(value.toFixed(4));
}
