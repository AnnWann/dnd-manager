from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Shared custom-system model: initiative exposure for system actions.
# ---------------------------------------------------------------------------
path = "src/models/customSystems/CustomSystemDefinition.ts"
text = read(path)
text = replace_once(
    text,
    """  conditionChanges?: CustomSystemConditionChangeDefinition[]\n}\n\nexport interface CustomStandardActionOverrideDefinition {\n""",
    """  conditionChanges?: CustomSystemConditionChangeDefinition[]\n  /** Exposição opcional desta ação como automação de alvos na iniciativa do mestre. */\n  initiative?: CustomSystemInitiativeActionDefinition\n}\n\nexport interface CustomSystemInitiativeActionDefinition {\n  enabled: boolean\n  label?: string\n  targetSide?: \"any\" | \"ally\" | \"enemy\" | \"neutral\"\n  minimumTargets?: number\n  maximumTargets?: number\n}\n\nexport interface CustomStandardActionOverrideDefinition {\n""",
    "custom initiative action model",
)
write(path, text)


# ---------------------------------------------------------------------------
# Client + worker initiative protocols: bulk conditions and custom actions.
# ---------------------------------------------------------------------------
for path in [
    "src/features/session-runtime/initiativeSessionProtocol.ts",
    "session-server/src/routes/initiative/initiativeProtocol.ts",
]:
    text = read(path)
    text = replace_once(
        text,
        """  | { type: \"initiative.deathSaves.set\"; characterId: \"session\"; entryId: string; successes: number; failures: number }\n  | { type: \"initiative.reset\"; characterId: \"session\" }""",
        """  | { type: \"initiative.deathSaves.set\"; characterId: \"session\"; entryId: string; successes: number; failures: number }\n  | { type: \"initiative.conditions.bulk\"; characterId: \"session\"; entryIds: string[]; mode: \"add\" | \"remove\"; condition?: Record<string, unknown>; conditionName?: string }\n  | { type: \"initiative.customAction.execute\"; characterId: \"session\"; systemId: string; actionId: string; entryIds: string[] }\n  | { type: \"initiative.reset\"; characterId: \"session\" }""",
        f"initiative operations {path}",
    )
    if path.startswith("session-server"):
        text = replace_once(
            text,
            """    case \"initiative.deathSaves.set\": return readId(operation.entryId) && integerRange(operation.successes, 0, 3) && integerRange(operation.failures, 0, 3) ? value as SessionInitiativeClientMessage : null;\n    case \"initiative.sort\":\n""",
            """    case \"initiative.deathSaves.set\": return readId(operation.entryId) && integerRange(operation.successes, 0, 3) && integerRange(operation.failures, 0, 3) ? value as SessionInitiativeClientMessage : null;\n    case \"initiative.conditions.bulk\":\n      return Array.isArray(operation.entryIds)\n        && operation.entryIds.length > 0\n        && operation.entryIds.length <= 50\n        && operation.entryIds.every((entryId) => Boolean(readId(entryId)))\n        && (operation.mode === \"add\" || operation.mode === \"remove\")\n        && (operation.mode !== \"add\" || isRecord(operation.condition))\n        && (operation.mode !== \"remove\" || Boolean(readId(operation.conditionName)))\n        ? value as SessionInitiativeClientMessage\n        : null;\n    case \"initiative.customAction.execute\":\n      return Boolean(readId(operation.systemId))\n        && Boolean(readId(operation.actionId))\n        && Array.isArray(operation.entryIds)\n        && operation.entryIds.length > 0\n        && operation.entryIds.length <= 50\n        && operation.entryIds.every((entryId) => Boolean(readId(entryId)))\n        ? value as SessionInitiativeClientMessage\n        : null;\n    case \"initiative.sort\":\n""",
            "worker initiative parser bulk/custom",
        )
    write(path, text)


# ---------------------------------------------------------------------------
# Authoritative initiative <-> character projection helper.
# ---------------------------------------------------------------------------
write("session-server/src/routes/initiative/initiativeCharacterProjection.ts", r'''import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
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
''')


# ---------------------------------------------------------------------------
# Worker initiative actor: source synchronization, bulk/custom operations.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/InitiativeSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    """import type { SessionConnection, SessionHpState } from \"../session/protocol\";\n""",
    """import type { SessionConditionsState, SessionConnection, SessionHpState } from \"../session/protocol\";\n""",
    "initiative actor condition state import",
)
text = replace_once(
    text,
    """  addInitiativeEntries,\n  advanceInitiativeTurn,\n""",
    """  addInitiativeEntries,\n  advanceInitiativeTurn,\n  applyInitiativeCondition,\n""",
    "initiative actor condition helper import",
)
text = replace_once(
    text,
    """  normalizeInitiativeSession,\n  removeInitiativeEntry,\n""",
    """  normalizeInitiativeSession,\n  removeInitiativeCondition,\n  removeInitiativeEntry,\n""",
    "initiative actor remove condition import",
)
text = replace_once(
    text,
    """} from \"./initiativeProtocol\";\n\nexport const INITIATIVE_STATE_KEY""",
    """} from \"./initiativeProtocol\";\nimport {\n  linkedCharacterIdForInitiativeEntry,\n  projectInitiativeSessionFromCharacterState,\n  synchronizeInitiativeEditsToCharacterState,\n} from \"./initiativeCharacterProjection\";\n\nexport const INITIATIVE_STATE_KEY""",
    "initiative projection import",
)
text = replace_once(
    text,
    """const HP_STATE_KEY = \"hp-state\";\n""",
    """const HP_STATE_KEY = \"hp-state\";\nconst CONDITIONS_STATE_KEY = \"conditions-state\";\n""",
    "initiative conditions key",
)
text = replace_once(
    text,
    """    const [state, abilities, hp, runtimeConfig, log] = await Promise.all([\n      readInitiativeState(this.ctx.storage),\n      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),\n      readRuntimeConfig(this.ctx.storage),\n      readSessionLog(this.ctx.storage),\n    ]);\n""",
    """    const [state, abilities, hp, conditions, runtimeConfig, log] = await Promise.all([\n      readInitiativeState(this.ctx.storage),\n      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),\n      readRuntimeConfig(this.ctx.storage),\n      readSessionLog(this.ctx.storage),\n    ]);\n""",
    "initiative actor read conditions",
)
text = replace_once(
    text,
    """    const result = applyInitiativeOperation(current, operation);\n    if (!result.ok) {\n      sendError(webSocket, result.code, result.message);\n      return;\n    }\n\n    const previousAbilities: Record<string, SessionAbilityState> = {};\n""",
    """    const result = applyInitiativeOperation(current, operation, runtimeConfig);\n    if (!result.ok) {\n      sendError(webSocket, result.code, result.message);\n      return;\n    }\n\n    const sourceSync = synchronizeInitiativeEditsToCharacterState(\n      current,\n      result.session,\n      { abilities, hp, conditions },\n    );\n    if (!sourceSync.ok) {\n      sendError(webSocket, sourceSync.code, sourceSync.message);\n      return;\n    }\n    let nextSession = sourceSync.session;\n\n    const previousAbilities: Record<string, SessionAbilityState> = {};\n""",
    "initiative actor source sync",
)
text = text.replace("result.session.entries.find((entry) => entry.id === operation.entryId)", "nextSession.entries.find((entry) => entry.id === operation.entryId)")
text = replace_once(
    text,
    """        const events = initiativeAutomationEvents(current, result.session, operation);\n""",
    """        const events = initiativeAutomationEvents(current, nextSession, operation);\n""",
    "initiative automation next session",
)
text = replace_once(
    text,
    """    state.session = result.session as unknown as Record<string, unknown>;\n    state.revision += 1;\n    const affectedScopes = [\n      INITIATIVE_SHARED_SCOPE,\n      ...Array.from(changedAbilityIds, characterScope),\n    ];\n""",
    """    nextSession = projectInitiativeSessionFromCharacterState(\n      nextSession,\n      { abilities, hp, conditions },\n    ).session;\n    state.session = nextSession as unknown as Record<string, unknown>;\n    state.revision += 1;\n    const changedCharacterIds = new Set([\n      ...changedAbilityIds,\n      ...sourceSync.changedHpIds,\n      ...sourceSync.changedConditionIds,\n    ]);\n    const affectedScopes = [\n      INITIATIVE_SHARED_SCOPE,\n      ...Array.from(changedCharacterIds, characterScope),\n    ];\n""",
    "initiative actor affected scopes",
)
text = replace_once(
    text,
    """        ...(changedAbilityIds.size\n          ? {\n              abilities: Object.fromEntries(\n                Array.from(changedAbilityIds).map((characterId) => [\n                  characterId,\n                  previousAbilities[characterId],\n                ]),\n              ),\n            }\n          : {}),\n""",
    """        ...(changedAbilityIds.size\n          ? {\n              abilities: Object.fromEntries(\n                Array.from(changedAbilityIds).map((characterId) => [\n                  characterId,\n                  previousAbilities[characterId],\n                ]),\n              ),\n            }\n          : {}),\n        ...(sourceSync.changedHpIds.size ? { hp: sourceSync.previousHp } : {}),\n        ...(sourceSync.changedConditionIds.size ? { conditions: sourceSync.previousConditions } : {}),\n""",
    "initiative reverse hp conditions",
)
text = replace_once(
    text,
    """    const writes: Record<string, unknown> = { [INITIATIVE_STATE_KEY]: state };\n    if (changedAbilityIds.size) writes[ABILITIES_STATE_KEY] = abilities;\n""",
    """    const writes: Record<string, unknown> = { [INITIATIVE_STATE_KEY]: state };\n    if (changedAbilityIds.size) writes[ABILITIES_STATE_KEY] = abilities;\n    if (sourceSync.changedHpIds.size) writes[HP_STATE_KEY] = hp;\n    if (sourceSync.changedConditionIds.size) writes[CONDITIONS_STATE_KEY] = conditions;\n""",
    "initiative actor writes source state",
)
text = replace_once(
    text,
    """    broadcast(this.ctx.getWebSockets(), { type: \"session.initiative.updated\", state });\n    for (const characterId of changedAbilityIds) {\n""",
    """    broadcastVisibilityFiltered(this.ctx.getWebSockets(), { type: \"session.initiative.updated\", state });\n    for (const characterId of changedAbilityIds) {\n""",
    "initiative actor visibility initiative broadcast",
)
text = replace_once(
    text,
    """    for (const characterId of changedAbilityIds) {\n      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {\n        type: \"session.abilities.updated\",\n        character: abilities[characterId],\n      });\n    }\n""",
    """    for (const characterId of changedAbilityIds) {\n      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {\n        type: \"session.abilities.updated\",\n        character: abilities[characterId],\n      });\n    }\n    for (const characterId of sourceSync.changedHpIds) {\n      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {\n        type: \"session.hp.updated\",\n        character: hp[characterId],\n      });\n    }\n    for (const characterId of sourceSync.changedConditionIds) {\n      broadcastVisibilityFiltered(this.ctx.getWebSockets(), {\n        type: \"session.conditions.updated\",\n        character: conditions[characterId],\n      });\n    }\n""",
    "initiative actor source broadcasts",
)
text = replace_once(
    text,
    """function applyInitiativeOperation(\n  current: InitiativeSession,\n  operation: SessionInitiativeOperation,\n): { ok: true; session: InitiativeSession; operation: SessionInitiativeOperation } | { ok: false; code: string; message: string } {\n""",
    """function applyInitiativeOperation(\n  current: InitiativeSession,\n  operation: SessionInitiativeOperation,\n  runtimeConfig: SessionRuntimeConfigSnapshot | null,\n): { ok: true; session: InitiativeSession; operation: SessionInitiativeOperation } | { ok: false; code: string; message: string } {\n""",
    "initiative apply signature runtime config",
)
# Insert new operation cases before sort.
text = replace_once(
    text,
    """    case \"initiative.sort\": {\n""",
    r'''    case "initiative.conditions.bulk": {
      const entryIds = Array.from(new Set(operation.entryIds));
      if (!entryIds.length || entryIds.length > 50) return invalid("INITIATIVE_BULK_TARGETS_INVALID", "Select between 1 and 50 initiative targets.");
      if (entryIds.some((entryId) => !current.entries.some((entry) => entry.id === entryId))) {
        return invalid("INITIATIVE_ENTRY_NOT_FOUND", "One or more initiative targets were not found.");
      }
      let session = current;
      if (operation.mode === "add") {
        const condition = normalizeInitiativeConditionInput(operation.condition);
        if (!condition) return invalid("INITIATIVE_CONDITION_INVALID", "The initiative condition is invalid.");
        for (const entryId of entryIds) {
          session = applyInitiativeCondition(session, entryId, {
            ...condition,
            id: crypto.randomUUID(),
          });
        }
      } else {
        const conditionName = operation.conditionName?.trim();
        if (!conditionName) return invalid("INITIATIVE_CONDITION_INVALID", "Choose a condition to remove.");
        const normalizedName = normalizeName(conditionName);
        for (const entryId of entryIds) {
          const entry = session.entries.find((candidate) => candidate.id === entryId);
          if (!entry) continue;
          for (const condition of entry.conditions.filter((candidate) => normalizeName(candidate.name) === normalizedName)) {
            session = removeInitiativeCondition(session, entryId, condition.id);
          }
        }
      }
      if (JSON.stringify(session.entries) === JSON.stringify(current.entries)) {
        return invalid("INITIATIVE_BULK_NO_CHANGE", "The bulk condition operation did not change any target.");
      }
      return { ok: true, session, operation: { ...operation, entryIds } };
    }
    case "initiative.customAction.execute": {
      const system = runtimeConfig?.config.customSystems.find((definition) => definition.id === operation.systemId);
      const action = system?.actions?.find((candidate) => candidate.id === operation.actionId);
      if (!system || !action || action.enabled === false || !action.initiative?.enabled) {
        return invalid("INITIATIVE_CUSTOM_ACTION_NOT_FOUND", "This initiative custom-system action is not available.");
      }
      const entryIds = Array.from(new Set(operation.entryIds));
      const targets = entryIds.flatMap((entryId) => {
        const entry = current.entries.find((candidate) => candidate.id === entryId);
        return entry ? [entry] : [];
      });
      if (targets.length !== entryIds.length) return invalid("INITIATIVE_ENTRY_NOT_FOUND", "One or more initiative targets were not found.");
      const minimum = Math.max(1, Math.trunc(action.initiative.minimumTargets ?? 1));
      const maximum = Math.max(minimum, Math.min(50, Math.trunc(action.initiative.maximumTargets ?? 50)));
      if (targets.length < minimum || targets.length > maximum) {
        return invalid("INITIATIVE_CUSTOM_ACTION_TARGET_COUNT", `Select between ${minimum} and ${maximum} targets for this action.`);
      }
      const targetSide = action.initiative.targetSide ?? "any";
      if (targetSide !== "any" && targets.some((target) => target.side !== targetSide)) {
        return invalid("INITIATIVE_CUSTOM_ACTION_TARGET_SIDE", "One or more selected targets do not match the action target side.");
      }
      const changes = action.conditionChanges ?? [];
      if (!changes.length) return invalid("INITIATIVE_CUSTOM_ACTION_NO_EFFECTS", "This action has no condition changes to apply in initiative.");
      let session = current;
      for (const target of targets) {
        for (const change of changes) {
          if (change.operation === "add") {
            session = applyInitiativeCondition(session, target.id, {
              id: crypto.randomUUID(),
              name: change.name,
              description: change.description,
              duration: customConditionDuration(change.duration, target.id),
            });
          } else {
            const latest = session.entries.find((candidate) => candidate.id === target.id);
            if (!latest) continue;
            const normalizedName = normalizeName(change.name);
            for (const condition of latest.conditions.filter((candidate) => normalizeName(candidate.name) === normalizedName)) {
              session = removeInitiativeCondition(session, target.id, condition.id);
            }
          }
        }
      }
      if (JSON.stringify(session.entries) === JSON.stringify(current.entries)) {
        return invalid("INITIATIVE_CUSTOM_ACTION_NO_CHANGE", "The custom action did not change any selected target.");
      }
      return { ok: true, session, operation: { ...operation, entryIds } };
    }
    case "initiative.sort": {
''',
    "initiative bulk custom cases",
)
# Add parsing/mapping helpers before emptyInitiativeSession.
text = replace_once(
    text,
    """function emptyInitiativeSession(): InitiativeSession {\n""",
    r'''function normalizeInitiativeConditionInput(value: unknown): Omit<InitiativeEntry["conditions"][number], "id"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = readString(record.name);
  if (!name || name.length > 200) return null;
  const description = optionalString(record.description);
  const duration = normalizeInitiativeDuration(record.duration);
  if (!duration) return null;
  return { name, description, duration };
}

function normalizeInitiativeDuration(value: unknown): InitiativeEntry["conditions"][number]["duration"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: "manual" };
  const record = value as Record<string, unknown>;
  if (record.type === "manual") return { type: "manual" };
  if (record.type === "turns" || record.type === "rounds") {
    const remaining = finite(record.remaining);
    return remaining !== null && remaining >= 0
      ? { type: record.type, remaining: Math.trunc(remaining) }
      : null;
  }
  if (record.type === "untilTurnStart" || record.type === "untilTurnEnd") {
    const ownerEntryId = readString(record.ownerEntryId);
    return ownerEntryId ? { type: record.type, ownerEntryId } : null;
  }
  return null;
}

function customConditionDuration(
  duration: import("../../../../src/models/characters/CharacterCondition").CharacterConditionDuration & { amount?: number } | undefined,
  targetEntryId: string,
): InitiativeEntry["conditions"][number]["duration"] {
  if (!duration) return { type: "manual" };
  if (duration.type === "rounds" || duration.type === "turns") {
    return {
      type: duration.type,
      remaining: Math.max(1, Math.trunc(duration.remaining ?? duration.total ?? duration.amount ?? 1)),
    };
  }
  if (duration.type === "until-start-of-turn") return { type: "untilTurnStart", ownerEntryId: targetEntryId };
  if (duration.type === "until-end-of-turn") return { type: "untilTurnEnd", ownerEntryId: targetEntryId };
  return { type: "manual" };
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function emptyInitiativeSession(): InitiativeSession {
''',
    "initiative actor condition helpers",
)
# Use shared helper instead of narrow local helper for death saves and remove duplicate local helper if present.
text = text.replace("linkedCharacterIdForEntry(entry)", "linkedCharacterIdForInitiativeEntry(entry)")
text = text.replace("linkedCharacterIdForEntry(deathSaveEntry)", "linkedCharacterIdForInitiativeEntry(deathSaveEntry)")
local_helper_start = "function linkedCharacterIdForEntry(entry: InitiativeEntry | undefined): string | undefined {\n"
if local_helper_start in text:
    start = text.index(local_helper_start)
    end = text.index("function normalizeDeathSaves", start)
    text = text[:start] + text[end:]
write(path, text)


# ---------------------------------------------------------------------------
# Final authoritative actor: project character-domain changes back to initiative
# and make initiative undo restore HP/conditions as well.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/session/AuthoritativeSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    """import type { SessionConnection } from \"./protocol\";\n""",
    """import type { SessionConditionsState, SessionConnection, SessionHpState } from \"./protocol\";\n""",
    "authoritative state imports",
)
text = replace_once(
    text,
    """import { parseInitiativeClientMessage, type SessionInitiativeState } from \"../initiative/initiativeProtocol\";\n""",
    """import { parseInitiativeClientMessage, type SessionInitiativeState } from \"../initiative/initiativeProtocol\";\nimport { normalizeInitiativeSession } from \"../../../../src/models/initiative/Initiative\";\nimport { projectInitiativeSessionFromCharacterState } from \"../initiative/initiativeCharacterProjection\";\n""",
    "authoritative initiative projection imports",
)
text = replace_once(
    text,
    """const ABILITIES_STATE_KEY = \"abilities-state\";\n""",
    """const ABILITIES_STATE_KEY = \"abilities-state\";\nconst HP_STATE_KEY = \"hp-state\";\nconst CONDITIONS_STATE_KEY = \"conditions-state\";\n""",
    "authoritative hp conditions keys",
)
text = replace_once(
    text,
    """  abilities?: Record<string, SessionAbilityState>;\n};\n""",
    """  abilities?: Record<string, SessionAbilityState>;\n  hp?: Record<string, SessionHpState>;\n  conditions?: Record<string, SessionConditionsState>;\n};\n""",
    "initiative reverse source state",
)
text = replace_once(
    text,
    """    if (parseCustomSystemClientMessage(raw)) {\n      await this.customSystemRoute.webSocketMessage(webSocket, message);\n      return;\n    }\n""",
    """    if (parseCustomSystemClientMessage(raw)) {\n      await this.customSystemRoute.webSocketMessage(webSocket, message);\n      await this.reconcileInitiativeProjection();\n      return;\n    }\n""",
    "custom system reconcile initiative",
)
text = replace_once(
    text,
    """    await super.webSocketMessage(webSocket, message);\n  }\n\n  private async handleRuntimeConfigPublish(\n""",
    """    await super.webSocketMessage(webSocket, message);\n    await this.reconcileInitiativeProjection();\n  }\n\n  private async reconcileInitiativeProjection(): Promise<void> {\n    const [initiative, abilities, hp, conditions] = await Promise.all([\n      readInitiativeState(this.ctx.storage),\n      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),\n    ]);\n    if (!initiative.initialized) return;\n    const current = normalizeInitiativeSession(initiative.session as Partial<import(\"../../../../src/models/initiative/Initiative\").InitiativeSession>);\n    const projection = projectInitiativeSessionFromCharacterState(current, { abilities, hp, conditions });\n    if (!projection.changed) return;\n    initiative.session = projection.session as unknown as Record<string, unknown>;\n    initiative.revision += 1;\n    await this.ctx.storage.put(INITIATIVE_STATE_KEY, initiative);\n    broadcastVisibilityFiltered(this.ctx.getWebSockets(), {\n      type: \"session.initiative.updated\",\n      state: initiative,\n    });\n  }\n\n  private async handleRuntimeConfigPublish(\n""",
    "authoritative reconcile method",
)
# restoreInitiativeUndo reads and restores sources.
text = replace_once(
    text,
    """    const [currentInitiative, abilities] = await Promise.all([\n      readInitiativeState(this.ctx.storage),\n      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),\n    ]);\n""",
    """    const [currentInitiative, abilities, hp, conditions] = await Promise.all([\n      readInitiativeState(this.ctx.storage),\n      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),\n      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),\n    ]);\n""",
    "initiative undo read source states",
)
text = replace_once(
    text,
    """    const restoredAbilityIds = Object.keys(reverse.abilities ?? {});\n""",
    """    const restoredAbilityIds = Object.keys(reverse.abilities ?? {});\n    const restoredHpIds = Object.keys(reverse.hp ?? {});\n    const restoredConditionIds = Object.keys(reverse.conditions ?? {});\n""",
    "initiative undo restored source ids",
)
text = replace_once(
    text,
    """    const inverseReverse: InitiativeReverse = {\n      type: \"session.initiative.restore\",\n      characterId: \"session\",\n      affectedScopes,\n      snapshot: structuredClone(currentInitiative),\n      ...(restoredAbilityIds.length ? { abilities: inverseAbilities } : {}),\n    };\n\n    for (const [characterId, snapshot] of Object.entries(reverse.abilities ?? {})) {\n      abilities[characterId] = structuredClone(snapshot);\n    }\n""",
    """    const inverseHp = Object.fromEntries(restoredHpIds.flatMap((characterId) => hp[characterId] ? [[characterId, structuredClone(hp[characterId])]] : [])) as Record<string, SessionHpState>;\n    const inverseConditions = Object.fromEntries(restoredConditionIds.flatMap((characterId) => conditions[characterId] ? [[characterId, structuredClone(conditions[characterId])]] : [])) as Record<string, SessionConditionsState>;\n    const inverseReverse: InitiativeReverse = {\n      type: \"session.initiative.restore\",\n      characterId: \"session\",\n      affectedScopes,\n      snapshot: structuredClone(currentInitiative),\n      ...(restoredAbilityIds.length ? { abilities: inverseAbilities } : {}),\n      ...(restoredHpIds.length ? { hp: inverseHp } : {}),\n      ...(restoredConditionIds.length ? { conditions: inverseConditions } : {}),\n    };\n\n    for (const [characterId, snapshot] of Object.entries(reverse.abilities ?? {})) abilities[characterId] = structuredClone(snapshot);\n    for (const [characterId, snapshot] of Object.entries(reverse.hp ?? {})) hp[characterId] = structuredClone(snapshot);\n    for (const [characterId, snapshot] of Object.entries(reverse.conditions ?? {})) conditions[characterId] = structuredClone(snapshot);\n""",
    "initiative undo inverse source states",
)
text = replace_once(
    text,
    """    if (restoredAbilityIds.length) writes[ABILITIES_STATE_KEY] = abilities;\n""",
    """    if (restoredAbilityIds.length) writes[ABILITIES_STATE_KEY] = abilities;\n    if (restoredHpIds.length) writes[HP_STATE_KEY] = hp;\n    if (restoredConditionIds.length) writes[CONDITIONS_STATE_KEY] = conditions;\n""",
    "initiative undo source writes",
)
text = replace_once(
    text,
    """    broadcast(sockets, { type: \"session.initiative.updated\", state: reverse.snapshot });\n""",
    """    broadcastVisibilityFiltered(sockets, { type: \"session.initiative.updated\", state: reverse.snapshot });\n""",
    "initiative undo filtered broadcast",
)
text = replace_once(
    text,
    """    for (const characterId of restoredAbilityIds) {\n      const snapshot = abilities[characterId];\n      if (!snapshot) continue;\n      broadcastVisibilityFiltered(sockets, {\n        type: \"session.abilities.updated\",\n        character: snapshot,\n      });\n    }\n""",
    """    for (const characterId of restoredAbilityIds) {\n      const snapshot = abilities[characterId];\n      if (!snapshot) continue;\n      broadcastVisibilityFiltered(sockets, { type: \"session.abilities.updated\", character: snapshot });\n    }\n    for (const characterId of restoredHpIds) {\n      const snapshot = hp[characterId];\n      if (!snapshot) continue;\n      broadcastVisibilityFiltered(sockets, { type: \"session.hp.updated\", character: snapshot });\n    }\n    for (const characterId of restoredConditionIds) {\n      const snapshot = conditions[characterId];\n      if (!snapshot) continue;\n      broadcastVisibilityFiltered(sockets, { type: \"session.conditions.updated\", character: snapshot });\n    }\n""",
    "initiative undo source broadcasts",
)
write(path, text)


# ---------------------------------------------------------------------------
# Initiative roster selection UI.
# ---------------------------------------------------------------------------
path = "src/features/initiative/initiativeRosterTypes.ts"
text = read(path)
text = replace_once(
    text,
    """  onRename?: (entryId: string) => void\n  onCondition: (entryId: string) => void\n""",
    """  onRename?: (entryId: string) => void\n  selectedEntryIds?: ReadonlySet<string>\n  onSelectEntry?: (entryId: string, selected: boolean) => void\n  onCondition: (entryId: string) => void\n""",
    "roster selection props",
)
write(path, text)

path = "src/features/initiative/InitiativeTable.tsx"
text = read(path)
text = replace_once(
    text,
    """        <td className=\"px-3 py-3\">\n          {active ? (\n""",
    """        <td className=\"px-3 py-3\">\n          <div className=\"flex items-center gap-2\">\n            {onSelectEntry ? (\n              <input\n                type=\"checkbox\"\n                checked={selectedEntryIds?.has(entry.id) ?? false}\n                onChange={(event) => onSelectEntry(entry.id, event.target.checked)}\n                aria-label={`Selecionar ${entry.name}`}\n              />\n            ) : null}\n          {active ? (\n""",
    "table selection checkbox start",
)
text = replace_once(
    text,
    """            <span className=\"text-textMuted\">{entry.order + 1}</span>\n          )}\n        </td>\n""",
    """            <span className=\"text-textMuted\">{entry.order + 1}</span>\n          )}\n          </div>\n        </td>\n""",
    "table selection checkbox end",
)
write(path, text)

path = "src/features/initiative/InitiativeCards.tsx"
text = read(path)
text = replace_once(
    text,
    """              <article\n                className={[\n""",
    """              <article\n                className={[\n""",
    "cards article anchor noop",
)
text = replace_once(
    text,
    """                <div className=\"flex items-start justify-between gap-3\">\n                  <EntryIdentity\n""",
    """                {!readOnly && props.onSelectEntry ? (\n                  <label className=\"mb-3 flex items-center gap-2 text-xs text-textMuted\">\n                    <input\n                      type=\"checkbox\"\n                      checked={props.selectedEntryIds?.has(entry.id) ?? false}\n                      onChange={(event) => props.onSelectEntry?.(entry.id, event.target.checked)}\n                    />\n                    Selecionar alvo\n                  </label>\n                ) : null}\n                <div className=\"flex items-start justify-between gap-3\">\n                  <EntryIdentity\n""",
    "cards selection checkbox",
)
write(path, text)


# ---------------------------------------------------------------------------
# Initiative master view: selection, bulk condition controls, custom actions.
# ---------------------------------------------------------------------------
path = "src/views/InitiativeView.tsx"
text = read(path)
text = replace_once(
    text,
    """import { InitiativeTable } from \"../features/initiative/InitiativeTable\"\n""",
    """import { InitiativeTable } from \"../features/initiative/InitiativeTable\"\nimport { useOptionalSessionRuntime } from \"../features/session-runtime/useSessionRuntime\"\n""",
    "initiative runtime import",
)
text = replace_once(
    text,
    """  const { userRole } = useSyncContext()\n  const { session, updateSession, resetSession, hydrated } =\n""",
    """  const { userRole } = useSyncContext()\n  const runtime = useOptionalSessionRuntime()\n  const { session, updateSession, resetSession, hydrated } =\n""",
    "initiative runtime value",
)
text = replace_once(
    text,
    """  const [conditionTargetId, setConditionTargetId] = useState<string>()\n  const [renameTargetId, setRenameTargetId] = useState<string>()\n""",
    """  const [conditionTargetId, setConditionTargetId] = useState<string>()\n  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set())\n  const [bulkConditionOpen, setBulkConditionOpen] = useState(false)\n  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)\n  const [bulkRemoveConditionName, setBulkRemoveConditionName] = useState(\"\")\n  const [renameTargetId, setRenameTargetId] = useState<string>()\n""",
    "initiative bulk state",
)
# derived custom actions after selected creature etc.
text = replace_once(
    text,
    """  const activeEntry = session.entries.find(\n""",
    """  const initiativeSystemActions = useMemo(() => {\n    const snapshot = runtime?.runtimeConfigSnapshot\n    if (!snapshot) return []\n    const enabledSystems = new Set(\n      snapshot.config.characters.flatMap((character) =>\n        character.customSystems.filter((installation) => installation.enabled).map((installation) => installation.systemId),\n      ),\n    )\n    return snapshot.config.customSystems.flatMap((system) =>\n      enabledSystems.has(system.id)\n        ? (system.actions ?? []).flatMap((action) => action.enabled !== false && action.initiative?.enabled ? [{ system, action }] : [])\n        : [],\n    )\n  }, [runtime?.runtimeConfigSnapshot])\n  const activeEntry = session.entries.find(\n""",
    "initiative custom actions derived",
)
# selection pruning effect after selected character effect.
text = replace_once(
    text,
    """  function patchEntry(entryId: string, patch: Partial<InitiativeEntry>) {\n""",
    """  useEffect(() => {\n    const ids = new Set(session.entries.map((entry) => entry.id))\n    setSelectedEntryIds((current) => {\n      const next = new Set(Array.from(current).filter((entryId) => ids.has(entryId)))\n      return next.size === current.size ? current : next\n    })\n  }, [session.entries])\n\n  function patchEntry(entryId: string, patch: Partial<InitiativeEntry>) {\n""",
    "initiative selection prune",
)
# Add bulk helpers after applyCondition.
text = replace_once(
    text,
    """  async function clearCombat() {\n""",
    r'''  function toggleSelectedEntry(entryId: string, selected: boolean) {
    setSelectedEntryIds((current) => {
      const next = new Set(current)
      if (selected) next.add(entryId)
      else next.delete(entryId)
      return next
    })
  }

  function applyBulkCondition(condition: InitiativeConditionInput) {
    const entryIds = Array.from(selectedEntryIds)
    if (!entryIds.length) return
    if (runtime?.initiativeState?.initialized) {
      runtime.dispatchInitiativeOperation({
        type: "initiative.conditions.bulk",
        characterId: "session",
        entryIds,
        mode: "add",
        condition: condition as unknown as Record<string, unknown>,
      })
    } else {
      updateSession((current) => entryIds.reduce(
        (next, entryId) => applyInitiativeCondition(next, entryId, condition),
        current,
      ))
    }
    setBulkConditionOpen(false)
  }

  function removeBulkCondition() {
    const entryIds = Array.from(selectedEntryIds)
    const conditionName = bulkRemoveConditionName.trim()
    if (!entryIds.length || !conditionName) return
    if (runtime?.initiativeState?.initialized) {
      runtime.dispatchInitiativeOperation({
        type: "initiative.conditions.bulk",
        characterId: "session",
        entryIds,
        mode: "remove",
        conditionName,
      })
    } else {
      const normalized = normalizeLabel(conditionName)
      updateSession((current) => entryIds.reduce((next, entryId) => {
        const entry = next.entries.find((candidate) => candidate.id === entryId)
        if (!entry) return next
        return entry.conditions
          .filter((condition) => normalizeLabel(condition.name) === normalized)
          .reduce((updated, condition) => removeInitiativeCondition(updated, entryId, condition.id), next)
      }, current))
    }
    setBulkRemoveOpen(false)
  }

  function executeInitiativeSystemAction(systemId: string, actionId: string) {
    const entryIds = Array.from(selectedEntryIds)
    if (!runtime?.initiativeState?.initialized || !entryIds.length) return
    runtime.dispatchInitiativeOperation({
      type: "initiative.customAction.execute",
      characterId: "session",
      systemId,
      actionId,
      entryIds,
    })
  }

  async function clearCombat() {
''',
    "initiative bulk action helpers",
)
# roster props selection.
text = replace_once(
    text,
    """    onRename: openRename,\n    onCondition: setConditionTargetId,\n""",
    """    onRename: openRename,\n    selectedEntryIds,\n    onSelectEntry: toggleSelectedEntry,\n    onCondition: setConditionTargetId,\n""",
    "roster selection wiring",
)
# Insert selection toolbar after main control section before death saves section.
anchor = """      <section className=\"grid gap-3 rounded-xl border border-border bg-bg p-4 shadow-theme-sm md:grid-cols-[minmax(0,1fr)_auto]\">\n        <div>\n          <div className=\"text-sm font-semibold text-textH\">Saves de morte na iniciativa</div>\n"""
insert = r'''      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">Ações em massa</div>
            <div className="mt-1 text-xs text-textMuted">{selectedEntryIds.size} alvo{selectedEntryIds.size === 1 ? "" : "s"} selecionado{selectedEntryIds.size === 1 ? "" : "s"}.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setSelectedEntryIds(new Set(session.entries.map((entry) => entry.id)))} disabled={!session.entries.length}>Selecionar todos</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedEntryIds(new Set())} disabled={!selectedEntryIds.size}>Limpar seleção</Button>
            <Button size="sm" onClick={() => setBulkConditionOpen(true)} disabled={!selectedEntryIds.size}>Aplicar condição</Button>
            <Button size="sm" onClick={() => {
              const first = session.entries.find((entry) => selectedEntryIds.has(entry.id))?.conditions[0]?.name ?? ""
              setBulkRemoveConditionName(first)
              setBulkRemoveOpen(true)
            }} disabled={!selectedEntryIds.size}>Remover condição</Button>
          </div>
        </div>
        {initiativeSystemActions.length ? (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-textMuted">Automações de sistemas customizados</div>
            <div className="flex flex-wrap gap-2">
              {initiativeSystemActions.map(({ system, action }) => {
                const targets = session.entries.filter((entry) => selectedEntryIds.has(entry.id))
                const targetSide = action.initiative?.targetSide ?? "any"
                const minimum = Math.max(1, action.initiative?.minimumTargets ?? 1)
                const maximum = Math.max(minimum, action.initiative?.maximumTargets ?? 50)
                const valid = targets.length >= minimum
                  && targets.length <= maximum
                  && (targetSide === "any" || targets.every((entry) => entry.side === targetSide))
                return (
                  <Button
                    key={`${system.id}:${action.id}`}
                    size="sm"
                    variant="secondary"
                    disabled={!valid}
                    title={action.description ?? system.name}
                    onClick={() => executeInitiativeSystemAction(system.id, action.id)}
                  >
                    {action.initiative?.label?.trim() || action.name}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}
      </section>

'''
text = replace_once(text, anchor, insert + anchor, "initiative bulk toolbar")
# Add modals before rename modal.
text = replace_once(
    text,
    """      {renameTarget ? (\n""",
    r'''      {bulkConditionOpen && selectedEntryIds.size ? (
        <ConditionDialog
          targetName={`${selectedEntryIds.size} participantes`}
          targetEntryId={Array.from(selectedEntryIds)[0]}
          entries={session.entries}
          activeEntryId={session.activeEntryId}
          onClose={() => setBulkConditionOpen(false)}
          onApply={applyBulkCondition}
        />
      ) : null}

      {bulkRemoveOpen ? (
        <Modal title="Remover condição em massa" onClose={() => setBulkRemoveOpen(false)} className="max-w-md">
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs text-textMuted">
              Condição
              <select className={selectClassName} value={bulkRemoveConditionName} onChange={(event) => setBulkRemoveConditionName(event.target.value)}>
                <option value="">Selecione</option>
                {Array.from(new Set(session.entries.filter((entry) => selectedEntryIds.has(entry.id)).flatMap((entry) => entry.conditions.map((condition) => condition.name)))).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={() => setBulkRemoveOpen(false)}>Cancelar</Button>
              <Button variant="danger" disabled={!bulkRemoveConditionName.trim()} onClick={removeBulkCondition}>Remover dos selecionados</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {renameTarget ? (
''',
    "initiative bulk modals",
)
# normalize helper at bottom before clamp.
text = replace_once(
    text,
    """function clamp(value: number, minimum: number, maximum: number): number {\n""",
    """function normalizeLabel(value: string): string {\n  return value.normalize(\"NFD\").replace(/[\\u0300-\\u036f]/g, \"\").trim().toLocaleLowerCase(\"pt-BR\")\n}\n\nfunction clamp(value: number, minimum: number, maximum: number): number {\n""",
    "initiative normalize label helper",
)
write(path, text)


# ---------------------------------------------------------------------------
# Custom action editor: initiative button configuration.
# ---------------------------------------------------------------------------
path = "src/features/customSystems/CustomSystemSheetIntegrationEditor.tsx"
text = read(path)
anchor = """      <TextInput\n        label=\"Descrição\"\n        value={value.description ?? \"\"}\n        onChange={(description) => onChange({ ...value, description: description || undefined })}\n      />\n\n      <section className=\"mt-4 rounded-xl border border-border bg-bg p-3\">\n        <h3 className=\"text-sm font-semibold text-textH\">Rolagem antes de executar</h3>\n"""
insert = """      <TextInput\n        label=\"Descrição\"\n        value={value.description ?? \"\"}\n        onChange={(description) => onChange({ ...value, description: description || undefined })}\n      />\n\n      <section className=\"mt-4 rounded-xl border border-border bg-bg p-3\">\n        <label className=\"flex items-center gap-2 text-sm font-semibold text-textH\">\n          <input\n            type=\"checkbox\"\n            checked={value.initiative?.enabled === true}\n            onChange={(event) => onChange({\n              ...value,\n              initiative: event.target.checked\n                ? { enabled: true, targetSide: value.initiative?.targetSide ?? \"any\", minimumTargets: value.initiative?.minimumTargets ?? 1, maximumTargets: value.initiative?.maximumTargets ?? 50, label: value.initiative?.label }\n                : undefined,\n            })}\n          />\n          Exibir como automação na iniciativa do mestre\n        </label>\n        <p className=\"mt-1 text-xs leading-5 text-textMuted\">Usa as alterações de condição/estado desta ação sobre os combatentes selecionados.</p>\n        {value.initiative?.enabled ? (\n          <div className=\"mt-2 grid gap-3 md:grid-cols-4\">\n            <TextInput label=\"Rótulo do botão\" value={value.initiative.label ?? \"\"} onChange={(label) => onChange({ ...value, initiative: { ...value.initiative!, label: label || undefined } })} />\n            <Select label=\"Lado dos alvos\" value={value.initiative.targetSide ?? \"any\"} options={[[\"any\", \"Qualquer\"], [\"ally\", \"Aliados\"], [\"enemy\", \"Inimigos\"], [\"neutral\", \"Neutros\"]]} onChange={(targetSide) => onChange({ ...value, initiative: { ...value.initiative!, targetSide: targetSide as \"any\" | \"ally\" | \"enemy\" | \"neutral\" } })} />\n            <TextInput label=\"Mínimo de alvos\" type=\"number\" value={String(value.initiative.minimumTargets ?? 1)} onChange={(minimumTargets) => onChange({ ...value, initiative: { ...value.initiative!, minimumTargets: Math.max(1, Number(minimumTargets) || 1) } })} />\n            <TextInput label=\"Máximo de alvos\" type=\"number\" value={String(value.initiative.maximumTargets ?? 50)} onChange={(maximumTargets) => onChange({ ...value, initiative: { ...value.initiative!, maximumTargets: Math.max(1, Math.min(50, Number(maximumTargets) || 1)) } })} />\n          </div>\n        ) : null}\n      </section>\n\n      <section className=\"mt-4 rounded-xl border border-border bg-bg p-3\">\n        <h3 className=\"text-sm font-semibold text-textH\">Rolagem antes de executar</h3>\n"""
text = replace_once(text, anchor, insert, "custom action initiative editor")
write(path, text)


# ---------------------------------------------------------------------------
# Session log descriptions for semantic bulk/custom initiative operations.
# ---------------------------------------------------------------------------
path = "src/features/session/SessionActionLog.tsx"
text = read(path)
text = replace_once(
    text,
    """    case \"initiative.deathSaves.set\": return `Atualizou os saves de morte na iniciativa (${operation.successes} sucessos, ${operation.failures} falhas).`\n    case \"initiative.reset\": return `Limpou o combate atual.`\n""",
    """    case \"initiative.deathSaves.set\": return `Atualizou os saves de morte na iniciativa (${operation.successes} sucessos, ${operation.failures} falhas).`\n    case \"initiative.conditions.bulk\": return operation.mode === \"add\" ? `Aplicou uma condição em ${operation.entryIds.length} participantes da iniciativa.` : `Removeu ${operation.conditionName || \"uma condição\"} de ${operation.entryIds.length} participantes da iniciativa.`\n    case \"initiative.customAction.execute\": {\n      const definition = customSystemDefinitions.find((entry) => entry.id === operation.systemId)\n      const action = definition?.actions?.find((entry) => entry.id === operation.actionId)\n      return `Executou ${action?.name ?? operation.actionId} em ${operation.entryIds.length} alvo${operation.entryIds.length === 1 ? \"\" : \"s\"} da iniciativa${definition ? ` — ${definition.name}` : \"\"}.`\n    }\n    case \"initiative.reset\": return `Limpou o combate atual.`\n""",
    "initiative log bulk custom",
)
write(path, text)


# Remove old Vercel trigger from the source tree if it still exists.
trigger = Path("src/qaDeployTrigger.ts")
if trigger.exists():
    trigger.unlink()

print("initiative sync, bulk conditions, and custom initiative actions patch applied")
