import type { CharacterGrantedEquipmentSpellUsageSource, CharacterGrantedSpellUsageSource } from "../../../../../src/models/characters/characterGrantedSpells";
import type { SpellResourceType } from "../../../../../src/models/magic/spells/Spell";
import type { SessionDiceRollMode, SessionRollVisibility } from "../../../../../src/shared/session-runtime/diceRollProtocol";

export type SessionSpellCastPayment =
  | { type: "none" }
  | { type: "slot"; pool: "normal" | "pact"; level: number }
  | { type: "resource"; resource: SpellResourceType }
  | { type: "ability-use"; source: CharacterGrantedSpellUsageSource }
  | { type: "equipment-spell-use"; source: CharacterGrantedEquipmentSpellUsageSource };

export type SessionMagicOperation =
  | { type: "character.spell.cast"; characterId: string; requestId: string; spellIndex: string; sourceId: string; castLevel: number; mode: SessionDiceRollMode; visibility?: SessionRollVisibility; payment: SessionSpellCastPayment }
  | { type: "character.spell.prepare"; characterId: string; spellIndex: string; prepared: boolean }
  | { type: "character.spell.add"; characterId: string; spellEntry: Record<string, unknown> }
  | { type: "character.spell.remove"; characterId: string; spellIndex: string }
  | { type: "character.spell.castingDescription.add"; characterId: string; spellIndex: string }
  | { type: "character.spell.castingDescription.update"; characterId: string; spellIndex: string; descriptionIndex: number; description: string }
  | { type: "character.spell.castingDescription.remove"; characterId: string; spellIndex: string; descriptionIndex: number }
  | { type: "character.spellSlot.spend"; characterId: string; level: number }
  | { type: "character.spellSlot.restore"; characterId: string; level: number }
  | { type: "character.pactSlot.spend"; characterId: string }
  | { type: "character.pactSlot.restore"; characterId: string }
  | { type: "character.customSpellSlot.spend"; characterId: string; poolId: string; level: number }
  | { type: "character.customSpellSlot.restore"; characterId: string; poolId: string; level: number }
  | { type: "character.metamagic.add"; characterId: string; metamagicId: string }
  | { type: "character.metamagic.remove"; characterId: string; metamagicId: string }
  | { type: "character.sorceryPoint.spend"; characterId: string }
  | { type: "character.sorceryPoint.restore"; characterId: string }
  | { type: "character.ki.spend"; characterId: string }
  | { type: "character.ki.restore"; characterId: string }
  | { type: "character.channelDivinity.spend"; characterId: string }
  | { type: "character.channelDivinity.restore"; characterId: string };

export type SessionMagicClientMessage =
  | {
      type: "session.magic.operation";
      operation: SessionMagicOperation;
    }
  | {
      type: "session.magic.operations";
      operations: SessionMagicOperation[];
    };

const MAX_MAGIC_BATCH_OPERATIONS = 200;
const SPELL_SOURCE_TYPES = new Set(["class", "feat", "ability", "race", "equipment"]);
const ATTRIBUTES = new Set(["str", "dex", "con", "int", "wis", "cha"]);
const ACQUISITION_SOURCE_TYPES = new Set([
  "characterCreation",
  "class",
  "race",
  "background",
  "feat",
  "ability",
  "equipment",
  "campaign",
  "manual",
  "import",
]);
const ACQUISITION_REASONS = new Set([
  "character-creation",
  "level-up",
  "manual",
  "import",
  "campaign-grant",
]);

export function parseMagicClientMessage(raw: string): SessionMagicClientMessage | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed)) return null;

  if (parsed.type === "session.magic.operation") {
    return isMagicOperation(parsed.operation)
      ? { type: parsed.type, operation: parsed.operation }
      : null;
  }

  if (parsed.type === "session.magic.operations") {
    if (
      !Array.isArray(parsed.operations)
      || parsed.operations.length < 1
      || parsed.operations.length > MAX_MAGIC_BATCH_OPERATIONS
      || !parsed.operations.every(isMagicOperation)
    ) {
      return null;
    }

    const characterId = parsed.operations[0]?.characterId;
    if (!characterId || !parsed.operations.every((operation) => operation.characterId === characterId)) {
      return null;
    }

    return { type: parsed.type, operations: parsed.operations };
  }

  return null;
}

function isMagicOperation(value: unknown): value is SessionMagicOperation {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.characterId !== "string" || !value.characterId.trim()) return false;
  switch (value.type) {
    case "character.spell.cast":
      return nonEmpty(value.requestId)
        && value.requestId.length <= 120
        && nonEmpty(value.spellIndex)
        && value.spellIndex.length <= 200
        && nonEmpty(value.sourceId)
        && value.sourceId.length <= 200
        && integer(value.castLevel)
        && value.castLevel >= 0
        && value.castLevel <= 9
        && (value.mode === "normal" || value.mode === "advantage" || value.mode === "disadvantage")
        && (
          value.visibility === undefined
          || value.visibility === "public"
          || value.visibility === "roller-master"
        )
        && isSpellCastPayment(value.payment);
    case "character.spell.prepare": return nonEmpty(value.spellIndex) && typeof value.prepared === "boolean";
    case "character.spell.add": return isKnownSpellEntry(value.spellEntry);
    case "character.spell.remove": return nonEmpty(value.spellIndex);
    case "character.spell.castingDescription.add": return nonEmpty(value.spellIndex);
    case "character.spell.castingDescription.update": return nonEmpty(value.spellIndex) && integer(value.descriptionIndex) && typeof value.description === "string";
    case "character.spell.castingDescription.remove": return nonEmpty(value.spellIndex) && integer(value.descriptionIndex);
    case "character.spellSlot.spend":
    case "character.spellSlot.restore": return slotLevel(value.level);
    case "character.pactSlot.spend":
    case "character.pactSlot.restore":
    case "character.sorceryPoint.spend":
    case "character.sorceryPoint.restore":
    case "character.ki.spend":
    case "character.ki.restore":
    case "character.channelDivinity.spend":
    case "character.channelDivinity.restore": return true;
    case "character.customSpellSlot.spend":
    case "character.customSpellSlot.restore": return nonEmpty(value.poolId) && slotLevel(value.level);
    case "character.metamagic.add":
    case "character.metamagic.remove": return nonEmpty(value.metamagicId);
    default: return false;
  }
}

function isSpellCastPayment(value: unknown): value is SessionSpellCastPayment {
  if (!isRecord(value) || !nonEmpty(value.type)) return false;
  if (value.type === "none") return true;
  if (value.type === "slot") {
    return (value.pool === "normal" || value.pool === "pact") && slotLevel(value.level);
  }
  if (value.type === "resource") {
    return value.resource === "ki"
      || value.resource === "sorceryPoints"
      || value.resource === "channelDivinity";
  }
  if (value.type === "ability-use") return isGrantedSpellUsageSource(value.source);
  if (value.type === "equipment-spell-use") return isEquipmentSpellUsageSource(value.source);
  return false;
}

function isEquipmentSpellUsageSource(
  value: unknown,
): value is CharacterGrantedEquipmentSpellUsageSource {
  return isRecord(value)
    && nonEmpty(value.itemId)
    && value.itemId.length <= 200
    && nonEmpty(value.spellIndex)
    && value.spellIndex.length <= 200;
}

function isGrantedSpellUsageSource(value: unknown): value is CharacterGrantedSpellUsageSource {
  if (!isRecord(value) || !nonEmpty(value.type) || !nonEmpty(value.abilityId)) return false;
  if (value.type === "character" || value.type === "race") return true;
  if (value.type === "equipment") return nonEmpty(value.itemId);
  if (value.type === "condition") return nonEmpty(value.conditionId);
  return false;
}

function isKnownSpellEntry(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  const spells = value.spells;
  const source = value.source;
  if (!isRecord(spells) || !nonEmpty(spells.id) || typeof spells.prepared !== "boolean") return false;
  if (!isRecord(source)) return false;
  if (!nonEmpty(source.type) || !SPELL_SOURCE_TYPES.has(source.type)) return false;
  if (!nonEmpty(source.name) || !nonEmpty(source.sourceId)) return false;
  if (!nonEmpty(source.attribute) || !ATTRIBUTES.has(source.attribute)) return false;
  if (source.extendedList !== undefined && typeof source.extendedList !== "boolean") return false;

  if (value.acquisition !== undefined && !isAcquisition(value.acquisition)) return false;
  return true;
}

function isAcquisition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!nonEmpty(value.eventId) || !nonEmpty(value.addedAt)) return false;
  if (!integer(value.characterLevel)) return false;
  if (!nonEmpty(value.sourceType) || !ACQUISITION_SOURCE_TYPES.has(value.sourceType)) return false;
  if (!nonEmpty(value.reason) || !ACQUISITION_REASONS.has(value.reason)) return false;

  if (value.className !== undefined && !nonEmpty(value.className)) return false;
  if (value.classLevel !== undefined && !integer(value.classLevel)) return false;
  if (value.sourceId !== undefined && !nonEmpty(value.sourceId)) return false;
  if (value.sourceName !== undefined && !nonEmpty(value.sourceName)) return false;
  if (value.notes !== undefined && typeof value.notes !== "string") return false;
  return true;
}

function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
function slotLevel(value: unknown): value is number { return integer(value) && value >= 1 && value <= 9; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
