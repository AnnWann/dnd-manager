from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Initiative actor: require active installed system and preserve rich metadata.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/InitiativeSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    'import type { SessionConditionsState, SessionConnection, SessionHpState } from "../session/protocol";\n',
    'import type { SessionCondition, SessionConditionsState, SessionConnection, SessionHpState } from "../session/protocol";\n',
    "initiative SessionCondition import",
)
text = replace_once(
    text,
    """    let nextSession = sourceSync.session;\n\n    const previousAbilities: Record<string, SessionAbilityState> = {};\n""",
    """    let nextSession = sourceSync.session;\n    if (operation.type === \"initiative.customAction.execute\") {\n      enrichCustomInitiativeActionConditions(\n        operation,\n        runtimeConfig,\n        current,\n        conditions,\n        sourceSync.previousConditions,\n      );\n    }\n\n    const previousAbilities: Record<string, SessionAbilityState> = {};\n""",
    "custom initiative rich condition enrichment call",
)
text = replace_once(
    text,
    """      const system = runtimeConfig?.config.customSystems.find((definition) => definition.id === operation.systemId);\n      const action = system?.actions?.find((candidate) => candidate.id === operation.actionId);\n      if (!system || !action || action.enabled === false || !action.initiative?.enabled) {\n        return invalid(\"INITIATIVE_CUSTOM_ACTION_NOT_FOUND\", \"This initiative custom-system action is not available.\");\n      }\n""",
    """      const system = runtimeConfig?.config.customSystems.find((definition) => definition.id === operation.systemId);\n      const action = system?.actions?.find((candidate) => candidate.id === operation.actionId);\n      const systemIsActive = Boolean(\n        system && runtimeConfig?.config.characters.some((character) =>\n          character.customSystems.some((installation) =>\n            installation.systemId === system.id\n            && installation.enabled\n            && !installation.suppressed\n            && installation.systemVersion === system.version,\n          ),\n        ),\n      );\n      if (!system || !action || !systemIsActive || action.enabled === false || !action.initiative?.enabled) {\n        return invalid(\"INITIATIVE_CUSTOM_ACTION_NOT_FOUND\", \"This initiative custom-system action is not available in the active session.\");\n      }\n""",
    "custom initiative active installation validation",
)
# Insert rich metadata helper before applyInitiativeOperation.
anchor = """function applyInitiativeOperation(\n  current: InitiativeSession,\n"""
helper = r'''function enrichCustomInitiativeActionConditions(
  operation: Extract<SessionInitiativeOperation, { type: "initiative.customAction.execute" }>,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
  before: InitiativeSession,
  conditions: Record<string, SessionConditionsState>,
  previousConditions: Record<string, SessionConditionsState>,
): void {
  const system = runtimeConfig?.config.customSystems.find((definition) => definition.id === operation.systemId);
  const action = system?.actions?.find((candidate) => candidate.id === operation.actionId);
  if (!system || !action) return;
  const additions = (action.conditionChanges ?? []).filter((change) => change.operation === "add");
  if (!additions.length) return;

  for (const entryId of operation.entryIds) {
    const entry = before.entries.find((candidate) => candidate.id === entryId);
    const characterId = linkedCharacterIdForInitiativeEntry(entry);
    if (!characterId) continue;
    const state = conditions[characterId];
    const previous = previousConditions[characterId];
    if (!state?.initialized || !previous?.initialized) continue;

    const previousIds = new Set(previous.conditions.map((condition) => condition.id));
    const unmatched = state.conditions.filter((condition) =>
      !previousIds.has(condition.id)
      && condition.linkedCombatantId === entryId,
    );
    const used = new Set<string>();

    for (const change of additions) {
      const condition = unmatched.find((candidate) =>
        !used.has(candidate.id)
        && normalizeName(candidate.name) === normalizeName(change.name),
      );
      if (!condition) continue;
      used.add(condition.id);
      condition.description = change.description ?? condition.description;
      condition.behavior = change.behavior ?? condition.behavior;
      condition.source = change.source ?? system.name;
      condition.notes = change.notes ?? condition.notes;
      condition.tags = change.tags ? [...change.tags] : condition.tags;
      if (change.bonuses) condition.bonuses = structuredClone(change.bonuses);
      if (change.sourceCharacterId) condition.sourceCharacterId = change.sourceCharacterId;
      condition.duration = richCustomConditionDuration(change.duration, condition.duration);
    }
  }
}

function richCustomConditionDuration(
  duration: import("../../../../src/models/characters/CharacterCondition").CharacterConditionDuration & { amount?: number } | undefined,
  fallback: SessionCondition["duration"],
): SessionCondition["duration"] {
  if (!duration) return fallback;
  const { amount, ...rich } = duration;
  const normalizedAmount = typeof amount === "number" && Number.isFinite(amount)
    ? Math.max(0, Math.trunc(amount))
    : undefined;
  return {
    ...rich,
    ...(rich.total === undefined && normalizedAmount !== undefined ? { total: normalizedAmount } : {}),
    ...(rich.remaining === undefined && normalizedAmount !== undefined ? { remaining: normalizedAmount } : {}),
  } as SessionCondition["duration"];
}

'''
text = replace_once(text, anchor, helper + anchor, "custom initiative rich condition helper")
write(path, text)


# ---------------------------------------------------------------------------
# Runtime config publish: immediately reproject AC/conditions after config swap.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/session/AuthoritativeSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    """      broadcastRuntimeConfig(sockets, snapshot);\n      await broadcastAllVisibleCharacterSnapshots(this.ctx.storage, sockets);\n      return;\n""",
    """      broadcastRuntimeConfig(sockets, snapshot);\n      await broadcastAllVisibleCharacterSnapshots(this.ctx.storage, sockets);\n      await this.reconcileInitiativeProjection();\n      return;\n""",
    "runtime config initiative reprojection",
)
write(path, text)

print("initiative sync hardening applied")
