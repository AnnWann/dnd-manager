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
# Publish creature compendium to the authoritative Worker, but never to players.
# ---------------------------------------------------------------------------
path = "src/shared/session-runtime/sessionRuntimeConfig.ts"
text = read(path)
text = replace_once(
    text,
    'import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"\n',
    'import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"\nimport type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"\n',
    "runtime creature import",
)
text = replace_once(
    text,
    '''export type SessionRuntimeConfig = {
  characters: SessionRuntimeCharacterConfig[]
  spells: Spell[]
  customSystems: CustomSystemDefinition[]
}
''',
    '''export type SessionRuntimeConfig = {
  characters: SessionRuntimeCharacterConfig[]
  spells: Spell[]
  customSystems: CustomSystemDefinition[]
  /** MASTER-only rules data used to adjudicate compendium combatants. */
  creatureCompendium: CompendiumCreature[]
}
''',
    "runtime compendium type",
)
text = replace_once(
    text,
    '''    spells: creation.spells,
    customSystems: creation.customSystems,
  }
''',
    '''    spells: creation.spells,
    customSystems: creation.customSystems,
    creatureCompendium: creation.creatureCompendium,
  }
''',
    "runtime compendium projection",
)
write(path, text)

path = "session-server/src/routes/session/runtimeConfigAccess.ts"
text = read(path)
text = replace_once(
    text,
    '''      characters: snapshot.config.characters.filter((character) =>
        canViewRuntimeCharacter(connection, character),
      ),
''',
    '''      characters: snapshot.config.characters.filter((character) =>
        canViewRuntimeCharacter(connection, character),
      ),
      // Creature stat blocks and real names are MASTER rules data. Initiative
      // visibility sends only the public projection required by players.
      creatureCompendium: [],
''',
    "hide compendium from players",
)
write(path, text)

# ---------------------------------------------------------------------------
# Client initiative protocol.
# ---------------------------------------------------------------------------
path = "src/features/session-runtime/initiativeSessionProtocol.ts"
text = read(path)
text = replace_once(
    text,
    'import type { InitiativeSession } from "../../models/initiative/Initiative"\n',
    'import type { InitiativeSession } from "../../models/initiative/Initiative"\nimport type { DamageType } from "../../models/combat/Damage"\n',
    "client damage type import",
)
text = replace_once(
    text,
    '''export type SessionInitiativeOperation =
''',
    '''export type InitiativeDamagePart = {
  amount: number
  damageType?: DamageType
  magical?: boolean
}

export type InitiativeHpApplicationResult = {
  entryId: string
  requested: number
  applied: number
  absorbedTemporary: number
  hpDelta: number
  concentrationCharacterId?: string
  concentrationDc?: number
  concentrationSource?: string
}

export type SessionInitiativeOperation =
''',
    "client initiative damage types",
)
text = replace_once(
    text,
    '  | { type: "initiative.conditions.bulk"; characterId: "session"; entryIds: string[]; mode: "add" | "remove"; condition?: Record<string, unknown>; conditionName?: string }\n',
    '''  | { type: "initiative.conditions.bulk"; characterId: "session"; entryIds: string[]; mode: "add" | "remove"; condition?: Record<string, unknown>; conditionName?: string }
  | { type: "initiative.hp.apply"; characterId: "session"; entryIds: string[]; mode: "damage"; parts: InitiativeDamagePart[]; results?: InitiativeHpApplicationResult[] }
  | { type: "initiative.hp.apply"; characterId: "session"; entryIds: string[]; mode: "heal" | "temporary"; amount: number; results?: InitiativeHpApplicationResult[] }
''',
    "client initiative hp operation",
)
write(path, text)

# ---------------------------------------------------------------------------
# Worker initiative protocol + strict validation.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/initiativeProtocol.ts"
text = read(path)
text = 'import { DAMAGE_TYPES, type DamageType } from "../../../../src/models/combat/Damage";\n\n' + text
text = replace_once(
    text,
    '''export type SessionInitiativeOperation =
''',
    '''export type InitiativeDamagePart = {
  amount: number;
  damageType?: DamageType;
  magical?: boolean;
};

export type InitiativeHpApplicationResult = {
  entryId: string;
  requested: number;
  applied: number;
  absorbedTemporary: number;
  hpDelta: number;
  concentrationCharacterId?: string;
  concentrationDc?: number;
  concentrationSource?: string;
};

export type SessionInitiativeOperation =
''',
    "worker initiative damage types",
)
text = replace_once(
    text,
    '  | { type: "initiative.conditions.bulk"; characterId: "session"; entryIds: string[]; mode: "add" | "remove"; condition?: Record<string, unknown>; conditionName?: string }\n',
    '''  | { type: "initiative.conditions.bulk"; characterId: "session"; entryIds: string[]; mode: "add" | "remove"; condition?: Record<string, unknown>; conditionName?: string }
  | { type: "initiative.hp.apply"; characterId: "session"; entryIds: string[]; mode: "damage"; parts: InitiativeDamagePart[]; results?: InitiativeHpApplicationResult[] }
  | { type: "initiative.hp.apply"; characterId: "session"; entryIds: string[]; mode: "heal" | "temporary"; amount: number; results?: InitiativeHpApplicationResult[] }
''',
    "worker initiative hp operation",
)
anchor = '''    case "initiative.customAction.execute":
      return Boolean(readId(operation.systemId))
'''
hp_parser = '''    case "initiative.hp.apply": {
      if (!validTargets(operation.entryIds)) return null;
      if (operation.mode === "damage") {
        return Array.isArray(operation.parts)
          && operation.parts.length > 0
          && operation.parts.length <= 10
          && operation.parts.every((part) => isRecord(part)
            && positiveInteger(part.amount)
            && (part.damageType === undefined || DAMAGE_TYPES.includes(part.damageType as DamageType))
            && (part.magical === undefined || typeof part.magical === "boolean"))
          ? value as SessionInitiativeClientMessage
          : null;
      }
      if (operation.mode === "heal" || operation.mode === "temporary") {
        return positiveInteger(operation.amount)
          ? value as SessionInitiativeClientMessage
          : null;
      }
      return null;
    }
'''
text = replace_once(text, anchor, hp_parser + anchor, "worker hp parser")
text = replace_once(
    text,
    '''function integerRange(value: unknown, minimum: number, maximum: number): boolean {
''',
    '''function validTargets(value: unknown): boolean {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 50
    && value.every((entryId) => Boolean(readId(entryId)));
}
function positiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1_000_000;
}

function integerRange(value: unknown, minimum: number, maximum: number): boolean {
''',
    "worker protocol helpers",
)
write(path, text)

# ---------------------------------------------------------------------------
# Compendium initiative projection: conditions use the same BonusCollection engine.
# ---------------------------------------------------------------------------
write("session-server/src/routes/initiative/initiativeCreatureProjection.ts", r'''import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import { getCreatureEffectiveArmorClass } from "../../../../src/models/creatures/CreatureCombatRuntime";
import type { InitiativeSession } from "../../../../src/models/initiative/Initiative";

export const COMPENDIUM_SOURCE_PREFIX = "compendium:";

export function projectInitiativeSessionFromCreatureState(
  session: InitiativeSession,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): { session: InitiativeSession; changed: boolean } {
  if (!runtimeConfig?.config.creatureCompendium.length) return { session, changed: false };
  const creatures = new Map(runtimeConfig.config.creatureCompendium.map((creature) => [creature.id, creature]));
  let changed = false;
  const entries = session.entries.map((entry) => {
    const creature = creatureForEntry(entry.sourceId, creatures);
    if (!creature) return entry;
    const armorClass = getCreatureEffectiveArmorClass(creature, entry.conditions, entry);
    if (entry.armorClass === armorClass) return entry;
    changed = true;
    return { ...entry, armorClass };
  });
  return {
    changed,
    session: changed ? { ...session, entries, updatedAt: Date.now() } : session,
  };
}

export function creatureIdFromSourceId(sourceId: string | undefined): string | undefined {
  return sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX)
    ? sourceId.slice(COMPENDIUM_SOURCE_PREFIX.length)
    : undefined;
}

function creatureForEntry<T extends { id: string }>(sourceId: string | undefined, creatures: Map<string, T>): T | undefined {
  const id = creatureIdFromSourceId(sourceId);
  return id ? creatures.get(id) : undefined;
}
''')

# ---------------------------------------------------------------------------
# Initiative authority resolves typed damage and creature condition projections.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/initiative/InitiativeSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    'import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";\n',
    '''import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import { resolveDamage, normalizeDamageAffinities, type DamageAffinity } from "../../../../src/models/combat/Damage";
import { getCreatureEffectiveArmorClass } from "../../../../src/models/creatures/CreatureCombatRuntime";
''',
    "initiative damage imports",
)
text = replace_once(
    text,
    '''import {
  linkedCharacterIdForInitiativeEntry,
  projectInitiativeSessionFromCharacterState,
  synchronizeInitiativeEditsToCharacterState,
} from "./initiativeCharacterProjection";
''',
    '''import {
  linkedCharacterIdForInitiativeEntry,
  projectInitiativeSessionFromCharacterState,
  synchronizeInitiativeEditsToCharacterState,
} from "./initiativeCharacterProjection";
import {
  COMPENDIUM_SOURCE_PREFIX,
  creatureIdFromSourceId,
  projectInitiativeSessionFromCreatureState,
} from "./initiativeCreatureProjection";
''',
    "initiative creature projection imports",
)
text = replace_once(
    text,
    '    const result = applyInitiativeOperation(current, operation, runtimeConfig);\n',
    '    const result = applyInitiativeOperation(current, operation, runtimeConfig, abilities, conditions);\n',
    "initiative apply context",
)
text = replace_once(
    text,
    '''    nextSession = projectInitiativeSessionFromCharacterState(
      nextSession,
      { abilities, hp, conditions },
    ).session;
''',
    '''    nextSession = projectInitiativeSessionFromCharacterState(
      nextSession,
      { abilities, hp, conditions },
    ).session;
    nextSession = projectInitiativeSessionFromCreatureState(
      nextSession,
      runtimeConfig,
    ).session;
''',
    "initiative creature projection after mutation",
)
# applyInitiativeOperation signature
text = replace_once(
    text,
    '''function applyInitiativeOperation(
  current: InitiativeSession,
  operation: SessionInitiativeOperation,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): { ok: true; session: InitiativeSession; operation: SessionInitiativeOperation } | { ok: false; code: string; message: string } {
''',
    '''function applyInitiativeOperation(
  current: InitiativeSession,
  operation: SessionInitiativeOperation,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
  abilities: Record<string, SessionAbilityState>,
  conditions: Record<string, SessionConditionsState>,
): { ok: true; session: InitiativeSession; operation: SessionInitiativeOperation } | { ok: false; code: string; message: string } {
''',
    "initiative apply signature",
)
# compendium manual AC override
old_entry_update = '''      const patch = normalizeEntryPatch(operation.patch);
      if (!Object.keys(patch).length) return invalid("INITIATIVE_PATCH_INVALID", "No supported initiative fields were supplied.");
      const session = updateInitiativeEntry(current, operation.entryId, (entry) => ({ ...entry, ...patch, id: entry.id, order: entry.order, createdAt: entry.createdAt }));
'''
new_entry_update = '''      const patch = normalizeEntryPatch(operation.patch);
      if (!Object.keys(patch).length) return invalid("INITIATIVE_PATCH_INVALID", "No supported initiative fields were supplied.");
      if (patch.armorClass !== undefined && existing.sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX)) {
        const creature = findRuntimeCreature(runtimeConfig, existing.sourceId);
        if (creature) {
          const base = existing.armorClassOverride ?? creature.armorClass ?? 10;
          const effective = getCreatureEffectiveArmorClass(creature, existing.conditions, existing);
          patch.armorClassOverride = cleanNumber(patch.armorClass - (effective - base));
        }
      }
      const session = updateInitiativeEntry(current, operation.entryId, (entry) => ({ ...entry, ...patch, id: entry.id, order: entry.order, createdAt: entry.createdAt }));
'''
text = replace_once(text, old_entry_update, new_entry_update, "initiative compendium AC override")
# Insert hp operation before conditions bulk.
anchor = '''    case "initiative.conditions.bulk": {
'''
hp_case = r'''    case "initiative.hp.apply": {
      const entryIds = Array.from(new Set(operation.entryIds));
      if (!entryIds.length || entryIds.length > 50) {
        return invalid("INITIATIVE_HP_TARGETS_INVALID", "Select between 1 and 50 initiative targets.");
      }
      if (entryIds.some((entryId) => !current.entries.some((entry) => entry.id === entryId))) {
        return invalid("INITIATIVE_ENTRY_NOT_FOUND", "One or more initiative targets were not found.");
      }

      let session = current;
      const results: NonNullable<typeof operation.results> = [];
      for (const entryId of entryIds) {
        const entry = session.entries.find((candidate) => candidate.id === entryId)!;
        if (operation.mode !== "temporary" && entry.currentHp === undefined) {
          return invalid("INITIATIVE_HP_UNAVAILABLE", `${entry.name} does not have hit points configured.`);
        }

        if (operation.mode === "damage") {
          const affinities = initiativeDamageAffinities(entry, abilities, runtimeConfig);
          const requested = operation.parts.reduce((total, part) => total + part.amount, 0);
          const applied = operation.parts.reduce(
            (total, part) => total + resolveDamage(part.amount, part.damageType, affinities, { magical: part.magical }).applied,
            0,
          );
          const temporary = Math.max(0, entry.temporaryHp ?? 0);
          const absorbedTemporary = Math.min(temporary, applied);
          const hpDamage = Math.max(0, applied - absorbedTemporary);
          const linkedCharacterId = linkedCharacterIdForInitiativeEntry(entry);
          const concentration = linkedCharacterId
            ? activeConcentration(conditions[linkedCharacterId])
            : undefined;
          session = updateInitiativeEntry(session, entryId, (target) => ({
            ...target,
            temporaryHp: Math.max(0, (target.temporaryHp ?? 0) - absorbedTemporary),
            currentHp: target.currentHp === undefined
              ? target.currentHp
              : Math.max(0, target.currentHp - hpDamage),
          }));
          results.push({
            entryId,
            requested,
            applied,
            absorbedTemporary,
            hpDelta: -hpDamage,
            ...(concentration && applied > 0 && linkedCharacterId
              ? {
                  concentrationCharacterId: linkedCharacterId,
                  concentrationDc: Math.max(10, Math.floor(applied / 2)),
                  concentrationSource: concentration.source || concentration.name,
                }
              : {}),
          });
          continue;
        }

        if (operation.mode === "heal") {
          const currentHp = Math.max(0, entry.currentHp ?? 0);
          const maximum = entry.maxHp === undefined ? currentHp + operation.amount : Math.max(0, entry.maxHp);
          const nextHp = Math.min(maximum, currentHp + operation.amount);
          session = updateInitiativeEntry(session, entryId, (target) => ({ ...target, currentHp: nextHp }));
          results.push({
            entryId,
            requested: operation.amount,
            applied: nextHp - currentHp,
            absorbedTemporary: 0,
            hpDelta: nextHp - currentHp,
          });
          continue;
        }

        const previousTemporary = Math.max(0, entry.temporaryHp ?? 0);
        session = updateInitiativeEntry(session, entryId, (target) => ({
          ...target,
          temporaryHp: Math.max(0, (target.temporaryHp ?? 0) + operation.amount),
        }));
        results.push({
          entryId,
          requested: operation.amount,
          applied: operation.amount,
          absorbedTemporary: 0,
          hpDelta: 0,
        });
      }

      return { ok: true, session, operation: { ...operation, entryIds, results } as SessionInitiativeOperation };
    }
'''
text = replace_once(text, anchor, hp_case + anchor, "initiative hp operation case")
# Helper block before addEntriesDuringCombat.
anchor = '''/**
 * Inserts reinforcements without re-sorting existing combatants.
'''
helpers = r'''function initiativeDamageAffinities(
  entry: InitiativeEntry,
  abilities: Record<string, SessionAbilityState>,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): DamageAffinity[] {
  const characterId = linkedCharacterIdForInitiativeEntry(entry);
  if (characterId) {
    const stored = abilities[characterId];
    if (stored?.initialized) {
      try {
        const character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>);
        return normalizeDamageAffinities(character.get("sheet").damageAffinities);
      } catch {
        return [];
      }
    }
  }
  return normalizeDamageAffinities(findRuntimeCreature(runtimeConfig, entry.sourceId)?.damageAffinities);
}

function findRuntimeCreature(
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
  sourceId: string | undefined,
) {
  const creatureId = creatureIdFromSourceId(sourceId);
  if (!creatureId) return undefined;
  return runtimeConfig?.config.creatureCompendium.find((creature) => creature.id === creatureId);
}

function activeConcentration(state: SessionConditionsState | undefined): SessionCondition | undefined {
  return state?.conditions.find((condition) =>
    condition.duration.type === "concentration"
    || condition.tags.includes("dnd-manager:concentrating")
    || normalizeName(condition.name) === "concentrando",
  );
}

'''
text = replace_once(text, anchor, helpers + anchor, "initiative damage helpers")
write(path, text)

# ---------------------------------------------------------------------------
# Authoritative actor projects creature AC after every relevant mutation/config publish.
# ---------------------------------------------------------------------------
path = "session-server/src/routes/session/AuthoritativeSessionActor.ts"
text = read(path)
text = replace_once(
    text,
    'import { projectInitiativeSessionFromCharacterState } from "../initiative/initiativeCharacterProjection";\n',
    'import { projectInitiativeSessionFromCharacterState } from "../initiative/initiativeCharacterProjection";\nimport { projectInitiativeSessionFromCreatureState } from "../initiative/initiativeCreatureProjection";\n',
    "authoritative creature projection import",
)
text = replace_once(
    text,
    '''  private async reconcileInitiativeProjection(): Promise<void> {
    const [initiative, abilities, hp, conditions] = await Promise.all([
      readInitiativeState(this.ctx.storage),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
    ]);
''',
    '''  private async reconcileInitiativeProjection(): Promise<void> {
    const [initiative, abilities, hp, conditions, runtimeConfig] = await Promise.all([
      readInitiativeState(this.ctx.storage),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY).then((value) => value ?? {}),
      this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY).then((value) => value ?? {}),
      readRuntimeConfig(this.ctx.storage),
    ]);
''',
    "authoritative projection reads runtime config",
)
text = replace_once(
    text,
    '''    const projection = projectInitiativeSessionFromCharacterState(current, { abilities, hp, conditions });
    if (!projection.changed) return;
    initiative.session = projection.session as unknown as Record<string, unknown>;
''',
    '''    const characterProjection = projectInitiativeSessionFromCharacterState(current, { abilities, hp, conditions });
    const creatureProjection = projectInitiativeSessionFromCreatureState(characterProjection.session, runtimeConfig);
    if (!characterProjection.changed && !creatureProjection.changed) return;
    initiative.session = creatureProjection.session as unknown as Record<string, unknown>;
''',
    "authoritative combined initiative projection",
)
write(path, text)

# ---------------------------------------------------------------------------
# Semantic log text.
# ---------------------------------------------------------------------------
path = "src/features/session/SessionActionLog.tsx"
text = read(path)
text = replace_once(
    text,
    '    case "initiative.conditions.bulk": return operation.mode === "add" ? `Aplicou uma condição em ${operation.entryIds.length} participantes da iniciativa.` : `Removeu ${operation.conditionName || "uma condição"} de ${operation.entryIds.length} participantes da iniciativa.`\n',
    '''    case "initiative.conditions.bulk": return operation.mode === "add" ? `Aplicou uma condição em ${operation.entryIds.length} participantes da iniciativa.` : `Removeu ${operation.conditionName || "uma condição"} de ${operation.entryIds.length} participantes da iniciativa.`
    case "initiative.hp.apply": {
      const count = operation.entryIds.length
      if (operation.mode === "damage") {
        const requested = operation.parts.reduce((total, part) => total + part.amount, 0)
        return `Aplicou ${requested} de dano em ${count} alvo${count === 1 ? "" : "s"} pela iniciativa.`
      }
      if (operation.mode === "heal") return `Curou ${count} alvo${count === 1 ? "" : "s"} pela iniciativa.`
      return `Adicionou PV temporários a ${count} alvo${count === 1 ? "" : "s"} pela iniciativa.`
    }
''',
    "initiative hp log",
)
write(path, text)

# ---------------------------------------------------------------------------
# Concentration alerts also understand semantic initiative damage operations.
# ---------------------------------------------------------------------------
path = "src/features/characters/characterSheet/masterConcentrationAlerts.tsx"
text = read(path)
old_loop = '''      if (
        operation.type !== "character.hp.damage" ||
        operation.requiresConcentrationCheck !== true
      ) {
        continue
      }

      const character = visibleCharacters.find(
        (entry) => entry.get("id") === operation.characterId,
      )
      incoming.push({
        id: record.id,
        characterName: character?.get("name") || "Personagem",
        damage: Math.max(0, Math.trunc(operation.amount || 0)),
        dc: Math.max(
          10,
          Math.trunc(
            operation.concentrationDc ??
              Math.max(10, Math.floor((operation.amount || 0) / 2)),
          ),
        ),
        source: operation.concentrationSource || undefined,
        expiresAt: now + ALERT_LIFETIME_MS,
      })
'''
new_loop = '''      if (operation.type === "initiative.hp.apply" && operation.mode === "damage") {
        for (const [index, result] of (operation.results ?? []).entries()) {
          if (!result.concentrationCharacterId || !result.concentrationDc || result.applied <= 0) continue
          const character = visibleCharacters.find((entry) => entry.get("id") === result.concentrationCharacterId)
          incoming.push({
            id: `${record.id}:${index}`,
            characterName: character?.get("name") || "Personagem",
            damage: Math.max(0, Math.trunc(result.applied)),
            dc: Math.max(10, Math.trunc(result.concentrationDc)),
            source: result.concentrationSource || undefined,
            expiresAt: now + ALERT_LIFETIME_MS,
          })
        }
        continue
      }

      if (
        operation.type !== "character.hp.damage" ||
        operation.requiresConcentrationCheck !== true
      ) {
        continue
      }

      const character = visibleCharacters.find(
        (entry) => entry.get("id") === operation.characterId,
      )
      incoming.push({
        id: record.id,
        characterName: character?.get("name") || "Personagem",
        damage: Math.max(0, Math.trunc(operation.amount || 0)),
        dc: Math.max(
          10,
          Math.trunc(
            operation.concentrationDc ??
              Math.max(10, Math.floor((operation.amount || 0) / 2)),
          ),
        ),
        source: operation.concentrationSource || undefined,
        expiresAt: now + ALERT_LIFETIME_MS,
      })
'''
text = replace_once(text, old_loop, new_loop, "initiative concentration alerts")
write(path, text)

print("authoritative initiative damage patch applied")
