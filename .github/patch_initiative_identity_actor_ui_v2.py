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
# Server initiative actor — exact anchors from current qa.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/InitiativeSessionActor.ts"
text = read(path)

text = replace_once(
    text,
    '''    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can mutate initiative state.");
      return;
    }

    if (parsed.type === "session.initiative.initialize") {
''',
    '''    if (
      connection.role !== "MASTER" &&
      !(
        parsed.type === "session.initiative.operation" &&
        parsed.operation.type === "initiative.deathSaves.set"
      )
    ) {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can mutate initiative state.");
      return;
    }

    if (parsed.type === "session.initiative.initialize") {
''',
    "player death-save exception",
)

text = replace_once(
    text,
    '''    const current = normalizeInitiativeSession(state.session as Partial<InitiativeSession>);
    const before = structuredClone(state);
    const result = applyInitiativeOperation(current, operation);
''',
    '''    const current = normalizeInitiativeSession(state.session as Partial<InitiativeSession>);
    if (connection.role !== "MASTER" && operation.type === "initiative.deathSaves.set") {
      const entry = current.entries.find((candidate) => candidate.id === operation.entryId);
      const linkedCharacterId = linkedCharacterIdForEntry(entry);
      const linkedHp = linkedCharacterId ? hp[linkedCharacterId] : undefined;
      if (
        !entry ||
        entry.sourceType !== "character" ||
        !linkedCharacterId ||
        linkedHp?.ownerUserId !== connection.userId ||
        !current.deathSaveOwnerCanEdit
      ) {
        sendError(webSocket, "DEATH_SAVES_ACCESS_DENIED", "This player cannot edit these death saves.");
        return;
      }
    }

    const before = structuredClone(state);
    const result = applyInitiativeOperation(current, operation);
''',
    "player death-save ownership validation",
)

text = replace_once(
    text,
    '''    const previousAbilities: Record<string, SessionAbilityState> = {};
    const changedAbilityIds = new Set<string>();
    if (runtimeConfig) {
''',
    '''    const previousAbilities: Record<string, SessionAbilityState> = {};
    const changedAbilityIds = new Set<string>();

    const deathSaveEntry = operation.type === "initiative.deathSaves.set"
      ? result.session.entries.find((entry) => entry.id === operation.entryId)
      : operation.type === "initiative.entry.update" && "deathSaves" in operation.patch
        ? result.session.entries.find((entry) => entry.id === operation.entryId)
        : undefined;
    const deathSaveCharacterId = linkedCharacterIdForEntry(deathSaveEntry);
    if (deathSaveEntry?.deathSaves && deathSaveCharacterId) {
      const storedAbility = abilities[deathSaveCharacterId];
      if (storedAbility?.initialized) {
        previousAbilities[deathSaveCharacterId] = structuredClone(storedAbility);
        const character = CharacterTemplate.fromJSON(
          storedAbility.character as Partial<CharacterTemplateProps>,
        );
        const updatedCharacter = character.with("deathSaves", {
          ...deathSaveEntry.deathSaves,
        });
        abilities[deathSaveCharacterId] = {
          characterId: deathSaveCharacterId,
          character: updatedCharacter.toJSON() as unknown as Record<string, unknown>,
          initialized: true,
          revision: storedAbility.revision + 1,
        };
        changedAbilityIds.add(deathSaveCharacterId);
      }
    }

    if (runtimeConfig) {
''',
    "death saves authoritative character sync",
)

text = replace_once(
    text,
    '''    case "initiative.viewMode.set": {
      if (current.viewMode === operation.viewMode) return invalid("INITIATIVE_VIEW_UNCHANGED", "Initiative already uses this view mode.");
      return { ok: true, session: { ...current, viewMode: operation.viewMode, updatedAt: Date.now() }, operation };
    }
    case "initiative.reset": {
''',
    '''    case "initiative.viewMode.set": {
      if (current.viewMode === operation.viewMode) return invalid("INITIATIVE_VIEW_UNCHANGED", "Initiative already uses this view mode.");
      return { ok: true, session: { ...current, viewMode: operation.viewMode, updatedAt: Date.now() }, operation };
    }
    case "initiative.settings.update": {
      const visibility = operation.patch.deathSaveVisibility;
      if (
        visibility !== undefined &&
        visibility !== "masterOnly" &&
        visibility !== "owner" &&
        visibility !== "everyone"
      ) {
        return invalid("INITIATIVE_SETTINGS_INVALID", "Invalid death-save visibility setting.");
      }
      if (
        operation.patch.deathSaveOwnerCanEdit !== undefined &&
        typeof operation.patch.deathSaveOwnerCanEdit !== "boolean"
      ) {
        return invalid("INITIATIVE_SETTINGS_INVALID", "Invalid death-save edit setting.");
      }
      return {
        ok: true,
        session: {
          ...current,
          ...(visibility !== undefined ? { deathSaveVisibility: visibility } : {}),
          ...(operation.patch.deathSaveOwnerCanEdit !== undefined
            ? { deathSaveOwnerCanEdit: operation.patch.deathSaveOwnerCanEdit }
            : {}),
          updatedAt: Date.now(),
        },
        operation,
      };
    }
    case "initiative.deathSaves.set": {
      const existing = current.entries.find((entry) => entry.id === operation.entryId);
      if (!existing || existing.sourceType !== "character") {
        return invalid("INITIATIVE_ENTRY_NOT_FOUND", "Player initiative entry was not found.");
      }
      if (!existing.downed && (existing.currentHp ?? 0) > 0) {
        return invalid("DEATH_SAVES_NOT_ACTIVE", "Death saves are only active while the character is downed.");
      }
      const deathSaves = {
        successes: operation.successes,
        failures: operation.failures,
      };
      return {
        ok: true,
        session: updateInitiativeEntry(current, operation.entryId, (entry) => ({
          ...entry,
          deathSaves,
        })),
        operation,
      };
    }
    case "initiative.reset": {
''',
    "initiative settings/death saves operations",
)

text = replace_once(
    text,
    '''    sourceId: optionalString(value.sourceId),
    sourceType,
    name,
    imageUrl: optionalString(value.imageUrl),
''',
    '''    sourceId: optionalString(value.sourceId),
    sourceType,
    name,
    realName: optionalString(value.realName),
    basicName: optionalString(value.basicName),
    customName: optionalString(value.customName),
    revealRealName: value.revealRealName === true,
    imageUrl: optionalString(value.imageUrl),
''',
    "normalize initiative names",
)

text = replace_once(
    text,
    '''    hidden: value.hidden === true,
    defeated: value.defeated === true,
    conditions: Array.isArray(value.conditions) ? structuredClone(value.conditions) as InitiativeEntry["conditions"] : [],
''',
    '''    hidden: value.hidden === true,
    defeated: value.defeated === true,
    downed: value.downed === true,
    defeatReason:
      value.defeatReason === "manual" || value.defeatReason === "zeroHp"
        ? value.defeatReason
        : undefined,
    deathSaves: sourceType === "character"
      ? normalizeDeathSaves(value.deathSaves)
      : undefined,
    conditions: Array.isArray(value.conditions) ? structuredClone(value.conditions) as InitiativeEntry["conditions"] : [],
''',
    "normalize initiative combat state",
)

text = replace_once(
    text,
    '''  const patch: Partial<InitiativeEntry> = {};
  if (typeof value.name === "string" && value.name.trim()) patch.name = value.name.trim();
  for (const key of ["initiative", "initiativeBonus", "dexterity", "armorClass", "currentHp", "maxHp", "temporaryHp"] as const) {
''',
    '''  const patch: Partial<InitiativeEntry> = {};
  if (typeof value.name === "string" && value.name.trim()) patch.name = value.name.trim();
  for (const key of ["realName", "basicName", "customName"] as const) {
    if (!(key in value)) continue;
    patch[key] = optionalString(value[key]);
  }
  if (typeof value.revealRealName === "boolean") patch.revealRealName = value.revealRealName;
  for (const key of ["initiative", "initiativeBonus", "dexterity", "armorClass", "currentHp", "maxHp", "temporaryHp"] as const) {
''',
    "normalize initiative name patches",
)

text = replace_once(
    text,
    '''  if (typeof value.hidden === "boolean") patch.hidden = value.hidden;
  if (typeof value.defeated === "boolean") patch.defeated = value.defeated;
  if (Array.isArray(value.conditions)) patch.conditions = structuredClone(value.conditions) as InitiativeEntry["conditions"];
''',
    '''  if (typeof value.hidden === "boolean") patch.hidden = value.hidden;
  if (typeof value.defeated === "boolean") patch.defeated = value.defeated;
  if (typeof value.downed === "boolean") patch.downed = value.downed;
  if ("defeatReason" in value) {
    patch.defeatReason = value.defeatReason === "manual" || value.defeatReason === "zeroHp"
      ? value.defeatReason
      : undefined;
  }
  if ("deathSaves" in value) patch.deathSaves = normalizeDeathSaves(value.deathSaves);
  if (Array.isArray(value.conditions)) patch.conditions = structuredClone(value.conditions) as InitiativeEntry["conditions"];
''',
    "normalize initiative combat patches",
)

text = replace_once(
    text,
    '''    started: false,
    viewMode: "table",
    createdAt: 0,
''',
    '''    started: false,
    viewMode: "table",
    deathSaveVisibility: "owner",
    deathSaveOwnerCanEdit: false,
    createdAt: 0,
''',
    "empty initiative compatibility defaults",
)

text = replace_once(
    text,
    '''function optionalFinite(value: unknown): number | undefined {
''',
    '''function linkedCharacterIdForEntry(entry: InitiativeEntry | undefined): string | undefined {
  if (!entry?.sourceId?.trim()) return undefined;
  if (entry.sourceId.startsWith("compendium:")) return undefined;
  return entry.sourceId.trim();
}

function normalizeDeathSaves(value: unknown): NonNullable<InitiativeEntry["deathSaves"]> {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const successes = typeof record.successes === "number" && Number.isFinite(record.successes)
    ? Math.max(0, Math.min(3, Math.trunc(record.successes)))
    : 0;
  const failures = typeof record.failures === "number" && Number.isFinite(record.failures)
    ? Math.max(0, Math.min(3, Math.trunc(record.failures)))
    : 0;
  return { successes, failures };
}

function optionalFinite(value: unknown): number | undefined {
''',
    "initiative actor helpers",
)
write(path, text)


# ---------------------------------------------------------------------------
# Server visibility: secret real names and death saves must not merely be
# hidden by React; they are stripped from PLAYER WebSocket payloads.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/session/visibilityDelivery.ts"
text = read(path)
text = replace_once(
    text,
    '''  if (type === "session.character.removed") {
''',
    '''  if (
    (type === "session.initiative.snapshot" || type === "session.initiative.updated") &&
    record.state &&
    typeof record.state === "object" &&
    !Array.isArray(record.state)
  ) {
    return filterInitiativeMessageForPlayer(connection, record);
  }

  if (type === "session.character.removed") {
''',
    "initiative visibility routing",
)
text = replace_once(
    text,
    '''function canReceiveCharacter(
''',
    '''function filterInitiativeMessageForPlayer(
  connection: SessionConnection,
  message: Record<string, unknown>,
): Record<string, unknown> {
  const state = message.state as Record<string, unknown>;
  const rawSession = state.session;
  if (!rawSession || typeof rawSession !== "object" || Array.isArray(rawSession)) return message;
  const session = rawSession as Record<string, unknown>;
  if (!Array.isArray(session.entries)) return message;

  const visibility = session.deathSaveVisibility;
  const entries = session.entries.map((rawEntry) => {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return rawEntry;
    const entry = rawEntry as Record<string, unknown>;
    const realName = typeof entry.realName === "string" ? entry.realName.trim() : "";
    const basicName = typeof entry.basicName === "string" ? entry.basicName.trim() : "";
    const canonicalName = typeof entry.name === "string" ? entry.name.trim() : "";
    const customName = typeof entry.customName === "string" ? entry.customName.trim() : "";
    const revealRealName = entry.revealRealName === true;
    const publicName = customName || (revealRealName ? (realName || canonicalName) : (basicName || canonicalName));
    const sourceId = typeof entry.sourceId === "string" ? entry.sourceId.trim() : "";
    const ownsEntry = Boolean(sourceId && readOwnedCharacterIds(connection)?.includes(sourceId));
    const maySeeDeathSaves = visibility === "everyone" || (visibility === "owner" && ownsEntry);

    const filtered: Record<string, unknown> = {
      ...entry,
      name: publicName,
    };
    if (!revealRealName) delete filtered.realName;
    if (!maySeeDeathSaves) delete filtered.deathSaves;
    return filtered;
  });

  return {
    ...message,
    state: {
      ...state,
      session: {
        ...session,
        entries,
      },
    },
  };
}

function canReceiveCharacter(
''',
    "initiative visibility helper",
)
write(path, text)


# ---------------------------------------------------------------------------
# Roster shared types and components.
# ---------------------------------------------------------------------------
path = "src/features/initiative/initiativeRosterTypes.ts"
text = read(path)
text = replace_once(
    text,
    '''  onOpen: (entryId: string) => void
  onCondition: (entryId: string) => void
''',
    '''  onOpen: (entryId: string) => void
  onRename?: (entryId: string) => void
  onCondition: (entryId: string) => void
''',
    "roster rename callback",
)
write(path, text)

path = "src/features/initiative/InitiativeEntryParts.tsx"
text = read(path)
text = replace_once(
    text,
    '''import type {
  InitiativeConditionDuration,
  InitiativeEntry,
  InitiativeSide,
} from "../../models/initiative/Initiative"
''',
    '''import {
  initiativeEntryDisplayName,
  type InitiativeConditionDuration,
  type InitiativeEntry,
  type InitiativeSide,
} from "../../models/initiative/Initiative"
''',
    "entry display-name import",
)
text = replace_once(
    text,
    '''  showTemporaryHp = true,
}: {
  entry: InitiativeEntry
  onOpen?: () => void
  showTemporaryHp?: boolean
}) {
''',
    '''  showTemporaryHp = true,
  viewer = "master",
}: {
  entry: InitiativeEntry
  onOpen?: () => void
  showTemporaryHp?: boolean
  viewer?: "master" | "player"
}) {
''',
    "entry identity viewer",
)
text = replace_once(text, "          {entry.name}\n", "          {initiativeEntryDisplayName(entry, viewer)}\n", "entry display name")
text = replace_once(
    text,
    '''export function TradeControls({
''',
    '''export function DeathSaveCounter({
  entry,
  editable = false,
  onChange,
}: {
  entry: InitiativeEntry
  editable?: boolean
  onChange?: (deathSaves: { successes: number; failures: number }) => void
}) {
  if (entry.sourceType !== "character" || !entry.downed) return null
  const saves = entry.deathSaves ?? { successes: 0, failures: 0 }

  function adjust(kind: "successes" | "failures", delta: number) {
    if (!editable || !onChange) return
    onChange({
      ...saves,
      [kind]: Math.max(0, Math.min(3, saves[kind] + delta)),
    })
  }

  return (
    <div className="grid gap-1 text-[10px] text-textMuted">
      <div className="font-semibold uppercase tracking-wide text-textH">
        Caído · Saves de morte
      </div>
      {(["successes", "failures"] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-1.5">
          <span className={kind === "successes" ? "text-emerald-300" : "text-danger"}>
            {kind === "successes" ? "Sucessos" : "Falhas"}
          </span>
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={[
                  "h-2.5 w-2.5 rounded-full border",
                  index < saves[kind]
                    ? kind === "successes"
                      ? "border-emerald-300 bg-emerald-300"
                      : "border-danger bg-danger"
                    : "border-border bg-bg",
                ].join(" ")}
              />
            ))}
          </div>
          {editable ? (
            <div className="ml-1 flex gap-1">
              <button type="button" className="rounded border border-border px-1" onClick={() => adjust(kind, -1)}>−</button>
              <button type="button" className="rounded border border-border px-1" onClick={() => adjust(kind, 1)}>+</button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function TradeControls({
''',
    "death save counter",
)
write(path, text)

path = "src/features/initiative/InitiativeTable.tsx"
text = read(path)
text = replace_once(text, 'import { Play, Skull, Trash2 } from "lucide-react"', 'import { Pencil, Play, Skull, Trash2 } from "lucide-react"', "table pencil")
text = replace_once(text, "  ConditionChips,\n  EntryIdentity,\n", "  ConditionChips,\n  DeathSaveCounter,\n  EntryIdentity,\n", "table death save import")
text = replace_once(text, "  onOpen,\n  onCondition,\n", "  onOpen,\n  onRename,\n  onCondition,\n", "table rename destructure")
text = replace_once(
    text,
    '''        <td className="px-3 py-3">
          <HitPointEditor entry={entry} patchEntry={patchEntry} />
        </td>
''',
    '''        <td className="px-3 py-3">
          <div className="grid gap-2">
            <HitPointEditor entry={entry} patchEntry={patchEntry} />
            <DeathSaveCounter
              entry={entry}
              editable
              onChange={(deathSaves) => patchEntry(entry.id, { deathSaves })}
            />
          </div>
        </td>
''',
    "table death save counter",
)
text = replace_once(
    text,
    '''          <div className="flex justify-end gap-1">
            <Button
''',
    '''          <div className="flex justify-end gap-1">
            {onRename ? (
              <Button size="icon" variant="ghost" title="Nome no combate" onClick={() => onRename(entry.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
''',
    "table rename button",
)
text = replace_once(
    text,
    '''                patchEntry(entry.id, { defeated: !entry.defeated })
''',
    '''                patchEntry(entry.id, {
                  defeated: !entry.defeated,
                  downed: entry.defeated ? entry.downed : false,
                  defeatReason: entry.defeated ? undefined : "manual",
                })
''',
    "table manual defeat",
)
write(path, text)

path = "src/features/initiative/InitiativeCards.tsx"
text = read(path)
text = replace_once(text, 'import { Skull, Trash2 } from "lucide-react"', 'import { Pencil, Skull, Trash2 } from "lucide-react"', "cards pencil")
text = replace_once(text, "  ConditionChips,\n  EntryIdentity,\n", "  ConditionChips,\n  DeathSaveCounter,\n  EntryIdentity,\n", "cards death save import")
text = replace_once(
    text,
    '''                    showTemporaryHp={showPrivateStats}
                  />
''',
    '''                    showTemporaryHp={showPrivateStats}
                    viewer={readOnly ? "player" : "master"}
                  />
''',
    "cards identity viewer",
)
text = replace_once(
    text,
    '''                <div className="mt-4 flex-1">
''',
    '''                {entry.downed && showPrivateStats ? (
                  <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-2">
                    <DeathSaveCounter entry={entry} />
                  </div>
                ) : null}

                <div className="mt-4 flex-1">
''',
    "cards death saves",
)
text = replace_once(
    text,
    '''                    <div className="flex gap-1">
                      <Button
''',
    '''                    <div className="flex gap-1">
                      {props.onRename ? (
                        <Button size="icon" variant="ghost" title="Nome no combate" onClick={() => props.onRename?.(entry.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
''',
    "cards rename button",
)
text = replace_once(
    text,
    '''                          props.patchEntry(entry.id, {
                            defeated: !entry.defeated,
                          })
''',
    '''                          props.patchEntry(entry.id, {
                            defeated: !entry.defeated,
                            downed: entry.defeated ? entry.downed : false,
                            defeatReason: entry.defeated ? undefined : "manual",
                          })
''',
    "cards manual defeat",
)
write(path, text)


# ---------------------------------------------------------------------------
# Master initiative view.
# ---------------------------------------------------------------------------
path = "src/views/InitiativeView.tsx"
text = read(path)
text = replace_once(text, "  advanceInitiativeTurn,\n  applyInitiativeCondition,\n", "  advanceInitiativeTurn,\n  applyInitiativeCondition,\n  initiativeEntryDisplayName,\n", "master display-name import")
text = replace_once(text, "  const [conditionTargetId, setConditionTargetId] = useState<string>()\n  const [quickSheetEntryId, setQuickSheetEntryId] = useState<string>()\n", "  const [conditionTargetId, setConditionTargetId] = useState<string>()\n  const [renameTargetId, setRenameTargetId] = useState<string>()\n  const [renameValue, setRenameValue] = useState(\"\")\n  const [quickSheetEntryId, setQuickSheetEntryId] = useState<string>()\n", "master rename state")
text = replace_once(
    text,
    '''  const conditionTarget = session.entries.find(
    (entry) => entry.id === conditionTargetId,
  )
  const quickSheetEntry = session.entries.find(
''',
    '''  const conditionTarget = session.entries.find(
    (entry) => entry.id === conditionTargetId,
  )
  const renameTarget = session.entries.find((entry) => entry.id === renameTargetId)
  const quickSheetEntry = session.entries.find(
''',
    "master rename target",
)
text = replace_once(
    text,
    '''  function addSelectedCharacter() {
''',
    '''  function openRename(entryId: string) {
    const entry = session.entries.find((candidate) => candidate.id === entryId)
    if (!entry) return
    setRenameTargetId(entryId)
    setRenameValue(entry.customName ?? "")
  }

  function addSelectedCharacter() {
''',
    "open rename",
)
text = replace_once(
    text,
    '''          name,
          imageUrl: selectedCharacter.get("profile").imageUrl,
''',
    '''          name,
          realName: name,
          basicName: name,
          revealRealName: true,
          imageUrl: selectedCharacter.get("profile").imageUrl,
''',
    "character initiative identity",
)
text = replace_once(
    text,
    '''      name: selectedCreature.unique
        ? selectedCreature.name
        : `${selectedCreature.name} ${existingCopies + index + 1}`,
      imageUrl: selectedCreature.sheetImageUrl,
''',
    '''      name: selectedCreature.unique
        ? selectedCreature.name
        : `${selectedCreature.name} ${existingCopies + index + 1}`,
      realName: selectedCreature.unique
        ? selectedCreature.name
        : `${selectedCreature.name} ${existingCopies + index + 1}`,
      basicName: selectedCreature.unique
        ? selectedCreature.basicName
        : `${selectedCreature.basicName} ${existingCopies + index + 1}`,
      revealRealName: false,
      imageUrl: selectedCreature.sheetImageUrl,
''',
    "creature initiative identity",
)
text = replace_once(
    text,
    '''                    {creature.name}
                    {disabled ? " — já adicionada" : ""}
''',
    '''                    {creature.name}
                    {creature.basicName !== creature.name ? ` — ${creature.basicName}` : ""}
                    {disabled ? " — já adicionada" : ""}
''',
    "creature selector dual name",
)
text = replace_once(text, "    onOpen: setQuickSheetEntryId,\n    onCondition: setConditionTargetId,\n", "    onOpen: setQuickSheetEntryId,\n    onRename: openRename,\n    onCondition: setConditionTargetId,\n", "roster rename hook")
text = replace_once(text, "        activeName={activeEntry?.name}\n", "        activeName={activeEntry ? initiativeEntryDisplayName(activeEntry, \"master\") : undefined}\n", "master active name")

roster_anchor = '''      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
'''
settings = '''      <section className="grid gap-3 rounded-xl border border-border bg-bg p-4 shadow-theme-sm md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="text-sm font-semibold text-textH">Saves de morte na iniciativa</div>
          <p className="mt-1 text-xs text-textMuted">
            Personagens em 0 PV ficam como Caídos; criaturas não-jogadoras são marcadas como derrotadas automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClassName}
            value={session.deathSaveVisibility}
            onChange={(event) =>
              updateSession((current) => ({
                ...current,
                deathSaveVisibility: event.target.value as typeof current.deathSaveVisibility,
                updatedAt: Date.now(),
              }))
            }
          >
            <option value="masterOnly">Oculto dos jogadores</option>
            <option value="owner">Visível apenas ao dono</option>
            <option value="everyone">Visível para todos</option>
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-textH">
            <input
              type="checkbox"
              checked={session.deathSaveOwnerCanEdit}
              onChange={(event) =>
                updateSession((current) => ({
                  ...current,
                  deathSaveOwnerCanEdit: event.target.checked,
                  updatedAt: Date.now(),
                }))
              }
            />
            Dono pode editar
          </label>
        </div>
      </section>

'''
text = replace_once(text, roster_anchor, settings + roster_anchor, "death-save settings UI")

modal_anchor = '''      {customOpen ? (
'''
rename_modal = '''      {renameTarget ? (
        <Modal title="Nome no combate" onClose={() => setRenameTargetId(undefined)} className="max-w-md">
          <div className="grid gap-3">
            <div className="text-xs text-textMuted">
              Nome verdadeiro: <strong className="text-textH">{renameTarget.realName ?? renameTarget.name}</strong>
              {renameTarget.basicName ? (
                <> · nome básico: <strong className="text-textH">{renameTarget.basicName}</strong></>
              ) : null}
            </div>
            <label className="grid gap-1 text-xs text-textMuted">
              Nome personalizado neste combate
              <Input
                value={renameValue}
                placeholder="Ex.: Snik, o goblin"
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </label>
            {renameTarget.realName && renameTarget.basicName && renameTarget.realName !== renameTarget.basicName ? (
              <label className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-textH">
                <input
                  type="checkbox"
                  checked={Boolean(renameTarget.revealRealName)}
                  onChange={(event) => patchEntry(renameTarget.id, { revealRealName: event.target.checked })}
                />
                Revelar nome verdadeiro aos jogadores
              </label>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                onClick={() => {
                  patchEntry(renameTarget.id, { customName: undefined })
                  setRenameValue("")
                }}
              >
                Limpar nome de combate
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  patchEntry(renameTarget.id, { customName: renameValue.trim() || undefined })
                  setRenameTargetId(undefined)
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

'''
text = replace_once(text, modal_anchor, rename_modal + modal_anchor, "combat rename modal")
text = replace_once(text, "          targetName={conditionTarget.name}\n", "          targetName={initiativeEntryDisplayName(conditionTarget, \"master\")}\n", "condition target master name")
text = replace_once(text, "          title={`Ficha rápida — ${quickSheetEntry.name}`}\n", "          title={`Ficha rápida — ${initiativeEntryDisplayName(quickSheetEntry, \"master\")}`}\n", "quick sheet master name")
write(path, text)


# ---------------------------------------------------------------------------
# Player initiative view — display already server-sanitized identity and enforce
# death-save visibility/editability in the UI too.
# ---------------------------------------------------------------------------
path = "src/views/InitiativePlayerView.tsx"
text = read(path)
text = replace_once(
    text,
    '''import { InitiativeCards } from "../features/initiative/InitiativeCards"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { InitiativeEntry } from "../models/initiative/Initiative"
''',
    '''import { InitiativeCards } from "../features/initiative/InitiativeCards"
import { DeathSaveCounter } from "../features/initiative/InitiativeEntryParts"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import { initiativeEntryDisplayName, type InitiativeEntry } from "../models/initiative/Initiative"
''',
    "player initiative imports",
)
text = replace_once(text, "  const { session, hydrated } = useInitiativeSession()\n  const { visibleCharacters } = useCharacterContext()\n", "  const { session, hydrated } = useInitiativeSession()\n  const runtime = useOptionalSessionRuntime()\n  const { visibleCharacters } = useCharacterContext()\n", "player runtime")
text = replace_once(
    text,
    '''  const canViewPrivateStats = (entry: InitiativeEntry) =>
    Boolean(entry.sourceId && ownedCharacterIds.has(entry.sourceId))

  const noop = () => undefined
''',
    '''  const canViewPrivateStats = (entry: InitiativeEntry) =>
    Boolean(entry.sourceId && ownedCharacterIds.has(entry.sourceId))
  const canViewDeathSaves = (entry: InitiativeEntry) =>
    Boolean(entry.deathSaves) && (
      session.deathSaveVisibility === "everyone" ||
      (session.deathSaveVisibility === "owner" && canViewPrivateStats(entry))
    )
  const canEditDeathSaves = (entry: InitiativeEntry) =>
    Boolean(
      runtime &&
      runtime.status === "connected" &&
      session.deathSaveOwnerCanEdit &&
      canViewPrivateStats(entry),
    )
  const setDeathSaves = (
    entry: InitiativeEntry,
    deathSaves: { successes: number; failures: number },
  ) => {
    if (!canEditDeathSaves(entry)) return
    runtime?.dispatchInitiativeOperation({
      type: "initiative.deathSaves.set",
      characterId: "session",
      entryId: entry.id,
      successes: deathSaves.successes,
      failures: deathSaves.failures,
    })
  }

  const noop = () => undefined
''',
    "player death save permissions",
)
text = replace_once(text, "`Turno: ${active.name}`", "`Turno: ${initiativeEntryDisplayName(active, \"player\")}`", "player active public name")
text = replace_once(
    text,
    '''              showPrivateStats={canViewPrivateStats(entry)}
            />
''',
    '''              showPrivateStats={canViewPrivateStats(entry)}
              showDeathSaves={canViewDeathSaves(entry)}
              editDeathSaves={canEditDeathSaves(entry)}
              onDeathSaves={(deathSaves) => setDeathSaves(entry, deathSaves)}
            />
''',
    "player death save row props",
)
text = replace_once(
    text,
    '''  showPrivateStats,
}: {
  entry: InitiativeEntry
  active: boolean
  showPrivateStats: boolean
}) {
''',
    '''  showPrivateStats,
  showDeathSaves,
  editDeathSaves,
  onDeathSaves,
}: {
  entry: InitiativeEntry
  active: boolean
  showPrivateStats: boolean
  showDeathSaves: boolean
  editDeathSaves: boolean
  onDeathSaves: (deathSaves: { successes: number; failures: number }) => void
}) {
''',
    "player row death-save props",
)
text = replace_once(text, "            {entry.name}\n", "            {initiativeEntryDisplayName(entry, \"player\")}\n", "player row public name")
text = replace_once(
    text,
    '''          {entry.defeated ? (
            <span className="rounded-full border border-border px-2 py-1 text-[10px] text-textMuted">
              Derrotado
            </span>
          ) : null}
''',
    '''          {entry.downed ? (
            <span className="rounded-full border border-danger/50 bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger">
              Caído
            </span>
          ) : entry.defeated ? (
            <span className="rounded-full border border-border px-2 py-1 text-[10px] text-textMuted">
              Derrotado
            </span>
          ) : null}
''',
    "player downed state",
)
condition_block = '''        {entry.conditions.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.conditions.map((condition) => (
              <span
                key={condition.id}
                title={condition.description}
                className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-[10px] text-textH"
              >
                {condition.name}
              </span>
            ))}
          </div>
        ) : null}
'''
text = replace_once(
    text,
    condition_block,
    condition_block + '''        {entry.downed && showDeathSaves ? (
          <div className="mt-2 rounded-lg border border-danger/40 bg-danger/10 p-2">
            <DeathSaveCounter
              entry={entry}
              editable={editDeathSaves}
              onChange={onDeathSaves}
            />
          </div>
        ) : null}
''',
    "player death save counter",
)
write(path, text)

print("exact initiative actor and UI patch applied")
