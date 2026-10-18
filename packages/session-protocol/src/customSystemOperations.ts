export type SessionCustomSystemOperation<TJson, TResource, TAbility> =
  | { type: "character.customSystem.field.set"; characterId: string; systemId: string; fieldId: string; value: TJson }
  | { type: "character.customSystem.field.remove"; characterId: string; systemId: string; fieldId: string }
  | { type: "character.customSystem.resource.set"; characterId: string; systemId: string; resourceId: string; state: TResource }
  | { type: "character.customSystem.resource.adjust"; characterId: string; systemId: string; resourceId: string; amount: number }
  | { type: "character.customSystem.resource.reset"; characterId: string; systemId: string; resourceId: string }
  | { type: "character.customSystem.ability.add"; characterId: string; systemId: string; ability: TAbility }
  | { type: "character.customSystem.ability.remove"; characterId: string; systemId: string; abilityId: string }
  | { type: "character.customSystem.ability.field.set"; characterId: string; systemId: string; abilityId: string; fieldId: string; value: TJson }
  | { type: "character.customSystem.ability.learned.set"; characterId: string; systemId: string; abilityId: string; learned: boolean }
  | { type: "character.customSystem.ability.prepared.set"; characterId: string; systemId: string; abilityId: string; prepared: boolean }
  | { type: "character.customSystem.ability.usage.set"; characterId: string; systemId: string; abilityId: string; used: number }
  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string; rollValue?: number; rollDice?: string; rollTotal?: number; rollDamageValues?: number[]; rollSummary?: string[]; activationLevel?: number; visibility?: "public" | "roller-master" }
  | { type: "character.customSystem.action.execute"; characterId: string; systemId: string; actionId: string; rollValue?: number; rollDice?: string; rollTotal?: number; rollDamageValues?: number[]; rollSummary?: string[]; activationLevel?: number; visibility?: "public" | "roller-master" }
  | { type: "character.customSystem.collection.entry.add"; characterId: string; systemId: string; collectionId: string; entryId: string }
  | { type: "character.customSystem.collection.entry.remove"; characterId: string; systemId: string; collectionId: string; entryId: string }
  | { type: "character.customSystem.collection.entry.field.set"; characterId: string; systemId: string; collectionId: string; entryId: string; fieldId: string; value: TJson }
  | { type: "character.customSystem.automation.execute"; characterId: string; systemId: string; automationId: string }

export type SessionCustomSystemClientMessage<TJson, TResource, TAbility> = {
  type: "session.customSystem.operation"
  operation: SessionCustomSystemOperation<TJson, TResource, TAbility>
}
