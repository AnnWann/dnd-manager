from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"start anchor not found: {label}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"end anchor not found: {label}")
    return text[:start_index] + replacement + text[end_index:]


# 1) Formula-with-character runtime: resolve only character variables actually referenced.
path = "src/lib/customSystems/CustomFormulaEngineWithCharacter.ts"
text = read(path)
text = replace_once(
    text,
    """    getCharacterFormulaValues(character),\n    ability,\n""",
    """    getCharacterFormulaValues(\n      character,\n      collectReferencedCharacterPaths(formula, definition, ability?.type),\n    ),\n    ability,\n""",
    "evaluate requested character formula variables",
)
text = replace_once(
    text,
    """    getCharacterFormulaValues(),\n    abilityType ? { type: abilityType } : undefined,\n""",
    """    getCharacterFormulaValues(\n      undefined,\n      collectReferencedCharacterPaths(formula, definition, abilityType),\n    ),\n    abilityType ? { type: abilityType } : undefined,\n""",
    "validate requested character formula variables",
)
helper_anchor = """function replaceIdentifier(\n  expression: string,\n"""
helper = """function collectReferencedCharacterPaths(\n  formula: string,\n  definition: CustomSystemDefinition,\n  abilityType?: CustomAbilityTypeDefinition,\n): string[] {\n  const expressions = [\n    formula,\n    ...definition.fields.flatMap((field) =>\n      field.type === 'formula' ? [field.formula] : [],\n    ),\n    ...definition.resources.flatMap((resource) =>\n      resource.maximumFormula ? [resource.maximumFormula] : [],\n    ),\n    ...(abilityType?.fields.flatMap((field) =>\n      field.type === 'formula' ? [field.formula] : [],\n    ) ?? []),\n  ]\n  const paths = new Set<string>()\n  const pattern = /\\bcharacter\\.[A-Za-z0-9_.-]+/g\n\n  for (const expression of expressions) {\n    for (const match of expression.matchAll(pattern)) paths.add(match[0])\n  }\n\n  return [...paths]\n}\n\n"""
text = replace_once(text, helper_anchor, helper + helper_anchor, "character variable collector")
write(path, text)


# 2) Base formula parser: tokenization is pure, so cache tokens per formula.
path = "src/lib/customSystems/CustomFormulaEngine.ts"
text = read(path)
text = replace_once(
    text,
    """type Token =\n  | { type: 'number'; value: number }\n""",
    """type Token =\n  | { type: 'number'; value: number }\n""",
    "formula token type anchor",
)
# Insert cache immediately after the Token union.
token_union_end = """  | { type: 'comma' }\n  | { type: 'eof' }\n\n"""
text = replace_once(
    text,
    token_union_end,
    token_union_end + "const FORMULA_TOKEN_CACHE_LIMIT = 512\nconst formulaTokenCache = new Map<string, Token[]>()\n\n",
    "formula token cache",
)
text = replace_once(
    text,
    """      tokenize(formula),\n      (path) => resolveVariable(path, definition, state),\n""",
    """      getFormulaTokens(formula),\n      (path) => resolveVariable(path, definition, state),\n""",
    "cached formula tokens",
)
tokenize_anchor = """function tokenize(input: string): Token[] {\n"""
token_cache_helper = """function getFormulaTokens(input: string): Token[] {\n  const cached = formulaTokenCache.get(input)\n  if (cached) return cached\n\n  const tokens = tokenize(input)\n  if (formulaTokenCache.size >= FORMULA_TOKEN_CACHE_LIMIT) formulaTokenCache.clear()\n  formulaTokenCache.set(input, tokens)\n  return tokens\n}\n\n"""
text = replace_once(text, tokenize_anchor, token_cache_helper + tokenize_anchor, "token cache helper")
write(path, text)


# 3) Formula runtime patch: lazy copy + reference equality instead of cloning/stringifying all systems.
path = "src/lib/customSystems/CustomFormulaRuntimePatch.ts"
text = read(path)
new_recalculate = """export function recalculateCustomSystemState(\n  state: CharacterCustomSystemState,\n  character?: CharacterTemplate,\n): CharacterCustomSystemState {\n  const definition = resolveDefinition?.(state.systemId)\n  if (!definition) return state\n\n  const hasCalculatedResources = definition.resources.some((resource) =>\n    Boolean(resource.maximumFormula) && (resource.maximumMode ?? 'formula') !== 'manual',\n  )\n  const hasCalculatedFields = definition.fields.some((field) => field.type === 'formula')\n  if (!hasCalculatedResources && !hasCalculatedFields) return state\n\n  let next = state\n\n  for (const resource of definition.resources) {\n    if (!resource.maximumFormula) continue\n    const mode = resource.maximumMode ?? 'formula'\n    const currentState = next.resources[resource.id]\n    const hasManualOverride = mode === 'formulaWithOverride' && currentState?.maximum !== undefined\n    if (mode === 'manual' || hasManualOverride) continue\n\n    const result = evaluateCustomFormula(\n      resource.maximumFormula,\n      definition,\n      next,\n      character,\n    )\n    if (!result.ok || typeof result.value !== 'number') continue\n\n    const previousCurrent = currentState?.current ?? resource.initialValue ?? 0\n    const nextCurrent = Math.min(previousCurrent, result.value)\n    if (\n      currentState &&\n      currentState.maximum === result.value &&\n      currentState.current === nextCurrent\n    ) {\n      continue\n    }\n\n    next = {\n      ...next,\n      resources: {\n        ...next.resources,\n        [resource.id]: {\n          ...(currentState ?? { current: resource.initialValue ?? 0 }),\n          maximum: result.value,\n          current: nextCurrent,\n        },\n      },\n    }\n  }\n\n  for (const field of definition.fields) {\n    if (field.type !== 'formula') continue\n    const result = evaluateCustomFormula(field.formula, definition, next, character)\n    if (!result.ok) {\n      if (!(field.id in next.fields)) continue\n      const fields = { ...next.fields }\n      delete fields[field.id]\n      next = { ...next, fields }\n      continue\n    }\n    if (Object.is(next.fields[field.id], result.value)) continue\n    next = {\n      ...next,\n      fields: {\n        ...next.fields,\n        [field.id]: result.value,\n      },\n    }\n  }\n\n  return next\n}\n\n"""
text = replace_between(
    text,
    "export function recalculateCustomSystemState(\n",
    "export function applyCustomSystemRestRecovery(\n",
    new_recalculate,
    "lazy custom formula recalculation",
)
text = replace_once(
    text,
    """    const recalculated = systems.map((state) =>\n      recalculateCustomSystemState(state, updated),\n    )\n\n    if (sameSystemStates(systems, recalculated)) return updated\n""",
    """    const recalculated = systems.map((state) =>\n      recalculateCustomSystemState(state, updated),\n    )\n\n    if (recalculated.every((state, index) => state === systems[index])) return updated\n""",
    "reference equality for recalculated systems",
)
same_states_marker = """\nfunction sameSystemStates(\n"""
marker_index = text.find(same_states_marker)
if marker_index < 0:
    raise SystemExit("anchor not found: remove sameSystemStates")
text = text[:marker_index].rstrip() + "\n"
write(path, text)


# 4) Stop constructing a patched CharacterTemplate during render only to scope one system.
path = "src/features/characters/customSystems/CustomSystemsTab.tsx"
text = read(path)
text = replace_once(
    text,
    """  actor: CustomSystemActor\n}\n\nexport function CustomSystemsTab({ character, updateCharacter, actor }: Props) {\n  const definitions = useCustomSystemDefinitions()\n  const runtime = useOptionalSessionRuntime()\n  const states = character.get('sheet').customSystems ?? []\n""",
    """  actor: CustomSystemActor\n  systemIds?: string[]\n}\n\nexport function CustomSystemsTab({ character, updateCharacter, actor, systemIds }: Props) {\n  const definitions = useCustomSystemDefinitions()\n  const runtime = useOptionalSessionRuntime()\n  const allStates = character.get('sheet').customSystems ?? []\n  const states = systemIds?.length\n    ? allStates.filter((state) => systemIds.includes(state.systemId))\n    : allStates\n""",
    "scope CustomSystemsTab without character clone",
)
write(path, text)

path = "src/features/characters/customSystems/CustomSystemsTabWithLibrary.tsx"
text = read(path)
old_block = """      {activeStates.map((state) => {\n        const visibleCharacter = character.withSheet('customSystems', [state])\n\n        return (\n          <div\n            key={state.systemId}\n            className=\"[&>div]:!grid-cols-1 [&>div>aside]:hidden\"\n          >\n            <CustomSystemsTab\n              character={visibleCharacter}\n              updateCharacter={updateCharacter}\n              actor={actor}\n            />\n          </div>\n        )\n      })}\n"""
new_block = """      {activeStates.map((state) => (\n        <div\n          key={state.systemId}\n          className=\"[&>div]:!grid-cols-1 [&>div>aside]:hidden\"\n        >\n          <CustomSystemsTab\n            character={character}\n            updateCharacter={updateCharacter}\n            actor={actor}\n            systemIds={[state.systemId]}\n          />\n        </div>\n      ))}\n"""
text = replace_once(text, old_block, new_block, "remove render-time CharacterTemplate.withSheet")
write(path, text)


# 5) Legacy/local path: character.replace is intentionally too large for the local log.
# Do not stringify the entire character just to discover that fact on every edit.
path = "src/models/game/GameOperation.ts"
text = read(path)
text = replace_once(
    text,
    """function shouldStoreOperationRecord(record: GameOperationRecord): boolean {\n  if (!isBulkyOperation(record.operation)) return true\n\n  try {\n""",
    """function shouldStoreOperationRecord(record: GameOperationRecord): boolean {\n  if (record.operation.type === \"character.replace\") return false\n  if (!isBulkyOperation(record.operation)) return true\n\n  try {\n""",
    "skip whole-character stringify in legacy log",
)
write(path, text)


# 6) Authoritative custom-system hot path: compare only the touched state for simple operations.
path = "session-server/src/routes/characters/custom-systems/CustomSystemSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    """        if (JSON.stringify(currentState) === JSON.stringify(nextState)) {\n          sendError(webSocket, \"CUSTOM_SYSTEM_OPERATION_NO_CHANGE\", \"The requested custom-system operation does not change the current state.\");\n          return;\n        }\n""",
    """        if (!didOperationChangeState(currentState, nextState, operation)) {\n          sendError(webSocket, \"CUSTOM_SYSTEM_OPERATION_NO_CHANGE\", \"The requested custom-system operation does not change the current state.\");\n          return;\n        }\n""",
    "targeted custom system change comparison",
)
text = replace_once(
    text,
    """    if (JSON.stringify(character.toJSON()) === JSON.stringify(nextCharacter.toJSON())) {\n      sendError(webSocket, \"CUSTOM_SYSTEM_OPERATION_NO_CHANGE\", \"The requested custom-system operation does not change the current state.\");\n      return;\n    }\n""",
    """    if (\n      aggregateOperation &&\n      JSON.stringify(character.toJSON()) === JSON.stringify(nextCharacter.toJSON())\n    ) {\n      sendError(webSocket, \"CUSTOM_SYSTEM_OPERATION_NO_CHANGE\", \"The requested custom-system operation does not change the current state.\");\n      return;\n    }\n""",
    "avoid whole-character stringify for simple custom system operations",
)
text = replace_once(
    text,
    """    const hpChanged = JSON.stringify(nextHp) !== JSON.stringify(hp);\n    const conditionsChanged = JSON.stringify(nextConditions) !== JSON.stringify(conditions);\n""",
    """    const hpChanged = aggregateOperation && JSON.stringify(nextHp) !== JSON.stringify(hp);\n    const conditionsChanged = aggregateOperation && JSON.stringify(nextConditions) !== JSON.stringify(conditions);\n""",
    "avoid unchanged HP/condition serialization",
)
apply_anchor = """function applyOperation(\n"""
change_helpers = """function didOperationChangeState(\n  before: CharacterCustomSystemState,\n  after: CharacterCustomSystemState,\n  operation: Exclude<SessionCustomSystemOperation, AggregateCustomSystemOperation>,\n): boolean {\n  switch (operation.type) {\n    case \"character.customSystem.field.set\":\n    case \"character.customSystem.field.remove\":\n      return !sameSmallJson(before.fields[operation.fieldId], after.fields[operation.fieldId])\n        || Object.prototype.hasOwnProperty.call(before.fields, operation.fieldId)\n          !== Object.prototype.hasOwnProperty.call(after.fields, operation.fieldId);\n    case \"character.customSystem.resource.set\":\n    case \"character.customSystem.resource.adjust\":\n    case \"character.customSystem.resource.reset\":\n      return !sameResourceState(before.resources[operation.resourceId], after.resources[operation.resourceId]);\n    case \"character.customSystem.ability.add\":\n      return !before.abilities.some((ability) => ability.id === operation.ability.id)\n        && after.abilities.some((ability) => ability.id === operation.ability.id);\n    case \"character.customSystem.ability.remove\":\n      return before.abilities.some((ability) => ability.id === operation.abilityId)\n        && !after.abilities.some((ability) => ability.id === operation.abilityId);\n    case \"character.customSystem.ability.field.set\": {\n      const previous = before.abilities.find((ability) => ability.id === operation.abilityId);\n      const next = after.abilities.find((ability) => ability.id === operation.abilityId);\n      return !sameSmallJson(previous?.values[operation.fieldId], next?.values[operation.fieldId]);\n    }\n    case \"character.customSystem.ability.learned.set\": {\n      const previous = before.abilities.find((ability) => ability.id === operation.abilityId);\n      const next = after.abilities.find((ability) => ability.id === operation.abilityId);\n      return previous?.learned !== next?.learned;\n    }\n    case \"character.customSystem.ability.prepared.set\": {\n      const previous = before.abilities.find((ability) => ability.id === operation.abilityId);\n      const next = after.abilities.find((ability) => ability.id === operation.abilityId);\n      return previous?.prepared !== next?.prepared;\n    }\n    case \"character.customSystem.ability.usage.set\": {\n      const previous = before.abilities.find((ability) => ability.id === operation.abilityId);\n      const next = after.abilities.find((ability) => ability.id === operation.abilityId);\n      return previous?.usage?.used !== next?.usage?.used\n        || previous?.usage?.maximum !== next?.usage?.maximum;\n    }\n  }\n}\n\nfunction sameResourceState(\n  left: CharacterCustomSystemState[\"resources\"][string] | undefined,\n  right: CharacterCustomSystemState[\"resources\"][string] | undefined,\n): boolean {\n  if (!left || !right) return left === right;\n  return left.current === right.current\n    && left.maximum === right.maximum\n    && left.temporary === right.temporary;\n}\n\nfunction sameSmallJson(left: unknown, right: unknown): boolean {\n  if (Object.is(left, right)) return true;\n  if (left === null || right === null || typeof left !== \"object\" || typeof right !== \"object\") return false;\n  return JSON.stringify(left) === JSON.stringify(right);\n}\n\n"""
text = replace_once(text, apply_anchor, change_helpers + apply_anchor, "custom system change helpers")
write(path, text)


# 7) Keep reverse snapshots server-side. The UI needs only reverse type/scope metadata.
path = "session-server/src/routes/session/sessionLog.ts"
text = read(path)
text = replace_once(
    text,
    """export type SessionLogPage = {\n  records: SessionLogRecord[];\n""",
    """export type SessionClientLogRecord = Omit<SessionLogRecord, \"reverseOperation\"> & {\n  reverseOperation: Pick<SessionReverseOperation, \"type\" | \"characterId\" | \"affectedScopes\">;\n};\n\nexport type SessionLogPage = {\n  records: SessionLogRecord[];\n""",
    "client log record type",
)
text = replace_once(
    text,
    """  const page = getSessionLogPage(records, beforeLogId);\n  try {\n    socket.send(JSON.stringify({ type: \"session.hp.log\", ...page }));\n""",
    """  const page = getSessionLogPage(records, beforeLogId);\n  try {\n    socket.send(JSON.stringify({\n      type: \"session.hp.log\",\n      ...page,\n      records: page.records.map(toClientLogRecord),\n    }));\n""",
    "compact log page send",
)
text = replace_once(
    text,
    """export function broadcastSessionLogToMasters(sockets: WebSocket[], records: SessionLogRecord[]): void {\n  const page = getSessionLogPage(records);\n  const payload = JSON.stringify({ type: \"session.hp.log\", ...page });\n""",
    """export function broadcastSessionLogToMasters(sockets: WebSocket[], records: SessionLogRecord[]): void {\n  const page = getSessionLogPage(records);\n  const payload = JSON.stringify({\n    type: \"session.hp.log\",\n    ...page,\n    records: page.records.map(toClientLogRecord),\n  });\n""",
    "compact log master broadcast",
)
normalize_anchor = """function normalizeScopes(scopes: string[]): string[] {\n"""
client_helper = """function toClientLogRecord(record: SessionLogRecord): SessionClientLogRecord {\n  return {\n    id: record.id,\n    actorId: record.actorId,\n    createdAt: record.createdAt,\n    operation: record.operation,\n    reverseOperation: {\n      type: record.reverseOperation.type,\n      characterId: record.reverseOperation.characterId,\n      affectedScopes: record.reverseOperation.affectedScopes,\n    },\n    ...(record.undoneAt ? { undoneAt: record.undoneAt } : {}),\n    ...(record.undoneBy ? { undoneBy: record.undoneBy } : {}),\n  };\n}\n\n"""
text = replace_once(text, normalize_anchor, client_helper + normalize_anchor, "client log serializer")
write(path, text)


# 8) Separate timeline state from gameplay runtime context so a log message does not invalidate every character view.
path = "src/features/session-runtime/SessionRuntimeProvider.tsx"
text = read(path)
text = replace_once(text, "  hpLog: SessionLogRecord[]\n", "", "remove log from gameplay context type")
text = replace_once(text, "  undoLog: (logId: string) => boolean\n", "", "remove undo from gameplay context type")
context_anchor = """export const SessionRuntimeContext = createContext<SessionRuntimeContextValue | null>(null)\n\n"""
log_context = """export type SessionRuntimeLogContextValue = {\n  hpLog: SessionLogRecord[]\n  undoLog: (logId: string) => boolean\n}\n\nexport const SessionRuntimeContext = createContext<SessionRuntimeContextValue | null>(null)\nexport const SessionRuntimeLogContext = createContext<SessionRuntimeLogContextValue | null>(null)\n\n"""
text = replace_once(text, context_anchor, log_context, "session log context declaration")
text = replace_once(
    text,
    """    inventoryState, missionState, initiativeState, hpLog,\n""",
    """    inventoryState, missionState, initiativeState,\n""",
    "log removed from main context value",
)
text = replace_once(
    text,
    """    dispatchRaceOperation, dispatchProfileOperation, dispatchCustomClassOperation, dispatchCustomSystemOperation,\n    dispatchCharacterLifecycleOperation, undoLog,\n""",
    """    dispatchRaceOperation, dispatchProfileOperation, dispatchCustomClassOperation, dispatchCustomSystemOperation,\n    dispatchCharacterLifecycleOperation,\n""",
    "undo removed from main context value",
)
text = replace_once(text, "    hpByCharacterId, hpLog, initializeAbilities,", "    hpByCharacterId, initializeAbilities,", "log removed from main context deps")
text = replace_once(text, "    sessionCharactersById, sessionId, status, undoLog,\n", "    sessionCharactersById, sessionId, status,\n", "undo removed from main context deps")
return_anchor = """  return <SessionRuntimeContext.Provider value={value}>{children}</SessionRuntimeContext.Provider>\n}\n"""
return_replacement = """  const logValue = useMemo<SessionRuntimeLogContextValue>(() => ({\n    hpLog,\n    undoLog,\n  }), [hpLog, undoLog])\n\n  return (\n    <SessionRuntimeContext.Provider value={value}>\n      <SessionRuntimeLogContext.Provider value={logValue}>\n        {children}\n      </SessionRuntimeLogContext.Provider>\n    </SessionRuntimeContext.Provider>\n  )\n}\n"""
text = replace_once(text, return_anchor, return_replacement, "nested session log provider")
write(path, text)

path = "src/features/session-runtime/useSessionRuntime.ts"
text = read(path)
text = replace_once(
    text,
    """import { SessionRuntimeContext } from \"./SessionRuntimeProvider\"\n""",
    """import { SessionRuntimeContext, SessionRuntimeLogContext } from \"./SessionRuntimeProvider\"\n""",
    "import session log context",
)
append_anchor = """export function useSessionRuntime() {\n"""
log_hooks = """export function useOptionalSessionRuntimeLog() {\n  return useContext(SessionRuntimeLogContext)\n}\n\nexport function useSessionRuntimeLog() {\n  const context = useOptionalSessionRuntimeLog()\n  if (!context) {\n    throw new Error(\"useSessionRuntimeLog must be used inside SessionRuntimeProvider\")\n  }\n  return context\n}\n\n"""
text = replace_once(text, append_anchor, log_hooks + append_anchor, "session log hooks")
write(path, text)

path = "src/features/session/SessionActionLog.tsx"
text = read(path)
text = replace_once(
    text,
    """import { useOptionalSessionRuntime } from \"../session-runtime/useSessionRuntime\"\n""",
    """import {\n  useOptionalSessionRuntime,\n  useOptionalSessionRuntimeLog,\n} from \"../session-runtime/useSessionRuntime\"\n""",
    "session action log hook imports",
)
text = replace_once(
    text,
    """  const runtime = useOptionalSessionRuntime()\n  const sessionLog = (runtime?.hpLog ?? []) as SessionLogRecord[]\n""",
    """  const runtime = useOptionalSessionRuntime()\n  const logRuntime = useOptionalSessionRuntimeLog()\n  const sessionLog = (logRuntime?.hpLog ?? []) as SessionLogRecord[]\n""",
    "session action log state source",
)
text = replace_once(
    text,
    """                onUndo={() => runtime?.undoLog(entry.record.id)}\n""",
    """                onUndo={() => logRuntime?.undoLog(entry.record.id)}\n""",
    "session action log undo source",
)
write(path, text)

print("custom resource performance patch applied")
