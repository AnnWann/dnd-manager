export type SessionMagicOperation =
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

export type SessionMagicClientMessage = {
  type: "session.magic.operation";
  operation: SessionMagicOperation;
};

export function parseMagicClientMessage(raw: string): SessionMagicClientMessage | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed) || parsed.type !== "session.magic.operation" || !isMagicOperation(parsed.operation)) return null;
  return { type: "session.magic.operation", operation: parsed.operation };
}

function isMagicOperation(value: unknown): value is SessionMagicOperation {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.characterId !== "string" || !value.characterId.trim()) return false;
  switch (value.type) {
    case "character.spell.prepare": return nonEmpty(value.spellIndex) && typeof value.prepared === "boolean";
    case "character.spell.add": return isRecord(value.spellEntry);
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

function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
function slotLevel(value: unknown): value is number { return integer(value) && value >= 1 && value <= 9; }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
