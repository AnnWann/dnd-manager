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
  | { type: "character.channelDivinity.restore"; characterId: string }
