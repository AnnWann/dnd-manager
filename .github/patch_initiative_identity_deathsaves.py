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
# Creature compendium: keep `name` as the canonical/real name for backwards
# compatibility and add an explicit basic/public name used by initiative.
# ---------------------------------------------------------------------------
path = "src/models/creatures/CompendiumCreature.ts"
text = read(path)
text = replace_once(
    text,
    """  id: string\n  name: string\n  category: string\n""",
    """  id: string\n  /** Nome verdadeiro/canônico conhecido pelo mestre. */\n  name: string\n  /** Nome genérico mostrado aos jogadores na iniciativa por padrão. */\n  basicName: string\n  category: string\n""",
    "creature basicName type",
)
text = replace_once(
    text,
    """    id: patch.id ?? crypto.randomUUID(),\n    name: patch.name ?? \"Nova criatura\",\n    category: patch.category ?? \"Monstro\",\n""",
    """    id: patch.id ?? crypto.randomUUID(),\n    name: patch.name ?? \"Nova criatura\",\n    basicName: patch.basicName?.trim() || patch.name?.trim() || \"Nova criatura\",\n    category: patch.category ?? \"Monstro\",\n""",
    "creature basicName create",
)
text = replace_once(
    text,
    """    id: stringValue(value.id).trim() || crypto.randomUUID(),\n    name,\n    category: stringValue(value.category, \"Monstro\"),\n""",
    """    id: stringValue(value.id).trim() || crypto.randomUUID(),\n    name,\n    basicName:\n      optionalStringValue(value.basicName) ??\n      optionalStringValue(value.publicName) ??\n      optionalStringValue(value.genericName) ??\n      name,\n    category: stringValue(value.category, \"Monstro\"),\n""",
    "creature basicName normalize",
)
write(path, text)


# Creature editor fields.
path = "src/features/creatures/CreatureEditorDialog.tsx"
text = read(path)
text = replace_once(
    text,
    """              <Field label=\"Nome\" className=\"sm:col-span-2\">\n                <Input\n                  value={draft.name}\n                  onChange={(event) => patch({ name: event.target.value })}\n                  autoFocus={!jsonOpen}\n                />\n              </Field>\n\n              <TextInput\n                label=\"Categoria\"\n""",
    """              <Field label=\"Nome verdadeiro\">\n                <Input\n                  value={draft.name}\n                  onChange={(event) => patch({ name: event.target.value })}\n                  autoFocus={!jsonOpen}\n                />\n              </Field>\n              <TextInput\n                label=\"Nome básico\"\n                value={draft.basicName}\n                placeholder=\"Ex.: Goblin, Bugbear, Cultista…\"\n                onChange={(basicName) => patch({ basicName })}\n              />\n              <p className=\"text-xs leading-5 text-textMuted sm:col-span-2\">\n                O nome básico é o que os jogadores veem na iniciativa até o mestre revelar o nome verdadeiro ou definir um nome de combate.\n              </p>\n\n              <TextInput\n                label=\"Categoria\"\n""",
    "creature editor names",
)
write(path, text)


# ---------------------------------------------------------------------------
# Initiative model: names, zero-HP state and death-save policy/state.
# ---------------------------------------------------------------------------
path = "src/models/initiative/Initiative.ts"
text = read(path)
text = replace_once(
    text,
    """export type InitiativeViewMode = \"table\" | \"cards\"\n\n""",
    """export type InitiativeViewMode = \"table\" | \"cards\"\nexport type InitiativeDeathSaveVisibility = \"masterOnly\" | \"owner\" | \"everyone\"\nexport type InitiativeDeathSaves = { successes: number; failures: number }\nexport type InitiativeDefeatReason = \"manual\" | \"zeroHp\"\n\n""",
    "initiative death save types",
)
text = replace_once(
    text,
    """  sourceType: InitiativeSourceType\n  name: string\n  imageUrl?: string\n""",
    """  sourceType: InitiativeSourceType\n  /** Nome canônico usado pelo mestre e por entradas antigas. */\n  name: string\n  /** Nome verdadeiro quando a origem possui identidade secreta. */\n  realName?: string\n  /** Nome genérico/público mostrado aos jogadores. */\n  basicName?: string\n  /** Nome definido durante o combate; tem precedência para todos. */\n  customName?: string\n  /** Revela o nome verdadeiro aos jogadores. */\n  revealRealName?: boolean\n  imageUrl?: string\n""",
    "initiative entry names",
)
text = replace_once(
    text,
    """  hidden: boolean\n  defeated: boolean\n  order: number\n""",
    """  hidden: boolean\n  defeated: boolean\n  downed?: boolean\n  defeatReason?: InitiativeDefeatReason\n  deathSaves?: InitiativeDeathSaves\n  order: number\n""",
    "initiative entry combat state",
)
text = replace_once(
    text,
    """  viewMode: InitiativeViewMode\n  createdAt: number\n""",
    """  viewMode: InitiativeViewMode\n  deathSaveVisibility: InitiativeDeathSaveVisibility\n  deathSaveOwnerCanEdit: boolean\n  createdAt: number\n""",
    "initiative session death save settings",
)
text = replace_once(
    text,
    """    viewMode: \"table\",\n    createdAt: now,\n""",
    """    viewMode: \"table\",\n    deathSaveVisibility: \"owner\",\n    deathSaveOwnerCanEdit: false,\n    createdAt: now,\n""",
    "initiative session settings defaults",
)
text = replace_once(
    text,
    """    hidden: input.hidden ?? false,\n    defeated: input.defeated ?? false,\n    order,\n""",
    """    hidden: input.hidden ?? false,\n    defeated: input.defeated ?? false,\n    downed: input.downed ?? false,\n    defeatReason: input.defeatReason,\n    deathSaves: input.deathSaves\n      ? normalizeDeathSaves(input.deathSaves)\n      : input.sourceType === \"character\"\n        ? { successes: 0, failures: 0 }\n        : undefined,\n    order,\n""",
    "initiative entry create combat state",
)
text = replace_once(
    text,
    """      hidden: Boolean(entry.hidden),\n      defeated: Boolean(entry.defeated),\n      order: finiteNumber(entry.order, index),\n""",
    """      hidden: Boolean(entry.hidden),\n      defeated: Boolean(entry.defeated),\n      downed: Boolean(entry.downed),\n      defeatReason: entry.defeatReason === \"manual\" || entry.defeatReason === \"zeroHp\"\n        ? entry.defeatReason\n        : undefined,\n      deathSaves: entry.sourceType === \"character\"\n        ? normalizeDeathSaves(entry.deathSaves)\n        : undefined,\n      revealRealName: Boolean(entry.revealRealName),\n      realName: entry.realName?.trim() || undefined,\n      basicName: entry.basicName?.trim() || undefined,\n      customName: entry.customName?.trim() || undefined,\n      order: finiteNumber(entry.order, index),\n""",
    "initiative entry normalize fields",
)
text = replace_once(
    text,
    """    viewMode: raw.viewMode === \"cards\" ? \"cards\" : \"table\",\n    createdAt: finiteNumber(raw.createdAt, now),\n""",
    """    viewMode: raw.viewMode === \"cards\" ? \"cards\" : \"table\",\n    deathSaveVisibility:\n      raw.deathSaveVisibility === \"masterOnly\" ||\n      raw.deathSaveVisibility === \"everyone\"\n        ? raw.deathSaveVisibility\n        : \"owner\",\n    deathSaveOwnerCanEdit: Boolean(raw.deathSaveOwnerCanEdit),\n    createdAt: finiteNumber(raw.createdAt, now),\n""",
    "initiative session normalize settings",
)
text = replace_once(
    text,
    """  return touchSession({\n    ...session,\n    entries: session.entries.map((entry) =>\n      entry.id === entryId ? updater(entry) : entry,\n    ),\n  })\n}\n""",
    """  return touchSession({\n    ...session,\n    entries: session.entries.map((entry) =>\n      entry.id === entryId\n        ? normalizeZeroHpState(updater(entry), entry)\n        : entry,\n    ),\n  })\n}\n""",
    "initiative update zero hp normalization",
)
# Add helpers before rollInitiative.
anchor = """export function rollInitiative(bonus = 0): number {\n"""
helpers = """export function initiativeEntryDisplayName(\n  entry: InitiativeEntry,\n  viewer: \"master\" | \"player\" = \"master\",\n): string {\n  const custom = entry.customName?.trim()\n  if (custom) return custom\n  if (viewer === \"master\") return entry.realName?.trim() || entry.name\n  if (entry.revealRealName) return entry.realName?.trim() || entry.name\n  return entry.basicName?.trim() || entry.name\n}\n\nexport function setInitiativeEntryManualDefeated(\n  entry: InitiativeEntry,\n  defeated: boolean,\n): InitiativeEntry {\n  return {\n    ...entry,\n    defeated,\n    downed: defeated ? false : entry.downed,\n    defeatReason: defeated ? \"manual\" : undefined,\n  }\n}\n\nfunction normalizeZeroHpState(\n  next: InitiativeEntry,\n  previous: InitiativeEntry,\n): InitiativeEntry {\n  if (next.currentHp === undefined) return next\n  if (next.currentHp <= 0) {\n    if (next.sourceType === \"character\") {\n      return {\n        ...next,\n        downed: true,\n        defeated: next.defeatReason === \"manual\" ? next.defeated : false,\n        deathSaves: normalizeDeathSaves(next.deathSaves),\n      }\n    }\n    return next.defeated\n      ? next\n      : { ...next, defeated: true, downed: false, defeatReason: \"zeroHp\" }\n  }\n\n  const recoveredFromZero = previous.currentHp !== undefined && previous.currentHp <= 0\n  return {\n    ...next,\n    downed: false,\n    defeated: next.defeatReason === \"zeroHp\" ? false : next.defeated,\n    defeatReason: next.defeatReason === \"zeroHp\" ? undefined : next.defeatReason,\n    deathSaves: recoveredFromZero && next.sourceType === \"character\"\n      ? { successes: 0, failures: 0 }\n      : next.deathSaves,\n  }\n}\n\nfunction normalizeDeathSaves(value: InitiativeDeathSaves | undefined): InitiativeDeathSaves {\n  return {\n    successes: clampInteger(value?.successes, 0, 3),\n    failures: clampInteger(value?.failures, 0, 3),\n  }\n}\n\nfunction clampInteger(value: unknown, minimum: number, maximum: number): number {\n  const numeric = typeof value === \"number\" && Number.isFinite(value)\n    ? Math.trunc(value)\n    : 0\n  return Math.max(minimum, Math.min(maximum, numeric))\n}\n\n"""
text = replace_once(text, anchor, helpers + anchor, "initiative helpers")
write(path, text)


# ---------------------------------------------------------------------------
# Client initiative protocol and diffing.
# ---------------------------------------------------------------------------
path = "src/features/session-runtime/initiativeSessionProtocol.ts"
text = read(path)
text = replace_once(
    text,
    """  | { type: \"initiative.viewMode.set\"; characterId: \"session\"; viewMode: \"table\" | \"cards\" }\n  | { type: \"initiative.reset\"; characterId: \"session\" }\n""",
    """  | { type: \"initiative.viewMode.set\"; characterId: \"session\"; viewMode: \"table\" | \"cards\" }\n  | { type: \"initiative.settings.update\"; characterId: \"session\"; patch: { deathSaveVisibility?: \"masterOnly\" | \"owner\" | \"everyone\"; deathSaveOwnerCanEdit?: boolean } }\n  | { type: \"initiative.deathSaves.set\"; characterId: \"session\"; entryId: string; successes: number; failures: number }\n  | { type: \"initiative.reset\"; characterId: \"session\" }\n""",
    "client initiative protocol settings/death saves",
)
write(path, text)

path = "src/hooks/useInitiativeSession.ts"
text = read(path)
text = replace_once(
    text,
    """  if (current.viewMode !== next.viewMode) {\n    return { type: \"initiative.viewMode.set\", characterId: \"session\", viewMode: next.viewMode }\n  }\n\n""",
    """  if (current.viewMode !== next.viewMode) {\n    return { type: \"initiative.viewMode.set\", characterId: \"session\", viewMode: next.viewMode }\n  }\n\n  if (\n    current.deathSaveVisibility !== next.deathSaveVisibility ||\n    current.deathSaveOwnerCanEdit !== next.deathSaveOwnerCanEdit\n  ) {\n    return {\n      type: \"initiative.settings.update\",\n      characterId: \"session\",\n      patch: {\n        deathSaveVisibility: next.deathSaveVisibility,\n        deathSaveOwnerCanEdit: next.deathSaveOwnerCanEdit,\n      },\n    }\n  }\n\n""",
    "initiative settings diff",
)
text = replace_once(
    text,
    """    \"name\",\n    \"initiative\",\n""",
    """    \"name\",\n    \"realName\",\n    \"basicName\",\n    \"customName\",\n    \"revealRealName\",\n    \"initiative\",\n""",
    "initiative name diff fields",
)
text = replace_once(
    text,
    """    \"hidden\",\n    \"defeated\",\n  ] as const) {\n""",
    """    \"hidden\",\n    \"defeated\",\n    \"downed\",\n    \"defeatReason\",\n  ] as const) {\n""",
    "initiative combat state diff fields",
)
text = replace_once(
    text,
    """  if (JSON.stringify(current.conditions) !== JSON.stringify(next.conditions)) {\n    patch.conditions = next.conditions\n  }\n""",
    """  if (JSON.stringify(current.conditions) !== JSON.stringify(next.conditions)) {\n    patch.conditions = next.conditions\n  }\n  if (JSON.stringify(current.deathSaves) !== JSON.stringify(next.deathSaves)) {\n    patch.deathSaves = next.deathSaves\n  }\n""",
    "initiative death saves diff",
)
write(path, text)


# ---------------------------------------------------------------------------
# Server initiative protocol.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/initiativeProtocol.ts"
text = read(path)
text = replace_once(
    text,
    """  | { type: \"initiative.viewMode.set\"; characterId: \"session\"; viewMode: \"table\" | \"cards\" }\n  | { type: \"initiative.reset\"; characterId: \"session\" };\n""",
    """  | { type: \"initiative.viewMode.set\"; characterId: \"session\"; viewMode: \"table\" | \"cards\" }\n  | { type: \"initiative.settings.update\"; characterId: \"session\"; patch: { deathSaveVisibility?: \"masterOnly\" | \"owner\" | \"everyone\"; deathSaveOwnerCanEdit?: boolean } }\n  | { type: \"initiative.deathSaves.set\"; characterId: \"session\"; entryId: string; successes: number; failures: number }\n  | { type: \"initiative.reset\"; characterId: \"session\" };\n""",
    "server initiative protocol types",
)
text = replace_once(
    text,
    """    case \"initiative.viewMode.set\": return operation.viewMode === \"table\" || operation.viewMode === \"cards\" ? value as SessionInitiativeClientMessage : null;\n    case \"initiative.sort\":\n""",
    """    case \"initiative.viewMode.set\": return operation.viewMode === \"table\" || operation.viewMode === \"cards\" ? value as SessionInitiativeClientMessage : null;\n    case \"initiative.settings.update\": return isRecord(operation.patch) ? value as SessionInitiativeClientMessage : null;\n    case \"initiative.deathSaves.set\": return readId(operation.entryId) && integerRange(operation.successes, 0, 3) && integerRange(operation.failures, 0, 3) ? value as SessionInitiativeClientMessage : null;\n    case \"initiative.sort\":\n""",
    "server initiative protocol parser",
)
text += """\nfunction integerRange(value: unknown, minimum: number, maximum: number): boolean {\n  return typeof value === \"number\" && Number.isInteger(value) && value >= minimum && value <= maximum;\n}\n"""
write(path, text)


# ---------------------------------------------------------------------------
# Server initiative actor: player-owned death saves, new fields and ability
# snapshot synchronization for death saves.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/InitiativeSessionActor.ts"
text = read(path)
# Allow a narrow player operation before master-only guard.
text = replace_once(
    text,
    """    if (connection.role !== \"MASTER\") {\n      sendError(webSocket, \"MASTER_REQUIRED\", \"Only the MASTER can mutate initiative state.\");\n      return;\n    }\n\n    if (parsed.type === \"session.initiative.initialize\") {\n""",
    """    if (\n      connection.role !== \"MASTER\" &&\n      !(parsed.type === \"session.initiative.operation\" && parsed.operation.type === \"initiative.deathSaves.set\")\n    ) {\n      sendError(webSocket, \"MASTER_REQUIRED\", \"Only the MASTER can mutate initiative state.\");\n      return;\n    }\n\n    if (parsed.type === \"session.initiative.initialize\") {\n""",
    "allow player death saves operation",
)
# Validate owner operation after state loaded and before apply.
text = replace_once(
    text,
    """    const current = normalizeInitiativeSession(state.session as Partial<InitiativeSession>);\n    const before = structuredClone(state);\n    const result = applyInitiativeOperation(current, operation);\n""",
    """    const current = normalizeInitiativeSession(state.session as Partial<InitiativeSession>);\n    if (connection.role !== \"MASTER\" && operation.type === \"initiative.deathSaves.set\") {\n      const entry = current.entries.find((candidate) => candidate.id === operation.entryId);\n      const linkedCharacterId = linkedCharacterIdForEntry(entry);\n      const linkedHp = linkedCharacterId ? hp[linkedCharacterId] : undefined;\n      if (\n        !entry ||\n        entry.sourceType !== \"character\" ||\n        !linkedCharacterId ||\n        linkedHp?.ownerUserId !== connection.userId ||\n        !current.deathSaveOwnerCanEdit\n      ) {\n        sendError(webSocket, \"DEATH_SAVES_ACCESS_DENIED\", \"This player cannot edit these death saves.\");\n        return;\n      }\n    }\n    const before = structuredClone(state);\n    const result = applyInitiativeOperation(current, operation);\n""",
    "validate player death saves",
)
# Sync death saves into ability snapshot before automations.
text = replace_once(
    text,
    """    const previousAbilities: Record<string, SessionAbilityState> = {};\n    const changedAbilityIds = new Set<string>();\n    if (runtimeConfig) {\n""",
    """    const previousAbilities: Record<string, SessionAbilityState> = {};\n    const changedAbilityIds = new Set<string>();\n\n    const deathSaveEntry = operation.type === \"initiative.deathSaves.set\"\n      ? result.session.entries.find((entry) => entry.id === operation.entryId)\n      : operation.type === \"initiative.entry.update\" && \"deathSaves\" in operation.patch\n        ? result.session.entries.find((entry) => entry.id === operation.entryId)\n        : undefined;\n    const deathSaveCharacterId = linkedCharacterIdForEntry(deathSaveEntry);\n    if (deathSaveEntry?.deathSaves && deathSaveCharacterId) {\n      const storedAbility = abilities[deathSaveCharacterId];\n      if (storedAbility?.initialized) {\n        previousAbilities[deathSaveCharacterId] = structuredClone(storedAbility);\n        const character = CharacterTemplate.fromJSON(storedAbility.character as Partial<CharacterTemplateProps>);\n        const updatedCharacter = character.with(\"deathSaves\", { ...deathSaveEntry.deathSaves });\n        abilities[deathSaveCharacterId] = {\n          characterId: deathSaveCharacterId,\n          character: updatedCharacter.toJSON() as unknown as Record<string, unknown>,\n          initialized: true,\n          revision: storedAbility.revision + 1,\n        };\n        changedAbilityIds.add(deathSaveCharacterId);\n      }\n    }\n\n    if (runtimeConfig) {\n""",
    "sync death saves to ability snapshot",
)
# Avoid overwriting previous snapshot during automation.
text = replace_once(
    text,
    """            if (!previousAbilities[characterId]) {\n              previousAbilities[characterId] = structuredClone(storedAbility);\n            }\n""",
    """            if (!previousAbilities[characterId]) {\n              previousAbilities[characterId] = structuredClone(storedAbility);\n            }\n""",
    "automation previous ability snapshot",
)
# Apply operation cases settings/death saves.
text = replace_once(
    text,
    """    case \"initiative.viewMode.set\": {\n      if (operation.viewMode !== \"table\" && operation.viewMode !== \"cards\") return invalid(\"INITIATIVE_VIEW_MODE_INVALID\", \"Invalid initiative view mode.\");\n      return { ok: true, session: { ...current, viewMode: operation.viewMode, updatedAt: Date.now() }, operation };\n    }\n""",
    """    case \"initiative.viewMode.set\": {\n      if (operation.viewMode !== \"table\" && operation.viewMode !== \"cards\") return invalid(\"INITIATIVE_VIEW_MODE_INVALID\", \"Invalid initiative view mode.\");\n      return { ok: true, session: { ...current, viewMode: operation.viewMode, updatedAt: Date.now() }, operation };\n    }\n    case \"initiative.settings.update\": {\n      const visibility = operation.patch.deathSaveVisibility;\n      if (visibility !== undefined && visibility !== \"masterOnly\" && visibility !== \"owner\" && visibility !== \"everyone\") {\n        return invalid(\"INITIATIVE_SETTINGS_INVALID\", \"Invalid death-save visibility setting.\");\n      }\n      if (operation.patch.deathSaveOwnerCanEdit !== undefined && typeof operation.patch.deathSaveOwnerCanEdit !== \"boolean\") {\n        return invalid(\"INITIATIVE_SETTINGS_INVALID\", \"Invalid death-save edit setting.\");\n      }\n      return {\n        ok: true,\n        session: {\n          ...current,\n          ...(visibility !== undefined ? { deathSaveVisibility: visibility } : {}),\n          ...(operation.patch.deathSaveOwnerCanEdit !== undefined ? { deathSaveOwnerCanEdit: operation.patch.deathSaveOwnerCanEdit } : {}),\n          updatedAt: Date.now(),\n        },\n        operation,\n      };\n    }\n    case \"initiative.deathSaves.set\": {\n      const existing = current.entries.find((entry) => entry.id === operation.entryId);\n      if (!existing || existing.sourceType !== \"character\") return invalid(\"INITIATIVE_ENTRY_NOT_FOUND\", \"Player initiative entry was not found.\");\n      if (!existing.downed && (existing.currentHp ?? 0) > 0) return invalid(\"DEATH_SAVES_NOT_ACTIVE\", \"Death saves are only active while the character is downed.\");\n      const deathSaves = { successes: operation.successes, failures: operation.failures };\n      return {\n        ok: true,\n        session: updateInitiativeEntry(current, operation.entryId, (entry) => ({ ...entry, deathSaves })),\n        operation,\n      };\n    }\n""",
    "initiative actor settings/death saves cases",
)
# Normalize entry input names/combat fields. Locate return block fragment.
text = replace_once(
    text,
    """    sourceType,\n    name,\n    imageUrl: typeof value.imageUrl === \"string\" && value.imageUrl.trim() ? value.imageUrl.trim() : undefined,\n""",
    """    sourceType,\n    name,\n    realName: typeof value.realName === \"string\" && value.realName.trim() ? value.realName.trim() : undefined,\n    basicName: typeof value.basicName === \"string\" && value.basicName.trim() ? value.basicName.trim() : undefined,\n    customName: typeof value.customName === \"string\" && value.customName.trim() ? value.customName.trim() : undefined,\n    revealRealName: value.revealRealName === true,\n    imageUrl: typeof value.imageUrl === \"string\" && value.imageUrl.trim() ? value.imageUrl.trim() : undefined,\n""",
    "server normalize entry names",
)
text = replace_once(
    text,
    """    defeated: value.defeated === true,\n    conditions: Array.isArray(value.conditions) ? structuredClone(value.conditions) as InitiativeEntry[\"conditions\"] : [],\n""",
    """    defeated: value.defeated === true,\n    downed: value.downed === true,\n    defeatReason: value.defeatReason === \"manual\" || value.defeatReason === \"zeroHp\" ? value.defeatReason : undefined,\n    deathSaves: sourceType === \"character\" ? normalizeDeathSaves(value.deathSaves) : undefined,\n    conditions: Array.isArray(value.conditions) ? structuredClone(value.conditions) as InitiativeEntry[\"conditions\"] : [],\n""",
    "server normalize entry combat fields",
)
# Normalize patch.
text = replace_once(
    text,
    """  if (typeof value.name === \"string\" && value.name.trim()) patch.name = value.name.trim();\n  for (const key of [\"initiative\", \"initiativeBonus\", \"dexterity\", \"armorClass\", \"currentHp\", \"maxHp\", \"temporaryHp\"] as const) {\n""",
    """  if (typeof value.name === \"string\" && value.name.trim()) patch.name = value.name.trim();\n  for (const key of [\"realName\", \"basicName\", \"customName\"] as const) {\n    if (!(key in value)) continue;\n    patch[key] = typeof value[key] === \"string\" && value[key].trim() ? value[key].trim() : undefined;\n  }\n  if (typeof value.revealRealName === \"boolean\") patch.revealRealName = value.revealRealName;\n  for (const key of [\"initiative\", \"initiativeBonus\", \"dexterity\", \"armorClass\", \"currentHp\", \"maxHp\", \"temporaryHp\"] as const) {\n""",
    "server normalize patch names",
)
text = replace_once(
    text,
    """  if (typeof value.hidden === \"boolean\") patch.hidden = value.hidden;\n  if (typeof value.defeated === \"boolean\") patch.defeated = value.defeated;\n  if (Array.isArray(value.conditions)) patch.conditions = structuredClone(value.conditions) as InitiativeEntry[\"conditions\"];\n""",
    """  if (typeof value.hidden === \"boolean\") patch.hidden = value.hidden;\n  if (typeof value.defeated === \"boolean\") patch.defeated = value.defeated;\n  if (typeof value.downed === \"boolean\") patch.downed = value.downed;\n  if (value.defeatReason === \"manual\" || value.defeatReason === \"zeroHp\" || value.defeatReason === undefined) patch.defeatReason = value.defeatReason as InitiativeEntry[\"defeatReason\"];\n  if (\"deathSaves\" in value) patch.deathSaves = normalizeDeathSaves(value.deathSaves);\n  if (Array.isArray(value.conditions)) patch.conditions = structuredClone(value.conditions) as InitiativeEntry[\"conditions\"];\n""",
    "server normalize patch combat fields",
)
# Add helper before optionalFinite or end.
helper_anchor = """function optionalFinite(value: unknown): number | undefined {\n"""
actor_helpers = """function linkedCharacterIdForEntry(entry: InitiativeEntry | undefined): string | undefined {\n  if (!entry?.sourceId?.trim()) return undefined;\n  if (entry.sourceId.startsWith(\"compendium:\")) return undefined;\n  return entry.sourceId.trim();\n}\n\nfunction normalizeDeathSaves(value: unknown): InitiativeEntry[\"deathSaves\"] {\n  const record = value && typeof value === \"object\" && !Array.isArray(value)\n    ? value as Record<string, unknown>\n    : {};\n  const successes = typeof record.successes === \"number\" && Number.isFinite(record.successes)\n    ? Math.max(0, Math.min(3, Math.trunc(record.successes)))\n    : 0;\n  const failures = typeof record.failures === \"number\" && Number.isFinite(record.failures)\n    ? Math.max(0, Math.min(3, Math.trunc(record.failures)))\n    : 0;\n  return { successes, failures };\n}\n\n"""
text = replace_once(text, helper_anchor, actor_helpers + helper_anchor, "initiative actor helpers")
write(path, text)


# ---------------------------------------------------------------------------
# Roster UI: display names, rename action, death saves and manual defeat reason.
# ---------------------------------------------------------------------------
path = "src/features/initiative/initiativeRosterTypes.ts"
text = read(path)
text = replace_once(
    text,
    """  onOpen: (entryId: string) => void\n  onCondition: (entryId: string) => void\n""",
    """  onOpen: (entryId: string) => void\n  onRename?: (entryId: string) => void\n  onCondition: (entryId: string) => void\n""",
    "roster rename prop",
)
write(path, text)

path = "src/features/initiative/InitiativeEntryParts.tsx"
text = read(path)
text = replace_once(
    text,
    """import type {\n  InitiativeConditionDuration,\n  InitiativeEntry,\n  InitiativeSide,\n} from \"../../models/initiative/Initiative\"\n""",
    """import {\n  initiativeEntryDisplayName,\n  type InitiativeConditionDuration,\n  type InitiativeEntry,\n  type InitiativeSide,\n} from \"../../models/initiative/Initiative\"\n""",
    "entry parts display helper import",
)
text = replace_once(
    text,
    """  showTemporaryHp = true,\n}: {\n  entry: InitiativeEntry\n  onOpen?: () => void\n  showTemporaryHp?: boolean\n}) {\n""",
    """  showTemporaryHp = true,\n  viewer = \"master\",\n}: {\n  entry: InitiativeEntry\n  onOpen?: () => void\n  showTemporaryHp?: boolean\n  viewer?: \"master\" | \"player\"\n}) {\n""",
    "entry identity viewer prop",
)
text = replace_once(
    text,
    """          {entry.name}\n""",
    """          {initiativeEntryDisplayName(entry, viewer)}\n""",
    "entry identity display name",
)
# Add DeathSaveCounter before TradeControls.
anchor = """export function TradeControls({\n"""
death_counter = """export function DeathSaveCounter({\n  entry,\n  editable = false,\n  onChange,\n}: {\n  entry: InitiativeEntry\n  editable?: boolean\n  onChange?: (deathSaves: { successes: number; failures: number }) => void\n}) {\n  if (entry.sourceType !== \"character\" || !entry.downed) return null\n  const saves = entry.deathSaves ?? { successes: 0, failures: 0 }\n  const set = (kind: \"successes\" | \"failures\", delta: number) => {\n    if (!editable || !onChange) return\n    onChange({\n      ...saves,\n      [kind]: Math.max(0, Math.min(3, saves[kind] + delta)),\n    })\n  }\n  return (\n    <div className=\"grid gap-1 text-[10px] text-textMuted\">\n      <div className=\"font-semibold uppercase tracking-wide text-textH\">Caído · Saves de morte</div>\n      {([\"successes\", \"failures\"] as const).map((kind) => (\n        <div key={kind} className=\"flex items-center gap-1.5\">\n          <span className={kind === \"successes\" ? \"text-emerald-300\" : \"text-danger\"}>\n            {kind === \"successes\" ? \"Sucessos\" : \"Falhas\"}\n          </span>\n          <div className=\"flex gap-1\">\n            {[0, 1, 2].map((index) => (\n              <span\n                key={index}\n                className={[\n                  \"h-2.5 w-2.5 rounded-full border\",\n                  index < saves[kind]\n                    ? kind === \"successes\" ? \"border-emerald-300 bg-emerald-300\" : \"border-danger bg-danger\"\n                    : \"border-border bg-bg\",\n                ].join(\" \")}\n              />\n            ))}\n          </div>\n          {editable ? (\n            <div className=\"ml-1 flex gap-1\">\n              <button type=\"button\" className=\"rounded border border-border px-1\" onClick={() => set(kind, -1)}>−</button>\n              <button type=\"button\" className=\"rounded border border-border px-1\" onClick={() => set(kind, 1)}>+</button>\n            </div>\n          ) : null}\n        </div>\n      ))}\n    </div>\n  )\n}\n\n"""
text = replace_once(text, anchor, death_counter + anchor, "death save counter component")
write(path, text)

path = "src/features/initiative/InitiativeTable.tsx"
text = read(path)
text = replace_once(text, "import { Play, Skull, Trash2 } from \"lucide-react\"", "import { Pencil, Play, Skull, Trash2 } from \"lucide-react\"", "table pencil icon")
text = replace_once(
    text,
    """  ArmorClassEditor,\n  ConditionChips,\n  EntryIdentity,\n""",
    """  ArmorClassEditor,\n  ConditionChips,\n  DeathSaveCounter,\n  EntryIdentity,\n""",
    "table death counter import",
)
text = replace_once(
    text,
    """  onOpen,\n  onCondition,\n""",
    """  onOpen,\n  onRename,\n  onCondition,\n""",
    "table rename destructure",
)
text = replace_once(
    text,
    """        <td className=\"px-3 py-3\">\n          <HitPointEditor entry={entry} patchEntry={patchEntry} />\n        </td>\n""",
    """        <td className=\"px-3 py-3\">\n          <div className=\"grid gap-2\">\n            <HitPointEditor entry={entry} patchEntry={patchEntry} />\n            <DeathSaveCounter\n              entry={entry}\n              editable\n              onChange={(deathSaves) => patchEntry(entry.id, { deathSaves })}\n            />\n          </div>\n        </td>\n""",
    "table death saves render",
)
text = replace_once(
    text,
    """          <div className=\"flex justify-end gap-1\">\n            <Button\n              size=\"icon\"\n              variant={entry.defeated ? \"outline\" : \"ghost\"}\n""",
    """          <div className=\"flex justify-end gap-1\">\n            {onRename ? (\n              <Button size=\"icon\" variant=\"ghost\" title=\"Nome no combate\" onClick={() => onRename(entry.id)}>\n                <Pencil className=\"h-4 w-4\" />\n              </Button>\n            ) : null}\n            <Button\n              size=\"icon\"\n              variant={entry.defeated ? \"outline\" : \"ghost\"}\n""",
    "table rename button",
)
text = replace_once(
    text,
    """                patchEntry(entry.id, { defeated: !entry.defeated })\n""",
    """                patchEntry(entry.id, {\n                  defeated: !entry.defeated,\n                  downed: entry.defeated ? entry.downed : false,\n                  defeatReason: entry.defeated ? undefined : \"manual\",\n                })\n""",
    "table manual defeat reason",
)
write(path, text)

path = "src/features/initiative/InitiativeCards.tsx"
text = read(path)
text = replace_once(text, "import { Skull, Trash2 } from \"lucide-react\"", "import { Pencil, Skull, Trash2 } from \"lucide-react\"", "cards pencil icon")
text = replace_once(
    text,
    """  ConditionChips,\n  EntryIdentity,\n  TradeControls,\n""",
    """  ConditionChips,\n  DeathSaveCounter,\n  EntryIdentity,\n  TradeControls,\n""",
    "cards death counter import",
)
text = replace_once(
    text,
    """                    showTemporaryHp={showPrivateStats}\n                  />\n""",
    """                    showTemporaryHp={showPrivateStats}\n                    viewer={readOnly ? \"player\" : \"master\"}\n                  />\n""",
    "cards viewer",
)
text = replace_once(
    text,
    """                <div className=\"mt-4 flex-1\">\n""",
    """                {entry.downed && showPrivateStats ? (\n                  <div className=\"mt-3 rounded-lg border border-danger/40 bg-danger/10 p-2\">\n                    <DeathSaveCounter entry={entry} />\n                  </div>\n                ) : null}\n\n                <div className=\"mt-4 flex-1\">\n""",
    "cards death saves render",
)
text = replace_once(
    text,
    """                    <div className=\"flex gap-1\">\n                      <Button\n""",
    """                    <div className=\"flex gap-1\">\n                      {props.onRename ? (\n                        <Button size=\"icon\" variant=\"ghost\" title=\"Nome no combate\" onClick={() => props.onRename?.(entry.id)}>\n                          <Pencil className=\"h-4 w-4\" />\n                        </Button>\n                      ) : null}\n                      <Button\n""",
    "cards rename button",
)
text = replace_once(
    text,
    """                          props.patchEntry(entry.id, {\n                            defeated: !entry.defeated,\n                          })\n""",
    """                          props.patchEntry(entry.id, {\n                            defeated: !entry.defeated,\n                            downed: entry.defeated ? entry.downed : false,\n                            defeatReason: entry.defeated ? undefined : \"manual\",\n                          })\n""",
    "cards manual defeat reason",
)
write(path, text)


# ---------------------------------------------------------------------------
# Initiative master view: compendium names, rename/reveal modal and settings.
# ---------------------------------------------------------------------------
path = "src/views/InitiativeView.tsx"
text = read(path)
text = replace_once(
    text,
    """  addInitiativeEntries,\n  advanceInitiativeTurn,\n""",
    """  addInitiativeEntries,\n  advanceInitiativeTurn,\n  initiativeEntryDisplayName,\n""",
    "initiative view display helper import",
)
text = replace_once(
    text,
    """  const [conditionTargetId, setConditionTargetId] = useState<string>()\n  const [quickSheetEntryId, setQuickSheetEntryId] = useState<string>()\n""",
    """  const [conditionTargetId, setConditionTargetId] = useState<string>()\n  const [renameTargetId, setRenameTargetId] = useState<string>()\n  const [renameValue, setRenameValue] = useState(\"\")\n  const [quickSheetEntryId, setQuickSheetEntryId] = useState<string>()\n""",
    "initiative view rename state",
)
text = replace_once(
    text,
    """  const conditionTarget = session.entries.find(\n    (entry) => entry.id === conditionTargetId,\n  )\n""",
    """  const conditionTarget = session.entries.find(\n    (entry) => entry.id === conditionTargetId,\n  )\n  const renameTarget = session.entries.find((entry) => entry.id === renameTargetId)\n""",
    "initiative view rename target",
)
# Add open rename helper before addSelectedCharacter.
text = replace_once(
    text,
    """  function addSelectedCharacter() {\n""",
    """  function openRename(entryId: string) {\n    const entry = session.entries.find((candidate) => candidate.id === entryId)\n    if (!entry) return\n    setRenameTargetId(entryId)\n    setRenameValue(entry.customName ?? \"\")\n  }\n\n  function addSelectedCharacter() {\n""",
    "initiative open rename helper",
)
# Creature entries names.
text = replace_once(
    text,
    """      name: selectedCreature.unique\n        ? selectedCreature.name\n        : `${selectedCreature.name} ${existingCopies + index + 1}`,\n      imageUrl: selectedCreature.sheetImageUrl,\n""",
    """      name: selectedCreature.unique\n        ? selectedCreature.name\n        : `${selectedCreature.name} ${existingCopies + index + 1}`,\n      realName: selectedCreature.unique\n        ? selectedCreature.name\n        : `${selectedCreature.name} ${existingCopies + index + 1}`,\n      basicName: selectedCreature.unique\n        ? selectedCreature.basicName\n        : `${selectedCreature.basicName} ${existingCopies + index + 1}`,\n      revealRealName: false,\n      imageUrl: selectedCreature.sheetImageUrl,\n""",
    "initiative creature names",
)
# Dropdown labels.
text = replace_once(
    text,
    """                    {creature.name}\n                    {disabled ? \" — já adicionada\" : \"\"}\n""",
    """                    {creature.name}{creature.basicName !== creature.name ? ` — ${creature.basicName}` : \"\"}\n                    {disabled ? \" — já adicionada\" : \"\"}\n""",
    "initiative creature dropdown names",
)
# roster rename prop.
text = replace_once(
    text,
    """    onOpen: setQuickSheetEntryId,\n    onCondition: setConditionTargetId,\n""",
    """    onOpen: setQuickSheetEntryId,\n    onRename: openRename,\n    onCondition: setConditionTargetId,\n""",
    "initiative roster rename prop",
)
# Header active name.
text = replace_once(
    text,
    """        activeName={activeEntry?.name}\n""",
    """        activeName={activeEntry ? initiativeEntryDisplayName(activeEntry, \"master\") : undefined}\n""",
    "initiative header master name",
)
# Add settings controls after quick-entry toolbar opening.
text = replace_once(
    text,
    """      <section className=\"flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg p-4 shadow-theme-sm\">\n        <Button onClick={() => setCustomOpen(true)}>\n""",
    """      <section className=\"flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg p-4 shadow-theme-sm\">\n        <Button onClick={() => setCustomOpen(true)}>\n""",
    "initiative toolbar anchor noop",
)
# Insert death save settings before roster section using combat toolbar closing + next section anchor.
anchor = """      <section className=\"rounded-xl border border-border bg-bg shadow-theme-sm\">\n        <div className=\"flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between\">\n"""
settings = """      <section className=\"grid gap-3 rounded-xl border border-border bg-bg p-4 shadow-theme-sm md:grid-cols-[minmax(0,1fr)_auto]\">\n        <div>\n          <div className=\"text-sm font-semibold text-textH\">Saves de morte na iniciativa</div>\n          <p className=\"mt-1 text-xs text-textMuted\">Personagens em 0 PV ficam como Caídos; criaturas não-jogadoras são marcadas como derrotadas automaticamente.</p>\n        </div>\n        <div className=\"flex flex-wrap items-center gap-2\">\n          <select\n            className={selectClassName}\n            value={session.deathSaveVisibility}\n            onChange={(event) => updateSession((current) => ({\n              ...current,\n              deathSaveVisibility: event.target.value as typeof current.deathSaveVisibility,\n              updatedAt: Date.now(),\n            }))}\n          >\n            <option value=\"masterOnly\">Oculto dos jogadores</option>\n            <option value=\"owner\">Visível apenas ao dono</option>\n            <option value=\"everyone\">Visível para todos</option>\n          </select>\n          <label className=\"flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-textH\">\n            <input\n              type=\"checkbox\"\n              checked={session.deathSaveOwnerCanEdit}\n              onChange={(event) => updateSession((current) => ({\n                ...current,\n                deathSaveOwnerCanEdit: event.target.checked,\n                updatedAt: Date.now(),\n              }))}\n            />\n            Dono pode editar\n          </label>\n        </div>\n      </section>\n\n"""
text = replace_once(text, anchor, settings + anchor, "initiative death save settings UI")
# Add rename modal before custom modal anchor; locate customOpen modal.
rename_anchor = """      {customOpen ? (\n"""
rename_modal = """      {renameTarget ? (\n        <Modal title=\"Nome no combate\" onClose={() => setRenameTargetId(undefined)} className=\"max-w-md\">\n          <div className=\"grid gap-3\">\n            <div className=\"text-xs text-textMuted\">\n              Mestre: <strong className=\"text-textH\">{renameTarget.realName ?? renameTarget.name}</strong>\n              {renameTarget.basicName ? <> · jogadores: <strong className=\"text-textH\">{renameTarget.basicName}</strong></> : null}\n            </div>\n            <label className=\"grid gap-1 text-xs text-textMuted\">\n              Nome personalizado durante este combate\n              <Input value={renameValue} placeholder=\"Ex.: Snik, o goblin\" onChange={(event) => setRenameValue(event.target.value)} />\n            </label>\n            {renameTarget.realName && renameTarget.basicName && renameTarget.realName !== renameTarget.basicName ? (\n              <label className=\"flex items-center gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-textH\">\n                <input\n                  type=\"checkbox\"\n                  checked={Boolean(renameTarget.revealRealName)}\n                  onChange={(event) => patchEntry(renameTarget.id, { revealRealName: event.target.checked })}\n                />\n                Revelar nome verdadeiro aos jogadores\n              </label>\n            ) : null}\n            <div className=\"flex justify-end gap-2 border-t border-border pt-3\">\n              <Button variant=\"ghost\" onClick={() => { patchEntry(renameTarget.id, { customName: undefined }); setRenameValue(\"\"); }}>Limpar apelido</Button>\n              <Button variant=\"primary\" onClick={() => { patchEntry(renameTarget.id, { customName: renameValue.trim() || undefined }); setRenameTargetId(undefined); }}>Salvar</Button>\n            </div>\n          </div>\n        </Modal>\n      ) : null}\n\n"""
text = replace_once(text, rename_anchor, rename_modal + rename_anchor, "initiative rename modal")
write(path, text)


# ---------------------------------------------------------------------------
# Player initiative: public/basic names and death-save visibility/editing.
# ---------------------------------------------------------------------------
path = "src/views/InitiativePlayerView.tsx"
text = read(path)
text = replace_once(
    text,
    """import { InitiativeCards } from \"../features/initiative/InitiativeCards\"\nimport { useInitiativeSession } from \"../hooks/useInitiativeSession\"\nimport type { InitiativeEntry } from \"../models/initiative/Initiative\"\n""",
    """import { InitiativeCards } from \"../features/initiative/InitiativeCards\"\nimport { DeathSaveCounter } from \"../features/initiative/InitiativeEntryParts\"\nimport { useOptionalSessionRuntime } from \"../features/session-runtime/useSessionRuntime\"\nimport { useInitiativeSession } from \"../hooks/useInitiativeSession\"\nimport { initiativeEntryDisplayName, type InitiativeEntry } from \"../models/initiative/Initiative\"\n""",
    "player initiative imports",
)
text = replace_once(
    text,
    """  const { session, hydrated } = useInitiativeSession()\n  const { visibleCharacters } = useCharacterContext()\n""",
    """  const { session, hydrated } = useInitiativeSession()\n  const runtime = useOptionalSessionRuntime()\n  const { visibleCharacters } = useCharacterContext()\n""",
    "player runtime",
)
# Add helpers after canViewPrivateStats.
text = replace_once(
    text,
    """  const canViewPrivateStats = (entry: InitiativeEntry) =>\n    Boolean(entry.sourceId && ownedCharacterIds.has(entry.sourceId))\n\n  const noop = () => undefined\n""",
    """  const canViewPrivateStats = (entry: InitiativeEntry) =>\n    Boolean(entry.sourceId && ownedCharacterIds.has(entry.sourceId))\n  const canViewDeathSaves = (entry: InitiativeEntry) =>\n    session.deathSaveVisibility === \"everyone\" ||\n    (session.deathSaveVisibility === \"owner\" && canViewPrivateStats(entry))\n  const canEditDeathSaves = (entry: InitiativeEntry) =>\n    Boolean(\n      runtime &&\n      runtime.status === \"connected\" &&\n      session.deathSaveOwnerCanEdit &&\n      canViewPrivateStats(entry),\n    )\n  const setDeathSaves = (entry: InitiativeEntry, deathSaves: { successes: number; failures: number }) => {\n    if (!canEditDeathSaves(entry)) return\n    runtime?.dispatchInitiativeOperation({\n      type: \"initiative.deathSaves.set\",\n      characterId: \"session\",\n      entryId: entry.id,\n      successes: deathSaves.successes,\n      failures: deathSaves.failures,\n    })\n  }\n\n  const noop = () => undefined\n""",
    "player death save helpers",
)
# Active name.
text = replace_once(text, "`Turno: ${active.name}`", "`Turno: ${initiativeEntryDisplayName(active, \"player\")}`", "player active name")
# Pass death save props to ReadOnlyEntry.
text = replace_once(
    text,
    """              showPrivateStats={canViewPrivateStats(entry)}\n            />\n""",
    """              showPrivateStats={canViewPrivateStats(entry)}\n              showDeathSaves={canViewDeathSaves(entry)}\n              editDeathSaves={canEditDeathSaves(entry)}\n              onDeathSaves={(deathSaves) => setDeathSaves(entry, deathSaves)}\n            />\n""",
    "player readonly death save props",
)
# Extend ReadOnlyEntry props.
text = replace_once(
    text,
    """  showPrivateStats,\n}: {\n  entry: InitiativeEntry\n  active: boolean\n  showPrivateStats: boolean\n}) {\n""",
    """  showPrivateStats,\n  showDeathSaves,\n  editDeathSaves,\n  onDeathSaves,\n}: {\n  entry: InitiativeEntry\n  active: boolean\n  showPrivateStats: boolean\n  showDeathSaves: boolean\n  editDeathSaves: boolean\n  onDeathSaves: (deathSaves: { successes: number; failures: number }) => void\n}) {\n""",
    "readonly entry death save props",
)
text = replace_once(text, """            {entry.name}\n""", """            {initiativeEntryDisplayName(entry, \"player\")}\n""", "player entry public name")
# Add downed badge next to defeated.
text = replace_once(
    text,
    """          {entry.defeated ? (\n            <span className=\"rounded-full border border-border px-2 py-1 text-[10px] text-textMuted\">\n              Derrotado\n            </span>\n          ) : null}\n""",
    """          {entry.downed ? (\n            <span className=\"rounded-full border border-danger/50 bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger\">\n              Caído\n            </span>\n          ) : entry.defeated ? (\n            <span className=\"rounded-full border border-border px-2 py-1 text-[10px] text-textMuted\">\n              Derrotado\n            </span>\n          ) : null}\n""",
    "player downed badge",
)
# Add counter after conditions.
text = replace_once(
    text,
    """        {entry.conditions.length ? (\n          <div className=\"mt-2 flex flex-wrap gap-1.5\">\n            {entry.conditions.map((condition) => (\n              <span\n                key={condition.id}\n                title={condition.description}\n                className=\"rounded-full border border-border bg-bg-subtle px-2 py-1 text-[10px] text-textH\"\n              >\n                {condition.name}\n              </span>\n            ))}\n          </div>\n        ) : null}\n""",
    """        {entry.conditions.length ? (\n          <div className=\"mt-2 flex flex-wrap gap-1.5\">\n            {entry.conditions.map((condition) => (\n              <span\n                key={condition.id}\n                title={condition.description}\n                className=\"rounded-full border border-border bg-bg-subtle px-2 py-1 text-[10px] text-textH\"\n              >\n                {condition.name}\n              </span>\n            ))}\n          </div>\n        ) : null}\n        {entry.downed && showDeathSaves ? (\n          <div className=\"mt-2 rounded-lg border border-danger/40 bg-danger/10 p-2\">\n            <DeathSaveCounter entry={entry} editable={editDeathSaves} onChange={onDeathSaves} />\n          </div>\n        ) : null}\n""",
    "player death save counter render",
)
write(path, text)

print("initiative identity/death-saves patch applied")
